import { supabaseAdmin } from '../config/supabase.js';
import { validarFechaAltaTurno } from '../utils/turnosFecha.js';
import { validarSolapamientoTurno } from '../utils/algoritmoAgenda.js';
import { guardarPresupuestoParaTurno } from '../services/presupuestoService.js';
import { responderErrorServicio } from '../utils/solicitudesVisita.js';

// Lo que espera estrictamente la DB de Supabase para sus CHECK constraints
export const PRIORIDADES_VALIDAS = ['P1_Reasignado', 'P2_Fijo', 'P3_Casual'];
export const ESTADOS_VALIDOS = ['Coordinado', 'Confirmado', 'En ejecución', 'Realizado', 'Cancelado'];

// Mapeadores para traducir de Frontend (MAYÚSCULAS) a DB (Title Case)
const mapToDBPrioridad = (p) => {
  const val = p?.toUpperCase();
  if (val === 'P1_REASIGNADO') return 'P1_Reasignado';
  if (val === 'P2_FIJO') return 'P2_Fijo';
  if (val === 'P3_CASUAL') return 'P3_Casual';
  return p;
};

const mapToDBEstado = (e) => {
  const val = e?.toUpperCase();
  if (val === 'COORDINADO') return 'Coordinado';
  if (val === 'CONFIRMADO') return 'Confirmado';
  if (val === 'EN_EJECUCION' || val === 'EN EJECUCIÓN') return 'En ejecución';
  if (val === 'REALIZADO') return 'Realizado';
  if (val === 'CANCELADO') return 'Cancelado';
  return e || 'Coordinado';
};  

// Mapeador inverso: DB -> Frontend
const mapToFrontendEstado = (e) => {
  if (!e) return 'COORDINADO';
  if (e.toLowerCase() === 'en ejecución' || e.toLowerCase() === 'en ejecucion') return 'EN_EJECUCION';
  return e.toUpperCase();
};
const DESCRIPCION_SIN_SERVICIO = 'Servicio programado (Sin presupuesto asociado)';

// Servicios y resumen de presupuesto contratados por presupuesto.
// Un fallo acá no debe tirar el listado de turnos, así que degrada a vacío.
const obtenerServiciosPorPresupuesto = async (idsPresupuesto) => {
  const ids = [...new Set(idsPresupuesto.filter((id) => id !== null && id !== undefined))];
  const porPresupuesto = new Map();
  if (ids.length === 0) return porPresupuesto;

  const [resDetalles, resPresupuestos] = await Promise.all([
    supabaseAdmin
      .from('detalle_presupuesto')
      .select('id_presupuesto, id_servicio, servicio:servicios_catalogo(nombre)')
      .in('id_presupuesto', ids),
    supabaseAdmin
      .from('presupuestos')
      .select('id_presupuesto, monto_estimado, monto_subtotal, monto_total, estado')
      .in('id_presupuesto', ids),
  ]);

  if (resDetalles.error) {
    console.error('Error al consultar los servicios de los turnos:', resDetalles.error);
  }
  if (resPresupuestos.error) {
    console.error('Error al consultar los presupuestos de los turnos:', resPresupuestos.error);
  }

  for (const p of resPresupuestos.data ?? []) {
    porPresupuesto.set(p.id_presupuesto, {
      nombres: [],
      id_servicio: null,
      presupuesto: {
        id_presupuesto: p.id_presupuesto,
        monto_estimado: Number(p.monto_estimado ?? 0),
        monto_subtotal: Number(p.monto_subtotal ?? 0),
        monto_total: Number(p.monto_total ?? 0),
        estado: p.estado,
      },
    });
  }

  for (const fila of resDetalles.data ?? []) {
    const actual = porPresupuesto.get(fila.id_presupuesto) ?? {
      nombres: [],
      id_servicio: null,
      presupuesto: null,
    };
    if (!actual.id_servicio && fila.id_servicio) {
      actual.id_servicio = Number(fila.id_servicio);
    }
    const nombre = fila.servicio?.nombre;
    if (nombre && !actual.nombres.includes(nombre)) {
      actual.nombres.push(nombre);
    }
    porPresupuesto.set(fila.id_presupuesto, actual);
  }
  return porPresupuesto;
};

const armarServicio = (infoPresupuesto) => {
  const nombres = Array.isArray(infoPresupuesto)
    ? infoPresupuesto
    : (infoPresupuesto?.nombres ?? []);
  const idServicio = Array.isArray(infoPresupuesto)
    ? null
    : (infoPresupuesto?.id_servicio ?? null);
  return {
    id_servicio: idServicio,
    nombres,
    descripcion: nombres.length > 0 ? nombres.join(', ') : DESCRIPCION_SIN_SERVICIO
  };
};

const formatearTurnoRespuesta = (t, infoPresupuesto) => ({
  idTurno: t.id_turno,
  fechaAsignada: t.fecha_programada,
  franjaHoraria: { horaInicio: t.inicio_desde, horaFin: t.hasta },
  prioridad: t.prioridad?.toUpperCase() || 'P3_CASUAL',
  estado: mapToFrontendEstado(t.estado),
  motivo_cancelacion: t.motivo_cancelacion,
  // Estado de cobro del turno (vista de Cobros). null se toma como pendiente.
  cobrado: t.cobrado === true,
  inmueble: t.inmueble,
  cliente: t.inmueble?.cliente,
  servicio: armarServicio(infoPresupuesto),
  presupuesto: infoPresupuesto?.presupuesto ?? null,
});

// GET /api/turnos
export const getTurnos = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('turnos')
      .select(`
        *,
        inmueble:inmuebles (
          *,
          cliente:clientes (*)
        )
      `)
      .order('fecha_programada', { ascending: true });

    if (error) throw error;

    const serviciosPorPresupuesto = await obtenerServiciosPorPresupuesto(data.map(t => t.id_presupuesto));

    const turnosFormateados = data.map(t =>
      formatearTurnoRespuesta(t, serviciosPorPresupuesto.get(t.id_presupuesto))
    );

    res.status(200).json({ ok: true, data: turnosFormateados });
  } catch (error) {
    console.error('Error al obtener turnos:', error);
    res.status(500).json({ ok: false, error: 'Error al consultar la lista de turnos.' });
  }
};

// GET /api/turnos/:id
export const getTurnoById = async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabaseAdmin
      .from('turnos')
      .select('*, inmueble:inmuebles(*, cliente:clientes(*))')
      .eq('id_turno', id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ ok: false, error: 'Turno no encontrado.' });

    const serviciosPorPresupuesto = await obtenerServiciosPorPresupuesto([data.id_presupuesto]);
    const turnoFormateado = formatearTurnoRespuesta(data, serviciosPorPresupuesto.get(data.id_presupuesto));

    res.status(200).json({ ok: true, data: turnoFormateado });
  } catch (error) {
    console.error('Error al obtener el turno:', error);
    res.status(500).json({ ok: false, error: 'Error al consultar el detalle del turno.' });
  }
};

// POST /api/turnos/nuevo
export const createTurno = async (req, res) => {
  const { id_inmueble, id_servicio, monto_total, fecha_programada, inicio_desde, hasta, prioridad, estado } = req.body;

  if (!id_inmueble || !fecha_programada || !inicio_desde || !hasta || !prioridad) {
    return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios para agendar el turno.' });
  }

  const errorFecha = validarFechaAltaTurno(fecha_programada, inicio_desde, hasta);
  if (errorFecha) return res.status(400).json({ ok: false, error: errorFecha });

  try {
    if (mapToDBEstado(estado) !== 'Cancelado' && await validarSolapamientoTurno({ fecha_programada, inicio_desde, hasta })) {
      return res.status(409).json({ ok: false, error: 'La franja seleccionada se superpone con otro turno.' });
    }

    if (!id_servicio) {
      return res.status(400).json({ ok: false, error: 'Debes seleccionar un servicio para agendar el turno.' });
    }

    const resultadoPresupuesto = await guardarPresupuestoParaTurno({
      idInmueble: id_inmueble,
      idServicio: id_servicio,
      idUsuario: Number(req.user?.sub),
      montoTotal: monto_total,
    });

    if (resultadoPresupuesto.error) {
      return responderErrorServicio(res, resultadoPresupuesto.error);
    }

    const idPresupuesto = resultadoPresupuesto.presupuesto.id_presupuesto;
    const nombresServicio = resultadoPresupuesto.nombreServicio
      ? [resultadoPresupuesto.nombreServicio]
      : [];

    const { data, error } = await supabaseAdmin
      .from('turnos')
      .insert({
        id_inmueble,
        id_presupuesto: idPresupuesto,
        fecha_programada,
        inicio_desde,
        hasta,
        prioridad: mapToDBPrioridad(prioridad),
        estado: mapToDBEstado(estado)
      })
      .select('*, inmueble:inmuebles(*, cliente:clientes(*))')
      .single();

    if (error) {
      await supabaseAdmin.from('detalle_presupuesto').delete().eq('id_presupuesto', idPresupuesto);
      await supabaseAdmin.from('presupuestos').delete().eq('id_presupuesto', idPresupuesto);
      throw error;
    }

    const turnoFormateado = formatearTurnoRespuesta(data, {
      nombres: nombresServicio,
      id_servicio: resultadoPresupuesto.idServicio ?? Number(id_servicio),
      presupuesto: {
        id_presupuesto: idPresupuesto,
        monto_estimado: Number(resultadoPresupuesto.presupuesto.monto_estimado ?? 0),
        monto_subtotal: Number(resultadoPresupuesto.presupuesto.monto_subtotal ?? 0),
        monto_total: Number(resultadoPresupuesto.presupuesto.monto_total ?? 0),
        estado: resultadoPresupuesto.presupuesto.estado ?? 'Aceptado',
        traslado: resultadoPresupuesto.traslado ?? null,
      },
    });

    res.status(201).json({ ok: true, data: turnoFormateado });
  } catch (error) {
    console.error('Error al crear turno:', error);
    res.status(500).json({ ok: false, error: 'No se pudo agendar el turno. Verifique los datos de entrada.' });
  }
};

// PUT /api/turnos/:id
export const updateTurno = async (req, res) => {
  const { id } = req.params;
  const { id_inmueble, id_servicio, monto_total, fecha_programada, inicio_desde, hasta, prioridad, estado, cobrado } = req.body;

  // cobrado es opcional: solo se valida si viene en el body.
  if (cobrado !== undefined && typeof cobrado !== 'boolean') {
    return res.status(400).json({ ok: false, error: 'cobrado tiene que ser verdadero o falso.' });
  }

  try {
    const { data: actual, error: errorConsulta } = await supabaseAdmin
      .from('turnos')
      .select('id_turno, id_inmueble, id_presupuesto, fecha_programada, inicio_desde, hasta, estado, prioridad')
      .eq('id_turno', id)
      .maybeSingle();
    if (errorConsulta) throw errorConsulta;
    if (!actual) return res.status(404).json({ ok: false, error: 'Turno no encontrado.' });

    const nuevaFecha = fecha_programada === undefined ? actual.fecha_programada : fecha_programada;
    const nuevoInicio = inicio_desde === undefined ? actual.inicio_desde : inicio_desde;
    const nuevoFin = hasta === undefined ? actual.hasta : hasta;
    const nuevoEstado = estado === undefined ? actual.estado : mapToDBEstado(estado);

    // Solo un turno Realizado puede quedar marcado como cobrado.
    if (cobrado === true && nuevoEstado !== 'Realizado') {
      return res.status(409).json({
        ok: false,
        error: `Solo se puede registrar el cobro de un turno Realizado (estado actual: ${nuevoEstado}).`
      });
    }

    // Postgres devuelve HH:MM:SS; los selectores también pueden enviar HH:MM.
    const horaComparable = (hora) => typeof hora === 'string' && hora.length === 5 ? `${hora}:00` : hora;
    const reprogramado = nuevaFecha !== actual.fecha_programada
      || horaComparable(nuevoInicio) !== horaComparable(actual.inicio_desde)
      || horaComparable(nuevoFin) !== horaComparable(actual.hasta);

    if (reprogramado) {
      const errorFecha = validarFechaAltaTurno(nuevaFecha, nuevoInicio, nuevoFin);
      if (errorFecha) return res.status(400).json({ ok: false, error: errorFecha });
    }

    const reactivado = actual.estado === 'Cancelado' && nuevoEstado !== 'Cancelado';
    if ((reprogramado || reactivado) && nuevoEstado !== 'Cancelado' && nuevoInicio && nuevoFin
      && await validarSolapamientoTurno({ fecha_programada: nuevaFecha, inicio_desde: nuevoInicio, hasta: nuevoFin, id_turno_a_excluir: id })) {
      return res.status(409).json({ ok: false, error: 'La franja seleccionada se superpone con otro turno.' });
    }

    const nuevoIdInmueble = id_inmueble === undefined ? actual.id_inmueble : Number(id_inmueble);
    let nuevoIdPresupuesto = actual.id_presupuesto;
    const actualizaDatosPresupuesto = id_inmueble !== undefined || id_servicio !== undefined || monto_total !== undefined;

    if (actualizaDatosPresupuesto) {
      if (actual.estado === 'Realizado' || actual.estado === 'Cancelado') {
        return res.status(409).json({
          ok: false,
          error: 'No se puede modificar el cliente, inmueble, servicio o monto de un turno realizado o cancelado.'
        });
      }

      const resultadoPresupuesto = await guardarPresupuestoParaTurno({
        idPresupuesto: actual.id_presupuesto,
        idInmueble: nuevoIdInmueble,
        idServicio: id_servicio,
        idUsuario: Number(req.user?.sub),
        montoTotal: monto_total,
      });

      if (resultadoPresupuesto.error) {
        return responderErrorServicio(res, resultadoPresupuesto.error);
      }

      nuevoIdPresupuesto = resultadoPresupuesto.presupuesto.id_presupuesto;
    }

    const camposUpdate = {
      fecha_programada: nuevaFecha,
      inicio_desde: nuevoInicio,
      hasta: nuevoFin,
      prioridad: prioridad === undefined ? actual.prioridad : mapToDBPrioridad(prioridad),
      estado: nuevoEstado,
    };
    if (id_inmueble !== undefined) camposUpdate.id_inmueble = nuevoIdInmueble;
    if (nuevoIdPresupuesto !== actual.id_presupuesto) camposUpdate.id_presupuesto = nuevoIdPresupuesto;
    if (cobrado !== undefined) camposUpdate.cobrado = cobrado;

    const { data, error } = await supabaseAdmin
      .from('turnos')
      .update(camposUpdate)
      .eq('id_turno', id)
      .select('*, inmueble:inmuebles(*, cliente:clientes(*))')
      .single();

    // P0001 = trg_turno_realizado o trg_turno_cancelado rechazaron el cambio de
    // estado (presupuesto no Aceptado, total 0, o turno ya imputado en la cuenta
    // corriente): el turno no cambió y el mensaje de la base explica por qué.
    if (error?.code === 'P0001') return res.status(409).json({ ok: false, error: error.message });
    if (error) throw error;

    const serviciosPorPresupuesto = await obtenerServiciosPorPresupuesto([data.id_presupuesto]);
    const turnoFormateado = formatearTurnoRespuesta(data, serviciosPorPresupuesto.get(data.id_presupuesto));

    res.status(200).json({ ok: true, data: turnoFormateado });
  } catch (error) {
    console.error('Error al actualizar turno:', error);
    res.status(500).json({ ok: false, error: 'Error al actualizar el turno.' });
  }
};

// PATCH /api/turnos/:id/cancelar
export const cancelarTurno = async (req, res) => {
  const { id } = req.params;
  const { motivo_cancelacion } = req.body;

  try {
    const { data, error } = await supabaseAdmin
      .from('turnos')
      .update({
        estado: 'Cancelado', // Exactamente como lo espera la base de datos
        motivo_cancelacion: motivo_cancelacion || 'Cancelado por el administrador'
      })
      .eq('id_turno', id)
      .select()
      .single();

    // P0001 = trg_turno_cancelado: el turno ya tiene un trabajo registrado.
    if (error?.code === 'P0001') return res.status(409).json({ ok: false, error: error.message });
    if (error) throw error;

    res.status(200).json({ ok: true, data });
  } catch (error) {
    console.error('Error al cancelar turno:', error);
    res.status(500).json({ ok: false, error: 'Error al cancelar el turno.' });
  }
};