// Driving distance between two points with OpenRouteService.
//
// Docs: POST /v2/directions/{profile}, API key in the Authorization header
// (the only way for POST), coordinates as [longitude, latitude], distances in
// meters. The free plan has a daily quota, so results are cached by coordinate
// pair: a property rarely moves and the boss's departure point changes seldom.
//
// Never throws: it resolves { km } or { motivo } so the budget keeps working
// without a trip cost when routing is unavailable.

const BASE_URL = process.env.OPENROUTESERVICE_URL || 'https://api.openrouteservice.org';
const PERFIL = 'driving-car';
const TIMEOUT_MS = 8000;
const TTL_CACHE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ENTRADAS_CACHE = 500;

const cache = new Map();

export const reiniciarCacheRutas = () => cache.clear();

// ~11 m of precision: nearby clicks on the same property share one route.
const redondear4 = (numero) => Number(numero).toFixed(4);

const claveCache = (origen, destino) =>
  `${redondear4(origen.latitud)},${redondear4(origen.longitud)}|${redondear4(destino.latitud)},${redondear4(destino.longitud)}`;

// Accepts the JSON shape (routes[0].summary) and the GeoJSON one (features[0].properties.summary).
const extraerMetros = (cuerpo) =>
  Number(cuerpo?.routes?.[0]?.summary?.distance ?? cuerpo?.features?.[0]?.properties?.summary?.distance);

const guardar = (clave, km, ahora) => {
  if (cache.size >= MAX_ENTRADAS_CACHE) cache.delete(cache.keys().next().value);
  cache.set(clave, { km, hasta: ahora + TTL_CACHE_MS });
};

export const distanciaKm = async (
  { origen, destino },
  { fetchFn = fetch, apiKey = process.env.OPENROUTESERVICE_API_KEY, ahora = Date.now() } = {}
) => {
  if (!apiKey) return { motivo: 'sin_ruteo' };

  const clave = claveCache(origen, destino);
  const guardado = cache.get(clave);
  if (guardado && ahora < guardado.hasta) return { km: guardado.km };

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const respuesta = await fetchFn(`${BASE_URL}/v2/directions/${PERFIL}`, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        coordinates: [
          [origen.longitud, origen.latitud],
          [destino.longitud, destino.latitud],
        ],
      }),
      signal: controlador.signal,
    });
    const cuerpo = await respuesta.json().catch(() => null);

    const metros = extraerMetros(cuerpo);
    if (!respuesta.ok || !Number.isFinite(metros) || metros < 0) {
      console.error('[ruta] OpenRouteService no devolvió una distancia válida:', respuesta.status);
      return { motivo: 'ruta_no_disponible' };
    }

    const km = Math.round((metros / 1000) * 100) / 100;
    guardar(clave, km, ahora);
    return { km };
  } catch (error) {
    console.error('[ruta] no se pudo consultar OpenRouteService:', error.message);
    return { motivo: 'ruta_no_disponible' };
  } finally {
    clearTimeout(temporizador);
  }
};
