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

const FRANJA_INICIO_TARDE_MIN = 13 * 60;
const aMinutos = (hora) => Number(hhmm(hora).slice(0, 2)) * 60 + Number(hhmm(hora).slice(3, 5));

// What the client asked for in the request: preferred day, time slot (the bot writes it
// in nota_horario as "Horario elegido: 15:00 a 17:00") and franja (Mañana | Tarde).
export const horarioSolicitado = (visita) => {
  const fecha = /^\d{4}-\d{2}-\d{2}/.test(visita?.fecha_preferida ?? '') ? visita.fecha_preferida.slice(0, 10) : null;
  const coincidencia = /Horario elegido:\s*(\d{2}:\d{2})\s*a\s*(\d{2}:\d{2})/.exec(visita?.nota_horario ?? '');
  const franja = ['Mañana', 'Tarde'].includes(visita?.franja_preferida) ? visita.franja_preferida : null;
  return {
    fecha,
    desde: coincidencia?.[1] ?? null,
    hasta: coincidencia?.[2] ?? null,
    franja,
  };
};

// Slot to preselect among the free ones: the exact one the client tapped, else the first
// one inside their franja. null when none fits (the admin picks by hand).
export const slotSolicitado = (slots, solicitado) => {
  if (!Array.isArray(slots) || !solicitado) return null;
  if (solicitado.desde && solicitado.hasta) {
    const exacto = slots.find((s) => hhmm(s.inicio_desde) === solicitado.desde && hhmm(s.hasta) === solicitado.hasta);
    if (exacto) return exacto;
  }
  if (!solicitado.franja) return null;
  return slots.find((s) => (aMinutos(s.inicio_desde) < FRANJA_INICIO_TARDE_MIN) === (solicitado.franja === 'Mañana')) ?? null;
};

export const getApiError = (err, fallback) => err.response?.data?.error || fallback;

// Backend "Realizada" means "turno agendado": it is shown as Confirmada
export const getEstadoLabel = (estado) => (estado === 'Realizada' ? 'Confirmada' : estado);

// Tipo de Badge (components/ui/Badge.jsx) según el estado de la solicitud
export const BADGE_TIPO = {
  Pendiente: 'pendiente',
  Contactada: 'info',
  Confirmada: 'exito',
  Cancelada: 'neutro',
};

// A request nobody attended yet: any Pendiente one (new contact, or a client's first
// turno on a property) plus an existing client's request still waiting for its budget,
// which the bot creates already Confirmada. Same rule as the "nueva_solicitud"
// notification (docs/migrations/018_solicitud_cliente_existente.sql).
export const esSolicitudNueva = (visita) =>
  visita.estado === 'Pendiente'
  || (visita.tipo_solicitud === 'cliente' && visita.estado === 'Confirmada' && !visita.id_presupuesto);

export const INTERNAL_NOTICE ='Estimado interno - no se comunica al cliente';
