// Pure helpers: payment status mapping, amount checks and state transitions.

const MAPA_ESTADOS = {
  approved: 'Aprobado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
  expired: 'Expirado',
};

// Returns the cobro state for a final provider status, or null when the status
// is non-final/unknown (pending, in_process, authorized, ...) and nothing changes.
export const mapearEstadoPago = (status) =>
  (typeof status === 'string' && Object.hasOwn(MAPA_ESTADOS, status)) ? MAPA_ESTADOS[status] : null;

const aCentavos = (valor) => {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

export const montoCoincide = (cobro, pago) => {
  const esperado = aCentavos(cobro?.monto);
  const recibido = typeof pago?.transaction_amount === 'number' ? aCentavos(pago.transaction_amount) : null;
  return esperado !== null && recibido !== null && esperado === recibido && pago.currency_id === 'ARS';
};

// Returns { nuevoEstado } where null means "leave the cobro unchanged".
// Rules: only Pendiente cobros move; an Aprobado cobro is final; approval
// requires the paid amount/currency to match what the cobro asked for.
export const resolverTransicion = (cobro, pago) => {
  if (cobro?.estado !== 'Pendiente') return { nuevoEstado: null, motivo: 'estado_final' };
  const destino = mapearEstadoPago(pago?.status);
  if (!destino) return { nuevoEstado: null, motivo: 'estado_no_final' };
  if (destino === 'Aprobado' && !montoCoincide(cobro, pago)) {
    return { nuevoEstado: null, motivo: 'monto_no_coincide' };
  }
  return { nuevoEstado: destino };
};

// From the results of Mercado Pago's payment search (newest first), the payment
// to apply to a cobro: an approved one if there is any (a client may fail once and
// then pay), otherwise the most recent. null when there is none.
export const elegirPagoDeBusqueda = (resultados) => {
  if (!Array.isArray(resultados) || resultados.length === 0) return null;
  return resultados.find((pago) => pago?.status === 'approved') ?? resultados[0];
};

// True when the payment of a turno's cobro still has to be recorded in the
// client's account: the cobro is Aprobado (just now, or in an earlier notification
// whose registration failed), it belongs to a turno and has no pago yet. The
// provider status is checked again so a refunded payment is never registered.
export const requiereRegistroDePago = (cobro, pago) =>
  cobro?.estado === 'Aprobado' && Boolean(cobro.id_turno) && !cobro.id_pago && pago?.status === 'approved';

// A valid amount is a JS number > 0 with at most 2 decimals; otherwise null.
export const validarMonto = (valor) => {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) return null;
  if (Math.abs(valor * 100 - Math.round(valor * 100)) > 1e-6) return null;
  return valor;
};
