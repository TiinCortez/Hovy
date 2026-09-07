import httpService from './http.service';

const ClienteService = {
  // Obtener todos los clientes
  getAll: async () => {
    const response = await httpService.get('/clientes');
    return response.data;
  },
  
  // Crear un nuevo cliente[cite: 1]
  create: async (clienteData) => {
    const response = await httpService.post('/clientes', clienteData);
    return response.data;
  },

  // Modificar un cliente existente (usa el teléfono como ID según tu backend)[cite: 1]
  update: async (telefono, clienteData) => {
    const response = await httpService.put(`/clientes/${telefono}`, clienteData);
    return response.data;
  }
};

export default ClienteService;