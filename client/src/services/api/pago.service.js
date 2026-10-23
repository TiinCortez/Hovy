import httpService from './http.service';

// Payments of a turno: the balance the client still owes and the cash / bank
// transfer payments received by hand (Mercado Pago payments go through CobroService).
const PagoService = {
  // -> { ok, data: { total, pendiente, cobrado, pagos: [{ medio, monto, fecha }] } }
  // `pendiente` is null until the turno is Realizado (that is when the debt exists).
  getSaldo: async (idTurno) => {
    const response = await httpService.get(`/turnos/${idTurno}/saldo`);
    return response.data;
  },

  // Registers a payment received by hand. The server rejects an amount above what
  // the client owes. It cannot be undone: the account ledger is immutable.
  // -> { ok, data: { id_pago, medio, pendiente, cobrado, cobros_cancelados } }
  registrar: async (idTurno, { medio, monto, referencia }) => {
    const response = await httpService.post(`/turnos/${idTurno}/pagos`, { medio, monto, referencia });
    return response.data;
  },
};

export default PagoService;
