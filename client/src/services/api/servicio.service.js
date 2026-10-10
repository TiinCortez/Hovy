import httpService from './http.service';

const ServicioService = {
  // Global catalog of service types
  getTipos: async () => {
    const response = await httpService.get('/servicios');
    return response.data;
  },

  // Services of the logged user (includes inactive rows)
  getMios: async () => {
    const response = await httpService.get('/servicios/catalogo');
    return response.data;
  },

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
