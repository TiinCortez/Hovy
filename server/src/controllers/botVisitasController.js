import { supabaseAdmin } from '../config/supabase.js';
import { normalizarTelefono, ERROR_TELEFONO_INVALIDO } from '../utils/telefono.js';
import { geocodificarDireccion, geocodificarCoordenadas } from '../services/geocodingService.js';
import { normalizarCoordenadas, ERROR_COORDENADAS_INVALIDAS } from '../utils/coordenadas.js';
import { validarFechaNoPasada } from '../utils/fechaArgentina.js';

// Solicitudes de visita del canal bot (n8n / WhatsApp).
//
// A diferencia del resto del bot, acá NO hace falta ser cliente: cualquiera que
// escriba puede pedir una visita dejando sus datos. Por eso la ruta no monta
// resolverClientePorTelefono (que respondería 404 al número nuevo). El teléfono
// sale igual de la URL y no del body: es el número que mandó el mensaje, un
// dato que quien escribe no elige.
//
// La solicitud no es un turno. Guarda lo que el cliente pidió; el equipo la ve,
// la confirma y recién ahí se genera el cliente, el inmueble y el turno.

// Copia literal de los CHECK de docs/supabase-solicitudes-visita.sql. Si se
// agrega un valor allá hay que agregarlo acá.
export const FRANJAS_VALIDAS = ['Mañana', 'Tarde', 'Indistinto'];

const CAMPOS_OBLIGATORIOS = ['nombre', 'apellido'];

const ERROR_COORDENADAS_INCOMPLETAS =
  'latitud y longitud tienen que venir juntas: con una sola no se puede ubicar la visita.';

const estaVacio = (valor) =>
  valor === undefined || valor === null || String(valor).trim() === '';

const textoOpcional = (valor) => (estaVacio(valor) ? null : String(valor).trim());

// Si el número ya es cliente, la solicitud queda enlazada desde el alta. Un
// error acá no frena la solicitud: id_cliente es nullable y se puede enlazar
// después, cuando se concrete la visita.
const buscarIdCliente = async (telefono) => {
  const { data, error } = await supabaseAdmin
    .from('clientes')
    .select('id_cliente')
    .eq('telefono', telefono)
    .maybeSingle();

  if (error) {
    console.error('Error al buscar cliente para la solicitud de visita:', error);
    return null;
  }

  return data?.id_cliente ?? null;
};

// POST /api/bot/visitas/:telefono
//
// Dirección: igual que en inmuebles, o viene escrita o viene el pin de
// WhatsApp (o las dos). Con el pin y sin dirección escrita, se completa con la
// geocodificación inversa; con la dirección y sin pin, se geocodifica para
// tener las coordenadas. Nominatim caído no frena la solicitud salvo en el
// único caso en que no queda ninguna dirección para guardar.
export const crearSolicitudVisita = async (req, res) => {
  const telefono = normalizarTelefono(req.params.telefono);
  if (!telefono) {
    return res.status(400).json({ ok: false, error: ERROR_TELEFONO_INVALIDO });
  }

  const body = req.body ?? {};

  // Se juntan todos los errores en un solo mensaje: por WhatsApp, repreguntar
  // de a un campo por vez es una conversación eterna.
  const errores = [];

  const camposFaltantes = CAMPOS_OBLIGATORIOS.filter((campo) => estaVacio(body[campo]));

  const vinoLatitud = !estaVacio(body.latitud);
  const vinoLongitud = !estaVacio(body.longitud);

  // Sin dirección escrita ni pin no hay a dónde ir.
  if (estaVacio(body.direccion) && !vinoLatitud && !vinoLongitud) {
    camposFaltantes.push('direccion (o latitud y longitud)');
  }

  if (camposFaltantes.length > 0) {
    errores.push(`Faltan campos obligatorios: ${camposFaltantes.join(', ')}`);
  }

  let coordenadas = null;
  if (vinoLatitud !== vinoLongitud) {
    errores.push(ERROR_COORDENADAS_INCOMPLETAS);
  } else if (vinoLatitud) {
    coordenadas = normalizarCoordenadas(body.latitud, body.longitud);
    if (!coordenadas) errores.push(ERROR_COORDENADAS_INVALIDAS);
  }

  const franja = estaVacio(body.franja_preferida) ? 'Indistinto' : body.franja_preferida;
  if (!FRANJAS_VALIDAS.includes(franja)) {
    errores.push(
      `franja_preferida inválida: "${franja}". Valores permitidos: ${FRANJAS_VALIDAS.join(', ')}`
    );
  }

  const fechaPreferida = textoOpcional(body.fecha_preferida);
  if (fechaPreferida) {
    const errorFecha = validarFechaNoPasada(fechaPreferida, 'fecha_preferida');
    if (errorFecha) errores.push(errorFecha);
  }

  // Opcional: el cliente muchas veces no la sabe, y es solo orientativa.
  let superficieAproximada = null;
  if (!estaVacio(body.superficie_aproximada)) {
    superficieAproximada = Number(body.superficie_aproximada);
    if (!Number.isFinite(superficieAproximada) || superficieAproximada <= 0) {
      errores.push(
        `superficie_aproximada tiene que ser un número mayor a 0 (en m²). Se recibió: "${body.superficie_aproximada}"`
      );
    }
  }

  if (errores.length > 0) {
    return res.status(400).json({ ok: false, error: errores.join(' ') });
  }

  const direccion = {
    direccion: textoOpcional(body.direccion),
    barrio: textoOpcional(body.barrio),
    provincia: textoOpcional(body.provincia),
    latitud: coordenadas?.latitud ?? null,
    longitud: coordenadas?.longitud ?? null,
  };

  let origenCoordenadas = coordenadas ? 'whatsapp' : 'ninguna';

  try {
    if (coordenadas && !direccion.direccion) {
      // Lo escrito gana sobre lo que sugiere Nominatim: solo se completan los
      // campos que no vinieron.
      const sugerencia = await geocodificarCoordenadas(coordenadas);
      direccion.direccion = sugerencia.direccion;
      direccion.barrio ??= sugerencia.barrio;
      direccion.provincia ??= sugerencia.provincia;

      if (!direccion.direccion) {
        return res.status(422).json({
          ok: false,
          error: 'No pudimos obtener la dirección a partir de la ubicación. Pedile al cliente que la escriba.',
        });
      }
    } else if (!coordenadas) {
      const resultado = await geocodificarDireccion(direccion);
      if (resultado.latitud !== null && resultado.longitud !== null) {
        direccion.latitud = resultado.latitud;
        direccion.longitud = resultado.longitud;
        origenCoordenadas = 'nominatim';
      }
    }

    const idCliente = await buscarIdCliente(telefono);

    const { data, error } = await supabaseAdmin
      .from('solicitudes_visita')
      .insert({
        telefono,
        nombre: String(body.nombre).trim(),
        apellido: String(body.apellido).trim(),
        ...direccion,
        superficie_aproximada: superficieAproximada,
        servicio: textoOpcional(body.servicio),
        fecha_preferida: fechaPreferida,
        franja_preferida: franja,
        nota_horario: textoOpcional(body.nota_horario),
        id_cliente: idCliente,
      })
      .select()
      .single();

    if (error) {
      console.error('Error al registrar la solicitud de visita:', error);
      return res.status(500).json({
        ok: false,
        error: 'No se pudo registrar la solicitud de visita. Intentá de nuevo más tarde.',
      });
    }

    // es_cliente le sirve al bot para el mensaje de cierre; origen_coordenadas
    // tiene el mismo sentido que en inmuebles.
    return res.status(201).json({
      ok: true,
      mensaje: 'Recibimos tu solicitud. Te vamos a contactar para confirmar la visita.',
      data,
      es_cliente: idCliente !== null,
      origen_coordenadas: origenCoordenadas,
    });
  } catch (err) {
    console.error('Error inesperado al registrar la solicitud de visita:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al registrar la solicitud de visita.',
    });
  }
};
