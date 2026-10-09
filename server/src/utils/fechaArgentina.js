// Fechas en huso horario de Argentina, sin depender de dónde corre el server.
//
// En Azure el server corre en UTC: a las 22 hs de Córdoba allá ya es mañana.
// Nace en botVisitasController.js (validar que fecha_preferida no sea
// anterior a hoy) y se comparte acá porque botStaffController.js necesita la
// misma cuenta para recorrer varios días de disponibilidad.

const ZONA_HORARIA = 'America/Argentina/Cordoba';

// en-CA formatea como YYYY-MM-DD, que es lo que se compara como string.
export const hoyEnArgentina = (ahora = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA }).format(ahora);

// Hora argentina para la agenda. No cambia la validación de los consumidores existentes.
export const ahoraEnArgentina = (ahora = new Date()) => {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(ahora).map(({ type, value }) => [type, value]));
  return {
    fecha: hoyEnArgentina(ahora),
    segundos: Number(partes.hour) * 3600 + Number(partes.minute) * 60 + Number(partes.second)
  };
};

// Suma (o resta, con n negativo) días a una fecha YYYY-MM-DD. Se opera en UTC
// a propósito: como fechaISO no tiene hora, sumar días calendario en UTC no
// se pisa con ningún horario de verano ni con la zona del server.
export const sumarDias = (fechaISO, n) => {
  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  fecha.setUTCDate(fecha.getUTCDate() + n);
  return fecha.toISOString().slice(0, 10);
};

// Devuelve el mensaje de error o null. Chequea el formato y que la fecha
// exista (2026-02-30 pasa la regex pero no es una fecha), y que no sea
// anterior a hoy.
export const validarFechaNoPasada = (fecha, nombreCampo = 'fecha', ahora = new Date()) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return `${nombreCampo} tiene que tener el formato YYYY-MM-DD. Se recibió: "${fecha}"`;
  }

  const [anio, mes, dia] = fecha.split('-').map(Number);
  const fechaUtc = new Date(Date.UTC(anio, mes - 1, dia));
  if (fechaUtc.getUTCMonth() !== mes - 1 || fechaUtc.getUTCDate() !== dia) {
    return `${nombreCampo} no es una fecha válida: "${fecha}"`;
  }

  if (fecha < hoyEnArgentina(ahora)) {
    return `${nombreCampo} no puede ser anterior a hoy.`;
  }

  return null;
};
