import { supabaseAdmin } from '../config/supabase.js';
import {
  ERROR_ID_SOLICITUD_INVALIDO,
  parsearIdSolicitud,
  estaVacio,
  responderErrorServicio,
} from '../utils/solicitudesVisita.js';
import { consultarDisponibilidad, confirmarVisita, agendarTurnoVisita } from '../services/visitaFlujoService.js';

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
