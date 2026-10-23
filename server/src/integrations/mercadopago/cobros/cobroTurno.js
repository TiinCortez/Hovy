import { falla } from '../../../utils/solicitudesVisita.js';
import { validarMonto } from './estadoPago.js';
import { EXPIRACION_MS } from './preferenciaPayload.js';

// Pure rules to charge a turno with a Mercado Pago payment link (no I/O).
//
// What the client owes for a job comes from the account ledger (movimientos_cuenta):
// the Debito created when the turno was marked Realizado, plus any later Ajuste,
// minus the payments already made. The ledger is immutable, so this sum is the
// source of truth; the budget total is only a fallback when there are no movements.

const MAX_DESCRIPCION = 120;

// A link is not handed out again when it is about to expire: the client could
// open it and find it dead.
const MARGEN_VENCIMIENTO_MS = 30 * 60 * 1000;

// True when the pending cobro still has a usable link (it was created recently
// enough that the Mercado Pago preference has not expired).
const linkVigente = (cobro, ahora) => {
  const creado = Date.parse(cobro.created_at);
  return Boolean(cobro.init_point) && Number.isFinite(creado) && ahora - creado < EXPIRACION_MS - MARGEN_VENCIMIENTO_MS;
};

// Debito / Ajuste_Debito raise what the client owes, Credito / Ajuste_Credito lower it.
const SIGNO = { Debito: 1, Ajuste_Debito: 1, Credito: -1, Ajuste_Credito: -1 };

const aCentavos = (valor) => Math.round(Number(valor) * 100);

// Outstanding amount of one job from its movements, or null when there are none.
// Summed in cents so floating point errors never reach the amount to charge.
export const calcularPendienteTrabajo = (movimientos) => {
  if (!Array.isArray(movimientos) || movimientos.length === 0) return null;

  let centavos = 0;
  for (const movimiento of movimientos) {
    const signo = SIGNO[movimiento?.tipo];
    if (signo) centavos += signo * aCentavos(movimiento.monto);
  }
  return centavos / 100;
};

// Decides what to do when someone asks for the payment link of a turno.
//  - { error }: it cannot be charged (message in Spanish, ready to show).
//  - { accion: 'reutilizar', cobro }: there is already a pending link for exactly
//    the amount owed that has not expired, so the same QR is given again.
//  - { accion: 'crear', monto, descripcion, cancelar }: a new link is needed;
//    `cancelar` lists the stale pending cobros (different amount, expired link,
//    or without link).
export const planificarCobroTurno = ({
  turno,
  movimientos,
  presupuesto,
  cobrosActivos,
  servicio,
  ahora = Date.now(),
}) => {
  if (!turno) return falla(404, 'No existe un turno con ese id.');

  if (turno.estado !== 'Realizado') {
    return falla(409, `El turno tiene que estar Realizado para cobrarlo (estado actual: ${turno.estado}).`);
  }

  const activos = Array.isArray(cobrosActivos) ? cobrosActivos : [];
  if (turno.cobrado === true || activos.some((cobro) => cobro.estado === 'Aprobado')) {
    return falla(409, 'Este turno ya fue cobrado.');
  }

  let monto = calcularPendienteTrabajo(movimientos);
  if (monto === null) {
    if (!presupuesto || presupuesto.estado !== 'Aceptado') {
      return falla(409, 'El turno no tiene un presupuesto aceptado para cobrar.');
    }
    monto = Number(presupuesto.monto_total);
  }

  if (!(monto > 0)) return falla(409, 'Este turno no tiene saldo pendiente de cobro.');

  const montoValido = validarMonto(monto);
  if (montoValido === null) {
    return falla(409, 'El saldo pendiente no es un monto válido para cobrar (hasta 2 decimales).');
  }

  const pendientes = activos.filter((cobro) => cobro.estado === 'Pendiente');
  const reutilizable = pendientes.find(
    (cobro) => linkVigente(cobro, ahora) && aCentavos(cobro.monto) === aCentavos(montoValido)
  );
  if (reutilizable) return { accion: 'reutilizar', cobro: reutilizable };

  const descripcion = `Turno #${turno.id_turno}${servicio ? ` - ${servicio}` : ''}`.slice(0, MAX_DESCRIPCION);
  return {
    accion: 'crear',
    monto: montoValido,
    descripcion,
    cancelar: pendientes.map((cobro) => cobro.id),
  };
};
