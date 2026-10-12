import { supabaseAdmin } from '../config/supabase.js';
import {
  ERROR_ID_SOLICITUD_INVALIDO,
  parsearIdSolicitud,
  estaVacio,
  responderErrorServicio,
} from '../utils/solicitudesVisita.js';
import { consultarDisponibilidad, confirmarVisita, agendarTurnoVisita } from '../services/visitaFlujoService.js';
import { armarLinkMaps, resolverTransicionTurno, contenidoQrTurno } from '../utils/turnosBot.js';
import { componerQrEnPlantilla } from '../integrations/qr/qrPlantillaService.js';

// Operaciones de staff por WhatsApp: agendar un turno después de que un admin
// visitó una solicitud de visita y el cliente confirmó que quiere el
// servicio. req.usuario ya viene resuelto por resolverStaffPorTelefono (es del
// equipo y tiene rol admin); estos handlers no vuelven a chequear identidad.
//
// El turno nunca se crea a partir de un id_inmueble suelto: nace de una
// SOLICITUD ya Confirmada (ver docs/supabase-solicitudes-visita-inmueble.sql).
// Así, ni el admin ni el agente de IA que arma la conversación tienen forma de
// nombrar un inmueble a mano, que es justo el error que se quiere evitar (un
// turno agendado en el domicilio equivocado).

// GET /api/bot/staff/:telefono/visitas?nombre=Juan&estado=Contactada
//
// Busca solicitudes para que el agente desambigüe ("hay dos Juan, ¿cuál?").
// nombre matchea por ILIKE contra nombre y apellido, así "Juan" encuentra
// tanto a Juan Pérez como a alguien de apellido Juan. Sin `nombre`, lista todas
// las del estado pedido (útil para "¿qué solicitudes tengo para confirmar?").
export const buscarSolicitudesStaff = async (req, res) => {
  const { nombre, estado = 'Contactada' } = req.query;

  try {
    let query = supabaseAdmin
      .from('solicitudes_visita')
      .select('*')
      .eq('estado', estado)
      .order('created_at', { ascending: false });

    if (!estaVacio(nombre)) {
      const termino = `%${String(nombre).trim()}%`;
      query = query.or(`nombre.ilike.${termino},apellido.ilike.${termino}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error al buscar solicitudes para staff:', error);
      return res.status(500).json({
        ok: false,
        error: 'No se pudieron consultar las solicitudes. Intentá de nuevo más tarde.',
      });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error('Error inesperado al buscar solicitudes para staff:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al consultar las solicitudes.',
    });
  }
};

// GET /api/bot/staff/:telefono/disponibilidad?fecha=&desde=&hasta=&dias=&limite=
//
// Ver consultarDisponibilidad (visitaFlujoService.js): dos modos, con `fecha`
// o recorriendo los próximos días.
export const consultarDisponibilidadStaff = async (req, res) => {
  try {
    const resultado = await consultarDisponibilidad(req.query);
    if (resultado.error) return responderErrorServicio(res, resultado.error);

    return res.status(200).json({ ok: true, data: resultado.data });
  } catch (err) {
    console.error('Error inesperado al consultar disponibilidad:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al consultar la disponibilidad.',
    });
  }
};

// GET /api/bot/staff/:telefono/turnos?fecha=YYYY-MM-DD&estado=Confirmado
//
// Agenda del día para el jefe. Sin `fecha` usa hoy en hora de Córdoba. Sin
// `estado` trae todo menos los Cancelados. Solo lectura.
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const hoyEnCordoba = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Cordoba',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

export const listarTurnosStaff = async (req, res) => {
  const { estado } = req.query;
  const fecha = estaVacio(req.query.fecha) ? hoyEnCordoba() : String(req.query.fecha).trim();

  if (!FECHA_ISO.test(fecha)) {
    return res.status(400).json({ ok: false, error: 'La fecha debe tener formato YYYY-MM-DD.' });
  }

  try {
    let query = supabaseAdmin
      .from('turnos')
      .select('id_turno, fecha_programada, inicio_desde, hasta, prioridad, estado, inmueble:inmuebles(direccion, barrio, latitud, longitud, cliente:clientes(nombre, apellido))')
      .eq('fecha_programada', fecha)
      .order('inicio_desde', { ascending: true });

    query = estaVacio(estado) ? query.neq('estado', 'Cancelado') : query.eq('estado', String(estado).trim());

    const { data, error } = await query;

    if (error) {
      console.error('Error al listar turnos para staff:', error);
      return res.status(500).json({
        ok: false,
        error: 'No se pudieron consultar los turnos. Intentá de nuevo más tarde.',
      });
    }

    return res.status(200).json({ ok: true, fecha, data: data.map(resumirTurno) });
  } catch (err) {
    console.error('Error inesperado al listar turnos para staff:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al consultar los turnos.',
    });
  }
};

// Lo que ve el jefe de un turno: datos para reconocerlo y el link de Maps.
// Las coordenadas crudas no salen: el agente solo necesita el link.
function resumirTurno(t) {
  const inmueble = t.inmueble ?? {};
  const cliente = inmueble.cliente ?? {};
  return {
    id_turno: t.id_turno,
    fecha: t.fecha_programada,
    hora_inicio: t.inicio_desde,
    hora_fin: t.hasta,
    estado: t.estado,
    prioridad: t.prioridad,
    direccion: inmueble.direccion ?? null,
    barrio: inmueble.barrio ?? null,
    cliente: [cliente.nombre, cliente.apellido].filter(Boolean).join(' ') || null,
    link_maps: armarLinkMaps(inmueble),
  };
}

// POST /api/bot/staff/:telefono/turnos/:id/iniciar | /finalizar
//
// Dos fases, forzadas acá y no solo en el prompt del agente: sin
// `confirmado: true` (boolean estricto) NO se modifica nada y se devuelven los
// datos del turno para que el jefe los confirme. Con `confirmado: true` se
// aplica la transición. Ver resolverTransicionTurno para los estados válidos.
const cambiarEstadoTurnoStaff = (accion) => async (req, res) => {
  const idTurno = Number(req.params.id);
  if (!Number.isInteger(idTurno) || idTurno <= 0) {
    return res.status(400).json({ ok: false, error: 'El id del turno no es válido.' });
  }

  try {
    const { data: turno, error: errorConsulta } = await supabaseAdmin
      .from('turnos')
      .select('id_turno, fecha_programada, inicio_desde, hasta, prioridad, estado, inmueble:inmuebles(direccion, barrio, latitud, longitud, cliente:clientes(nombre, apellido))')
      .eq('id_turno', idTurno)
      .maybeSingle();

    if (errorConsulta) throw errorConsulta;
    if (!turno) return res.status(404).json({ ok: false, error: 'Turno no encontrado.' });

    const transicion = resolverTransicionTurno(turno.estado, accion);
    if (!transicion.ok) return res.status(409).json({ ok: false, error: transicion.error });

    if (req.body?.confirmado !== true) {
      return res.status(200).json({
        ok: true,
        requiere_confirmacion: true,
        accion,
        mensaje: `Mostrá estos datos al jefe y pedile confirmación explícita antes de ${accion} el turno.`,
        data: resumirTurno(turno),
      });
    }

    const { data: actualizado, error } = await supabaseAdmin
      .from('turnos')
      .update({ estado: transicion.estadoNuevo })
      .eq('id_turno', idTurno)
      .select('id_turno, fecha_programada, inicio_desde, hasta, prioridad, estado, inmueble:inmuebles(direccion, barrio, latitud, longitud, cliente:clientes(nombre, apellido))')
      .single();

    if (error) throw error;

    return res.status(200).json({ ok: true, data: resumirTurno(actualizado) });
  } catch (err) {
    console.error(`Error inesperado al ${accion} turno para staff:`, err);
    return res.status(500).json({
      ok: false,
      error: `Ocurrió un error inesperado al ${accion} el turno.`,
    });
  }
};

export const iniciarTurnoStaff = cambiarEstadoTurnoStaff('iniciar');
export const finalizarTurnoStaff = cambiarEstadoTurnoStaff('finalizar');

// GET /api/bot/staff/:telefono/turnos/:id/qr -> image/png
//
// QR sobre la plantilla de Hovy para mostrarle al cliente cuando se termina el
// turno. Solo se entrega con el turno ya Realizado: un turno sin terminar no
// debe poder cobrarse.
export const qrTurnoStaff = async (req, res) => {
  const idTurno = Number(req.params.id);
  if (!Number.isInteger(idTurno) || idTurno <= 0) {
    return res.status(400).json({ ok: false, error: 'El id del turno no es válido.' });
  }

  try {
    const { data: turno, error } = await supabaseAdmin
      .from('turnos')
      .select('id_turno, estado')
      .eq('id_turno', idTurno)
      .maybeSingle();

    if (error) throw error;
    if (!turno) return res.status(404).json({ ok: false, error: 'Turno no encontrado.' });
    if (turno.estado !== 'Realizado') {
      return res.status(409).json({
        ok: false,
        error: `El QR solo se genera para turnos realizados (este está "${turno.estado}").`,
      });
    }

    const imagen = await componerQrEnPlantilla(contenidoQrTurno(turno.id_turno));
    if (imagen.error) return responderErrorServicio(res, imagen.error);

    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
    return res.status(200).send(imagen);
  } catch (err) {
    console.error('Error inesperado al generar el QR del turno:', err);
    return res.status(500).json({ ok: false, error: 'No se pudo generar el QR del turno.' });
  }
};

// POST /api/bot/staff/:telefono/visitas/:id/confirmar
//
// Cierra el semi-registro: crea (o reusa) el cliente y crea el inmueble con
// los datos que el admin confirmó en la visita física. Ver confirmarVisita.
export const confirmarSolicitudVisita = async (req, res) => {
  const idSolicitud = parsearIdSolicitud(req.params.id);
  if (!idSolicitud) {
    return res.status(400).json({ ok: false, error: ERROR_ID_SOLICITUD_INVALIDO });
  }

  try {
    const resultado = await confirmarVisita(idSolicitud, req.body ?? {});
    if (resultado.error) return responderErrorServicio(res, resultado.error);

    const { solicitud, solicitudConfirmada, idCliente, inmueble } = resultado;

    return res.status(200).json({
      ok: true,
      mensaje: `Listo, ${solicitud.nombre} ${solicitud.apellido} y su inmueble en ${solicitud.direccion} quedaron registrados.`,
      data: { solicitud: solicitudConfirmada, id_cliente: idCliente, inmueble },
    });
  } catch (err) {
    console.error('Error inesperado al confirmar la solicitud de visita:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al confirmar la solicitud de visita.',
    });
  }
};

// POST /api/bot/staff/:telefono/visitas/:id/turno
//
// Cierra la cadena: agenda el turno con el inmueble y el presupuesto ya
// enlazados en la solicitud. Ver agendarTurnoVisita.
export const crearTurnoDesdeSolicitud = async (req, res) => {
  const idSolicitud = parsearIdSolicitud(req.params.id);
  if (!idSolicitud) {
    return res.status(400).json({ ok: false, error: ERROR_ID_SOLICITUD_INVALIDO });
  }

  const body = req.body ?? {};

  try {
    const resultado = await agendarTurnoVisita(idSolicitud, body);
    if (resultado.error) return responderErrorServicio(res, resultado.error);

    const { solicitud, solicitudFinal, turno, conFranja } = resultado;

    return res.status(201).json({
      ok: true,
      mensaje: `Turno agendado para ${solicitud.nombre} ${solicitud.apellido} el ${body.fecha_programada}${conFranja ? ` de ${body.inicio_desde} a ${body.hasta}` : ''}.`,
      data: { solicitud: solicitudFinal, turno },
    });
  } catch (err) {
    console.error('Error inesperado al agendar el turno desde la solicitud de visita:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al agendar el turno.',
    });
  }
};
