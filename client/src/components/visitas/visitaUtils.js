// Shared helpers of the visit detail workflow components.

// Allowed values come from the backend (inmuebles.js, clientesController.js, turnosController.js)
export const TIPOS_INMUEBLE = ['Lote Vacio', 'Casa Habitada'];
export const TIPOS_CLIENTE = ['Fijo', 'Casual', 'Empresa'];
export const PRIORIDADES = [
  { value: 'P1_Reasignado', label: 'P1 - Reasignado' },
  { value: 'P2_Fijo', label: 'P2 - Cliente fijo' },
  { value: 'P3_Casual', label: 'P3 - Cliente casual' },
];

export const formatMoney = (value) => `$${Number(value || 0).toLocaleString('es-AR')}`;

export const formatFecha = (valor) => {
  if (!valor) return null;
  return new Date(valor).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' });
};

// "YYYY-MM-DD" -> readable date without timezone shifts
export const formatDia = (iso) => {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { dateStyle: 'long' });
};

export const hhmm = (hora) => (hora ? String(hora).slice(0, 5) : '');

export const getApiError = (err, fallback) => err.response?.data?.error || fallback;

// Backend "Realizada" means "turno agendado": it is shown as Confirmada
export const getEstadoLabel = (estado) => (estado === 'Realizada' ? 'Confirmada' : estado);

export const BADGE_CLASS = {
  Pendiente: 'bg-warning-subtle text-warning border border-warning-subtle',
  Contactada: 'bg-info-subtle text-info border border-info-subtle',
  Confirmada: 'bg-success-subtle text-success border border-success-subtle',
  Cancelada: 'bg-danger-subtle text-danger border border-danger-subtle',
};

export const INTERNAL_NOTICE = 'Estimado interno - no se comunica al cliente';
