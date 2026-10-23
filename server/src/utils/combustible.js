// Pure helpers for the fuel prices (naftas.com.ar) and the travel cost.
// No I/O here: the HTTP client and the database live in the fuel service.

// Prices older than this are refreshed from the API on the next read.
export const TTL_PRECIOS_MS = 3 * 24 * 60 * 60 * 1000;

// Same rounding used by the budget (presupuestoService.redondear2).
const redondear2 = (numero) => Math.round((numero + Number.EPSILON) * 100) / 100;

// The API only accepts the exact upper-case city name, without accents.
export const normalizarCiudad = (texto) => {
  if (typeof texto !== 'string') return '';
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
};

// Product names are not uniform across brands ("SUPER", "Shell Super",
// "AXION Diesel X10", "DIESEL500"), so the type is derived from the name.
// GNC is sold per m3, everything else per liter.
export const clasificarProducto = (nombre) => {
  const texto = String(nombre ?? '').toUpperCase();
  if (texto.includes('GNC')) return { tipo: 'gnc', unidad: 'm3' };
  if (texto.includes('DIESEL')) return { tipo: 'gasoil', unidad: 'l' };
  return { tipo: 'nafta', unidad: 'l' };
};

// Flattens the API response ({ CIUDAD: { empresas: { EMPRESA: { PRODUCTO: {...} } } } })
// into one row per empresa + producto, ready for combustible_precios.
// Products without a positive price are dropped.
export const aplanarPrecios = (respuesta) => {
  if (!respuesta || typeof respuesta !== 'object') return [];

  const filas = [];
  for (const [ciudad, datos] of Object.entries(respuesta)) {
    const empresas = datos?.empresas;
    if (!empresas || typeof empresas !== 'object') continue;

    for (const [empresa, productos] of Object.entries(empresas)) {
      for (const [producto, info] of Object.entries(productos ?? {})) {
        const precio = Number(info?.precio);
        if (!Number.isFinite(precio) || precio <= 0) continue;

        filas.push({
          ciudad,
          empresa,
          producto,
          ...clasificarProducto(producto),
          precio,
          fecha_vigencia: info.fecha_vigencia ?? null,
          desde_ciudad: info.fromNearby ?? null,
          precision: info.fromNearbyPrecision ?? null,
        });
      }
    }
  }
  return filas;
};

// True when there are no cached rows or the oldest one is past the TTL.
export const preciosVencidos = (filas, ahora = Date.now(), ttlMs = TTL_PRECIOS_MS) => {
  if (!Array.isArray(filas) || filas.length === 0) return true;
  const masViejo = Math.min(...filas.map((fila) => Date.parse(fila.actualizado_en)));
  if (!Number.isFinite(masViejo)) return true;
  return ahora - masViejo >= ttlMs;
};

// km x (consumo per 100 km / 100) x price per unit (liter or m3) x tramos.
// `tramos` is 1 for one way (current rule) and 2 for a round trip.
// Returns null when any input is missing or invalid, so the caller can ask the
// user to complete their configuration instead of showing a made-up number.
export const calcularCostoTraslado = ({ km, consumo100km, precioUnidad, tramos = 1 }) => {
  const valores = [km, consumo100km, precioUnidad, tramos];
  if (valores.some((v) => v === null || v === undefined || v === '' || typeof v === 'boolean')) return null;

  const [kmNum, consumo, precio, cantidadTramos] = valores.map(Number);
  if (![kmNum, consumo, precio, cantidadTramos].every(Number.isFinite)) return null;
  if (kmNum < 0 || consumo <= 0 || precio <= 0 || cantidadTramos <= 0) return null;

  return redondear2(kmNum * (consumo / 100) * precio * cantidadTramos);
};
