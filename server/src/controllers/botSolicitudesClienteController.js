import { responderErrorServicio } from '../utils/solicitudesVisita.js';
import { crearSolicitudCliente, consultarDisponibilidadCliente } from '../services/solicitudClienteService.js';

// POST /api/bot/clientes/:telefono/solicitudes
// body: { id_inmueble, id_servicio, fecha_preferida?, franja_preferida?, hora_desde?, hora_hasta?, nota_horario? }
// hora_desde/hora_hasta (HH:MM): the slot the client tapped; a preference, not a reservation.
//
// An existing client asks for a turno on one of their properties. The request
// lands in "Solicitudes -> Clientes" ready for the admin to assign the budget.
// See crearSolicitudCliente. The third argument only exists for tests (express
// passes `next` there, which has no `crear`).
export const crearSolicitudClienteBot = async (req, res, deps) => {
  const crear = typeof deps?.crear === 'function' ? deps.crear : crearSolicitudCliente;

  try {
    const resultado = await crear({ cliente: req.cliente, body: req.body ?? {} });
    if (resultado.error) return responderErrorServicio(res, resultado.error);

    const { solicitud, servicio, servicioCargado, requiereVisita = false } = resultado;

    // First turno on the property: nobody measured it yet, so the budget waits
    // for the physical visit (see crearSolicitudCliente).
    const siguientePaso = requiereVisita
      ? 'Como es la primera vez que trabajamos en este inmueble, te vamos a contactar para coordinar una visita y medir el terreno. Después te enviamos el presupuesto.'
      : 'Te vamos a enviar el presupuesto.';

    return res.status(201).json({
      ok: true,
      mensaje: `Recibimos tu pedido de ${servicio.nombre} para ${solicitud.direccion}. ${siguientePaso}`,
      data: solicitud,
      servicio_cargado: servicioCargado,
      requiere_visita: requiereVisita,
    });
  } catch (err) {
    console.error('Error inesperado al registrar el pedido del cliente:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al registrar el pedido.',
    });
  }
};

// GET /api/bot/clientes/:telefono/disponibilidad?fecha=YYYY-MM-DD
//
// Free time slots for an existing client's turno request. With `fecha`, the free
// slots of that day; without it, the next days that have free slots (for the
// WhatsApp list of days). See consultarDisponibilidadCliente.
export const consultarDisponibilidadClienteBot = async (req, res, deps) => {
  const consultar = typeof deps?.consultar === 'function' ? deps.consultar : null;

  try {
    const resultado = consultar
      ? await consultar({ query: req.query ?? {} })
      : await consultarDisponibilidadCliente({ query: req.query ?? {} });
    if (resultado.error) return responderErrorServicio(res, resultado.error);

    return res.status(200).json({ ok: true, data: resultado.data });
  } catch (err) {
    console.error('Error inesperado al consultar la disponibilidad para el cliente:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al consultar los horarios disponibles.',
    });
  }
};
