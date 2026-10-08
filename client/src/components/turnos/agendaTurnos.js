// Configuración y cálculos compartidos exclusivamente por el ABMC de Turnos.
// Utilidades puras: no importan configuración ni servicios del servidor.
import { ahoraEnArgentina, sumarDias } from '../../../../server/src/utils/fechaArgentina.js';

export function obtenerAhoraTurnos(ahora = new Date()) {
  return ahoraEnArgentina(ahora);
}

// Las fechas de la agenda son días calendario, sin conversión a UTC.
export const fechaDesdeIso = (iso) => new Date(`${iso}T12:00:00`);

export function fechaAIso(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

export function sumarDiasTurnos(iso, cantidad) {
  return sumarDias(iso, cantidad);
}

export function inicioSemanaTurnos(iso) {
  const dia = fechaDesdeIso(iso).getDay();
  return sumarDiasTurnos(iso, -(dia === 0 ? 6 : dia - 1));
}

export function cambiarMesTurnos(iso, cantidad) {
  const fecha = fechaDesdeIso(iso);
  // Evita que el 31 salte al mes siguiente al navegar a un mes más corto.
  fecha.setDate(1);
  fecha.setMonth(fecha.getMonth() + cantidad);
  return fechaAIso(fecha);
}

export function horarioPasadoTurnos(fecha, hora, ahora = obtenerAhoraTurnos()) {
  if (!fecha || !hora) return true;
  const [h, m, s = 0] = hora.split(':').map(Number);
  return fecha < ahora.fecha || (fecha === ahora.fecha && h * 3600 + m * 60 + s < ahora.segundos);
}

export const PRIORIDADES_CONFIG = {
  P1_REASIGNADO: { label: 'P1 Reasignado', short: 'P1 - REASIGNADO', code: 'P1', color: 'danger', weight: 3, description: 'Turno postergado o urgente' },
  P2_FIJO: { label: 'P2 Fijo', short: 'P2 - FIJO', code: 'P2', color: 'success', weight: 2, description: 'Cliente frecuente o abono' },
  P3_CASUAL: { label: 'P3 Casual', short: 'P3 - CASUAL', code: 'P3', color: 'secondary', weight: 1, description: 'Según vacante diaria' }
};

export const PRIORIDADES = Object.entries(PRIORIDADES_CONFIG).map(([value, config]) => ({
  value, title: config.label, description: config.description, color: config.color
}));

const FRANJAS_BASE = [
  { horaInicio: '08:30', horaFin: '11:00' },
  { horaInicio: '11:30', horaFin: '13:30' },
  { horaInicio: '14:00', horaFin: '16:30' },
  { horaInicio: '16:30', horaFin: '18:30' }
];

export function horaAMinutos(hora) {
  if (typeof hora !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(hora)) return null;
  const [h, m, s = 0] = hora.split(':').map(Number);
  return h * 60 + m + s / 60;
}

export function minutosAHora(minutos) {
  const total = Math.min(Math.round(minutos), 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function tieneHorarioTurno(turno) {
  const inicio = horaAMinutos(turno.franjaHoraria?.horaInicio);
  const fin = horaAMinutos(turno.franjaHoraria?.horaFin);
  return inicio !== null && fin !== null && fin > inicio;
}

export function compararHorarioTurnos(a, b) {
  const inicioA = horaAMinutos(a.franjaHoraria?.horaInicio);
  const inicioB = horaAMinutos(b.franjaHoraria?.horaInicio);
  if (inicioA === null) return inicioB === null ? 0 : 1;
  if (inicioB === null) return -1;
  return inicioA - inicioB;
}

export function formatearHorarioTurno(turno) {
  return tieneHorarioTurno(turno)
    ? `${turno.franjaHoraria.horaInicio} - ${turno.franjaHoraria.horaFin} hs`
    : 'Sin horario';
}

export function obtenerFranjasTurnos({ fecha, turnos = [], turnoActual, horaInicioInicial }) {
  let slots = FRANJAS_BASE.map((slot) => ({ ...slot }));
  // Conserva la franja exacta de turnos creados fuera de las opciones fijas.
  if (turnoActual && tieneHorarioTurno(turnoActual)) {
    const actual = turnoActual.franjaHoraria;
    slots = slots.filter((slot) => horaAMinutos(slot.horaInicio) !== horaAMinutos(actual.horaInicio));
    slots.push({ horaInicio: actual.horaInicio, horaFin: actual.horaFin });
  }
  const inicioInicial = horaAMinutos(horaInicioInicial);
  if (inicioInicial !== null && !slots.some((slot) => horaAMinutos(slot.horaInicio) === inicioInicial)) {
    slots.push({ horaInicio: horaInicioInicial, horaFin: minutosAHora(inicioInicial + 120) });
  }
  return slots.sort((a, b) => horaAMinutos(a.horaInicio) - horaAMinutos(b.horaInicio)).map((slot) => ({
    ...slot,
    turnoSolapado: turnos.find((turno) => {
      if (turno.estado === 'CANCELADO' || turno.fechaAsignada !== fecha || !tieneHorarioTurno(turno)) return false;
      if (turnoActual && String(turno.idTurno) === String(turnoActual.idTurno)) return false;
      return horaAMinutos(slot.horaInicio) < horaAMinutos(turno.franjaHoraria.horaFin)
        && horaAMinutos(slot.horaFin) > horaAMinutos(turno.franjaHoraria.horaInicio);
    })
  }));
}
