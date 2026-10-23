import httpService from './http.service';

// Payment links (Mercado Pago) of the logged-in seller. The money goes to the
// seller's own Mercado Pago account.
const CobroService = {
  // Cobros of a turno, newest first.
  // -> { ok, data: [{ id, id_turno, estado, monto, init_point, impactado, ... }] }
  listarPorTurno: async (idTurno) => {
    const response = await httpService.get('/cobros', { params: { id_turno: idTurno } });
    return response.data;
  },

  // Gets or creates the payment link of a turno for what the client still owes:
  // the same link if it is still valid, a new one if the amount changed or it expired.
  crearParaTurno: async (idTurno) => {
    const response = await httpService.post('/cobros', { id_turno: idTurno });
    return response.data;
  },

  // Asks the backend to check the payment against Mercado Pago (it throttles itself).
  // -> { ok, data: cobro, verificado }
  verificar: async (idCobro) => {
    const response = await httpService.post(`/cobros/${idCobro}/verificar`);
    return response.data;
  },

  // Local cancellation only: the link at Mercado Pago keeps working until it expires.
  cancelar: async (idCobro) => {
    const response = await httpService.post(`/cobros/${idCobro}/cancelar`);
    return response.data;
  },

  // QR image of the link inside the Hovy template (needs the auth header, so it is
  // fetched as a blob instead of used as an <img src>).
  getQr: async (idCobro) => {
    const response = await httpService.get(`/cobros/${idCobro}/qr`, { responseType: 'blob' });
    return response.data;
  },
};

export default CobroService;
