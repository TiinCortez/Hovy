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

// ---- Responder un turno desde WhatsApp: confirmar o cancelar ---------------------------------
//
// El cliente toca [Confirmar] o [Cancelar] en el aviso del turno. Reglas:
//  - Solo opera sobre sus turnos: el id_cliente sale del teléfono del que escribe (nunca del
//    body) y va en la misma consulta, así un turno ajeno se ve igual que uno inexistente (404).
//  - Cancelar NO borra: marca el turno como Cancelado (igual que el panel). El hueco se libera
//    porque la agenda ignora los turnos cancelados, y quedan el presupuesto y el historial.
//  - Idempotente: repetir el mismo toque no falla ni escribe de nuevo.
//  - La condición de estado va en el mismo UPDATE, para que dos toques a la vez no se pisen.
//  - La base puede rechazar la cancelación (trigger: el turno ya tiene un trabajo registrado).

const ERROR_DB_RESPUESTA = 'No se pudo actualizar el turno. Intentá de nuevo más tarde.';
const MOTIVO_CANCELACION_CLIENTE = 'Cancelado por el cliente (WhatsApp)';
const COLUMNAS_TURNO_CLIENTE = 'id_turno, estado, fecha_programada, inicio_desde, hasta, inmueble:inmuebles!inner(id_cliente, direccion)';

const resumenTurnoCliente = (turno, estado, yaAplicado) => ({
  id_turno: turno.id_turno,
  estado,
  fecha: turno.fecha_programada,
  hora_inicio: formatearHoraCorta(turno.inicio_desde),
  hora_fin: formatearHoraCorta(turno.hasta),
  direccion: turno.inmueble?.direccion ?? null,
  ya_aplicado: yaAplicado,
});

const cargarTurnoDelCliente = async (cliente, idCliente, idTurno) => {
  const { data, error } = await cliente
    .from('turnos')
    .select(COLUMNAS_TURNO_CLIENTE)
    .eq('id_turno', idTurno)
    .eq('inmueble.id_cliente', idCliente)
    .maybeSingle();

  if (error) {
    console.error('[turnosCliente] error al leer el turno del cliente:', error?.code || 'error');
    return { error: { status: 500, message: ERROR_DB_RESPUESTA } };
  }
  if (!data) return falla(404, 'No encontré ese turno.');
  return { turno: data };
};

// Si el UPDATE no encontró fila, puede ser que otro toque (reintento de la entrega o doble toque)
// ya hizo el mismo cambio entre la lectura y la escritura. Se relee: si el turno ya está en el
// estado pedido, es éxito (idempotente); si quedó en otro estado, es un 409 real.
const resolverCarrera = async (cliente, idCliente, id, estadoEsperado, mensajeConflicto) => {
  const relectura = await cargarTurnoDelCliente(cliente, idCliente, id);
  if (!relectura.error && relectura.turno.estado === estadoEsperado) {
    return { data: resumenTurnoCliente(relectura.turno, estadoEsperado, true) };
  }
  return falla(409, mensajeConflicto);
};

export const confirmarTurnoDelCliente = async ({ idCliente, idTurno, ahora = new Date(), cliente = supabaseAdmin } = {}) => {
  const id = parsearIdSolicitud(idTurno);
  if (!id) return falla(400, 'El id del turno tiene que ser un número entero positivo.');

  const lectura = await cargarTurnoDelCliente(cliente, idCliente, id);
  if (lectura.error) return lectura;
  const { turno } = lectura;

  if (turno.estado === 'Confirmado') return { data: resumenTurnoCliente(turno, 'Confirmado', true) };
  if (turno.estado === 'Cancelado') return falla(409, 'Ese turno ya fue cancelado.');
  if (turno.estado !== 'Coordinado') return falla(409, 'Ese turno ya no se puede confirmar.');
  if (String(turno.fecha_programada).slice(0, 10) < hoyEnArgentina(ahora)) return falla(409, 'Ese turno ya pasó.');

  const { data, error } = await cliente
    .from('turnos')
    .update({ estado: 'Confirmado' })
    .eq('id_turno', id)
    .eq('estado', 'Coordinado')
    .select(COLUMNAS_TURNO_CLIENTE)
    .maybeSingle();

  if (error) {
    console.error('[turnosCliente] error al confirmar el turno:', error?.code || 'error');
    return falla(500, ERROR_DB_RESPUESTA);
  }
  if (!data) return resolverCarrera(cliente, idCliente, id, 'Confirmado', 'El turno cambió de estado mientras lo confirmabas. Revisalo de nuevo.');

  return { data: resumenTurnoCliente(data, 'Confirmado', false) };
};

export const cancelarTurnoDelCliente = async ({ idCliente, idTurno, ahora = new Date(), cliente = supabaseAdmin } = {}) => {
  const id = parsearIdSolicitud(idTurno);
  if (!id) return falla(400, 'El id del turno tiene que ser un número entero positivo.');

  const lectura = await cargarTurnoDelCliente(cliente, idCliente, id);
  if (lectura.error) return lectura;
  const { turno } = lectura;

  if (turno.estado === 'Cancelado') return { data: resumenTurnoCliente(turno, 'Cancelado', true) };
  if (!['Coordinado', 'Confirmado'].includes(turno.estado)) {
    return falla(409, 'Ese turno ya no se puede cancelar: está en curso o ya se realizó.');
  }
  if (String(turno.fecha_programada).slice(0, 10) < hoyEnArgentina(ahora)) return falla(409, 'Ese turno ya pasó.');

  const { data, error } = await cliente
    .from('turnos')
    .update({ estado: 'Cancelado', motivo_cancelacion: MOTIVO_CANCELACION_CLIENTE })
    .eq('id_turno', id)
    .in('estado', ['Coordinado', 'Confirmado'])
    .select(COLUMNAS_TURNO_CLIENTE)
    .maybeSingle();

  // P0001 = trg_turno_cancelado: el turno ya tiene un trabajo registrado.
  if (error?.code === 'P0001') return falla(409, error.message);
  if (error) {
    console.error('[turnosCliente] error al cancelar el turno:', error?.code || 'error');
    return falla(500, ERROR_DB_RESPUESTA);
  }
  if (!data) return resolverCarrera(cliente, idCliente, id, 'Cancelado', 'El turno cambió de estado mientras lo cancelabas. Revisalo de nuevo.');

  return { data: resumenTurnoCliente(data, 'Cancelado', false) };
};
