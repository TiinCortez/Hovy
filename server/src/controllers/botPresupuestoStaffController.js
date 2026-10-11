import {
  ERROR_ID_SOLICITUD_INVALIDO,
  parsearIdSolicitud,
  estaVacio,
  responderErrorServicio,
} from '../utils/solicitudesVisita.js';
import {
  AVISO_ESTIMADO_INTERNO,
  redondear2,
  validarItemsServicios,
  reemplazarServiciosVisita,
  obtenerEstimadoVisita,
  aceptarPresupuestoVisita,
  cancelarVisita,
} from '../services/presupuestoService.js';

// Budget operations of the staff WhatsApp flow (final price, internal
// estimate, services of a visit, cancel). req.usuario ya viene resuelto por
// resolverStaffPorTelefono. Thin controllers: they parse the request, call
// presupuestoService and format the response; the business logic lives there.
// The estimate is INTERNAL: nothing here is exposed to clients.

// POST /api/bot/staff/:telefono/visitas/:id/presupuesto
//
// El admin dicta el precio final por WhatsApp después de la visita. Se crea
// directo en estado Aceptado: acá no hay un presupuesto que el cliente apruebe
// aparte, el admin que lo dicta ya está aceptándolo. Eso es lo que POST
// .../turno exige para poder agendar.
//
// Si la visita tiene servicios cargados (PUT .../servicios), el presupuesto se
// arma con ellos (estimado + detalle_presupuesto); sin servicios se mantiene el
// monto suelto de siempre, para no romper el flujo actual del bot. Ver
// aceptarPresupuestoVisita.
export const cargarPresupuestoStaff = async (req, res) => {
  const idSolicitud = parsearIdSolicitud(req.params.id);
  if (!idSolicitud) {
    return res.status(400).json({ ok: false, error: ERROR_ID_SOLICITUD_INVALIDO });
  }

  const body = req.body ?? {};
  const errores = [];

  if (estaVacio(body.monto_total)) {
    errores.push('monto_total es obligatorio.');
  } else if (!Number.isFinite(Number(body.monto_total)) || Number(body.monto_total) <= 0) {
    errores.push(`monto_total tiene que ser un número mayor a 0. Se recibió: "${body.monto_total}"`);
  }

  const nota = estaVacio(body.nota) ? null : String(body.nota).trim();

  if (errores.length > 0) {
    return res.status(400).json({ ok: false, error: errores.join(' ') });
  }

  const montoTotal = Number(body.monto_total);

  try {
    const resultado = await aceptarPresupuestoVisita({
      idSolicitud,
      idUsuario: req.usuario.id,
      montoTotal,
      nota,
    });
    if (resultado.error) return responderErrorServicio(res, resultado.error);

    const { solicitud, presupuesto, conServicios, lineas, estimadoTotal } = resultado;

    if (!conServicios) {
      return res.status(200).json({
        ok: true,
        mensaje: `Presupuesto de $${montoTotal} registrado para ${solicitud.nombre} ${solicitud.apellido}.`,
        data: presupuesto,
      });
    }

    // Respuesta INTERNA (solo admin): incluye el estimado y la diferencia con
    // el precio final; nada de esto se le comunica al cliente.
    return res.status(200).json({
      ok: true,
      mensaje: `Presupuesto de $${montoTotal} registrado para ${solicitud.nombre} ${solicitud.apellido} (estimado interno: $${estimadoTotal}).`,
      data: {
        ...presupuesto,
        estimado_total: estimadoTotal,
        precio_final: montoTotal,
        diferencia: redondear2(montoTotal - estimadoTotal),
        lineas,
        aviso: AVISO_ESTIMADO_INTERNO,
      },
    });
  } catch (err) {
    console.error('Error inesperado al cargar el presupuesto:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al cargar el presupuesto.',
    });
  }
};

// PUT /api/bot/staff/:telefono/visitas/:id/servicios
// body: { servicios: [ { id_servicio, superficie_m2? } ] }
//
// REEMPLAZA el conjunto de servicios de la visita (ver reemplazarServiciosVisita).
export const cargarServiciosVisitaStaff = async (req, res) => {
  const idSolicitud = parsearIdSolicitud(req.params.id);
  if (!idSolicitud) {
    return res.status(400).json({ ok: false, error: ERROR_ID_SOLICITUD_INVALIDO });
  }

  const validacion = validarItemsServicios(req.body?.servicios);
  if (validacion.error) return responderErrorServicio(res, validacion.error);

  try {
    const resultado = await reemplazarServiciosVisita(idSolicitud, req.usuario.id, validacion.items);
    if (resultado.error) return responderErrorServicio(res, resultado.error);

    const { solicitud, guardados } = resultado;

    return res.status(200).json({
      ok: true,
      mensaje: `Servicios de la visita de ${solicitud.nombre} ${solicitud.apellido} actualizados (${guardados.length}).`,
      data: guardados,
    });
  } catch (err) {
    console.error('Error inesperado al cargar los servicios de la visita:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al cargar los servicios de la visita.',
    });
  }
};

// GET /api/bot/staff/:telefono/visitas/:id/estimado
//
// Estimado INTERNO con los precios vigentes del usuario staff (ver
// obtenerEstimadoVisita).
export const obtenerEstimadoVisitaStaff = async (req, res) => {
  const idSolicitud = parsearIdSolicitud(req.params.id);
  if (!idSolicitud) {
    return res.status(400).json({ ok: false, error: ERROR_ID_SOLICITUD_INVALIDO });
  }

  try {
    const resultado = await obtenerEstimadoVisita(idSolicitud, req.usuario.id);
    if (resultado.error) return responderErrorServicio(res, resultado.error);

    return res.status(200).json({ ok: true, data: resultado.data });
  } catch (err) {
    console.error('Error inesperado al calcular el estimado de la visita:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al calcular el estimado.',
    });
  }
};

// POST /api/bot/staff/:telefono/visitas/:id/cancelar
//
// Cancela una visita Confirmada: solo cambia solicitudes_visita.estado (ver
// cancelarVisita).
export const cancelarSolicitudVisita = async (req, res) => {
  const idSolicitud = parsearIdSolicitud(req.params.id);
  if (!idSolicitud) {
    return res.status(400).json({ ok: false, error: ERROR_ID_SOLICITUD_INVALIDO });
  }

  try {
    const resultado = await cancelarVisita(idSolicitud);
    if (resultado.error) return responderErrorServicio(res, resultado.error);

    const { solicitud, cancelada } = resultado;

    return res.status(200).json({
      ok: true,
      mensaje: `La solicitud de ${solicitud.nombre} ${solicitud.apellido} quedó cancelada.`,
      data: cancelada,
    });
  } catch (err) {
    console.error('Error inesperado al cancelar la solicitud de visita:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al cancelar la solicitud.',
    });
  }
};
