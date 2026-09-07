// Normalización de coordenadas.
// Todavia nose como llegan las coordenadas desde el chat de whatsapp al enviar
// la ubicacion exacta ni como la toma, por lo tanto, se normaliza para que siempre
// llegue de buena forma.

//   (-31.42, -64.18)     -> { latitud: -31.42, longitud: -64.18 }
//   ("-31.42", "-64.18") -> { latitud: -31.42, longitud: -64.18 }
//   (-64.18, -31.42)     -> null   (invertidas: cae en el Atlántico)
//   (40.71, -74.00)      -> null   (Nueva York)
//   ("abc", -64.18)      -> null

// Limites del territorio de Argentina (valida que no se ponga un punto afuera del pais).
const LIMITES_ARGENTINA = {
  latMin: -55.5,
  latMax: -21.5,
  lonMin: -74.0,
  lonMax: -53.0,
};

export const normalizarCoordenadas = (latitud, longitud) => {
  const lat = Number(latitud);
  const lon = Number(longitud);

  // Number(null) es 0 y Number('') también, así que los descartamos antes:
  // (0, 0) es una coordenada real y no queremos inventarla.
  if (latitud === null || latitud === undefined || String(latitud).trim() === '') return null;
  if (longitud === null || longitud === undefined || String(longitud).trim() === '') return null;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  if (lat < LIMITES_ARGENTINA.latMin || lat > LIMITES_ARGENTINA.latMax) return null;
  if (lon < LIMITES_ARGENTINA.lonMin || lon > LIMITES_ARGENTINA.lonMax) return null;

  return { latitud: lat, longitud: lon };
};

// Mensaje único para los 400 de coordenadas inválidas, así todos los endpoints
// explican lo mismo.
export const ERROR_COORDENADAS_INVALIDAS =
  'Coordenadas inválidas. Se espera un punto dentro de Argentina, primero la latitud y después la longitud (ej: latitud -31.42, longitud -64.18).';
