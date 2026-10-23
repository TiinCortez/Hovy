// Driving distance with OpenRouteService.
//
// Docs: POST /v2/directions/{profile}, API key in the Authorization header
// (the only way for POST), coordinates as [longitude, latitude], distances in
// meters. The route can have several waypoints, so a whole day is ONE request.
// The free plan has a daily quota, so results are cached by the list of points:
// a property rarely moves and the boss's departure point changes seldom.
//
// Never throws. It resolves { km, aproximado }:
//  - aproximado false: real driving distance from OpenRouteService.
//  - aproximado true: fallback (straight line x detour factor, see
//    utils/distancia.js, summed leg by leg) used when there is no API key, the
//    service fails or there are too many waypoints. It is NOT cached, so the real
//    route takes over as soon as it is available.
// With the fallback turned off (RUTA_RESPALDO_APROXIMADO=false) it resolves
// { motivo } instead, and the caller goes without distance.

import { kmAproximados } from '../utils/distancia.js';

const BASE_URL = process.env.OPENROUTESERVICE_URL || 'https://api.openrouteservice.org';
const PERFIL = 'driving-car';
const TIMEOUT_MS = 8000;
const TTL_CACHE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ENTRADAS_CACHE = 500;
// OpenRouteService limits the waypoints of one directions request (50 by default).
const MAX_PUNTOS = 50;

const cache = new Map();

export const reiniciarCacheRutas = () => cache.clear();

// ~11 m of precision: nearby clicks on the same property share one route.
const redondear4 = (numero) => Number(numero).toFixed(4);

const claveCache = (puntos) =>
  puntos.map((punto) => `${redondear4(punto.latitud)},${redondear4(punto.longitud)}`).join('|');

// Accepts the JSON shape (routes[0].summary) and the GeoJSON one (features[0].properties.summary).
const extraerMetros = (cuerpo) =>
  Number(cuerpo?.routes?.[0]?.summary?.distance ?? cuerpo?.features?.[0]?.properties?.summary?.distance);

const guardar = (clave, km, ahora) => {
  if (cache.size >= MAX_ENTRADAS_CACHE) cache.delete(cache.keys().next().value);
  cache.set(clave, { km, hasta: ahora + TTL_CACHE_MS });
};

const redondear2 = (numero) => Math.round((numero + Number.EPSILON) * 100) / 100;

// Distance of the route that goes through `puntos` in order ([{ latitud, longitud }]).
export const distanciaRutaKm = async (
  { puntos },
  {
    fetchFn = fetch,
    apiKey = process.env.OPENROUTESERVICE_API_KEY,
    ahora = Date.now(),
    respaldoAproximado = process.env.RUTA_RESPALDO_APROXIMADO !== 'false',
  } = {}
) => {
  if (!Array.isArray(puntos) || puntos.length < 2) return { km: 0, aproximado: false };

  const aproximada = () => {
    let total = 0;
    for (let i = 0; i < puntos.length - 1; i += 1) total += kmAproximados(puntos[i], puntos[i + 1]);
    return redondear2(total);
  };
  const sinRuta = (motivo) => (respaldoAproximado ? { km: aproximada(), aproximado: true } : { motivo });

  if (!apiKey) return sinRuta('sin_ruteo');
  if (puntos.length > MAX_PUNTOS) return sinRuta('ruta_no_disponible');

  const clave = claveCache(puntos);
  const guardado = cache.get(clave);
  if (guardado && ahora < guardado.hasta) return { km: guardado.km, aproximado: false };

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
      body: JSON.stringify({ coordinates: puntos.map((punto) => [punto.longitud, punto.latitud]) }),
      signal: controlador.signal,
    });
    const cuerpo = await respuesta.json().catch(() => null);

    const metros = extraerMetros(cuerpo);
    if (!respuesta.ok || !Number.isFinite(metros) || metros < 0) {
      console.error('[ruta] OpenRouteService no devolvió una distancia válida:', respuesta.status);
      return sinRuta('ruta_no_disponible');
    }

    const km = redondear2(metros / 1000);
    guardar(clave, km, ahora);
    return { km, aproximado: false };
  } catch (error) {
    console.error('[ruta] no se pudo consultar OpenRouteService:', error.message);
    return sinRuta('ruta_no_disponible');
  } finally {
    clearTimeout(temporizador);
  }
};

// Distance between two points (the trip to one property).
export const distanciaKm = ({ origen, destino }, opciones) =>
  distanciaRutaKm({ puntos: [origen, destino] }, opciones);
