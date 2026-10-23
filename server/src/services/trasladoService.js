import { supabaseAdmin } from '../config/supabase.js';
import { normalizarCoordenadas } from '../utils/coordenadas.js';
import { calcularCostoTraslado } from '../utils/combustible.js';
import { obtenerPrecios } from './combustibleService.js';
import { distanciaKm } from './rutaService.js';

// Cost of the trip from the boss's departure point to a property:
// km x (consumo / 100) x fuel price per unit. One way only; raising this to 2
// makes it a round trip without touching anything else.
export const TRAMOS_TRASLADO = 1;

const MENSAJES = {
  sin_configuracion: 'Cargá tu ajuste de combustible (combustible y consumo) en Configuración para sumar el traslado.',
  sin_origen: 'Cargá tu punto de salida en Configuración para sumar el traslado.',
  inmueble_sin_ubicacion: 'El inmueble no tiene ubicación cargada: no se pudo calcular el traslado.',
  sin_precio: 'Tu combustible ya no tiene precio en la ciudad elegida. Revisá tu ajuste de combustible.',
  sin_ruteo: 'El cálculo de distancias no está configurado en el servidor.',
  ruta_no_disponible: 'No se pudo calcular la distancia hasta el inmueble. Intentá de nuevo más tarde.',
  error: 'No se pudo calcular el traslado.',
};

const sinTraslado = (motivo) => ({ incluido: false, motivo, mensaje: MENSAJES[motivo] });

// Data access. Replaceable in tests.
const leerConfigUsuario = async (idUsuario) => {
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select(
      'combustible_ciudad, combustible_tipo, combustible_empresa, combustible_producto, consumo_100km, latitud_base, longitud_base'
    )
    .eq('id', idUsuario)
    .maybeSingle();
  return error ? { dbError: error } : { data };
};

const leerInmueble = async (idInmueble) => {
  const { data, error } = await supabaseAdmin
    .from('inmuebles')
    .select('latitud, longitud')
    .eq('id_inmueble', idInmueble)
    .maybeSingle();
  return error ? { dbError: error } : { data };
};

// Resolves { incluido: true, km, costo, ...foto } or { incluido: false, motivo, mensaje }.
// Never throws: a budget without trip cost is still a valid budget.
export const calcularTraslado = async (
  { idUsuario, idInmueble },
  deps = {}
) => {
  const dependencias = {
    leerConfigUsuario,
    leerInmueble,
    obtenerPrecios,
    distanciaKm,
    ...deps,
  };

  try {
    const lecturaConfig = await dependencias.leerConfigUsuario(idUsuario);
    if (lecturaConfig.dbError) {
      console.error('[traslado] no se pudo leer la configuración del usuario');
      return sinTraslado('error');
    }
    const config = lecturaConfig.data;

    if (
      !config?.combustible_ciudad
      || !config.combustible_tipo
      || !config.combustible_empresa
      || !config.combustible_producto
      || !(Number(config.consumo_100km) > 0)
    ) {
      return sinTraslado('sin_configuracion');
    }

    const origen = normalizarCoordenadas(config.latitud_base, config.longitud_base);
    if (!origen) return sinTraslado('sin_origen');

    const lecturaInmueble = await dependencias.leerInmueble(idInmueble);
    if (lecturaInmueble.dbError) {
      console.error('[traslado] no se pudo leer el inmueble');
      return sinTraslado('error');
    }
    const destino = normalizarCoordenadas(lecturaInmueble.data?.latitud, lecturaInmueble.data?.longitud);
    if (!destino) return sinTraslado('inmueble_sin_ubicacion');

    const precios = await dependencias.obtenerPrecios(config.combustible_ciudad);
    if (precios.error) return sinTraslado('sin_precio');
    const precio = precios.data.precios.find(
      (p) =>
        p.empresa === config.combustible_empresa
        && p.producto === config.combustible_producto
        && p.tipo === config.combustible_tipo
    );
    if (!precio) return sinTraslado('sin_precio');

    const ruta = await dependencias.distanciaKm({ origen, destino });
    if (ruta.motivo) return sinTraslado(ruta.motivo);

    const costo = calcularCostoTraslado({
      km: ruta.km,
      consumo100km: config.consumo_100km,
      precioUnidad: precio.precio,
      tramos: TRAMOS_TRASLADO,
    });
    if (costo === null) return sinTraslado('error');

    return {
      incluido: true,
      km: ruta.km,
      costo,
      consumo_100km: Number(config.consumo_100km),
      precio_unidad: precio.precio,
      unidad: precio.unidad,
      combustible: `${precio.empresa} ${precio.producto}`,
      tramos: TRAMOS_TRASLADO,
      // true when the km are an estimate (straight line x detour), not a route.
      km_aproximados: ruta.aproximado === true,
      desactualizado: precios.data.desactualizado,
      precio_de_referencia: precio.precio_de_referencia,
    };
  } catch (error) {
    console.error('[traslado] error inesperado al calcular el traslado:', error.message);
    return sinTraslado('error');
  }
};

// Columns of presupuestos for the trip cost.
//
// The trip travels in `recargo_logistico`: the database computes
// monto_estimado = monto_subtotal - descuento + recargo_logistico with a trigger
// (and ignores any monto_estimado sent), so that is what makes the estimate and
// the suggested total include it. The other columns (migration 012) keep a
// snapshot of what was used, so the amount does not change if the fuel price
// does. Without trip, the surcharge goes back to 0 and the snapshot is cleared,
// so re-saving a budget never leaves a previous trip behind.
export const camposTrasladoPresupuesto = (traslado) =>
  traslado?.incluido
    ? {
        recargo_logistico: traslado.costo,
        monto_traslado: traslado.costo,
        traslado_km: traslado.km,
        traslado_consumo_100km: traslado.consumo_100km,
        traslado_precio_unidad: traslado.precio_unidad,
        traslado_unidad: traslado.unidad,
        traslado_combustible: traslado.combustible,
        traslado_aproximado: traslado.km_aproximados === true,
      }
    : {
        recargo_logistico: 0,
        monto_traslado: null,
        traslado_km: null,
        traslado_consumo_100km: null,
        traslado_precio_unidad: null,
        traslado_unidad: null,
        traslado_combustible: null,
        traslado_aproximado: null,
      };
