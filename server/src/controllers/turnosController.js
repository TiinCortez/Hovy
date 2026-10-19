import { supabaseAdmin } from '../config/supabase.js';
import { validarFechaAltaTurno } from '../utils/turnosFecha.js';
import { validarSolapamientoTurno } from '../utils/algoritmoAgenda.js';
import { crearPresupuestoParaTurno } from '../services/presupuestoService.js';
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

// Servicios contratados por presupuesto: Map<id_presupuesto, string[]>.
// Un fallo acá no debe tirar el listado de turnos, así que degrada a vacío.
const obtenerServiciosPorPresupuesto = async (idsPresupuesto) => {
  const ids = [...new Set(idsPresupuesto.filter((id) => id !== null && id !== undefined))];
  const porPresupuesto = new Map();
  if (ids.length === 0) return porPresupuesto;

  const { data, error } = await supabaseAdmin
    .from('detalle_presupuesto')
    .select('id_presupuesto, servicio:servicios_catalogo(nombre)')
    .in('id_presupuesto', ids);

  if (error) {
    console.error('Error al consultar los servicios de los turnos:', error);
    return porPresupuesto;
  }

  for (const fila of data ?? []) {
    const nombre = fila.servicio?.nombre;
    if (!nombre) continue;
    const nombres = porPresupuesto.get(fila.id_presupuesto) ?? [];
    if (!nombres.includes(nombre)) nombres.push(nombre);
    porPresupuesto.set(fila.id_presupuesto, nombres);
  }
  return porPresupuesto;
};

const armarServicio = (nombres = []) => ({
  nombres,
  descripcion: nombres.length > 0 ? nombres.join(', ') : DESCRIPCION_SIN_SERVICIO
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

    const turnosFormateados = data.map(t => ({
      idTurno: t.id_turno,
      fechaAsignada: t.fecha_programada,
      franjaHoraria: { horaInicio: t.inicio_desde, horaFin: t.hasta },
      prioridad: t.prioridad?.toUpperCase() || 'P3_CASUAL',
      estado: mapToFrontendEstado(t.estado),
      motivo_cancelacion: t.motivo_cancelacion,
      inmueble: t.inmueble,
      cliente: t.inmueble?.cliente,
      servicio: armarServicio(serviciosPorPresupuesto.get(t.id_presupuesto))
    }));

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

    const turnoFormateado = {
      idTurno: data.id_turno,
      fechaAsignada: data.fecha_programada,
      franjaHoraria: { horaInicio: data.inicio_desde, horaFin: data.hasta },
      prioridad: data.prioridad?.toUpperCase(),
      estado: mapToFrontendEstado(data.estado),
      motivo_cancelacion: data.motivo_cancelacion,
      inmueble: data.inmueble,
      cliente: data.inmueble?.cliente,
      servicio: armarServicio(serviciosPorPresupuesto.get(data.id_presupuesto))
    };

    res.status(200).json({ ok: true, data: turnoFormateado });
  } catch (error) {
    console.error('Error al obtener el turno:', error);
    res.status(500).json({ ok: false, error: 'Error al consultar el detalle del turno.' });
  }
};

// POST /api/turnos/nuevo
export const createTurno = async (req, res) => {
  const { id_inmueble, id_servicio, fecha_programada, inicio_desde, hasta, prioridad, estado } = req.body;

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

    const resultadoPresupuesto = await crearPresupuestoParaTurno({
      idInmueble: id_inmueble,
      idServicio: id_servicio,
      idUsuario: Number(req.user?.sub),
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

    const turnoFormateado = {
      idTurno: data.id_turno,
      fechaAsignada: data.fecha_programada,
      franjaHoraria: { horaInicio: data.inicio_desde, horaFin: data.hasta },
      prioridad: data.prioridad?.toUpperCase(),
      estado: mapToFrontendEstado(data.estado),
      inmueble: data.inmueble,
      cliente: data.inmueble?.cliente,
      servicio: armarServicio(nombresServicio)
    };

    res.status(201).json({ ok: true, data: turnoFormateado });
  } catch (error) {
    console.error('Error al crear turno:', error);
    res.status(500).json({ ok: false, error: 'No se pudo agendar el turno. Verifique los datos de entrada.' });
  }
};

// PUT /api/turnos/:id
export const updateTurno = async (req, res) => {
  const { id } = req.params;
  const { fecha_programada, inicio_desde, hasta, prioridad, estado } = req.body;

  try {
    const { data: actual, error: errorConsulta } = await supabaseAdmin
      .from('turnos')
      .select('id_turno, fecha_programada, inicio_desde, hasta, estado, prioridad')
      .eq('id_turno', id)
      .maybeSingle();
    if (errorConsulta) throw errorConsulta;
    if (!actual) return res.status(404).json({ ok: false, error: 'Turno no encontrado.' });

    const nuevaFecha = fecha_programada === undefined ? actual.fecha_programada : fecha_programada;
    const nuevoInicio = inicio_desde === undefined ? actual.inicio_desde : inicio_desde;
    const nuevoFin = hasta === undefined ? actual.hasta : hasta;
    const nuevoEstado = estado === undefined ? actual.estado : mapToDBEstado(estado);
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

    const { data, error } = await supabaseAdmin
      .from('turnos')
      .update({
        fecha_programada: nuevaFecha,
        inicio_desde: nuevoInicio,
        hasta: nuevoFin,
        prioridad: prioridad === undefined ? actual.prioridad : mapToDBPrioridad(prioridad),
        estado: nuevoEstado
      })
      .eq('id_turno', id)
      .select('*, inmueble:inmuebles(*, cliente:clientes(*))')
      .single();

    // P0001 = trg_turno_realizado o trg_turno_cancelado rechazaron el cambio de
    // estado (presupuesto no Aceptado, total 0, o turno ya imputado en la cuenta
    // corriente): el turno no cambió y el mensaje de la base explica por qué.
    if (error?.code === 'P0001') return res.status(409).json({ ok: false, error: error.message });
    if (error) throw error;

    const serviciosPorPresupuesto = await obtenerServiciosPorPresupuesto([data.id_presupuesto]);

    const turnoFormateado = {
      idTurno: data.id_turno,
      fechaAsignada: data.fecha_programada,
      franjaHoraria: { horaInicio: data.inicio_desde, horaFin: data.hasta },
      prioridad: data.prioridad?.toUpperCase(),
      estado: mapToFrontendEstado(data.estado),
      inmueble: data.inmueble,
      cliente: data.inmueble?.cliente,
      servicio: armarServicio(serviciosPorPresupuesto.get(data.id_presupuesto))
    };

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
