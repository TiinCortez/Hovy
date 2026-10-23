// Approximate distance between two points, with no external service.
// Used as a fallback when OpenRouteService is not available.

const RADIO_TIERRA_KM = 6371;

// A road route is longer than the straight line (curves, blocks, detours).
// 1.3 is a rule of thumb for cities, not a measured value for any place.
export const FACTOR_RODEO = 1.3;

const aRadianes = (grados) => (grados * Math.PI) / 180;

// Straight-line distance over the Earth's surface (haversine formula), in km.
export const distanciaLineaRecta = (origen, destino) => {
  const deltaLatitud = aRadianes(destino.latitud - origen.latitud);
  const deltaLongitud = aRadianes(destino.longitud - origen.longitud);

  const a =
    Math.sin(deltaLatitud / 2) ** 2
    + Math.cos(aRadianes(origen.latitud)) * Math.cos(aRadianes(destino.latitud)) * Math.sin(deltaLongitud / 2) ** 2;

  return 2 * RADIO_TIERRA_KM * Math.asin(Math.sqrt(a));
};

// Straight line x detour factor, rounded to 2 decimals.
export const kmAproximados = (origen, destino) =>
  Math.round(distanciaLineaRecta(origen, destino) * FACTOR_RODEO * 100) / 100;
