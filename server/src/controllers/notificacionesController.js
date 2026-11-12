import { supabaseAdmin } from '../config/supabase.js';

// Notificaciones del panel. La lógica de qué notificar vive en la base
// (docs/migrations/017_historial_notificaciones.sql); acá solo se expone.

const DIAS_HISTORIAL = 60;

const parsearId = (valor) => {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
};

// GET /api/notificaciones
// Sincroniza (altas nuevas, cierre de resueltas) y devuelve las activas.
export const getNotificacionesActivas = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.rpc('fn_sincronizar_notificaciones');
    if (error) throw error;
    return res.status(200).json({ ok: true, data: data ?? [] });
  } catch (error) {
    console.error('Error al obtener las notificaciones:', error);
    return res.status(500).json({ ok: false, error: 'No se pudieron consultar las notificaciones.' });
  }
};

// GET /api/notificaciones/historial
// Resueltas y Canceladas cerradas en los últimos DIAS_HISTORIAL días.
export const getHistorialNotificaciones = async (req, res) => {
  const desde = new Date(Date.now() - DIAS_HISTORIAL * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { data, error } = await supabaseAdmin
      .from('notificaciones')
      .select('*')
      .in('estado', ['Resuelta', 'Cancelada'])
      .gte('fecha_cierre', desde)
      .order('fecha_cierre', { ascending: false });

    if (error) throw error;
    return res.status(200).json({ ok: true, data: data ?? [], dias: DIAS_HISTORIAL });
  } catch (error) {
    console.error('Error al obtener el historial de notificaciones:', error);
    return res.status(500).json({ ok: false, error: 'No se pudo consultar el historial de notificaciones.' });
  }
};

// Cambia el estado solo si la notificación está en el estado esperado.
const cambiarEstado = async (req, res, { desde, cambios, errorEstado, errorDb }) => {
  const id = parsearId(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'id de notificación inválido.' });

  try {
    const { data, error } = await supabaseAdmin
      .from('notificaciones')
      .update(cambios)
      .eq('id_notificacion', id)
      .eq('estado', desde)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(409).json({ ok: false, error: errorEstado });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    console.error(errorDb, error);
    return res.status(500).json({ ok: false, error: errorDb });
  }
};

// PATCH /api/notificaciones/:id/cancelar   (X + confirmación: Activa -> Cancelada)
export const cancelarNotificacion = (req, res) =>
  cambiarEstado(req, res, {
    desde: 'Activa',
    cambios: { estado: 'Cancelada', fecha_cierre: new Date().toISOString() },
    errorEstado: 'La notificación ya no está activa.',
    errorDb: 'No se pudo eliminar la notificación.',
  });

// PATCH /api/notificaciones/:id/restaurar  (historial: Cancelada -> Activa)
// Si ya no aplica, la próxima sincronización la deja Resuelta.
export const restaurarNotificacion = (req, res) =>
  cambiarEstado(req, res, {
    desde: 'Cancelada',
    cambios: { estado: 'Activa', fecha_cierre: null },
    errorEstado: 'Solo se pueden restaurar notificaciones canceladas.',
    errorDb: 'No se pudo restaurar la notificación.',
  });
