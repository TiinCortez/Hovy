import { supabaseAdmin } from '../config/supabase.js';
import { estaVacio, falla, parsearIdSolicitud } from '../utils/solicitudesVisita.js';
import { validarFechaNoPasada, ahoraEnArgentina } from '../utils/fechaArgentina.js';
import { FRANJAS_VALIDAS } from '../controllers/botVisitasController.js';
import { listarServiciosActivos } from './catalogoPublicoService.js';
import { consultarDisponibilidad } from './visitaFlujoService.js';

const HORA_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutos = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const INICIO_TARDE_MIN = 13 * 60;

// { desde, hasta } when both come, {} when neither, { error } otherwise.
const leerHorarioElegido = (body) => {
  const vinoDesde = !estaVacio(body.hora_desde);
  const vinoHasta = !estaVacio(body.hora_hasta);
  if (!vinoDesde && !vinoHasta) return {};
  if (vinoDesde !== vinoHasta) return { error: 'hora_desde y hora_hasta tienen que venir juntas.' };
  const desde = String(body.hora_desde).trim().slice(0, 5);
  const hasta = String(body.hora_hasta).trim().slice(0, 5);
  if (!HORA_HHMM.test(desde) || !HORA_HHMM.test(hasta)) {
    return { error: 'hora_desde y hora_hasta tienen que tener el formato HH:MM.' };
  }
  if (minutos(desde) >= minutos(hasta)) return { error: 'hora_desde tiene que ser menor a hora_hasta.' };
  return { desde, hasta };
};

const franjaDeHora = (hhmm) => (minutos(hhmm) < INICIO_TARDE_MIN ? 'Mañana' : 'Tarde');

const notaConHorario = (horario, nota) => {
  if (!horario.desde) return nota;
  const elegido = `Horario elegido: ${horario.desde} a ${horario.hasta}`;
  return nota ? `${elegido} · ${nota}` : elegido;
};

// Free slots shown to an existing client in the bot. Only the date can be chosen:
// duration, buffer and window stay the business defaults. Without a date it walks
// the next days and returns at most LIMITE_DIAS_CLIENTE days (a WhatsApp list
// holds up to 10 rows). Only free slots leave here, never other clients' turnos.
export const DIAS_DISPONIBILIDAD_CLIENTE = 21;
export const LIMITE_DIAS_CLIENTE = 10;

export const consultarDisponibilidadCliente = async ({
  query = {},
  consultar = consultarDisponibilidad,
  ahora = new Date(),
} = {}) => {
  const fecha = estaVacio(query.fecha) ? null : String(query.fecha).trim();
  const resultado = fecha
    ? await consultar({ fecha })
    : await consultar({ dias: DIAS_DISPONIBILIDAD_CLIENTE, limite: LIMITE_DIAS_CLIENTE });
  if (resultado.error) return resultado;

  // The shared agenda helper does not know the current time: for today, drop the
  // slots that already started. A day left without slots is dropped from the list
  // of days (with an explicit fecha it stays, empty, so the bot can say so).
  const { fecha: hoy, segundos } = ahoraEnArgentina(ahora);
  const minutoActual = Math.floor(segundos / 60);
  const dias = (resultado.data ?? []).map((dia) => (dia.fecha !== hoy ? dia : {
    ...dia,
    disponibles: (dia.disponibles ?? []).filter((h) => minutos(String(h.inicio_desde).slice(0, 5)) > minutoActual),
  }));

  return { data: fecha ? dias : dias.filter((dia) => (dia.disponibles ?? []).length > 0) };
};

// Turno request of an EXISTING client from the WhatsApp bot.
//
// The client already has their properties loaded: they pick one property, a
// service and (optionally) a preferred date / time slot.
//  - Property already measured (it has an accepted budget): the request is
//    created directly in estado 'Confirmada' with id_cliente and id_inmueble,
//    because that is all the presupuesto -> turno chain needs.
//  - First turno on the property: the request is created 'Pendiente' and goes
//    through the physical visit like a prospect. confirmarVisita updates this
//    same property (id_inmueble already set) instead of creating a duplicate.
//
// The client comes from the phone number (resolverClientePorTelefono), never
// from the body. Services never touch req/res: they return { error } or data.

const textoOpcional = (valor) => (estaVacio(valor) ? null : String(valor).trim());

// Postgres unique_violation: the partial unique index of migration 018 allows
// only one open client request per property (closes the select/insert race).
const UNIQUE_VIOLATION = '23505';

// Open = client request still waiting for its turno. Pendiente / Contactada are
// the requests that still need the physical visit (first turno on a property).
const ESTADOS_PEDIDO_ABIERTO = ['Pendiente', 'Contactada', 'Confirmada'];

const mensajePedidoEnCurso = (abierta) => {
  const numero = abierta?.id_solicitud ? ` (solicitud #${abierta.id_solicitud})` : '';
  if (abierta?.id_presupuesto) {
    return `Ya hay un pedido en curso para ese inmueble${numero} con el presupuesto cargado. Te vamos a confirmar el turno.`;
  }
  if (abierta?.estado === 'Pendiente' || abierta?.estado === 'Contactada') {
    return `Ya hay un pedido en curso para ese inmueble${numero}. Te vamos a contactar para coordinar la visita.`;
  }
  return `Ya hay un pedido en curso para ese inmueble${numero}. Te vamos a enviar el presupuesto.`;
};

// Maintainable m2 when loaded, otherwise the total; null when neither is > 0.
const superficieDelInmueble = (inmueble) => {
  for (const valor of [inmueble.superficie_mantenible, inmueble.superficie_total]) {
    const numero = Number(valor);
    if (!estaVacio(valor) && Number.isFinite(numero) && numero > 0) return numero;
  }
  return null;
};

export const crearSolicitudCliente = async ({
  cliente,
  body = {},
  ahora = new Date(),
  // Replaceable in tests.
  db = supabaseAdmin,
  listarServicios = listarServiciosActivos,
} = {}) => {
  if (!cliente?.id_cliente) {
    return falla(400, 'No se pudo identificar al cliente.');
  }

  // All the errors in one message: asking one field at a time over WhatsApp is
  // an endless conversation (same criterion as POST /bot/visitas).
  const errores = [];

  const idInmueble = parsearIdSolicitud(body.id_inmueble);
  if (!idInmueble) errores.push('id_inmueble es obligatorio y tiene que ser un número entero positivo.');

  const idServicio = parsearIdSolicitud(body.id_servicio);
  if (!idServicio) errores.push('id_servicio es obligatorio y tiene que ser un número entero positivo.');

  // Optional chosen slot (the bot shows the free slots of the day and the client
  // taps one). It is a preference, not a reservation: it defines the franja when
  // none was sent and is written in nota_horario for the admin.
  const horario = leerHorarioElegido(body);
  if (horario.error) errores.push(horario.error);

  const franja = estaVacio(body.franja_preferida)
    ? (horario.desde ? franjaDeHora(horario.desde) : 'Indistinto')
    : String(body.franja_preferida).trim();
  if (!FRANJAS_VALIDAS.includes(franja)) {
    errores.push(`franja_preferida inválida: "${franja}". Valores permitidos: ${FRANJAS_VALIDAS.join(', ')}`);
  }

  const fechaPreferida = textoOpcional(body.fecha_preferida);
  if (fechaPreferida) {
    const errorFecha = validarFechaNoPasada(fechaPreferida, 'fecha_preferida', ahora);
    if (errorFecha) errores.push(errorFecha);
  }

  if (errores.length > 0) return falla(400, errores.join(' '));

  // Ownership is applied in the query: another client's (or an inactive)
  // property simply does not come back.
  const { data: inmueble, error: errorInmueble } = await db
    .from('inmuebles')
    .select('*')
    .eq('id_inmueble', idInmueble)
    .eq('id_cliente', cliente.id_cliente)
    .eq('activo', true)
    .maybeSingle();

  if (errorInmueble) {
    console.error('Error al buscar el inmueble para el pedido del cliente:', errorInmueble);
    return falla(500, 'No se pudo consultar el inmueble. Intentá de nuevo más tarde.');
  }

  if (!inmueble) {
    return falla(404, `No existe un inmueble con el id ${idInmueble} asociado a ese teléfono.`);
  }

  const catalogo = await listarServicios();
  if (catalogo.error) return catalogo;

  const servicio = (catalogo.data ?? []).find((item) => Number(item.id_servicio) === idServicio);
  if (!servicio) {
    return falla(400, `El servicio ${idServicio} no está disponible. Elegí uno de la lista de servicios.`);
  }

  // A bot retry (or a double tap) must not create a second open request for the
  // same property: open = client request still waiting for its turno.
  const { data: abiertas, error: errorAbiertas } = await db
    .from('solicitudes_visita')
    .select('id_solicitud, id_presupuesto, estado')
    .eq('id_inmueble', idInmueble)
    .eq('tipo_solicitud', 'cliente')
    .in('estado', ESTADOS_PEDIDO_ABIERTO)
    .is('id_turno', null)
    .limit(1);

  if (errorAbiertas) {
    console.error('Error al buscar pedidos abiertos del inmueble:', errorAbiertas);
    return falla(500, 'No se pudo registrar el pedido. Intentá de nuevo más tarde.');
  }

  if ((abiertas ?? []).length > 0) {
    return falla(409, mensajePedidoEnCurso(abiertas[0]));
  }

  // First turno on a property: the m2 we have are the ones the client declared,
  // so there is nothing real to price on. Until the property has an accepted
  // budget (which only exists after someone measured it), the request goes
  // through the physical visit like a new prospect: Pendiente -> Contactada ->
  // confirmarVisita (which updates this same property with the measured m2).
  const { data: presupuestosPrevios, error: errorPresupuestos } = await db
    .from('presupuestos')
    .select('id_presupuesto')
    .eq('id_inmueble', idInmueble)
    .eq('estado', 'Aceptado')
    .limit(1);

  if (errorPresupuestos) {
    console.error('Error al buscar presupuestos previos del inmueble:', errorPresupuestos);
    return falla(500, 'No se pudo registrar el pedido. Intentá de nuevo más tarde.');
  }

  const requiereVisita = (presupuestosPrevios ?? []).length === 0;
  const superficie = superficieDelInmueble(inmueble);

  const { data: solicitud, error: errorSolicitud } = await db
    .from('solicitudes_visita')
    .insert({
      telefono: cliente.telefono,
      nombre: cliente.nombre,
      apellido: cliente.apellido ?? '',
      direccion: inmueble.direccion,
      barrio: inmueble.barrio ?? null,
      provincia: inmueble.provincia ?? null,
      latitud: inmueble.latitud ?? null,
      longitud: inmueble.longitud ?? null,
      superficie_aproximada: superficie,
      servicio: servicio.nombre,
      fecha_preferida: fechaPreferida,
      franja_preferida: franja,
      nota_horario: notaConHorario(horario, textoOpcional(body.nota_horario)),
      id_cliente: cliente.id_cliente,
      id_inmueble: inmueble.id_inmueble,
      estado: requiereVisita ? 'Pendiente' : 'Confirmada',
      tipo_solicitud: 'cliente',
    })
    .select()
    .single();

  if (errorSolicitud?.code === UNIQUE_VIOLATION) {
    // Two simultaneous requests for the same property: the other one won.
    return falla(409, mensajePedidoEnCurso(null));
  }

  if (errorSolicitud) {
    console.error('Error al registrar el pedido del cliente:', errorSolicitud);
    return falla(500, 'No se pudo registrar el pedido. Intentá de nuevo más tarde.');
  }

  // Preload the chosen service with the property's m2 so the internal estimate
  // is ready for the admin. If it fails the request is still valid: the admin
  // loads the service by hand, as with any confirmed visit. With a pending visit
  // there is no estimate yet: the declared m2 are not a basis to price on.
  let servicioCargado = false;
  if (superficie !== null && !requiereVisita) {
    const { error: errorServicio } = await db
      .from('solicitud_servicio')
      .insert({ id_solicitud: solicitud.id_solicitud, id_servicio: idServicio, superficie_m2: superficie });

    if (errorServicio) {
      console.error('Error al precargar el servicio del pedido del cliente:', errorServicio);
    } else {
      servicioCargado = true;
    }
  }

  return { solicitud, servicio, servicioCargado, requiereVisita };
};
