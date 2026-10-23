import httpService from './http.service';

// Fuel prices (naftas.com.ar, cached by the backend) and the user's fuel settings.
const CombustibleService = {
  // -> { ok, data: ['CITY', ...] }
  getCiudades: async () => {
    const response = await httpService.get('/combustible/ciudades');
    return response.data;
  },

  // -> { ok, data: { ciudad, desactualizado, precios: [{ empresa, producto, tipo, unidad, precio,
  //      fecha_vigencia, desde_ciudad, precio_de_referencia }] } }
  getPrecios: async (ciudad) => {
    const response = await httpService.get('/combustible/precios', { params: { ciudad } });
    return response.data;
  },

  // -> { ok, data: { ciudad, tipo, empresa, producto, consumo_100km } } (nulls when not set)
  getConfig: async () => {
    const response = await httpService.get('/combustible/config');
    return response.data;
  },

  // Trip cost from the user's departure point to a property. Always resolves:
  // when it cannot be computed, data.incluido is false and data.mensaje says why.
  // -> { ok, data: { incluido, km, costo, consumo_100km, precio_unidad, unidad, combustible,
  //      km_aproximados, desactualizado } | { incluido: false, motivo, mensaje } }
  getTraslado: async (idInmueble) => {
    const response = await httpService.get('/combustible/traslado', { params: { id_inmueble: idInmueble } });
    return response.data;
  },

  guardarConfig: async (config) => {
    const response = await httpService.put('/combustible/config', config);
    return response.data;
  },
};

export default CombustibleService;
