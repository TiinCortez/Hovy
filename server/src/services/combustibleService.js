import { supabaseAdmin } from '../config/supabase.js';
import { falla, estaVacio } from '../utils/solicitudesVisita.js';
import { normalizarCiudad, aplanarPrecios, preciosVencidos, TTL_PRECIOS_MS } from '../utils/combustible.js';

// Fuel prices from naftas.com.ar, cached in combustible_precios.
//
// Prices are read from the cache; when they are older than 3 days the API is
// queried again (lazy refresh, no scheduler). If the API fails, the last known
// prices are returned flagged as outdated instead of an error.
//
// Services never touch req/res. They return { error: { status, message } } or
// the data the controller needs.

const BASE_URL = process.env.NAFTAS_API_URL || 'https://www.naftas.com.ar/api/fuel';
const TIMEOUT_MS = 8000;
const TTL_CIUDADES_MS = 24 * 60 * 60 * 1000;
// After a failed refresh, the old prices are kept for this long before trying again.
const REINTENTO_TRAS_FALLA_MS = 10 * 60 * 1000;
const TIPOS = ['nafta', 'gasoil', 'gnc'];
const CONSUMO_MAXIMO = 100;
const ERROR_DB = 'No se pudo completar la operación. Intentá de nuevo más tarde.';

const CAMPOS_PRECIO =
  'ciudad, empresa, producto, tipo, unidad, precio, fecha_vigencia, desde_ciudad, precision, actualizado_en';

// Data access. Replaceable in tests.
export const repositorioPrecios = {
  async leer(ciudad) {
    const { data, error } = await supabaseAdmin
      .from('combustible_precios')
      .select(CAMPOS_PRECIO)
      .eq('ciudad', ciudad);
    return error ? { dbError: error } : { data: data ?? [] };
  },

  async guardar(filas, actualizadoEn) {
    const { error } = await supabaseAdmin
      .from('combustible_precios')
      .upsert(
        filas.map((fila) => ({ ...fila, actualizado_en: actualizadoEn })),
        { onConflict: 'ciudad,empresa,producto' }
      );
    return error ? { dbError: error } : { data: true };
  },

  // Products that disappeared from the API stop being offered.
  async depurar(ciudad, actualizadoEn) {
    const { error } = await supabaseAdmin
      .from('combustible_precios')
      .delete()
      .eq('ciudad', ciudad)
      .lt('actualizado_en', actualizadoEn);
    return error ? { dbError: error } : { data: true };
  },
};

// Queries the API for one city. Never throws.
// Resolves { data } | { ciudadNoEncontrada, ciudades } | { fallo }.
export const consultarNaftas = async (ciudad, fetchFn = fetch) => {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const url = new URL(BASE_URL);
    url.searchParams.set('city', ciudad);
    const respuesta = await fetchFn(url, {
      headers: { Accept: 'application/json' },
      signal: controlador.signal,
    });
    const cuerpo = await respuesta.json().catch(() => null);

    if (cuerpo?.error === 'City not found' && Array.isArray(cuerpo.availableCities)) {
      return { ciudadNoEncontrada: true, ciudades: cuerpo.availableCities };
    }
    if (!respuesta.ok || !cuerpo || typeof cuerpo !== 'object') {
      console.error('[combustible] la API de naftas respondió con un status inesperado:', respuesta.status);
      return { fallo: true };
    }
    return { data: cuerpo };
  } catch (error) {
    console.error('[combustible] no se pudo consultar la API de naftas:', error.message);
    return { fallo: true };
  } finally {
    clearTimeout(temporizador);
  }
};

let cacheCiudades = { lista: null, hasta: 0 };

// The API has no list endpoint: an unknown city answers with `availableCities`.
export const listarCiudades = async ({ fetchFn = fetch, ahora = Date.now() } = {}) => {
  if (cacheCiudades.lista && ahora < cacheCiudades.hasta) return { data: cacheCiudades.lista };

  const respuesta = await consultarNaftas('__LISTA__', fetchFn);
  if (!respuesta.ciudadNoEncontrada) {
    return cacheCiudades.lista
      ? { data: cacheCiudades.lista }
      : falla(502, 'No se pudo obtener la lista de ciudades. Intentá de nuevo más tarde.');
  }

  cacheCiudades = { lista: respuesta.ciudades, hasta: ahora + TTL_CIUDADES_MS };
  return { data: respuesta.ciudades };
};

// Test helper: forgets the in-memory list of cities.
export const reiniciarCacheCiudades = () => {
  cacheCiudades = { lista: null, hasta: 0 };
};

const vistaPrecio = (fila) => ({
  empresa: fila.empresa,
  producto: fila.producto,
  tipo: fila.tipo,
  unidad: fila.unidad,
  precio: Number(fila.precio),
  fecha_vigencia: fila.fecha_vigencia,
  // The API sometimes reports the price of a far city: the UI warns about it.
  desde_ciudad: fila.desde_ciudad,
  precio_de_referencia: fila.precision === 'low',
});

// Loads the prices of one city from the database and, when they are older than
// 3 days, from the naftas API. Resolves { respuesta, venceEn }: `respuesta` is what
// obtenerPrecios returns and `venceEn` (ms) is until when it can be kept in memory,
// or null when it must not be kept (errors).
const cargarPrecios = async (ciudad, ciudadTexto, { fetchFn, repo, ahora }) => {
  const cache = await repo.leer(ciudad);
  if (cache.dbError) {
    console.error('[combustible] no se pudo leer la caché de precios');
    return { respuesta: falla(500, ERROR_DB), venceEn: null };
  }

  if (!preciosVencidos(cache.data, ahora)) {
    // Still valid: it stays in memory until 3 days after the oldest saved update.
    const masViejo = Math.min(...cache.data.map((fila) => Date.parse(fila.actualizado_en)));
    return {
      respuesta: { data: { ciudad, precios: cache.data.map(vistaPrecio), desactualizado: false } },
      venceEn: masViejo + TTL_PRECIOS_MS,
    };
  }

  const consulta = await consultarNaftas(ciudad, fetchFn);

  if (consulta.ciudadNoEncontrada) {
    return {
      respuesta: falla(404, `No hay precios de combustible para "${ciudadTexto}". Elegí una ciudad de la lista.`),
      venceEn: null,
    };
  }

  const filas = consulta.data ? aplanarPrecios(consulta.data) : [];
  if (filas.length === 0) {
    // API down or empty answer: keep serving the last known prices, flagged. They are
    // remembered for a few minutes so a down API is not retried (and waited for) on
    // every request.
    if (cache.data.length > 0) {
      return {
        respuesta: { data: { ciudad, precios: cache.data.map(vistaPrecio), desactualizado: true } },
        venceEn: ahora + REINTENTO_TRAS_FALLA_MS,
      };
    }
    return {
      respuesta: falla(502, 'No se pudieron obtener los precios de combustible. Intentá de nuevo más tarde.'),
      venceEn: null,
    };
  }

  const marca = new Date(ahora).toISOString();
  const guardado = await repo.guardar(filas, marca);
  if (guardado.dbError) {
    console.error('[combustible] no se pudieron guardar los precios');
    return { respuesta: falla(500, ERROR_DB), venceEn: null };
  }
  await repo.depurar(ciudad, marca);

  return {
    respuesta: {
      data: {
        ciudad,
        precios: filas.map((fila) => vistaPrecio({ ...fila, actualizado_en: marca })),
        desactualizado: false,
      },
    },
    venceEn: ahora + TTL_PRECIOS_MS,
  };
};

// Prices already loaded, by city. Each city is read once and then kept until its
// 3-day check is due, so the usual request neither reads the database nor calls
// the API. Only the cities somebody actually uses end up here.
const preciosEnMemoria = new Map();
// Loads in progress, so simultaneous requests share one (no stampede on the API).
const cargasEnCurso = new Map();

// Test helper: forgets the prices kept in memory.
export const reiniciarCachePrecios = () => {
  preciosEnMemoria.clear();
  cargasEnCurso.clear();
};

// Prices of one city, checked against the naftas API every 3 days.
// Returns { data: { ciudad, precios, desactualizado } } or { error }.
// The returned object is shared between callers: do not modify it.
export const obtenerPrecios = (
  ciudadTexto,
  { fetchFn = fetch, repo = repositorioPrecios, ahora = Date.now() } = {}
) => {
  const ciudad = normalizarCiudad(ciudadTexto);
  if (!ciudad) return Promise.resolve(falla(400, 'Indicá la ciudad.'));

  const guardado = preciosEnMemoria.get(ciudad);
  if (guardado && ahora < guardado.venceEn) return Promise.resolve(guardado.respuesta);

  const enCurso = cargasEnCurso.get(ciudad);
  if (enCurso) return enCurso;

  const carga = cargarPrecios(ciudad, ciudadTexto, { fetchFn, repo, ahora })
    .then(({ respuesta, venceEn }) => {
      if (venceEn !== null) preciosEnMemoria.set(ciudad, { respuesta, venceEn });
      return respuesta;
    })
    .finally(() => cargasEnCurso.delete(ciudad));

  cargasEnCurso.set(ciudad, carga);
  return carga;
};

const CAMPOS_CONFIG =
  'combustible_ciudad, combustible_tipo, combustible_empresa, combustible_producto, consumo_100km';

const vistaConfig = (fila) => ({
  ciudad: fila?.combustible_ciudad ?? null,
  tipo: fila?.combustible_tipo ?? null,
  empresa: fila?.combustible_empresa ?? null,
  producto: fila?.combustible_producto ?? null,
  consumo_100km: fila?.consumo_100km != null ? Number(fila.consumo_100km) : null,
});

export const obtenerConfig = async (idUsuario) => {
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select(CAMPOS_CONFIG)
    .eq('id', idUsuario)
    .maybeSingle();

  if (error || !data) {
    console.error('[combustible] no se pudo leer la configuración del usuario');
    return falla(error ? 500 : 404, error ? ERROR_DB : 'No existe el usuario.');
  }
  return { data: vistaConfig(data) };
};

// Shape validation of the PUT body (no I/O). The consumo is required on every
// save: switching between nafta and GNC changes the unit, so the old value
// would be meaningless.
export const validarConfig = (body = {}) => {
  const errores = [];
  const { ciudad, tipo, empresa, producto, consumo_100km: consumo } = body ?? {};

  if (!TIPOS.includes(tipo)) errores.push(`tipo tiene que ser uno de: ${TIPOS.join(', ')}.`);
  if (estaVacio(ciudad)) errores.push('ciudad es obligatoria.');
  if (estaVacio(empresa)) errores.push('empresa es obligatoria.');
  if (estaVacio(producto)) errores.push('producto es obligatorio.');

  const consumoNum = typeof consumo === 'boolean' || estaVacio(consumo) ? NaN : Number(consumo);
  if (!Number.isFinite(consumoNum) || consumoNum <= 0 || consumoNum > CONSUMO_MAXIMO) {
    errores.push(`El consumo cada 100 km es obligatorio: un número mayor a 0 y hasta ${CONSUMO_MAXIMO}.`);
  }

  if (errores.length > 0) return falla(400, errores.join(' '));

  return {
    valores: {
      ciudad: normalizarCiudad(ciudad),
      tipo,
      empresa: String(empresa).trim(),
      producto: String(producto).trim(),
      consumo_100km: Math.round(consumoNum * 100) / 100,
    },
  };
};

// PUT config: validates the shape, checks the product really exists for that
// city and fuel type, then saves it on the user.
export const guardarConfig = async (idUsuario, body, opciones = {}) => {
  const validacion = validarConfig(body);
  if (validacion.error) return validacion;
  const { valores } = validacion;

  const precios = await obtenerPrecios(valores.ciudad, opciones);
  if (precios.error) return precios;

  const existe = precios.data.precios.some(
    (p) => p.empresa === valores.empresa && p.producto === valores.producto && p.tipo === valores.tipo
  );
  if (!existe) {
    return falla(400, 'Esa estación y combustible no están disponibles para la ciudad elegida.');
  }

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .update({
      combustible_ciudad: valores.ciudad,
      combustible_tipo: valores.tipo,
      combustible_empresa: valores.empresa,
      combustible_producto: valores.producto,
      consumo_100km: valores.consumo_100km,
    })
    .eq('id', idUsuario)
    .select(CAMPOS_CONFIG)
    .single();

  if (error) {
    console.error('[combustible] no se pudo guardar la configuración del usuario');
    return falla(500, ERROR_DB);
  }
  return { data: vistaConfig(data) };
};
