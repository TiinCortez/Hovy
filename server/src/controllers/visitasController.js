import { supabaseAdmin } from '../config/supabase.js';

// Solicitudes de visita del canal web (panel). Las crea el bot
// (botVisitasController.js); acá se leen y se avanzan de estado.
//
// Las que están en Pendiente son las notificaciones del panel.

// Copia literal del CHECK de docs/supabase-solicitudes-visita-contactada.sql.
export const ESTADOS_VISITA_VALIDOS = ['Pendiente', 'Contactada', 'Confirmada', 'Realizada', 'Cancelada'];

const ERROR_ID_SOLICITUD_INVALIDO =
  'El id de la solicitud tiene que ser un número entero positivo.';

// Filtra acá lo que si no llegaría a Postgres como un 22P02 y volvería como 500.
const parsearIdSolicitud = (valor) => {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) return null;
  return numero;
};

// GET /api/visitas?estado=Pendiente
//
// Sin filtro devuelve todas. Más nuevas primero: lo que el panel necesita ver
// es lo que acaba de entrar.
export const getSolicitudesVisita = async (req, res) => {
  const { estado } = req.query;

  if (estado !== undefined && !ESTADOS_VISITA_VALIDOS.includes(estado)) {
    return res.status(400).json({
      ok: false,
      error: `estado inválido: "${estado}". Valores permitidos: ${ESTADOS_VISITA_VALIDOS.join(', ')}`,
    });
  }

  try {
    let query = supabaseAdmin
      .from('solicitudes_visita')
      .select('*')
      .order('created_at', { ascending: false });

    if (estado) query = query.eq('estado', estado);

    const { data, error } = await query;

    if (error) {
      console.error('Error al listar las solicitudes de visita:', error);
      return res.status(500).json({
        ok: false,
        error: 'No se pudieron consultar las solicitudes de visita. Intentá de nuevo más tarde.',
      });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error('Error inesperado al listar las solicitudes de visita:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al consultar las solicitudes de visita.',
    });
  }
};

// GET /api/visitas/:id
//
// Detalle completo de una solicitud (la página "Ver detalles" del panel).
export const getSolicitudVisita = async (req, res) => {
  const idSolicitud = parsearIdSolicitud(req.params.id);

  if (!idSolicitud) {
    return res.status(400).json({ ok: false, error: ERROR_ID_SOLICITUD_INVALIDO });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('solicitudes_visita')
      .select('*')
      .eq('id_solicitud', idSolicitud)
      .maybeSingle();

    if (error) {
      console.error('Error al obtener la solicitud de visita:', error);
      return res.status(500).json({
        ok: false,
        error: 'No se pudo consultar la solicitud de visita. Intentá de nuevo más tarde.',
      });
    }

    if (!data) {
      return res.status(404).json({
        ok: false,
        error: `No existe una solicitud de visita con el id ${idSolicitud}.`,
      });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error('Error inesperado al obtener la solicitud de visita:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al consultar la solicitud de visita.',
    });
  }
};

// PATCH /api/visitas/:id/contactar
//
// El botón "Contactarse" de la notificación. Solo avanza una solicitud en
// Pendiente: el filtro por estado va en el mismo UPDATE, así que si dos admins
// la aprietan a la vez el segundo recibe 409 en vez de pisar la fecha y el
// usuario que dejó el primero.
export const contactarSolicitudVisita = async (req, res) => {
  const idSolicitud = parsearIdSolicitud(req.params.id);

  if (!idSolicitud) {
    return res.status(400).json({ ok: false, error: ERROR_ID_SOLICITUD_INVALIDO });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('solicitudes_visita')
      .update({
        estado: 'Contactada',
        contactada_at: new Date().toISOString(),
        // sub es el id de usuarios que firma authController.
        contactada_por: req.user?.sub ?? null,
      })
      .eq('id_solicitud', idSolicitud)
      .eq('estado', 'Pendiente')
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error al marcar como contactada la solicitud de visita:', error);
      return res.status(500).json({
        ok: false,
        error: 'No se pudo actualizar la solicitud de visita. Intentá de nuevo más tarde.',
      });
    }

    if (data) {
      return res.status(200).json({ ok: true, data });
    }

    // No se actualizó nada: o no existe, o ya no estaba Pendiente. Se consulta
    // aparte solo para devolver el status que corresponde.
    const { data: actual, error: errorBusqueda } = await supabaseAdmin
      .from('solicitudes_visita')
      .select('estado')
      .eq('id_solicitud', idSolicitud)
      .maybeSingle();

    if (errorBusqueda) {
      console.error('Error al buscar la solicitud de visita:', errorBusqueda);
      return res.status(500).json({
        ok: false,
        error: 'No se pudo consultar la solicitud de visita. Intentá de nuevo más tarde.',
      });
    }

    if (!actual) {
      return res.status(404).json({
        ok: false,
        error: `No existe una solicitud de visita con el id ${idSolicitud}.`,
      });
    }

    return res.status(409).json({
      ok: false,
      error: `La solicitud ya no está Pendiente (estado actual: ${actual.estado}).`,
    });
  } catch (err) {
    console.error('Error inesperado al marcar como contactada la solicitud de visita:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al actualizar la solicitud de visita.',
    });
  }
};
