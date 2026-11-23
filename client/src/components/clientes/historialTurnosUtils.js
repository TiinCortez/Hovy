// Utilidades puras del historial de turnos por cliente (independiente de la Agenda).

export const ESTADOS_HISTORIAL = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'REALIZADO', label: 'Realizados' },
  { key: 'CONFIRMADO', label: 'Confirmados' },
  { key: 'COORDINADO', label: 'Coordinados' },
  { key: 'EN_EJECUCION', label: 'En ejecución' },
  { key: 'CANCELADO', label: 'Cancelados' },
];

export const ESTADO_META = {
  REALIZADO: { label: 'Realizado', mod: 'realizado' },
  CONFIRMADO: { label: 'Confirmado', mod: 'confirmado' },
  COORDINADO: { label: 'Coordinado', mod: 'coordinado' },
  EN_EJECUCION: { label: 'En ejecución', mod: 'en-ejecucion' },
  CANCELADO: { label: 'Cancelado', mod: 'cancelado' },
};

export const PRIORIDAD_META = {
  P1_REASIGNADO: { label: 'P1 · Reasignado', mod: 'p1' },
  P2_FIJO: { label: 'P2 · Fijo', mod: 'p2' },
  P3_CASUAL: { label: 'P3 · Casual', mod: 'p3' },
};

const parsearFechaIso = (iso) => {
  if (!iso || typeof iso !== 'string') return null;
  const partes = iso.slice(0, 10).split('-').map(Number);
  if (partes.length !== 3 || partes.some(Number.isNaN)) return null;
  const [anio, mes, dia] = partes;
  return new Date(anio, mes - 1, dia);
};

const capitalizar = (texto) => (texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : '');

export function formatearFechaCorta(iso) {
  const fecha = parsearFechaIso(iso);
  if (!fecha) return 'Sin fecha';
  const texto = fecha.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return capitalizar(texto.replace(',', ''));
}

export function formatearFechaLarga(iso) {
  const fecha = parsearFechaIso(iso);
  if (!fecha) return 'Sin fecha';
  return capitalizar(fecha.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }));
}

export function formatearFechaPago(iso) {
  if (!iso) return 'Sin fecha';
  const soloFecha = String(iso).slice(0, 10);
  const fecha = parsearFechaIso(soloFecha);
  if (!fecha) return String(iso);
  return fecha.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const horaCorta = (hora) => {
  if (typeof hora !== 'string') return '';
  const limpia = hora.trim();
  return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(limpia) ? limpia.slice(0, 5) : limpia;
};

export function formatearFranja(inicio, fin) {
  const desde = horaCorta(inicio);
  const hasta = horaCorta(fin);
  if (desde && hasta) return `${desde} - ${hasta} hs`;
  if (desde) return `${desde} hs`;
  return 'Sin horario';
}

export function formatearMonto(monto) {
  const num = Number(monto);
  if (!Number.isFinite(num)) return '$0';
  return num.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function obtenerResumenCobro(turno) {
  if (!turno || turno.estado !== 'REALIZADO') return null;

  const totalPagado = Number(turno.cobro?.total_pagado ?? 0);
  const totalPresupuesto = turno.presupuesto?.monto_total !== undefined && turno.presupuesto?.monto_total !== null
    ? Number(turno.presupuesto.monto_total)
    : null;
  const pendiente = !turno.cobrado && totalPresupuesto !== null && totalPresupuesto > 0
    ? Math.max(0, Math.round((totalPresupuesto - totalPagado) * 100) / 100)
    : 0;

  if (turno.cobrado === true) {
    return { tipo: 'cobrado', label: 'Cobrado', totalPagado, pendiente: 0 };
  }
  if (totalPagado > 0) {
    return { tipo: 'parcial', label: 'Pago parcial', totalPagado, pendiente };
  }
  return { tipo: 'pendiente', label: 'Pendiente de cobro', totalPagado: 0, pendiente };
}
