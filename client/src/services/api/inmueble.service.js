import httpService from './http.service';

const InmuebleService = {
  // Obtener todos los inmuebles activos
  getAll: async () => {
    const response = await httpService.get('/inmuebles');
    return response.data;
  },
  
  // Obtener inmuebles filtrados por ID de cliente
  getByCliente: async (idCliente) => {
    const response = await httpService.get('/inmuebles');
    
    // El backend devuelve { ok: true, data: [...] }
    if (response.data && response.data.data) {
       // Filtramos en memoria los inmuebles que pertenecen al cliente
       const filtrados = response.data.data.filter(
         inmueble => String(inmueble.id_cliente) === String(idCliente)
       );
       return { ok: true, data: filtrados };
    }
    
    return response.data;
  },

  // Crear un nuevo inmueble
  create: async (inmuebleData) => {
    const response = await httpService.post('/inmuebles', inmuebleData);
    return response.data;
  },

  // Modificar un inmueble existente
  update: async (id, inmuebleData) => {
    const response = await httpService.put(`/inmuebles/${id}`, inmuebleData);
    return response.data;
  },

  // Dar de baja (borrado lógico) a un inmueble
  delete: async (id) => {
    const response = await httpService.delete(`/inmuebles/${id}/baja`);
    return response.data;
  }
};

export default InmuebleService;