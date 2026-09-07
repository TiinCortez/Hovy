// Geocodificación contra Nominatim (OpenStreetMap) para el canal del bot.
//
// El controller web (inmueblesController.js) tiene su propia copia privada de
// la geocodificación directa. La duplicación es a propósito: este cambio no
// toca el canal web. Cuando se migre, ese controller puede importar este
// service tal cual.
//
// Ninguna función de acá tira: ante cualquier falla logean y devuelven el
// objeto con todo en null, igual que el helper del controller web. Un inmueble
// sin coordenadas es un inmueble válido (las columnas son nullable), así que
// que Nominatim esté caído no puede frenar un alta desde WhatsApp. Decidir qué
// status HTTP corresponde es siempre trabajo del controller.

const BASE_URL = 'https://nominatim.openstreetmap.org';

// Nominatim exige un User-Agent identificatorio con contacto real y bloquea a
// quien no lo manda. Va por env para no hardcodear el mail del proyecto.
const USER_AGENT_POR_DEFECTO = 'HovyBackend/1.0 (contacto@hovy.com.ar)';

// Sin timeout, una consulta colgada cuelga el request entero y el cliente de
// WhatsApp se queda esperando una respuesta que no llega.
const TIMEOUT_MS = 5000;

// Arma la URL descartando los parámetros vacíos: con la búsqueda estructurada
// de Nominatim, mandar city= en blanco no es lo mismo que no mandarlo.
const armarUrl = (path, params) => {
  const url = new URL(`${BASE_URL}${path}`);

  for (const [clave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== null && String(valor).trim() !== '') {
      url.searchParams.set(clave, String(valor).trim());
    }
  }

  return url;
};

const consultarNominatim = async (path, params) => {
  // El timeout se implementa con AbortController porque fetch no tiene una
  // opción propia: sin esto, una consulta que nunca responde queda colgada.
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const respuesta = await fetch(armarUrl(path, params), {
      headers: {
        'User-Agent': process.env.NOMINATIM_USER_AGENT || USER_AGENT_POR_DEFECTO,
      },
      signal: controlador.signal,
    });

    // Sin este chequeo, un 429 (nos pasamos del límite) o un 403 (bloqueo por
    // User-Agent) termina en un respuesta.json() que explota y se confunde con
    // "no encontré la dirección".
    if (!respuesta.ok) {
      console.error("Nominatim respondió con un status inesperado:", respuesta.status);
      return null;
    }

    return await respuesta.json();
  } catch (error) {
    console.error("Error al consultar Nominatim:", error.message);
    return null;
  } finally {
    clearTimeout(temporizador);
  }
};

// Geocodificación directa: dirección escrita -> coordenadas.
//
// Recibe un objeto y no argumentos posicionales a propósito: con tres strings
// seguidos es cuestión de tiempo que una llamada los pase en otro orden y nadie
// se entere, porque la consulta igual "funciona", solo que devuelve otro punto.
//
// Usa la búsqueda estructurada de Nominatim en vez del q= libre: es más precisa
// y evita armar strings con comas colgando cuando falta un campo. El barrio va
// en el slot `city` porque la búsqueda estructurada no tiene un parámetro de
// barrio/suburbio y en la práctica es el que mejor lo matchea.
export const geocodificarDireccion = async ({ direccion, provincia, barrio }) => {
  if (!direccion) {
    return { latitud: null, longitud: null };
  }

  const data = await consultarNominatim('/search', {
    format: 'jsonv2',
    limit: 1,
    street: direccion,
    city: barrio,
    state: provincia,
    country: 'Argentina',
  });

  if (!Array.isArray(data) || data.length === 0) {
    return { latitud: null, longitud: null };
  }

  const latitud = parseFloat(data[0].lat);
  const longitud = parseFloat(data[0].lon);

  if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) {
    return { latitud: null, longitud: null };
  }

  return { latitud, longitud };
};

// Geocodificación inversa: coordenadas -> dirección aproximada.
//
// Es el complemento del pin de WhatsApp. Lo que devuelve es una SUGERENCIA para
// que el bot pregunte "¿es esta dirección?" en vez de pedir calle, barrio y
// provincia por separado. Nunca se guarda sin que el cliente lo confirme.
export const geocodificarCoordenadas = async ({ latitud, longitud }) => {
  const data = await consultarNominatim('/reverse', {
    format: 'jsonv2',
    // zoom 18 es el nivel de edificio/calle. Con menos devuelve solo la ciudad.
    zoom: 18,
    addressdetails: 1,
    lat: latitud,
    lon: longitud,
  });

  const domicilio = data?.address;

  if (!domicilio) {
    return { direccion: null, barrio: null, provincia: null };
  }

  const calle = domicilio.road || domicilio.pedestrian || domicilio.footway || null;
  const altura = domicilio.house_number || null;

  return {
    direccion: calle ? [calle, altura].filter(Boolean).join(' ') : null,
    // Nominatim no nombra igual al nivel "barrio" en todo el país, así que
    // probamos las tres variantes que aparecen en Argentina.
    barrio: domicilio.suburb || domicilio.neighbourhood || domicilio.city_district || null,
    provincia: domicilio.state || null,
  };
};
