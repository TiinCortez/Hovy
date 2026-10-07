import { ahoraEnArgentina, validarFechaNoPasada } from './fechaArgentina.js';

// Reglas de alta/reprogramación administrativa; no se aplican al flujo del bot.
export function validarFechaAltaTurno(fecha, inicio, fin, ahora = new Date()) {
  if (typeof fecha !== 'string') return 'La fecha del turno debe tener el formato YYYY-MM-DD.';
  const errorFecha = validarFechaNoPasada(fecha, 'La fecha del turno', ahora);
  if (errorFecha) return errorFecha;
  const horaValida = (hora) => typeof hora === 'string' && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(hora);
  if (!horaValida(inicio) || !horaValida(fin)) return 'La franja horaria del turno no es válida.';
  const segundos = (hora) => {
    const [h, m, s = 0] = hora.split(':').map(Number);
    return h * 3600 + m * 60 + s;
  };
  if (segundos(fin) <= segundos(inicio)) return 'La hora de finalización debe ser posterior al inicio.';
  const reloj = ahoraEnArgentina(ahora);
  if (fecha === reloj.fecha && segundos(inicio) < reloj.segundos) {
    return 'No se puede agendar un turno en un horario que ya pasó.';
  }
  return null;
}
