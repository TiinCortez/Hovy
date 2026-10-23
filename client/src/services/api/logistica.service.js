import httpService from './http.service';

// Logistics of a day: turnos, clients, route in km and fuel (or gas) estimate.
const LogisticaService = {
  // Without `fecha` the backend uses today (Argentina time).
  // -> { ok, data: { fecha, turnos, clientes_a_visitar, sin_ubicacion, sin_horario,
  //      ruta: { incluido, km, km_aproximados, paradas } | { incluido: false, motivo, mensaje },
  //      combustible: { incluido, cantidad, unidad, costo, combustible } | { incluido: false, motivo, mensaje } } }
  getDia: async (fecha) => {
    const response = await httpService.get('/logistica/dia', { params: fecha ? { fecha } : {} });
    return response.data;
  },
};

export default LogisticaService;
