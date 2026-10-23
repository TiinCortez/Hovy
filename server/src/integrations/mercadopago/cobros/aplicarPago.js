import * as repoPorDefecto from './cobrosRepository.js';
import { resolverTransicion, requiereRegistroDePago } from './estadoPago.js';

// Applies a payment read from Mercado Pago to a cobro. Shared by the webhook (the
// provider tells us) and the active check (we ask the provider), so both end in
// exactly the same state:
//   1. a Pendiente cobro moves to the final state of the payment (Aprobado only if
//      the amount and currency match);
//   2. an approved payment of a turno is recorded in the client's account (payment,
//      credit, cobrado flag) with the idempotent database function. It also covers
//      a cobro approved earlier whose registration failed.
// Resolves { cobro } with the cobro as it is now, or { dbError } when something
// failed and the caller should retry (the webhook answers 5xx so Mercado Pago
// notifies again).
export const aplicarPagoACobro = async (cobro, pago, repo = repoPorDefecto) => {
  const { nuevoEstado, motivo } = resolverTransicion(cobro, pago);
  let actual = cobro;

  if (nuevoEstado) {
    const { dbError } = await repo.transicionarDesdePendiente(cobro.id, nuevoEstado, pago.id);
    if (dbError) return { dbError };
    console.log(`[cobros] cobro ${cobro.id} -> ${nuevoEstado}`);
    actual = { ...cobro, estado: nuevoEstado, mp_payment_id: String(pago.id) };
  } else if (motivo === 'monto_no_coincide') {
    console.error(`[cobros] monto o moneda no coinciden en el cobro ${cobro.id}; no se aprueba`);
  }

  if (requiereRegistroDePago(actual, pago)) {
    const registro = await repo.registrarPagoCobro(cobro.id);
    if (registro.dbError) {
      console.error(`[cobros] no se pudo registrar en la cuenta el pago del cobro ${cobro.id}`);
      return { dbError: registro.dbError };
    }
    console.log(`[cobros] pago del cobro ${cobro.id} registrado (${registro.data?.motivo ?? 'ok'})`);
  }

  return { cobro: actual };
};
