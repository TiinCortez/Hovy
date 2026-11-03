import { supabaseAdmin } from '../config/supabase.js';
import { hoyEnArgentina } from '../utils/fechaArgentina.js';
import { estaVacio, falla, parsearIdSolicitud } from '../utils/solicitudesVisita.js';

export const ESTADOS_TURNOS_FUTUROS = ['Coordinado', 'Confirmado', 'En ejecución'];

const LIMITE_DEFECTO = 20;
const LIMITE_MAXIMO = 100;
const ERROR_DB = 'No se pudieron consultar los turnos futuros. Intentá de nuevo más tarde.';

const formatearFechaCorta = (fechaIso) => {
  if (!fechaIso) return '';
  const partes = String(fechaIso).split('-');
  if (partes.length !== 3) return fechaIso;
  const [, mes, dia] = partes;
  return `${dia}/${mes}`;
};

const formatearHoraCorta = (hora) => {
  if (!hora || typeof hora !== 'string') return null;
  const limpia = hora.trim();
  return /^\d{2}:\d{2}(:\d{2})?$/.test(limpia) ? limpia.slice(0, 5) : limpia;
};

export const armarMensajeTurnosFuturosCliente = (turnos) => {
  if (!Array.isArray(turnos) || turnos.length === 0) {
    return 'No tenés turnos futuros programados.';
  }

  const encabezado =
    turnos.length === 1
      ? 'Tenés 1 turno programado:'
      : `Tenés ${turnos.length} turnos programados:`;

  const lineas = [encabezado, ''];

  turnos.forEach((t, indice) => {
    const fecha = formatearFechaCorta(t.fecha);
    const inicio = formatearHoraCorta(t.hora_inicio);
    const fin = formatearHoraCorta(t.hora_fin);
    const horario = inicio && fin ? ` de ${inicio} a ${fin} hs` : inicio ? ` a las ${inicio} hs` : '';
    const lugar = [t.direccion, t.barrio].filter(Boolean).join(', ');
    const servicio = t.servicio ? ` (${t.servicio})` : '';
    const ubicacion = lugar ? ` - ${lugar}` : '';

    lineas.push(`${indice + 1}. ${fecha}${horario}${ubicacion}${servicio} [${t.estado}]`);
  });

  return lineas.join('\n');
};

const parsearLimite = (valor) => {
  if (estaVacio(valor)) return LIMITE_DEFECTO;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) return null;
  return Math.min(numero, LIMITE_MAXIMO);
};

const obtenerServiciosPorPresupuesto = async (idsPresupuesto, cliente) => {
  const ids = [...new Set(idsPresupuesto.filter((id) => id !== null && id !== undefined))];
  const porPresupuesto = new Map();
  if (ids.length === 0) return porPresupuesto;

  const { data, error } = await cliente
    .from('detalle_presupuesto')
    .select('id_presupuesto, id_servicio, servicio:servicios_catalogo(nombre)')
    .in('id_presupuesto', ids);

  if (error) {
    console.error('[turnosCliente] error al consultar servicios de los turnos:', error);
    return porPresupuesto;
  }

  for (const fila of data ?? []) {
    const lista = porPresupuesto.get(fila.id_presupuesto) ?? [];
    const nombre = fila.servicio?.nombre;
    if (nombre && !lista.includes(nombre)) {
      lista.push(nombre);
    }
    porPresupuesto.set(fila.id_presupuesto, lista);
  }

  return porPresupuesto;
};

export const obtenerTurnosFuturosCliente = async ({
  idCliente,
  limite,
  ahora = new Date(),
  cliente = supabaseAdmin,
} = {}) => {
  const idClienteNum = parsearIdSolicitud(idCliente);
  if (!idClienteNum) {
    return falla(400, 'El id del cliente no es válido.');
  }

  const limiteNum = parsearLimite(limite);
  if (limiteNum === null) {
    return falla(400, `limite tiene que ser un número entero positivo (máximo ${LIMITE_MAXIMO}).`);
  }

  const hoy = hoyEnArgentina(ahora);

  try {
    const { data: turnos, error: errTurnos } = await cliente
      .from('turnos')
      .select(`
        id_turno,
        fecha_programada,
        inicio_desde,
        hasta,
        estado,
        id_presupuesto,
        inmueble:inmuebles!inner (
          id_inmueble,
          id_cliente,
          direccion,
          barrio
        )
      `)
      .eq('inmueble.id_cliente', idClienteNum)
      .gte('fecha_programada', hoy)
      .in('estado', ESTADOS_TURNOS_FUTUROS)
      .order('fecha_programada', { ascending: true })
      .order('inicio_desde', { ascending: true })
      .limit(limiteNum);

    if (errTurnos) {
      console.error('[turnosCliente] error al consultar turnos futuros:', errTurnos);
      return falla(500, ERROR_DB);
    }

    if (!turnos || turnos.length === 0) {
      return {
        data: [],
        mensaje: armarMensajeTurnosFuturosCliente([]),
      };
    }

    const serviciosPorPresupuesto = await obtenerServiciosPorPresupuesto(
      turnos.map((t) => t.id_presupuesto),
      cliente
    );

    const formateados = turnos.map((t) => {
      const inmueble = t.inmueble ?? {};
      const servicios = serviciosPorPresupuesto.get(t.id_presupuesto) ?? [];
      return {
        id_turno: t.id_turno,
        fecha: t.fecha_programada,
        hora_inicio: t.inicio_desde ?? null,
        hora_fin: t.hasta ?? null,
        estado: t.estado,
        id_inmueble: inmueble.id_inmueble ?? null,
        direccion: inmueble.direccion ?? null,
        barrio: inmueble.barrio ?? null,
        servicio: servicios.length > 0 ? servicios.join(', ') : null,
        servicios,
      };
    });

    return {
      data: formateados,
      mensaje: armarMensajeTurnosFuturosCliente(formateados),
    };
  } catch (err) {
    console.error('[turnosCliente] error inesperado al consultar turnos futuros:', err);
    return falla(500, ERROR_DB);
  }
};
