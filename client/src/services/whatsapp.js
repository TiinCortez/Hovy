// Normalizador puro existente, sin dependencias de servicios del servidor.
import { normalizarTelefono } from '../../../server/src/utils/telefono.js';

export function obtenerEnlaceWhatsApp(telefono) {
  const normalizado = normalizarTelefono(telefono);
  return normalizado ? `https://wa.me/${normalizado}` : null;
}
