import httpService from './http.service';

const ServicioService = {
  // Global catalog of service types
  getTipos: async () => {
    const response = await httpService.get('/servicios');
    return response.data;
  },

  // Services of the logged user
  getMios: async () => {
    const response = await httpService.get('/servicios/catalogo');
    return response.data;
  },

  // payload: { nombre, descripcion?, variable_cotizacion?, precio_base, limite_operativo? }
  // The server finds-or-creates the type by name and reactivates removed links.
  create: async (payload) => {
    const response = await httpService.post('/servicios/catalogo', payload);
    return response.data;
  },

  update: async (id, payload) => {
    const response = await httpService.put(`/servicios/catalogo/${id}`, payload);
    return response.data;
  },

  // Soft delete (activo = false)
  remove: async (id) => {
    const response = await httpService.delete(`/servicios/catalogo/${id}`);
    return response.data;
  },
};

export default ServicioService;
