// Helpers compartidos por la vista de Cobros. Toda la liquidación se arma en el
// front a partir de GET /api/turnos.
import { compararHorarioTurnos } from '../turnos/agendaTurnos';

// Días sin cobrar a partir de los cuales un turno se marca como atrasado.
export const DIAS_ALERTA_COBRO = 10;
export const COBROS_POR_PAGINA = 8;

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGOS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const ORDENES = [
  { value: 'recientes', label: 'Recientes primero' },
  { value: 'monto-desc', label: 'Monto: mayor a menor' },
  { value: 'monto-asc', label: 'Monto: menor a mayor' },
  { value: 'antiguedad', label: 'Antigüedad de ejecución' },
];

// Comparación sin mayúsculas ni tildes para el buscador
export const normalizar = (texto) =>
  String(texto ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Turnos realizados de un mes (YYYY-MM). Se usa la fecha programada: el trigger
// trg_turno_realizado registra el trabajo con esa misma fecha de ejecución.
export const filtrarRealizadosDelMes = (turnos, mes) =>
  turnos.filter((t) => t.estado === 'REALIZADO' && (t.fechaAsignada || '').startsWith(mes));

// "#OT-2026-0841": año de ejecución + id del turno con 4 dígitos
export const codigoOrden = (turno) => {
  const anio = (turno.fechaAsignada || '').slice(0, 4);
  return `#OT-${anio}-${String(turno.idTurno).padStart(4, '0')}`;
};

// "2026-10-24" -> "24 Oct"
export const formatearDiaCorto = (iso) => {
  if (!iso) return 'Sin fecha';
  const [, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  return `${dia} ${MESES_CORTOS[mes - 1]}`;
};

// "2026-10" -> "Octubre 2026"
export const etiquetaMes = (mes) => {
  const [anio, numeroMes] = mes.split('-').map(Number);
  return `${MESES_LARGOS[numeroMes - 1]} ${anio}`;
};

// Días calendario entre dos fechas YYYY-MM-DD (en UTC para no depender de la zona)
export const diasEntre = (desdeIso, hastaIso) => {
  if (!desdeIso || !hastaIso) return 0;
  const aUtc = (iso) => {
    const [anio, mes, dia] = iso.slice(0, 10).split('-').map(Number);
    return Date.UTC(anio, mes - 1, dia);
  };
  return Math.round((aUtc(hastaIso) - aUtc(desdeIso)) / 86400000);
};

export const montoFinal = (turno) => Number(turno.presupuesto?.monto_total ?? 0);

// Pendiente con más de DIAS_ALERTA_COBRO días desde la ejecución
export const cobroAtrasado = (turno, hoyIso) =>
  !turno.cobrado && diasEntre(turno.fechaAsignada, hoyIso) > DIAS_ALERTA_COBRO;

const compararFecha = (a, b) =>
  (a.fechaAsignada || '').localeCompare(b.fechaAsignada || '') || compararHorarioTurnos(a, b);

export const ordenarLiquidaciones = (lista, orden) => {
  const copia = [...lista];
  if (orden === 'monto-desc') return copia.sort((a, b) => montoFinal(b) - montoFinal(a));
  if (orden === 'monto-asc') return copia.sort((a, b) => montoFinal(a) - montoFinal(b));
  if (orden === 'antiguedad') return copia.sort(compararFecha);
  return copia.sort((a, b) => compararFecha(b, a));
};