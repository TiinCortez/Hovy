import { supabaseAdmin } from '../config/supabase.js';
import { TIPOS_CLIENTE_VALIDOS, responderErrorCliente } from '../controllers/clientesController.js';
import { TIPOS_INMUEBLE_VALIDOS, mapearErrorInmueble } from '../utils/inmuebles.js';
import {
  obtenerHorariosDisponiblesHelper,
  validarSolapamientoTurno,
  horaAMinutos,
} from '../utils/algoritmoAgenda.js';
import { hoyEnArgentina, sumarDias, validarFechaNoPasada } from '../utils/fechaArgentina.js';
import { PRIORIDADES_VALIDAS } from '../controllers/turnosController.js';
import { estaVacio, falla } from '../utils/solicitudesVisita.js';
import { buscarSolicitud, exigirPresupuestoAceptado } from './presupuestoService.js';

// Visit workflow shared by the two channels: the WhatsApp bot (staff routes,
// botStaffController.js) and the web panel (visitasFlujoController.js).
// Contactada -> confirmar -> (services/budget in presupuestoService.js) ->
// disponibilidad -> turno.
//
// Services never touch req/res: they take plain arguments and return either
// `{ error: { status, message } }` (message already in Spanish) or the data
// the controller needs.

const HORA_REGEX = /^\d{2}:\d{2}(:\d{2})?$/;

const ERROR_HORA_INVALIDA = (campo) =>
  `${campo} tiene que tener el formato HH:MM. Se recibió inválido.`;

// Duración y margen por defecto de obtenerHorariosDisponiblesHelper
// (algoritmoAgenda.js), repetidos acá para poder validar los que mande el
// caller contra el mismo criterio ("entero positivo").
const DURACION_DEFECTO_MIN = 120;
const BUFFER_DEFECTO_MIN = 60;
const DIAS_DEFECTO = 14;
const DIAS_MAXIMO = 60;
const RESULTADOS_DEFECTO = 5;
const RESULTADOS_MAXIMO = 30;

const parsearEnteroPositivo = (valor, porDefecto, maximo) => {
  if (estaVacio(valor)) return porDefecto;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) return null;
  return maximo ? Math.min(numero, maximo) : numero;
};

// Availability query (fecha|desde|hasta|dias|limite|duracion_minutos|
// buffer_minutos). Wraps obtenerHorariosDisponiblesHelper (algoritmoAgenda.js).
// Two modes:
//
//   - Con `fecha`: los huecos libres de ese día, opcionalmente recortados a la
//     ventana horaria [desde, hasta) que pida el admin ("entre las 15 y 17hs").
//   - Sin `fecha`: recorre los próximos `dias` días (14 por defecto) desde hoy
//     y devuelve los que tengan algún hueco dentro de la ventana, hasta juntar
//     `limite` resultados (5 por defecto) — es la forma de responder "¿qué día
//     tengo libre entre las 15 y 17hs?" sin escanear meses de una.
//
// desde/hasta van juntos o ninguno: pedir solo uno no acota nada por sí solo.
// Returns { data } or { error }.
export const consultarDisponibilidad = async (query) => {
  const { fecha, desde, hasta, dias, limite, duracion_minutos, buffer_minutos } = query;

  const errores = [];

  if (fecha) {
    const errorFecha = validarFechaNoPasada(fecha);
    if (errorFecha) errores.push(errorFecha);
  }

  const vinoDesde = !estaVacio(desde);
  const vinoHasta = !estaVacio(hasta);
  if (vinoDesde !== vinoHasta) {
    errores.push('desde y hasta tienen que venir juntos: con uno solo no se puede acotar la ventana horaria.');
  } else if (vinoDesde && (!HORA_REGEX.test(desde) || !HORA_REGEX.test(hasta))) {
    errores.push(ERROR_HORA_INVALIDA('desde/hasta'));
  } else if (vinoDesde && horaAMinutos(desde) >= horaAMinutos(hasta)) {
    errores.push('desde tiene que ser menor a hasta.');
  }

  const duracionTurnoMinutos = parsearEnteroPositivo(duracion_minutos, DURACION_DEFECTO_MIN);
  if (duracionTurnoMinutos === null) errores.push('duracion_minutos tiene que ser un entero positivo.');

  const bufferMinutos = parsearEnteroPositivo(buffer_minutos, BUFFER_DEFECTO_MIN);
  if (bufferMinutos === null) errores.push('buffer_minutos tiene que ser un entero positivo.');

  const diasABuscar = parsearEnteroPositivo(dias, DIAS_DEFECTO, DIAS_MAXIMO);
  if (diasABuscar === null) errores.push(`dias tiene que ser un entero positivo (máximo ${DIAS_MAXIMO}).`);

  const limiteResultados = parsearEnteroPositivo(limite, RESULTADOS_DEFECTO, RESULTADOS_MAXIMO);
  if (limiteResultados === null) errores.push(`limite tiene que ser un entero positivo (máximo ${RESULTADOS_MAXIMO}).`);

  if (errores.length > 0) return falla(400, errores.join(' '));

  // Un slot entra si se superpone con la ventana pedida, no solo si cabe
  // entero adentro: con turnos de 2 hs por defecto, una ventana de "15 a
  // 17hs" ya es del mismo ancho que el turno, así que exigir que quepa entero
  // dejaría afuera slots que arrancan un poco antes o siguen un poco después.
  const seSuperponeConVentana = (slot) =>
    !vinoDesde || (horaAMinutos(slot.inicio_desde) < horaAMinutos(hasta) && horaAMinutos(slot.hasta) > horaAMinutos(desde));

  if (fecha) {
    const disponibles = await obtenerHorariosDisponiblesHelper({
      fecha_programada: fecha,
      duracionTurnoMinutos,
      bufferMinutos,
    });

    return { data: [{ fecha, disponibles: disponibles.filter(seSuperponeConVentana) }] };
  }

  const resultados = [];
  const cursor = hoyEnArgentina();

  for (let i = 0; i < diasABuscar && resultados.length < limiteResultados; i++) {
    const fechaIter = i === 0 ? cursor : sumarDias(cursor, i);
    const disponibles = await obtenerHorariosDisponiblesHelper({
      fecha_programada: fechaIter,
      duracionTurnoMinutos,
      bufferMinutos,
    });

    const filtrados = disponibles.filter(seSuperponeConVentana);
    if (filtrados.length > 0) resultados.push({ fecha: fechaIter, disponibles: filtrados });
  }

  return { data: resultados };
};

// Same as responderErrorCliente (clientesController.js) but without a real
// response: that function writes the mapped error straight to `res`, so a tiny
// capture object lets this service reuse its mapping instead of duplicating it.
const mapearErrorCliente = (error) => {
  const captura = {
    codigo: null,
    cuerpo: null,
    status(codigo) {
      this.codigo = codigo;
      return this;
    },
    json(cuerpo) {
      this.cuerpo = cuerpo;
      return this;
    },
  };
  if (!responderErrorCliente(error, captura)) return null;
  return falla(captura.codigo, captura.cuerpo.error);
};

// Closes the semi-registration: creates (or reuses) the client and creates the
// property with the data the admin confirmed in the physical visit, and links
// both in the solicitud. From here on the solicitud has id_inmueble, the only
// thing the turno creation accepts to locate the turno.
//
// tipo_inmueble y superficie_total no se completan solos: son justo el dato
// que la visita física verifica (la solicitud solo tenía una superficie
// aproximada, si el cliente la sabía). superficie_total y provincia caen a lo
// que ya traía la solicitud si el body no las manda.
// Returns { solicitud, solicitudConfirmada, idCliente, inmueble } or { error }.
export const confirmarVisita = async (idSolicitud, body) => {
  const busqueda = await buscarSolicitud(idSolicitud, 'a confirmar');
  if (busqueda.error) return busqueda;
  const { solicitud } = busqueda;

  if (solicitud.estado !== 'Contactada') {
    return falla(409, `La solicitud tiene que estar Contactada para confirmarse (estado actual: ${solicitud.estado}).`);
  }

  // Se juntan todos los errores en un solo mensaje, igual que en el resto
  // del bot: por WhatsApp, repreguntar de a un campo por vez es eterno.
  const errores = [];

  if (estaVacio(body.tipo_inmueble)) {
    errores.push('tipo_inmueble es obligatorio.');
  } else if (!TIPOS_INMUEBLE_VALIDOS.includes(body.tipo_inmueble)) {
    errores.push(
      `tipo_inmueble inválido: "${body.tipo_inmueble}". Valores permitidos: ${TIPOS_INMUEBLE_VALIDOS.join(', ')}`
    );
  }

  const superficieTotal = estaVacio(body.superficie_total)
    ? solicitud.superficie_aproximada
    : Number(body.superficie_total);

  if (estaVacio(superficieTotal)) {
    errores.push('superficie_total es obligatoria: la solicitud no tenía una superficie aproximada cargada.');
  } else if (!Number.isFinite(Number(superficieTotal)) || Number(superficieTotal) <= 0) {
    errores.push(`superficie_total tiene que ser un número mayor a 0. Se recibió: "${superficieTotal}"`);
  }

  const provincia = estaVacio(body.provincia) ? solicitud.provincia : body.provincia;
  if (estaVacio(provincia)) {
    errores.push('provincia es obligatoria: la solicitud no tenía provincia cargada.');
  }

  const tipoCliente = solicitud.id_cliente ? null : (body.tipo_cliente || 'Casual');
  if (tipoCliente && !TIPOS_CLIENTE_VALIDOS.includes(tipoCliente)) {
    errores.push(
      `tipo_cliente inválido: "${tipoCliente}". Valores permitidos: ${TIPOS_CLIENTE_VALIDOS.join(', ')}`
    );
  }

  if (errores.length > 0) return falla(400, errores.join(' '));

  // Cliente: se reusa si el teléfono ya era cliente al momento del intake
  // (buscarIdCliente en botVisitasController ya lo enlazó). Si no, se crea
  // uno nuevo sin pedir email: es el mismo criterio que el alta del panel
  // (createCliente), donde el email es opcional.
  let idCliente = solicitud.id_cliente;

  if (!idCliente) {
    const { data: clienteNuevo, error: errorCliente } = await supabaseAdmin
      .from('clientes')
      .insert({
        nombre: solicitud.nombre,
        apellido: solicitud.apellido,
        telefono: solicitud.telefono,
        tipo_cliente: tipoCliente,
        calificacion_promedio: 0,
      })
      .select()
      .single();

    if (errorCliente) {
      const errorMapeado = mapearErrorCliente(errorCliente);
      if (errorMapeado) return errorMapeado;
      console.error('Error al crear cliente al confirmar solicitud de visita:', errorCliente);
      return falla(500, 'No se pudo registrar el cliente.');
    }

    idCliente = clienteNuevo.id_cliente;
  }

  // Inmueble: siempre uno NUEVO, con la dirección que trajo la solicitud.
  // Nunca se busca "¿el cliente ya tiene algo parecido?": reusar un inmueble
  // existente reintroduciría el mismo riesgo que esta cadena de FKs busca
  // evitar (el turno terminaría en una propiedad vieja del cliente, no en
  // la que se acaba de visitar).
  const { data: inmueble, error: errorInmueble } = await supabaseAdmin
    .from('inmuebles')
    .insert({
      id_cliente: idCliente,
      direccion: solicitud.direccion,
      barrio: solicitud.barrio,
      provincia,
      tipo_inmueble: body.tipo_inmueble,
      superficie_total: Number(superficieTotal),
      superficie_mantenible: null,
      latitud: solicitud.latitud,
      longitud: solicitud.longitud,
    })
    .select()
    .single();

  if (errorInmueble) {
    const { status, mensaje } = mapearErrorInmueble(errorInmueble, 'registrar');
    return falla(status, mensaje);
  }

  // Guarda de carrera: si dos confirmaciones llegaron a la vez, la segunda
  // no pisa la primera. El cliente/inmueble que esta llamada haya creado
  // quedan igual (huérfanos de esta solicitud puntual, pero son datos
  // válidos) — con un solo admin operando, este cruce es un caso raro que no
  // amerita una transacción distribuida.
  const { data: solicitudConfirmada, error: errorUpdate } = await supabaseAdmin
    .from('solicitudes_visita')
    .update({ id_cliente: idCliente, id_inmueble: inmueble.id_inmueble, estado: 'Confirmada' })
    .eq('id_solicitud', idSolicitud)
    .eq('estado', 'Contactada')
    .select()
    .maybeSingle();

  if (errorUpdate) {
    console.error('Error al confirmar la solicitud de visita:', errorUpdate);
    return falla(
      500,
      'El cliente y el inmueble se registraron, pero no se pudo confirmar la solicitud. Reintentá la confirmación.'
    );
  }

  if (!solicitudConfirmada) {
    return falla(409, 'La solicitud ya fue confirmada por otra conversación mientras se procesaba esta.');
  }

  return { solicitud, solicitudConfirmada, idCliente, inmueble };
};

// Closes the chain: books the turno with the id_inmueble and id_presupuesto
// already linked in the solicitud — never with an id_inmueble coming in the
// body. inicio_desde/hasta use the same names the availability query returns,
// so a chosen slot can be passed straight through.
//
// Requires the solicitud to have a presupuesto (id_presupuesto) in estado
// Aceptado, something the turnos table itself does not enforce but this flow
// does: no turno is booked without a price accepted first.
// Returns { solicitud, solicitudFinal, turno, conFranja } or { error }.
export const agendarTurnoVisita = async (idSolicitud, body) => {
  const errores = [];

  const errorFecha = estaVacio(body.fecha_programada)
    ? 'fecha_programada es obligatoria.'
    : validarFechaNoPasada(body.fecha_programada);
  if (errorFecha) errores.push(errorFecha);

  const vinoInicio = !estaVacio(body.inicio_desde);
  const vinoHasta = !estaVacio(body.hasta);
  if (vinoInicio !== vinoHasta) {
    errores.push('inicio_desde y hasta tienen que venir juntos: con uno solo no se puede armar la franja horaria.');
  } else if (vinoInicio && (!HORA_REGEX.test(body.inicio_desde) || !HORA_REGEX.test(body.hasta))) {
    errores.push('inicio_desde y hasta tienen que tener el formato HH:MM.');
  } else if (vinoInicio && horaAMinutos(body.inicio_desde) >= horaAMinutos(body.hasta)) {
    errores.push('inicio_desde tiene que ser menor a hasta.');
  }

  if (estaVacio(body.prioridad)) {
    errores.push('prioridad es obligatoria.');
  } else if (!PRIORIDADES_VALIDAS.includes(body.prioridad)) {
    errores.push(`prioridad inválida: "${body.prioridad}". Valores permitidos: ${PRIORIDADES_VALIDAS.join(', ')}`);
  }

  if (errores.length > 0) return falla(400, errores.join(' '));

  const busqueda = await buscarSolicitud(idSolicitud, 'para agendar el turno');
  if (busqueda.error) return busqueda;
  const { solicitud } = busqueda;

  if (solicitud.estado !== 'Confirmada') {
    return falla(409, `La solicitud tiene que estar Confirmada para agendar el turno (estado actual: ${solicitud.estado}).`);
  }

  // Defensivo: si llegó a Confirmada, confirmarVisita ya le puso id_inmueble.
  // Lo que sí puede faltar de verdad es el presupuesto, que es un paso aparte
  // (aceptarPresupuestoVisita) y nada obliga a que ya haya pasado.
  if (!solicitud.id_inmueble) {
    return falla(409, 'La solicitud no tiene un inmueble enlazado. Volvé a confirmarla.');
  }

  if (!solicitud.id_presupuesto) {
    return falla(409, 'La solicitud todavía no tiene un presupuesto cargado. Cargalo antes de agendar el turno.');
  }

  // El turno solo se agenda con un presupuesto Aceptado.
  const presupuestoAceptado = await exigirPresupuestoAceptado(solicitud.id_presupuesto);
  if (presupuestoAceptado.error) return presupuestoAceptado;

  if (vinoInicio) {
    const hayChoque = await validarSolapamientoTurno({
      fecha_programada: body.fecha_programada,
      inicio_desde: body.inicio_desde,
      hasta: body.hasta,
    });

    if (hayChoque) {
      return falla(409, 'Ese horario ya está ocupado por otro turno. Consultá disponibilidad de nuevo.');
    }
  }

  const { data: turno, error: errorTurno } = await supabaseAdmin
    .from('turnos')
    .insert({
      id_inmueble: solicitud.id_inmueble,
      id_presupuesto: solicitud.id_presupuesto,
      fecha_programada: body.fecha_programada,
      inicio_desde: vinoInicio ? body.inicio_desde : null,
      hasta: vinoInicio ? body.hasta : null,
      prioridad: body.prioridad,
      estado: 'Coordinado',
    })
    .select()
    .single();

  if (errorTurno) {
    console.error('Error al crear el turno desde la solicitud de visita:', errorTurno);
    return falla(500, 'No se pudo registrar el turno.');
  }

  // Guarda de carrera igual que en confirmar: si dos llamadas llegaron a la
  // vez, la segunda no pisa el enlace de la primera. El turno que esta
  // llamada haya creado queda igual (con un solo admin operando, un choque
  // acá es un caso raro que no amerita una transacción distribuida) — pero
  // sí puede significar dos turnos para la misma solicitud si llegó a pasar,
  // por eso vale la pena revisar Executions si el agente reintenta solo.
  const { data: solicitudFinal, error: errorUpdate } = await supabaseAdmin
    .from('solicitudes_visita')
    .update({ id_turno: turno.id_turno, estado: 'Realizada' })
    .eq('id_solicitud', idSolicitud)
    .eq('estado', 'Confirmada')
    .select()
    .maybeSingle();

  if (errorUpdate) {
    console.error('Error al enlazar el turno con la solicitud:', errorUpdate);
    return falla(500, 'El turno se registró, pero no se pudo enlazar con la solicitud.');
  }

  if (!solicitudFinal) {
    return falla(409, 'La solicitud ya fue procesada por otra conversación mientras se agendaba el turno.');
  }

  return { solicitud, solicitudFinal, turno, conFranja: vinoInicio };
};
