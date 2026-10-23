import { supabaseAdmin } from '../config/supabase.js';
import { falla } from '../utils/solicitudesVisita.js';
import { normalizarCoordenadas, ERROR_COORDENADAS_INVALIDAS } from '../utils/coordenadas.js';
import { geocodificarCoordenadas } from './geocodingService.js';

// The boss's departure point (where the trips to the properties start from).
// Optional: the budget only adds a trip cost when it is set. It is private data
// of the logged-in user, so every query is scoped by the id taken from the JWT.
//
// Services never touch req/res. They return { error: { status, message } } or
// the data the controller needs.

const MAX_DOMICILIO = 200;
const ERROR_DB = 'No se pudo completar la operación. Intentá de nuevo más tarde.';
const COLUMNAS = 'domicilio_base, latitud_base, longitud_base';

// ~1 m of precision is plenty for a departure point.
const redondear5 = (numero) => Math.round(numero * 1e5) / 1e5;

// Data access. Replaceable in tests.
export const repositorioSalida = {
  async leer(idUsuario) {
    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select(COLUMNAS)
      .eq('id', idUsuario)
      .maybeSingle();
    return error ? { dbError: error } : { data };
  },

  async guardar(idUsuario, { domicilio, latitud, longitud }) {
    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .update({ domicilio_base: domicilio, latitud_base: latitud, longitud_base: longitud })
      .eq('id', idUsuario)
      .select(COLUMNAS)
      .single();
    return error ? { dbError: error } : { data };
  },

  async limpiar(idUsuario) {
    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .update({ domicilio_base: null, latitud_base: null, longitud_base: null })
      .eq('id', idUsuario)
      .select(COLUMNAS)
      .single();
    return error ? { dbError: error } : { data };
  },
};

const vista = (fila) => {
  const coordenadas = normalizarCoordenadas(fila?.latitud_base, fila?.longitud_base);
  return {
    configurada: Boolean(coordenadas),
    domicilio: coordenadas ? (fila?.domicilio_base ?? null) : null,
    latitud: coordenadas ? coordenadas.latitud : null,
    longitud: coordenadas ? coordenadas.longitud : null,
  };
};

// "Calle 123, Barrio, Provincia" with only the parts that exist, or null.
export const armarDomicilio = ({ direccion, barrio, provincia } = {}) => {
  const partes = [direccion, barrio, provincia].filter((parte) => parte && String(parte).trim() !== '');
  return partes.length > 0 ? partes.join(', ') : null;
};

// Shape validation of the body (no I/O). Coordinates must be a point inside
// Argentina, latitude first. Returns { valores } or { error } (400).
export const validarSalida = (body) => {
  const coordenadas = normalizarCoordenadas(body?.latitud, body?.longitud);
  if (!coordenadas) return falla(400, ERROR_COORDENADAS_INVALIDAS);

  let domicilio = null;
  if (body.domicilio !== undefined && body.domicilio !== null && String(body.domicilio).trim() !== '') {
    domicilio = String(body.domicilio).trim();
    if (domicilio.length > MAX_DOMICILIO) {
      return falla(400, `El domicilio puede tener hasta ${MAX_DOMICILIO} caracteres.`);
    }
  }

  return {
    valores: {
      latitud: redondear5(coordenadas.latitud),
      longitud: redondear5(coordenadas.longitud),
      domicilio,
    },
  };
};

// Step 1 of the flow: the browser sends the position it got with the user's
// permission and this answers with an approximate address to confirm. Nothing
// is saved here. If the address cannot be found, the coordinates still come back.
export const sugerirSalida = async (body, { geocodificar = geocodificarCoordenadas } = {}) => {
  const validacion = validarSalida(body);
  if (validacion.error) return validacion;
  const { latitud, longitud } = validacion.valores;

  const direccion = await geocodificar({ latitud, longitud });
  return { data: { latitud, longitud, direccion: armarDomicilio(direccion) } };
};

export const obtenerSalida = async (idUsuario, { repo = repositorioSalida } = {}) => {
  const lectura = await repo.leer(idUsuario);
  if (lectura.dbError || !lectura.data) {
    console.error('[salida] no se pudo leer el punto de salida del usuario');
    return falla(lectura.dbError ? 500 : 404, lectura.dbError ? ERROR_DB : 'No existe el usuario.');
  }
  return { data: vista(lectura.data) };
};

// Step 2: only called after the user explicitly confirmed the location.
export const guardarSalida = async (idUsuario, body, { repo = repositorioSalida } = {}) => {
  const validacion = validarSalida(body);
  if (validacion.error) return validacion;

  const guardado = await repo.guardar(idUsuario, validacion.valores);
  if (guardado.dbError) {
    console.error('[salida] no se pudo guardar el punto de salida');
    return falla(500, ERROR_DB);
  }
  return { data: vista(guardado.data) };
};

export const quitarSalida = async (idUsuario, { repo = repositorioSalida } = {}) => {
  const limpiado = await repo.limpiar(idUsuario);
  if (limpiado.dbError) {
    console.error('[salida] no se pudo quitar el punto de salida');
    return falla(500, ERROR_DB);
  }
  return { data: vista(limpiado.data) };
};
