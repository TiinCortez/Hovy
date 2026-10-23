import { normalizarCoordenadas } from './coordenadas.js';

// Helpers puros de los turnos que maneja el jefe por WhatsApp.

// Link de Google Maps con la ruta ya armada hasta el inmueble. No se manda
// origen: Maps parte de la ubicación actual de quien abre el link.
// Prioridad: coordenadas válidas > dirección y barrio > null.
export const armarLinkMaps = (inmueble) => {
  if (!inmueble) return null;

  const coords = normalizarCoordenadas(inmueble.latitud, inmueble.longitud);
  const direccion = [inmueble.direccion, inmueble.barrio]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
    .join(', ');

  const destino = coords ? `${coords.latitud},${coords.longitud}` : direccion;
  if (!destino) return null;

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}&travelmode=driving`;
};

// Máquina de estados mínima: iniciar y finalizar. Cancelar y reprogramar
// quedan fuera a propósito (el agente del jefe es de consulta + estas dos acciones).
const TRANSICIONES = {
  iniciar: { desde: ['Coordinado', 'Confirmado'], hacia: 'En ejecución' },
  finalizar: { desde: ['En ejecución'], hacia: 'Realizado' },
};

export const resolverTransicionTurno = (estadoActual, accion) => {
  const regla = TRANSICIONES[accion];
  if (!regla) return { ok: false, error: 'Acción de turno no soportada.' };

  if (!regla.desde.includes(estadoActual)) {
    return {
      ok: false,
      error: `No se puede ${accion} un turno que está en estado "${estadoActual}". Estados válidos: ${regla.desde.join(' o ')}.`,
    };
  }

  return { ok: true, estadoNuevo: regla.hacia };
};

// Estados válidos de un turno, tal como los guarda la base.
const ESTADOS_TURNO = ['Coordinado', 'Confirmado', 'En ejecución', 'Realizado', 'Cancelado'];
const sinTildes = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// "Coordinado, en ejecucion" -> ['Coordinado', 'En ejecución']. Vacío = sin filtro.
export const parsearEstadosTurno = (crudo) => {
  if (crudo === undefined || crudo === null) return { ok: true, estados: [] };

  const pedidos = String(crudo).split(',').map((s) => s.trim()).filter(Boolean);
  const estados = [];
  for (const pedido of pedidos) {
    const valido = ESTADOS_TURNO.find((e) => sinTildes(e) === sinTildes(pedido));
    if (!valido) return { ok: false, error: `Estado desconocido: "${pedido}". Válidos: ${ESTADOS_TURNO.join(', ')}.` };
    if (!estados.includes(valido)) estados.push(valido);
  }
  return { ok: true, estados };
};
