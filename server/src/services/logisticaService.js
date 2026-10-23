import { supabaseAdmin } from '../config/supabase.js';
import { falla } from '../utils/solicitudesVisita.js';
import { normalizarCoordenadas } from '../utils/coordenadas.js';
import { armarRutaDelDia } from '../utils/rutaDia.js';
import { calcularConsumoEstimado, calcularCostoTraslado } from '../utils/combustible.js';
import { obtenerPrecios } from './combustibleService.js';
import { distanciaRutaKm } from './rutaService.js';
import { leerConfigUsuario, TRAMOS_TRASLADO } from './trasladoService.js';

// Logistics of one day: how many turnos and clients, the route from the
// boss's departure point through the turnos in time order, and the fuel (or
// gas) that route needs. The agenda is global (all the crew's turnos), measured
// from the departure point and with the fuel settings of the user who asks.
//
// The route is one way: departure point -> first turno -> ... -> last turno.
//
// The answer never carries coordinates. Services never touch req/res: they
// return { error: { status, message } } or { data }.

const ERROR_DB = 'No se pudo completar la operación. Intentá de nuevo más tarde.';

const MENSAJES = {
  sin_turnos: 'No hay turnos ese día.',
  sin_ubicacion: 'Ningún turno del día tiene la ubicación del inmueble cargada.',
  sin_origen: 'Cargá tu punto de salida en tu Perfil para calcular la ruta.',
  sin_configuracion: 'Cargá tu combustible y tu consumo en Configuración para estimar el gasto.',
  sin_precio: 'Tu combustible ya no tiene precio en la ciudad elegida. Revisá Configuración.',
  sin_ruteo: 'El cálculo de distancias no está configurado en el servidor.',
  ruta_no_disponible: 'No se pudo calcular la distancia de la ruta. Intentá de nuevo más tarde.',
  error: 'No se pudo calcular la logística del día.',
};

const noIncluido = (motivo) => ({ incluido: false, motivo, mensaje: MENSAJES[motivo] ?? MENSAJES.error });

// Data access. Replaceable in tests.
const leerTurnosDelDia = async (fecha) => {
  const { data, error } = await supabaseAdmin
    .from('turnos')
    .select('id_turno, inicio_desde, estado, inmueble:inmuebles(id_cliente, latitud, longitud)')
    .eq('fecha_programada', fecha)
    .neq('estado', 'Cancelado')
    .order('inicio_desde', { ascending: true });
  return error ? { dbError: error } : { data: data ?? [] };
};

// Fuel block from the user's settings and the km of the day.
const calcularCombustible = async (config, km, dependencias) => {
  if (
    !config?.combustible_ciudad
    || !config.combustible_tipo
    || !config.combustible_empresa
    || !config.combustible_producto
    || !(Number(config.consumo_100km) > 0)
  ) {
    return noIncluido('sin_configuracion');
  }

  const precios = await dependencias.obtenerPrecios(config.combustible_ciudad);
  const precio = precios.error
    ? null
    : precios.data.precios.find(
        (p) =>
          p.empresa === config.combustible_empresa
          && p.producto === config.combustible_producto
          && p.tipo === config.combustible_tipo
      );
  if (!precio) return noIncluido('sin_precio');

  const cantidad = calcularConsumoEstimado({ km, consumo100km: config.consumo_100km });
  const costo = calcularCostoTraslado({
    km,
    consumo100km: config.consumo_100km,
    precioUnidad: precio.precio,
    tramos: TRAMOS_TRASLADO,
  });
  if (cantidad === null || costo === null) return noIncluido('error');

  return {
    incluido: true,
    cantidad,
    unidad: precio.unidad,
    costo,
    combustible: `${precio.empresa} ${precio.producto}`,
    desactualizado: precios.data.desactualizado,
    precio_de_referencia: precio.precio_de_referencia,
  };
};

// Resolves { data: { fecha, turnos, clientes_a_visitar, sin_ubicacion, sin_horario,
// ruta, combustible } } or { error }. `ruta` and `combustible` each carry
// incluido true with the numbers, or false with a motivo and a mensaje: the
// counts of turnos and clients are always there.
export const obtenerLogisticaDia = async ({ idUsuario, fecha }, deps = {}) => {
  const dependencias = { leerTurnosDelDia, leerConfigUsuario, obtenerPrecios, distanciaRutaKm, ...deps };

  try {
    const lecturaTurnos = await dependencias.leerTurnosDelDia(fecha);
    if (lecturaTurnos.dbError) {
      console.error('[logistica] no se pudieron leer los turnos del día');
      return falla(500, ERROR_DB);
    }

    const dia = armarRutaDelDia(lecturaTurnos.data);
    const base = {
      fecha,
      turnos: dia.turnos,
      clientes_a_visitar: dia.clientes,
      sin_ubicacion: dia.sin_ubicacion,
      sin_horario: dia.sin_horario,
    };
    const sinRuta = (motivo) => ({ data: { ...base, ruta: noIncluido(motivo), combustible: noIncluido(motivo) } });

    if (dia.turnos === 0) return sinRuta('sin_turnos');
    if (dia.puntos.length === 0) return sinRuta('sin_ubicacion');

    const lecturaConfig = await dependencias.leerConfigUsuario(idUsuario);
    if (lecturaConfig.dbError) {
      console.error('[logistica] no se pudo leer la configuración del usuario');
      return sinRuta('error');
    }
    const config = lecturaConfig.data;

    const origen = normalizarCoordenadas(config?.latitud_base, config?.longitud_base);
    if (!origen) return sinRuta('sin_origen');

    const recorrido = await dependencias.distanciaRutaKm({ puntos: [origen, ...dia.puntos] });
    if (recorrido.motivo) return sinRuta(recorrido.motivo);

    return {
      data: {
        ...base,
        ruta: {
          incluido: true,
          km: recorrido.km,
          km_aproximados: recorrido.aproximado === true,
          paradas: dia.puntos.length,
        },
        combustible: await calcularCombustible(config, recorrido.km, dependencias),
      },
    };
  } catch (error) {
    console.error('[logistica] error inesperado al calcular la logística del día:', error.message);
    return falla(500, ERROR_DB);
  }
};
