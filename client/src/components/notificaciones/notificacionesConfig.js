import { AlertTriangle, ClipboardList } from 'lucide-react';

// Evento para que la campana del Header se refresque cuando otra pantalla
// cancela o restaura una notificación (sin esperar al polling).
export const EVENTO_NOTIFICACIONES_ACTUALIZADAS = 'hovy:notificaciones-actualizadas';
export const avisarNotificacionesActualizadas = () =>
  window.dispatchEvent(new Event(EVENTO_NOTIFICACIONES_ACTUALIZADAS));

export const TIPOS_NOTIFICACION = {
  ciclo_corte: {
    etiqueta: 'Ciclo de corte',
    Icono: AlertTriangle,
    color: '#dc3545',
    fondo: 'rgba(220, 53, 69, 0.1)',
    textoBoton: 'Ver cliente',
  },
  nueva_solicitud: {
    etiqueta: 'Nueva solicitud',
    Icono: ClipboardList,
    color: '#0ea5e9',
    fondo: 'rgba(14, 165, 233, 0.1)',
    textoBoton: 'Ver solicitud',
  },
  turno_sin_confirmar: {
    etiqueta: 'Turno sin confirmar',
    Icono: AlertTriangle,
    color: '#f59e0b',
    fondo: 'rgba(245, 158, 11, 0.12)',
    textoBoton: 'Ver turno',
  },
};

export const obtenerTipo = (tipo) => TIPOS_NOTIFICACION[tipo] ?? TIPOS_NOTIFICACION.ciclo_corte;

// Adónde lleva cada notificación: { to, state } para navigate().
export const destinoNotificacion = (notificacion) => {
  switch (notificacion.tipo) {
    case 'ciclo_corte':
      return notificacion.id_cliente ? { to: `/clients/${notificacion.id_cliente}/inmuebles` } : null;
    case 'nueva_solicitud':
      return { to: `/visitas/${notificacion.id_referencia}` };
    case 'turno_sin_confirmar':
      return { to: '/calendar', state: { abrirTurnoId: notificacion.id_referencia } };
    default:
      return null;
  }
};

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const dosDigitos = (n) => String(n).padStart(2, '0');

// "Hace 5 min" / "Hace 3 horas" / "Ayer, 16:00" / "24 Oct, 09:15"
export const formatearTiempo = (fechaIso, ahora = new Date()) => {
  if (!fechaIso) return '';
  const fecha = new Date(fechaIso);
  const minutos = Math.floor((ahora - fecha) / 60000);
  const hora = `${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}`;

  const inicioHoy = new Date(ahora);
  inicioHoy.setHours(0, 0, 0, 0);
  const inicioAyer = new Date(inicioHoy);
  inicioAyer.setDate(inicioAyer.getDate() - 1);

  if (minutos < 1) return 'Recién';
  if (minutos < 60) return `Hace ${minutos} min`;
  if (fecha >= inicioHoy) {
    const horas = Math.floor(minutos / 60);
    return horas === 1 ? 'Hace 1 hora' : `Hace ${horas} horas`;
  }
  if (fecha >= inicioAyer) return `Ayer, ${hora}`;
  return `${fecha.getDate()} ${MESES[fecha.getMonth()]}, ${hora}`;
};

// "28 Ago 2026"
export const formatearFechaLarga = (fecha) =>
  `${fecha.getDate()} ${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
