import { supabaseAdmin } from '../config/supabase.js';
import { estaVacio, falla } from '../utils/solicitudesVisita.js';
import { normalizarTelefono } from '../utils/telefono.js';
import { enviarAviso as enviarAvisoN8n } from './avisoTurnoService.js';

// Rejection of a NEW contact's visit request (someone who is not a client yet).
//
//  - Only Pendiente / Contactada requests of a prospect: a registered client's
//    request is cancelled instead (it may already hold a property and turnos).
//  - The row is NOT deleted: it moves to 'Rechazada' with the reason, the date
//    and who rejected it, so it stays in the panel history and in the metrics.
//  - The WhatsApp session (sesiones_wa) of that number is deleted, so if the
//    person writes again the bot treats them as a first contact.
//  - The person is told by WhatsApp, reason included, through the same n8n
//    webhook as the turno notice: free text, only delivered inside the 24 h window.
// Neither the session cleanup nor the notice can undo the rejection: both report
// their result so the panel can tell the admin.

export const MAX_MOTIVO_RECHAZO = 500;
const ESTADOS_RECHAZABLES = ['Pendiente', 'Contactada'];

// sesiones_wa.wa_id is the number exactly as WhatsApp sends it, which for
// Argentina usually comes without the mobile 9 ("543514330429") while the API
// stores the canonical form ("5493514330429"). Both are tried.
export const variantesWaId = (telefono) => {
  const canonico = normalizarTelefono(telefono);
  if (!canonico) return [];
  return [canonico, '54' + canonico.slice(3)];
};

export const armarAvisoRechazo = (solicitud, motivo) => {
  const telefono = normalizarTelefono(solicitud?.telefono);
  if (!telefono) return { ok: false, motivo: 'sin_telefono' };
  return { ok: true, body: { tipo: 'rechazo_visita', telefono, nombre: solicitud.nombre ?? '', motivo } };
};

const leerMotivo = (valor) => {
  if (estaVacio(valor)) return { motivo: null };
  if (typeof valor !== 'string') return { error: 'motivo tiene que ser un texto.' };
  const motivo = valor.trim();
  if (motivo.length > MAX_MOTIVO_RECHAZO) {
    return { error: `motivo admite como máximo ${MAX_MOTIVO_RECHAZO} caracteres.` };
  }
  return { motivo };
};

export const rechazarVisita = async ({
  idSolicitud,
  idUsuario,
  body = {},
  ahora = new Date(),
  // Replaceable in tests.
  db = supabaseAdmin,
  enviarAviso = enviarAvisoN8n,
} = {}) => {
  const leido = leerMotivo(body.motivo);
  if (leido.error) return falla(400, leido.error);

  const { data: solicitud, error: errorBusqueda } = await db
    .from('solicitudes_visita')
    .select('*')
    .eq('id_solicitud', idSolicitud)
    .maybeSingle();

  if (errorBusqueda) {
    console.error('Error al buscar la solicitud a rechazar:', errorBusqueda);
    return falla(500, 'No se pudo consultar la solicitud. Intentá de nuevo más tarde.');
  }
  if (!solicitud) return falla(404, `No existe una solicitud de visita con el id ${idSolicitud}.`);

  if (solicitud.tipo_solicitud === 'cliente' || solicitud.id_cliente) {
    return falla(409, 'Es el pedido de un cliente registrado: no se rechaza, se cancela.');
  }
  if (!ESTADOS_RECHAZABLES.includes(solicitud.estado)) {
    return falla(409, `Solo se puede rechazar una solicitud ${ESTADOS_RECHAZABLES.join(', ')} (estado actual: ${solicitud.estado}).`);
  }

  // Race guard, same as the other transitions.
  const { data: rechazada, error } = await db
    .from('solicitudes_visita')
    .update({
      estado: 'Rechazada',
      motivo_rechazo: leido.motivo,
      fecha_rechazo: ahora.toISOString(),
      rechazada_por: idUsuario ?? null,
    })
    .eq('id_solicitud', idSolicitud)
    .eq('estado', solicitud.estado)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error al rechazar la solicitud de visita:', error);
    return falla(500, 'No se pudo rechazar la solicitud.');
  }
  if (!rechazada) {
    return falla(409, 'La solicitud ya fue modificada por otra conversación mientras se rechazaba.');
  }

  let sesionBorrada = false;
  const variantes = variantesWaId(solicitud.telefono);
  if (variantes.length > 0) {
    try {
      const { error: errorSesion } = await db.from('sesiones_wa').delete().in('wa_id', variantes);
      if (errorSesion) console.error('No se pudo borrar la sesión de WhatsApp del rechazo:', errorSesion.message ?? errorSesion);
      else sesionBorrada = true;
    } catch (err) {
      console.error('Error inesperado al borrar la sesión de WhatsApp del rechazo:', err?.name || 'error');
    }
  }

  let aviso;
  try {
    const armado = armarAvisoRechazo(solicitud, leido.motivo);
    aviso = armado.ok ? await enviarAviso(armado.body) : { enviado: false, motivo: armado.motivo };
  } catch (err) {
    aviso = { enviado: false, motivo: 'error_inesperado' };
  }
  if (!aviso.enviado && aviso.motivo !== 'no_configurado') {
    console.warn(`[rechazo-visita] no se avisó el rechazo de la solicitud ${idSolicitud}: ${aviso.motivo}`);
  }

  return { solicitud, rechazada, sesionBorrada, aviso };
};
