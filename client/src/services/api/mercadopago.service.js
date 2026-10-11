import httpService from './http.service';

// Mercado Pago seller-account linking. Responses never contain tokens.
const MercadoPagoService = {
  // -> { ok, data: { conectada, estado, mp_user_id, expira_en } }
  getConexion: async () => {
    const response = await httpService.get('/mercadopago/conexion');
    return response.data;
  },

  // -> { ok, data: { url } } (authorization URL to redirect the browser to)
  iniciarVinculacion: async () => {
    const response = await httpService.post('/mercadopago/oauth/iniciar');
    return response.data;
  },

  // Local unlink only (does not revoke the grant at Mercado Pago)
  desvincular: async () => {
    const response = await httpService.delete('/mercadopago/conexion');
    return response.data;
  },
};

export default MercadoPagoService;
