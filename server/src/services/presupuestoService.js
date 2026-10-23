import { supabaseAdmin } from '../config/supabase.js';
import { estaVacio, parsearIdSolicitud, falla } from '../utils/solicitudesVisita.js';
import { calcularTraslado, camposTrasladoPresupuesto } from './trasladoService.js';

// Business/data logic of the INTERNAL estimate and the final budget of a visit.
//
// A visit can include several services and the m2 are stored PER service
// (solicitud_servicio, see docs/supabase-presupuesto-estimado.sql). The
// estimate is the sum of precio_base (price per m2) x superficie_m2, using the
// prices of the staff user's own usuario_servicio rows. It is INTERNAL: nothing
// here may be exposed on a client-facing endpoint.
//
// Services never touch req/res. They return either `{ error: { status,
// message } }` (message already in Spanish) or the data the controller needs.

export const AVISO_ESTIMADO_INTERNO = 'Estimado interno: no comunicar al cliente.';

const ERROR_CONSULTA_SOLICITUD = 'No se pudo consultar la solicitud. Intentá de nuevo más tarde.';

export const redondear2 = (numero) => Math.round((numero + Number.EPSILON) * 100) / 100;

const sumarSubtotales = (lineas) =>
  redondear2(lineas.reduce((acumulado, linea) => acumulado + (linea.subtotal ?? 0), 0));

// Trip cost of a visit's property, or "not included" when it cannot be computed
// (see trasladoService). The budget never fails because of it.
const trasladoDeVisita = (solicitud, idUsuario) =>
  solicitud.id_inmueble
    ? calcularTraslado({ idUsuario, idInmueble: solicitud.id_inmueble })
    : { incluido: false, motivo: 'inmueble_sin_ubicacion' };

const costoTraslado = (traslado) => (traslado?.incluido ? traslado.costo : 0);

// Loads a visit by id. `contexto` only shapes the server log line.
export const buscarSolicitud = async (idSolicitud, contexto) => {
  const { data: solicitud, error } = await supabaseAdmin
    .from('solicitudes_visita')
    .select('*')
    .eq('id_solicitud', idSolicitud)
    .maybeSingle();

  if (error) {
    console.error(`Error al buscar la solicitud ${contexto}:`, error);
    return falla(500, ERROR_CONSULTA_SOLICITUD);
  }

  if (!solicitud) {
    return falla(404, `No existe una solicitud de visita con el id ${idSolicitud}.`);
  }

  return { solicitud };
};

// Lines of the internal estimate for a visit: one per solicitud_servicio row,
// priced with the staff user's CURRENT usuario_servicio (precio_base = price
// per m2). A service the user no longer offers (or deactivated) comes back with
// precio_m2 and subtotal null. Shared by the estimate (GET .../estimado) and by
// the final-price acceptance (POST .../presupuesto) so both compute the same
// numbers. Returns { lineas } or { error }.
export const calcularLineasEstimado = async (idSolicitud, idUsuario) => {
  const { data: cargados, error: errorCargados } = await supabaseAdmin
    .from('solicitud_servicio')
    .select('id_servicio, superficie_m2, servicio:servicios_catalogo(nombre)')
    .eq('id_solicitud', idSolicitud)
    .order('id_solicitud_servicio', { ascending: true });

  if (errorCargados) {
    console.error('Error al consultar los servicios de la visita:', errorCargados);
    return falla(500, 'No se pudieron consultar los servicios de la visita. Intentá de nuevo más tarde.');
  }

  if (!cargados || cargados.length === 0) return { lineas: [] };

  const { data: precios, error: errorPrecios } = await supabaseAdmin
    .from('usuario_servicio')
    .select('id_servicio, precio_base, activo')
    .eq('id_usuario', idUsuario)
    .in('id_servicio', cargados.map((fila) => fila.id_servicio));

  if (errorPrecios) {
    console.error('Error al consultar los precios del usuario staff:', errorPrecios);
    return falla(500, 'No se pudieron consultar los precios. Intentá de nuevo más tarde.');
  }

  const preciosPorId = new Map((precios ?? []).map((fila) => [Number(fila.id_servicio), fila]));

  const lineas = cargados.map((fila) => {
    const nombre = fila.servicio?.nombre ?? null;
    const superficie = Number(fila.superficie_m2);
    const precio = preciosPorId.get(Number(fila.id_servicio));

    if (!precio || precio.activo !== true) {
      return { id_servicio: fila.id_servicio, nombre, superficie_m2: superficie, precio_m2: null, subtotal: null };
    }

    const precioM2 = Number(precio.precio_base);
    return {
      id_servicio: fila.id_servicio,
      nombre,
      superficie_m2: superficie,
      precio_m2: precioM2,
      subtotal: redondear2(precioM2 * superficie),
    };
  });

  return { lineas };
};

// GET .../estimado. Prices are read at request time (no snapshot). Returns
// { data } with the internal estimate, or { error }.
export const obtenerEstimadoVisita = async (idSolicitud, idUsuario) => {
  const busqueda = await buscarSolicitud(idSolicitud, 'para el estimado');
  if (busqueda.error) return busqueda;

  const { lineas, error } = await calcularLineasEstimado(idSolicitud, idUsuario);
  if (error) return { error };

  if (lineas.length === 0) {
    return falla(409, 'La visita todavía no tiene servicios cargados. Cargalos antes de pedir el estimado.');
  }

  // A service deactivated since it was loaded is reported on its line
  // (precio_m2 null) and excluded from the total.
  const advertencias = lineas
    .filter((linea) => linea.precio_m2 === null)
    .map(
      (linea) =>
        `El servicio "${linea.nombre ?? linea.id_servicio}" ya no está activo en tu catálogo: no se incluyó en el total.`
    );

  // The estimate also carries the trip cost (fuel to the property) when the
  // boss has set up their fuel and departure point.
  const subtotalServicios = sumarSubtotales(lineas);
  const traslado = await trasladoDeVisita(busqueda.solicitud, idUsuario);

  const data = {
    id_solicitud: idSolicitud,
    lineas,
    subtotal_servicios: subtotalServicios,
    traslado,
    total_estimado: redondear2(subtotalServicios + costoTraslado(traslado)),
    aviso: AVISO_ESTIMADO_INTERNO,
  };
  if (advertencias.length > 0) data.advertencias = advertencias;

  return { data };
};

// Shape validation of the PUT .../servicios body (no DB access). Returns
// { items: [{ id_servicio, superficie_m2|null }] } or { error } (400) joining
// every problem into one message, like the rest of the bot.
export const validarItemsServicios = (servicios) => {
  if (!Array.isArray(servicios) || servicios.length === 0) {
    return falla(400, 'servicios tiene que ser una lista con al menos un servicio.');
  }

  const errores = [];
  const items = [];
  const vistos = new Set();
  const repetidos = new Set();

  servicios.forEach((item, indice) => {
    const posicion = indice + 1;
    const idServicio = parsearIdSolicitud(item?.id_servicio);

    if (!idServicio) {
      errores.push(`El servicio #${posicion} tiene un id_servicio inválido: tiene que ser un número entero positivo.`);
      return;
    }

    if (vistos.has(idServicio)) {
      repetidos.add(idServicio);
      return;
    }
    vistos.add(idServicio);

    let superficie = null;
    if (!estaVacio(item.superficie_m2)) {
      superficie = Number(item.superficie_m2);
      if (!Number.isFinite(superficie) || superficie <= 0) {
        errores.push(
          `superficie_m2 del servicio ${idServicio} tiene que ser un número mayor a 0. Se recibió: "${item.superficie_m2}"`
        );
        return;
      }
    }

    items.push({ id_servicio: idServicio, superficie_m2: superficie });
  });

  if (repetidos.size > 0) {
    errores.push(`Hay servicios repetidos en la lista (id_servicio: ${[...repetidos].join(', ')}).`);
  }

  if (errores.length > 0) return falla(400, errores.join(' '));

  return { items };
};

// PUT .../servicios: REPLACES the visit's service set. Every id_servicio must
// be an ACTIVE usuario_servicio of the staff user; a missing superficie_m2
// defaults to solicitudes_visita.superficie_aproximada (the client's unverified
// figure) and, if there is none either, it is a 400 naming the service.
// Returns { solicitud, guardados } or { error }.
export const reemplazarServiciosVisita = async (idSolicitud, idUsuario, items) => {
  const busqueda = await buscarSolicitud(idSolicitud, 'para cargar servicios');
  if (busqueda.error) return busqueda;
  const { solicitud } = busqueda;

  if (solicitud.estado !== 'Confirmada') {
    return falla(
      409,
      `La solicitud tiene que estar Confirmada para cargarle servicios (estado actual: ${solicitud.estado}). Confirmá la visita primero.`
    );
  }

  const ids = items.map((item) => item.id_servicio);

  const { data: ofrecidos, error: errorOfrecidos } = await supabaseAdmin
    .from('usuario_servicio')
    .select('id_servicio, precio_base, servicio:servicios_catalogo(nombre)')
    .eq('id_usuario', idUsuario)
    .eq('activo', true)
    .in('id_servicio', ids);

  if (errorOfrecidos) {
    console.error('Error al consultar los servicios del usuario staff:', errorOfrecidos);
    return falla(500, 'No se pudieron consultar los servicios. Intentá de nuevo más tarde.');
  }

  const ofrecidosPorId = new Map((ofrecidos ?? []).map((fila) => [Number(fila.id_servicio), fila]));
  const invalidos = ids.filter((id) => !ofrecidosPorId.has(id));

  if (invalidos.length > 0) {
    return falla(
      400,
      `Estos servicios no existen o no están activos en tu catálogo (id_servicio: ${invalidos.join(', ')}).`
    );
  }

  // Surface per item: the body's or, if missing, the request's approximate one.
  // EVERYTHING is validated before anything is deleted.
  const aproximada = estaVacio(solicitud.superficie_aproximada)
    ? null
    : Number(solicitud.superficie_aproximada);
  const aproximadaValida = Number.isFinite(aproximada) && aproximada > 0 ? aproximada : null;

  const filas = [];
  const sinSuperficie = [];

  for (const item of items) {
    const superficie = item.superficie_m2 ?? aproximadaValida;
    if (superficie === null) {
      sinSuperficie.push(ofrecidosPorId.get(item.id_servicio).servicio?.nombre ?? `id ${item.id_servicio}`);
      continue;
    }
    filas.push({ id_solicitud: idSolicitud, id_servicio: item.id_servicio, superficie_m2: superficie });
  }

  if (sinSuperficie.length > 0) {
    return falla(
      400,
      `Falta superficie_m2 para: ${sinSuperficie.join(', ')}. La solicitud no tiene una superficie aproximada para usar por defecto.`
    );
  }

  // No transaction is available with supabase-js: everything was validated
  // above and here we do delete + insert. If the insert failed after the
  // delete, the visit is left with no services (never a mixed set); the message
  // asks to retry and, since the PUT replaces the whole set, retrying is safe.
  const { error: errorBorrado } = await supabaseAdmin
    .from('solicitud_servicio')
    .delete()
    .eq('id_solicitud', idSolicitud);

  if (errorBorrado) {
    console.error('Error al borrar los servicios previos de la visita:', errorBorrado);
    return falla(500, 'No se pudieron actualizar los servicios de la visita.');
  }

  const { data: guardados, error: errorInsert } = await supabaseAdmin
    .from('solicitud_servicio')
    .insert(filas)
    .select();

  if (errorInsert) {
    console.error('Error al guardar los servicios de la visita:', errorInsert);
    return falla(500, 'Se borraron los servicios anteriores pero no se pudieron guardar los nuevos. Reintentá la carga.');
  }

  return { solicitud, guardados };
};

// POST .../presupuesto: accepts the admin's final price.
//
// With services loaded on the visit, the budget is built from them:
// monto_estimado and monto_subtotal are the sum of the lines and monto_total is
// the final price the admin dictated (higher or lower). Without services
// (legacy bot flow) it is a loose amount: subtotal and total are the same
// number and monto_estimado is not touched (stays null), so the n8n flow keeps
// working.
//
// presupuestos.id_solicitud is a legacy FK to the old solicitudes_presupuesto
// table and is deliberately NOT set: the link is solicitudes_visita.id_presupuesto.
//
// If the visit already had a presupuesto it is updated instead of creating a
// new one, so a correction does not leave an orphan row.
//
// Returns { solicitud, presupuesto, conServicios, lineas, estimadoTotal } or
// { error }.
export const aceptarPresupuestoVisita = async ({ idSolicitud, idUsuario, montoTotal, nota }) => {
  const busqueda = await buscarSolicitud(idSolicitud, 'para cargar el presupuesto');
  if (busqueda.error) return busqueda;
  const { solicitud } = busqueda;

  // Confirmada is the only stage where there is already a client and a
  // property to hang the budget from (presupuestos.id_cliente and id_inmueble
  // are NOT NULL in the database).
  if (solicitud.estado !== 'Confirmada') {
    return falla(
      409,
      `La solicitud tiene que estar Confirmada para cargarle un presupuesto (estado actual: ${solicitud.estado}). Confirmá la visita primero.`
    );
  }

  // Everything is validated before anything is written.
  const { lineas, error: errorLineas } = await calcularLineasEstimado(idSolicitud, idUsuario);
  if (errorLineas) return { error: errorLineas };

  const conServicios = lineas.length > 0;
  const sinPrecio = lineas.filter((linea) => linea.precio_m2 === null);

  if (sinPrecio.length > 0) {
    return falla(
      409,
      `No se puede aceptar el presupuesto: estos servicios no tienen precio activo en tu catálogo: ${sinPrecio
        .map((linea) => linea.nombre ?? `id ${linea.id_servicio}`)
        .join(', ')}. Activalos o recargá los servicios de la visita.`
    );
  }

  const subtotalServicios = sumarSubtotales(lineas);
  // The trip cost only applies to budgets built from services; the legacy loose
  // amount (no services) is left exactly as before.
  const traslado = conServicios
    ? await trasladoDeVisita(solicitud, idUsuario)
    : { incluido: false };
  const estimadoTotal = redondear2(subtotalServicios + costoTraslado(traslado));

  const camposPresupuesto = {
    id_cliente: solicitud.id_cliente,
    id_inmueble: solicitud.id_inmueble,
    monto_subtotal: conServicios ? subtotalServicios : montoTotal,
    monto_total: montoTotal,
    estado: 'Aceptado',
    nota,
    // Legacy loose amount (no services): the surcharge columns are left untouched.
    ...(conServicios ? camposTrasladoPresupuesto(traslado) : {}),
  };
  if (conServicios) camposPresupuesto.monto_estimado = estimadoTotal;

  let presupuesto;

  if (solicitud.id_presupuesto) {
    const { data, error } = await supabaseAdmin
      .from('presupuestos')
      .update(camposPresupuesto)
      .eq('id_presupuesto', solicitud.id_presupuesto)
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar el presupuesto:', error);
      return falla(500, 'No se pudo actualizar el presupuesto.');
    }

    presupuesto = data;
  } else {
    const { data, error } = await supabaseAdmin
      .from('presupuestos')
      .insert(camposPresupuesto)
      .select()
      .single();

    if (error) {
      console.error('Error al crear el presupuesto:', error);
      return falla(500, 'No se pudo registrar el presupuesto.');
    }

    presupuesto = data;

    const { error: errorEnlace } = await supabaseAdmin
      .from('solicitudes_visita')
      .update({ id_presupuesto: presupuesto.id_presupuesto })
      .eq('id_solicitud', idSolicitud);

    if (errorEnlace) {
      console.error('Error al enlazar el presupuesto con la solicitud:', errorEnlace);
      return falla(
        500,
        'El presupuesto se registró, pero no se pudo enlazar con la solicitud. Reintentá la carga.'
      );
    }
  }

  if (!conServicios) return { solicitud, presupuesto, conServicios, lineas, estimadoTotal, traslado };

  // Detail: one row per service with TODAY's price per m2 (snapshot), so the
  // budget does not change if the admin edits prices later. No transaction is
  // available: everything was validated above and here we do delete + insert;
  // if the insert failed after the delete, the presupuesto is left without
  // detail and the message asks to retry (accepting again replaces the whole
  // detail, so retrying is safe).
  const { error: errorBorrado } = await supabaseAdmin
    .from('detalle_presupuesto')
    .delete()
    .eq('id_presupuesto', presupuesto.id_presupuesto);

  if (errorBorrado) {
    console.error('Error al borrar el detalle previo del presupuesto:', errorBorrado);
    return falla(500, 'El presupuesto se registró, pero no se pudo actualizar su detalle. Reintentá la carga.');
  }

  const filasDetalle = lineas.map((linea) => ({
    id_presupuesto: presupuesto.id_presupuesto,
    id_servicio: linea.id_servicio,
    cantidad: linea.superficie_m2,
    precio_unitario: linea.precio_m2,
    subtotal: linea.subtotal,
  }));

  const { error: errorDetalle } = await supabaseAdmin.from('detalle_presupuesto').insert(filasDetalle);

  if (errorDetalle) {
    console.error('Error al guardar el detalle del presupuesto:', errorDetalle);
    return falla(500, 'El presupuesto se registró, pero no se pudo guardar su detalle. Reintentá la carga.');
  }

  return { solicitud, presupuesto, conServicios, lineas, estimadoTotal, traslado };
};

// POST .../cancelar: only solicitudes_visita.estado changes. Services
// (solicitud_servicio), presupuestos and turnos are NOT touched and the row is
// not deleted. WhatsApp session cleanup is deliberately NOT done here (deferred
// to a bot branch). Returns { solicitud, cancelada } or { error }.
export const cancelarVisita = async (idSolicitud) => {
  const busqueda = await buscarSolicitud(idSolicitud, 'a cancelar');
  if (busqueda.error) return busqueda;
  const { solicitud } = busqueda;

  if (solicitud.estado !== 'Confirmada') {
    return falla(409, `Solo se puede cancelar una solicitud Confirmada (estado actual: ${solicitud.estado}).`);
  }

  // Race guard, same as the other transitions.
  const { data: cancelada, error } = await supabaseAdmin
    .from('solicitudes_visita')
    .update({ estado: 'Cancelada' })
    .eq('id_solicitud', idSolicitud)
    .eq('estado', 'Confirmada')
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error al cancelar la solicitud de visita:', error);
    return falla(500, 'No se pudo cancelar la solicitud.');
  }

  if (!cancelada) {
    return falla(409, 'La solicitud ya fue modificada por otra conversación mientras se cancelaba.');
  }

  return { solicitud, cancelada };
};

// A turno can only be booked with a budget the client already accepted (the
// admin registers it as Aceptado when dictating the final price). Returns {} if
// the presupuesto exists and is Aceptado, or { error }.
export const exigirPresupuestoAceptado = async (idPresupuesto) => {
  const { data: presupuesto, error } = await supabaseAdmin
    .from('presupuestos')
    .select('id_presupuesto, estado')
    .eq('id_presupuesto', idPresupuesto)
    .maybeSingle();

  if (error) {
    console.error('Error al buscar el presupuesto para agendar el turno:', error);
    return falla(500, 'No se pudo consultar el presupuesto. Intentá de nuevo más tarde.');
  }

  if (!presupuesto) {
    return falla(409, 'El presupuesto enlazado a la solicitud no existe. Volvé a cargarlo antes de agendar el turno.');
  }

  if (presupuesto.estado !== 'Aceptado') {
    return falla(
      409,
      `El presupuesto tiene que estar Aceptado para agendar el turno (estado actual: ${presupuesto.estado}).`
    );
  }

  return {};
};

// Extra detail for the web panel's visit page (GET /api/visitas/:id): the
// services loaded on the visit (the same lines the internal estimate uses,
// priced with the acting admin's CURRENT prices) and the linked presupuesto.
// Only Confirmada/Realizada visits can have either, so the other states skip
// the queries. INTERNAL data: the route is admin-only. Returns
// { servicios, presupuesto }; a failed lookup is logged and degrades to
// servicios null / presupuesto null so the detail itself never breaks.
export const obtenerResumenFlujoVisita = async (solicitud, idUsuario) => {
  if (!['Confirmada', 'Realizada'].includes(solicitud.estado)) {
    return { servicios: [], presupuesto: null };
  }

  const { lineas, error } = await calcularLineasEstimado(solicitud.id_solicitud, idUsuario);

  let presupuesto = null;
  if (solicitud.id_presupuesto) {
    const { data, error: errorPresupuesto } = await supabaseAdmin
      .from('presupuestos')
      .select('id_presupuesto, monto_estimado, monto_total, estado, nota')
      .eq('id_presupuesto', solicitud.id_presupuesto)
      .maybeSingle();

    if (errorPresupuesto) {
      console.error('Error al consultar el presupuesto de la visita:', errorPresupuesto);
    } else {
      presupuesto = data ?? null;
    }
  }

  return { servicios: error ? null : lineas, presupuesto };
};

// Creates or updates an Accepted budget (presupuestos + detalle_presupuesto)
// directly from an existing property (id_inmueble) and a single active service
// from the admin user's catalog (usuario_servicio), optionally applying a custom
// final monto_total while keeping monto_estimado / monto_subtotal as precio_base * m2.
// Returns { presupuesto, nombreServicio, idServicio, subtotal, montoTotal } or { error }.
export const guardarPresupuestoParaTurno = async ({
  idPresupuesto = null,
  idInmueble,
  idServicio,
  idUsuario,
  montoTotal = null,
  // Replaceable in tests.
  calcularTrasladoFn = calcularTraslado,
}) => {
  const idInm = parsearIdSolicitud(idInmueble);
  if (!idInm) {
    return falla(400, 'El id del inmueble no es válido.');
  }

  const idServ = parsearIdSolicitud(idServicio);
  if (!idServ) {
    return falla(400, 'Debes seleccionar un servicio válido para el turno.');
  }

  const idUsr = parsearIdSolicitud(idUsuario);
  if (!idUsr) {
    return falla(401, 'No se pudo identificar al usuario autenticado.');
  }

  let montoFinalOverride = null;
  if (!estaVacio(montoTotal)) {
    const parsedMonto = Number(montoTotal);
    if (!Number.isFinite(parsedMonto) || parsedMonto <= 0) {
      return falla(400, 'El valor final del presupuesto debe ser un número mayor a 0.');
    }
    montoFinalOverride = redondear2(parsedMonto);
  }

  const { data: inmueble, error: errorInmueble } = await supabaseAdmin
    .from('inmuebles')
    .select('id_inmueble, id_cliente, superficie_mantenible, superficie_total')
    .eq('id_inmueble', idInm)
    .maybeSingle();

  if (errorInmueble) {
    console.error('Error al consultar el inmueble para el presupuesto del turno:', errorInmueble);
    return falla(500, 'No se pudo consultar el inmueble seleccionado.');
  }

  if (!inmueble) {
    return falla(404, 'El inmueble seleccionado no existe.');
  }

  const superficieRaw = !estaVacio(inmueble.superficie_mantenible) && Number(inmueble.superficie_mantenible) > 0
    ? Number(inmueble.superficie_mantenible)
    : Number(inmueble.superficie_total);

  if (!Number.isFinite(superficieRaw) || superficieRaw <= 0) {
    return falla(
      400,
      'El inmueble seleccionado no tiene una superficie mantenible mayor a 0 m² para calcular el presupuesto del servicio.'
    );
  }

  const { data: usuarioServicio, error: errorServicio } = await supabaseAdmin
    .from('usuario_servicio')
    .select('id_servicio, precio_base, activo, servicio:servicios_catalogo(nombre)')
    .eq('id_usuario', idUsr)
    .eq('id_servicio', idServ)
    .eq('activo', true)
    .maybeSingle();

  if (errorServicio) {
    console.error('Error al consultar el servicio del usuario para el turno:', errorServicio);
    return falla(500, 'No se pudo consultar el servicio seleccionado.');
  }

  if (!usuarioServicio) {
    return falla(400, 'El servicio seleccionado no existe o no está activo en tu catálogo.');
  }

  const precioUnitario = Number(usuarioServicio.precio_base);
  if (!Number.isFinite(precioUnitario) || precioUnitario <= 0) {
    return falla(400, 'El servicio seleccionado debe tener un precio por m² mayor a 0.');
  }

  const subtotal = redondear2(precioUnitario * superficieRaw);
  // Trip cost (fuel to the property). Not included when the boss has not set up
  // fuel / departure point or the property has no location: same budget as before.
  const traslado = await calcularTrasladoFn({ idUsuario: idUsr, idInmueble: inmueble.id_inmueble });
  const montoEstimado = redondear2(subtotal + costoTraslado(traslado));
  const montoFinal = montoFinalOverride ?? montoEstimado;
  const nombreServicio = usuarioServicio.servicio?.nombre ?? null;

  const camposPresupuesto = {
    id_cliente: inmueble.id_cliente,
    id_inmueble: inmueble.id_inmueble,
    monto_estimado: montoEstimado,
    monto_subtotal: subtotal,
    monto_total: montoFinal,
    estado: 'Aceptado',
    ...camposTrasladoPresupuesto(traslado),
  };

  const idPresExistente = parsearIdSolicitud(idPresupuesto);
  let presupuesto = null;

  if (idPresExistente) {
    const { data: actualizado, error: errorUpdate } = await supabaseAdmin
      .from('presupuestos')
      .update(camposPresupuesto)
      .eq('id_presupuesto', idPresExistente)
      .select()
      .maybeSingle();

    if (errorUpdate) {
      console.error('Error al actualizar el presupuesto del turno:', errorUpdate);
      return falla(500, 'No se pudo actualizar el presupuesto del turno.');
    }

    if (actualizado) {
      presupuesto = actualizado;
      const { error: errorBorrado } = await supabaseAdmin
        .from('detalle_presupuesto')
        .delete()
        .eq('id_presupuesto', idPresExistente);

      if (errorBorrado) {
        console.error('Error al borrar el detalle previo del presupuesto del turno:', errorBorrado);
        return falla(500, 'No se pudo actualizar el detalle del presupuesto del turno.');
      }

      const { error: errorDetalleUpdate } = await supabaseAdmin
        .from('detalle_presupuesto')
        .insert({
          id_presupuesto: idPresExistente,
          id_servicio: idServ,
          cantidad: superficieRaw,
          precio_unitario: precioUnitario,
          subtotal,
        });

      if (errorDetalleUpdate) {
        console.error('Error al guardar el nuevo detalle del presupuesto del turno:', errorDetalleUpdate);
        return falla(500, 'No se pudo registrar el detalle actualizado del presupuesto.');
      }

      return { presupuesto, nombreServicio, idServicio: idServ, subtotal, montoTotal: montoFinal, traslado };
    }
  }

  const { data: creado, error: errorPresupuesto } = await supabaseAdmin
    .from('presupuestos')
    .insert(camposPresupuesto)
    .select()
    .single();

  if (errorPresupuesto) {
    console.error('Error al crear el presupuesto automático del turno:', errorPresupuesto);
    return falla(500, 'No se pudo generar el presupuesto para el turno.');
  }

  presupuesto = creado;

  const { error: errorDetalle } = await supabaseAdmin
    .from('detalle_presupuesto')
    .insert({
      id_presupuesto: presupuesto.id_presupuesto,
      id_servicio: idServ,
      cantidad: superficieRaw,
      precio_unitario: precioUnitario,
      subtotal,
    });

  if (errorDetalle) {
    console.error('Error al guardar el detalle del presupuesto del turno:', errorDetalle);
    await supabaseAdmin.from('presupuestos').delete().eq('id_presupuesto', presupuesto.id_presupuesto);
    return falla(500, 'No se pudo registrar el detalle del presupuesto para el turno.');
  }

  return { presupuesto, nombreServicio, idServicio: idServ, subtotal, montoTotal: montoFinal, traslado };
};

export const crearPresupuestoParaTurno = (params) => guardarPresupuestoParaTurno(params);

