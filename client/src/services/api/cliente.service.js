import httpService from './http.service';

const ClienteService = {
  // Obtener todos los clientes
  getAll: async () => {
    const response = await httpService.get('/clientes');
    return response.data;
  },
  
  // Crear un nuevo cliente
  create: async (clienteData) => {
    const response = await httpService.post('/clientes', clienteData);
    return response.data;
  },

  // Modificar un cliente existente (usa el teléfono como ID según tu backend)
  update: async (telefono, clienteData) => {
    const response = await httpService.put(`/clientes/${telefono}`, clienteData);
    return response.data;
  },

  // Eliminar (o dar de baja) un cliente
  delete: async (telefono) => {
    const response = await httpService.delete(`/clientes/${telefono}`);
    return response.data;
  }
};

export default ClienteService;