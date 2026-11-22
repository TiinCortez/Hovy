// Utilidad pura: traduce lo que respondió el backend sobre el aviso por WhatsApp
// ("aviso_whatsapp" al asignar un turno) en el mensaje que ve el admin.
// Devuelve null cuando no hay nada que mostrar, o { tipo, mensaje, duracion? } para useAvisos().
//
// El aviso es texto libre: solo llega si el cliente escribió en las últimas 24 h
// (sin costo). Fuera de esa ventana no se manda y el admin tiene que avisarle él.
// Nunca se muestran códigos internos (motivo, n8n, webhook) al admin.

const DURACION_LECTURA_MS = 10_000;

export function resumenAvisoWhatsapp(aviso) {
  if (!aviso || typeof aviso !== 'object') return null;

  if (aviso.enviado === true) {
    return { tipo: 'ok', mensaje: 'Le avisamos al cliente por WhatsApp.' };
  }

  switch (aviso.motivo) {
    case undefined:
    case null:
    case 'turno_cancelado':
      return null;
    case 'fuera_de_ventana':
      return {
        tipo: 'aviso',
        mensaje: 'No pudimos avisarle por WhatsApp: pasaron más de 24 h desde su último mensaje. Avisale vos.',
        duracion: DURACION_LECTURA_MS,
      };
    case 'sin_precio':
      return {
        tipo: 'aviso',
        mensaje: 'No se avisó por WhatsApp: el turno no tiene precio final. Avisale vos.',
        duracion: DURACION_LECTURA_MS,
      };
    case 'sin_telefono':
      return {
        tipo: 'aviso',
        mensaje: 'No se avisó por WhatsApp: el cliente no tiene teléfono cargado. Avisale vos.',
        duracion: DURACION_LECTURA_MS,
      };
    default:
      return {
        tipo: 'aviso',
        mensaje: 'No se pudo avisar al cliente por WhatsApp (problema técnico). Avisale vos.',
        duracion: DURACION_LECTURA_MS,
      };
  }
}
