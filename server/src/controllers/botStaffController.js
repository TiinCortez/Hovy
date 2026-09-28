import { supabaseAdmin } from '../config/supabase.js';
import { TIPOS_CLIENTE_VALIDOS, responderErrorCliente } from './clientesController.js';
import { TIPOS_INMUEBLE_VALIDOS, mapearErrorInmueble } from '../utils/inmuebles.js';
import {
  obtenerHorariosDisponiblesHelper,
  validarSolapamientoTurno,
  horaAMinutos,
} from '../utils/algoritmoAgenda.js';
import { hoyEnArgentina, sumarDias, validarFechaNoPasada } from '../utils/fechaArgentina.js';
import { PRIORIDADES_VALIDAS } from './turnosController.js';

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

const ERROR_ID_SOLICITUD_INVALIDO =
  'El id de la solicitud tiene que ser un número entero positivo.';

const parsearIdSolicitud = (valor) => {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) return null;
  return numero;
};

const estaVacio = (valor) =>
  valor === undefined || valor === null || String(valor).trim() === '';

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

const ERROR_HORA_INVALIDA = (campo) =>
  `${campo} tiene que tener el formato HH:MM. Se recibió inválido.`;

const HORA_REGEX = /^\d{2}:\d{2}(:\d{2})?$/;

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

// GET /api/bot/staff/:telefono/disponibilidad?fecha=&desde=&hasta=&dias=&limite=
//
// Envuelve obtenerHorariosDisponiblesHelper (algoritmoAgenda.js), que hasta
// ahora no colgaba de ningún endpoint. Dos modos:
//
//   - Con `fecha`: los huecos libres de ese día, opcionalmente recortados a la
//     ventana horaria [desde, hasta) que pida el admin ("entre las 15 y 17hs").
//   - Sin `fecha`: recorre los próximos `dias` días (14 por defecto) desde hoy
//     y devuelve los que tengan algún hueco dentro de la ventana, hasta juntar
//     `limite` resultados (5 por defecto) — es la forma de responder "¿qué día
//     tengo libre entre las 15 y 17hs?" sin escanear meses de una.
//
// desde/hasta van juntos o ninguno: pedir solo uno no acota nada por sí solo.
export const consultarDisponibilidadStaff = async (req, res) => {
  const { fecha, desde, hasta, dias, limite, duracion_minutos, buffer_minutos } = req.query;

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

  if (errores.length > 0) {
    return res.status(400).json({ ok: false, error: errores.join(' ') });
  }

  // Un slot entra si se superpone con la ventana pedida, no solo si cabe
  // entero adentro: con turnos de 2 hs por defecto, una ventana de "15 a
  // 17hs" ya es del mismo ancho que el turno, así que exigir que quepa entero
  // dejaría afuera slots que arrancan un poco antes o siguen un poco después.
  const seSuperponeConVentana = (slot) =>
    !vinoDesde || (horaAMinutos(slot.inicio_desde) < horaAMinutos(hasta) && horaAMinutos(slot.hasta) > horaAMinutos(desde));

  try {
    if (fecha) {
      const disponibles = await obtenerHorariosDisponiblesHelper({
        fecha_programada: fecha,
        duracionTurnoMinutos,
        bufferMinutos,
      });

      return res.status(200).json({
        ok: true,
        data: [{ fecha, disponibles: disponibles.filter(seSuperponeConVentana) }],
      });
    }

    const resultados = [];
    let cursor = hoyEnArgentina();

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

    return res.status(200).json({ ok: true, data: resultados });
  } catch (err) {
    console.error('Error inesperado al consultar disponibilidad:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al consultar la disponibilidad.',
    });
  }
};

// POST /api/bot/staff/:telefono/visitas/:id/presupuesto
//
// El admin dicta un monto por WhatsApp después de la visita. Sin base de
// precios todavía (servicios_catalogo/detalle_presupuesto sin usar), así que
// por ahora esto es un monto total y una nota en texto libre para lo que
// quiera aclarar — no un desglose por servicio.
//
// Se crea directo en estado Aceptado: acá no hay un presupuesto que el
// cliente apruebe aparte, el admin que lo dicta ya está aceptándolo. Eso es lo
// que POST .../turnos va a exigir para poder agendar.
//
// Si la solicitud ya tenía un presupuesto cargado, este endpoint lo
// actualiza en vez de crear uno nuevo: el admin puede haberse equivocado con
// el monto y corregirlo con una segunda llamada, sin dejar una fila
// huérfana por cada corrección.
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
    const { data: solicitud, error: errorBusqueda } = await supabaseAdmin
      .from('solicitudes_visita')
      .select('*')
      .eq('id_solicitud', idSolicitud)
      .maybeSingle();

    if (errorBusqueda) {
      console.error('Error al buscar la solicitud para cargar el presupuesto:', errorBusqueda);
      return res.status(500).json({
        ok: false,
        error: 'No se pudo consultar la solicitud. Intentá de nuevo más tarde.',
      });
    }

    if (!solicitud) {
      return res.status(404).json({
        ok: false,
        error: `No existe una solicitud de visita con el id ${idSolicitud}.`,
      });
    }

    // Confirmada es la única etapa donde ya hay cliente e inmueble para
    // colgar el presupuesto (presupuestos.id_cliente e id_inmueble son
    // NOT NULL en la base).
    if (solicitud.estado !== 'Confirmada') {
      return res.status(409).json({
        ok: false,
        error: `La solicitud tiene que estar Confirmada para cargarle un presupuesto (estado actual: ${solicitud.estado}). Confirmá la visita primero.`,
      });
    }

    // Sin descuento ni recargo logístico todavía: subtotal y total son el
    // mismo número. El día que exista la base de precios, esto se arma con
    // detalle_presupuesto en vez de escribirse a mano acá.
    const camposPresupuesto = {
      id_cliente: solicitud.id_cliente,
      id_inmueble: solicitud.id_inmueble,
      monto_subtotal: montoTotal,
      monto_total: montoTotal,
      estado: 'Aceptado',
      nota,
    };

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
        return res.status(500).json({ ok: false, error: 'No se pudo actualizar el presupuesto.' });
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
        return res.status(500).json({ ok: false, error: 'No se pudo registrar el presupuesto.' });
      }

      presupuesto = data;

      const { error: errorEnlace } = await supabaseAdmin
        .from('solicitudes_visita')
        .update({ id_presupuesto: presupuesto.id_presupuesto })
        .eq('id_solicitud', idSolicitud);

      if (errorEnlace) {
        console.error('Error al enlazar el presupuesto con la solicitud:', errorEnlace);
        return res.status(500).json({
          ok: false,
          error: 'El presupuesto se registró, pero no se pudo enlazar con la solicitud. Reintentá la carga.',
        });
      }
    }

    return res.status(200).json({
      ok: true,
      mensaje: `Presupuesto de $${montoTotal} registrado para ${solicitud.nombre} ${solicitud.apellido}.`,
      data: presupuesto,
    });
  } catch (err) {
    console.error('Error inesperado al cargar el presupuesto:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al cargar el presupuesto.',
    });
  }
};

// POST /api/bot/staff/:telefono/visitas/:id/confirmar
//
// Cierra el semi-registro: crea (o reusa) el cliente y crea el inmueble con
// los datos que el admin confirmó en la visita física, y enlaza los dos en la
// solicitud. A partir de acá la solicitud tiene id_inmueble, que es lo único
// que POST .../turnos va a aceptar para ubicar el turno.
//
// tipo_inmueble y superficie_total no se completan solos: son justo el dato
// que la visita física verifica (la solicitud solo tenía una superficie
// aproximada, si el cliente la sabía). superficie_total y provincia caen a lo
// que ya traía la solicitud si el body no las manda.
export const confirmarSolicitudVisita = async (req, res) => {
  const idSolicitud = parsearIdSolicitud(req.params.id);
  if (!idSolicitud) {
    return res.status(400).json({ ok: false, error: ERROR_ID_SOLICITUD_INVALIDO });
  }

  const body = req.body ?? {};

  try {
    const { data: solicitud, error: errorBusqueda } = await supabaseAdmin
      .from('solicitudes_visita')
      .select('*')
      .eq('id_solicitud', idSolicitud)
      .maybeSingle();

    if (errorBusqueda) {
      console.error('Error al buscar la solicitud a confirmar:', errorBusqueda);
      return res.status(500).json({
        ok: false,
        error: 'No se pudo consultar la solicitud. Intentá de nuevo más tarde.',
      });
    }

    if (!solicitud) {
      return res.status(404).json({
        ok: false,
        error: `No existe una solicitud de visita con el id ${idSolicitud}.`,
      });
    }

    if (solicitud.estado !== 'Contactada') {
      return res.status(409).json({
        ok: false,
        error: `La solicitud tiene que estar Contactada para confirmarse (estado actual: ${solicitud.estado}).`,
      });
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

    let tipoCliente = solicitud.id_cliente ? null : (body.tipo_cliente || 'Casual');
    if (tipoCliente && !TIPOS_CLIENTE_VALIDOS.includes(tipoCliente)) {
      errores.push(
        `tipo_cliente inválido: "${tipoCliente}". Valores permitidos: ${TIPOS_CLIENTE_VALIDOS.join(', ')}`
      );
    }

    if (errores.length > 0) {
      return res.status(400).json({ ok: false, error: errores.join(' ') });
    }

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
        if (responderErrorCliente(errorCliente, res)) return;
        console.error('Error al crear cliente al confirmar solicitud de visita:', errorCliente);
        return res.status(500).json({ ok: false, error: 'No se pudo registrar el cliente.' });
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
      return res.status(status).json({ ok: false, error: mensaje });
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
      return res.status(500).json({
        ok: false,
        error: 'El cliente y el inmueble se registraron, pero no se pudo confirmar la solicitud. Reintentá la confirmación.',
      });
    }

    if (!solicitudConfirmada) {
      return res.status(409).json({
        ok: false,
        error: 'La solicitud ya fue confirmada por otra conversación mientras se procesaba esta.',
      });
    }

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

const HORA_REGEX_TURNO = /^\d{2}:\d{2}(:\d{2})?$/;

// POST /api/bot/staff/:telefono/visitas/:id/turno
//
// Cierra la cadena: agenda el turno con el id_inmueble y el id_presupuesto
// que ya quedaron enlazados en la solicitud — nunca con un id_inmueble que
// venga en el body. inicio_desde/hasta usan el mismo nombre que devuelve
// GET .../disponibilidad, para que el agente pueda pasar un slot elegido de
// ahí directo, sin traducir campos.
//
// Exige que la solicitud ya tenga presupuesto cargado (id_presupuesto), algo
// que la tabla turnos en sí no obliga (ahí es opcional) pero que sí es la
// regla de este flujo: acá no se agenda sin haber dictado un monto antes.
export const crearTurnoDesdeSolicitud = async (req, res) => {
  const idSolicitud = parsearIdSolicitud(req.params.id);
  if (!idSolicitud) {
    return res.status(400).json({ ok: false, error: ERROR_ID_SOLICITUD_INVALIDO });
  }

  const body = req.body ?? {};
  const errores = [];

  const errorFecha = estaVacio(body.fecha_programada)
    ? 'fecha_programada es obligatoria.'
    : validarFechaNoPasada(body.fecha_programada);
  if (errorFecha) errores.push(errorFecha);

  const vinoInicio = !estaVacio(body.inicio_desde);
  const vinoHasta = !estaVacio(body.hasta);
  if (vinoInicio !== vinoHasta) {
    errores.push('inicio_desde y hasta tienen que venir juntos: con uno solo no se puede armar la franja horaria.');
  } else if (vinoInicio && (!HORA_REGEX_TURNO.test(body.inicio_desde) || !HORA_REGEX_TURNO.test(body.hasta))) {
    errores.push('inicio_desde y hasta tienen que tener el formato HH:MM.');
  } else if (vinoInicio && horaAMinutos(body.inicio_desde) >= horaAMinutos(body.hasta)) {
    errores.push('inicio_desde tiene que ser menor a hasta.');
  }

  if (estaVacio(body.prioridad)) {
    errores.push('prioridad es obligatoria.');
  } else if (!PRIORIDADES_VALIDAS.includes(body.prioridad)) {
    errores.push(`prioridad inválida: "${body.prioridad}". Valores permitidos: ${PRIORIDADES_VALIDAS.join(', ')}`);
  }

  if (errores.length > 0) {
    return res.status(400).json({ ok: false, error: errores.join(' ') });
  }

  try {
    const { data: solicitud, error: errorBusqueda } = await supabaseAdmin
      .from('solicitudes_visita')
      .select('*')
      .eq('id_solicitud', idSolicitud)
      .maybeSingle();

    if (errorBusqueda) {
      console.error('Error al buscar la solicitud para agendar el turno:', errorBusqueda);
      return res.status(500).json({
        ok: false,
        error: 'No se pudo consultar la solicitud. Intentá de nuevo más tarde.',
      });
    }

    if (!solicitud) {
      return res.status(404).json({
        ok: false,
        error: `No existe una solicitud de visita con el id ${idSolicitud}.`,
      });
    }

    if (solicitud.estado !== 'Confirmada') {
      return res.status(409).json({
        ok: false,
        error: `La solicitud tiene que estar Confirmada para agendar el turno (estado actual: ${solicitud.estado}).`,
      });
    }

    // Defensivo: si llegó a Confirmada, confirmarSolicitudVisita ya le puso
    // id_inmueble. Lo que sí puede faltar de verdad es el presupuesto, que es
    // un paso aparte (cargarPresupuestoStaff) y nada obliga a que ya haya
    // pasado.
    if (!solicitud.id_inmueble) {
      return res.status(409).json({
        ok: false,
        error: 'La solicitud no tiene un inmueble enlazado. Volvé a confirmarla.',
      });
    }

    if (!solicitud.id_presupuesto) {
      return res.status(409).json({
        ok: false,
        error: 'La solicitud todavía no tiene un presupuesto cargado. Cargalo antes de agendar el turno.',
      });
    }

    if (vinoInicio) {
      const hayChoque = await validarSolapamientoTurno({
        fecha_programada: body.fecha_programada,
        inicio_desde: body.inicio_desde,
        hasta: body.hasta,
      });

      if (hayChoque) {
        return res.status(409).json({
          ok: false,
          error: 'Ese horario ya está ocupado por otro turno. Consultá disponibilidad de nuevo.',
        });
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
      return res.status(500).json({ ok: false, error: 'No se pudo registrar el turno.' });
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
      return res.status(500).json({
        ok: false,
        error: 'El turno se registró, pero no se pudo enlazar con la solicitud.',
      });
    }

    if (!solicitudFinal) {
      return res.status(409).json({
        ok: false,
        error: 'La solicitud ya fue procesada por otra conversación mientras se agendaba el turno.',
      });
    }

    return res.status(201).json({
      ok: true,
      mensaje: `Turno agendado para ${solicitud.nombre} ${solicitud.apellido} el ${body.fecha_programada}${vinoInicio ? ` de ${body.inicio_desde} a ${body.hasta}` : ''}.`,
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
