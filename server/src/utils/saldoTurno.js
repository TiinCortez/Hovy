import { calcularPendienteTrabajo } from '../integrations/mercadopago/cobros/cobroTurno.js';

// Pure: how much a turno costs, how much the client still owes and which payments
// were registered, from data already loaded (no I/O).
//
//  - total: the accepted budget's final value, or null when there is none.
//  - pendiente: what the client still owes. It only exists once the turno is
//    Realizado (that is when the debt is created in the account ledger): the ledger
//    balance of the job, or the budget total when there are no movements. null before.
//  - pagos: the payments of the job (the reference is left out on purpose).
export const armarSaldoTurno = ({ turno, movimientos, presupuesto, pagos }) => {
  const totalNumerico = Number(presupuesto?.monto_total);
  const total = presupuesto?.estado === 'Aceptado' && Number.isFinite(totalNumerico) ? totalNumerico : null;

  const pendiente = turno.estado === 'Realizado'
    ? (calcularPendienteTrabajo(movimientos) ?? total)
    : null;

  return {
    estado: turno.estado,
    cobrado: turno.cobrado === true,
    total,
    pendiente,
    pagos: (Array.isArray(pagos) ? pagos : []).map((pago) => ({
      id_pago: pago.id_pago,
      medio: pago.medio_pago,
      monto: Number(pago.monto),
      estado: pago.estado,
      fecha: pago.fecha_pago ?? null,
    })),
  };
};
