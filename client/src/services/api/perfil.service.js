import httpService from './http.service';

// Departure point of the logged-in user (where the trips to the properties start).
const PerfilService = {
  // -> { ok, data: { configurada, domicilio, latitud, longitud } }
  getSalida: async () => {
    const response = await httpService.get('/perfil/salida');
    return response.data;
  },

  // Approximate address of a position, to be confirmed. Saves nothing.
  // -> { ok, data: { latitud, longitud, direccion } }
  sugerirSalida: async ({ latitud, longitud }) => {
    const response = await httpService.post('/perfil/salida/sugerencia', { latitud, longitud });
    return response.data;
  },

  // Only after the user confirmed the location.
  guardarSalida: async ({ latitud, longitud, domicilio }) => {
    const response = await httpService.put('/perfil/salida', { latitud, longitud, domicilio });
    return response.data;
  },

  quitarSalida: async () => {
    const response = await httpService.delete('/perfil/salida');
    return response.data;
  },
};

export default PerfilService;
