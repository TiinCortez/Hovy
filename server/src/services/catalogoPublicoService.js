import { supabaseAdmin } from '../config/supabase.js';
import { falla } from '../utils/solicitudesVisita.js';

// Public service catalog for the WhatsApp bot: the service TYPES the business
// currently offers, so a client requesting a visit can pick one.
//
// Prices must NEVER leave through here (docs/ARQUITECTURA.md:27): usuario_servicio
// is only read to know WHICH services are active, and the select does not ask
// for precio_base or limite_operativo at all. Returns { data } or { error }.
export const listarServiciosActivos = async () => {
  const { data, error } = await supabaseAdmin
    .from('usuario_servicio')
    .select('servicio:servicios_catalogo(id_servicio, nombre, descripcion)')
    .eq('activo', true);

  if (error) {
    console.error('Error al consultar los servicios activos:', error);
    return falla(500, 'No se pudieron consultar los servicios. Intentá de nuevo más tarde.');
  }

  // Several admins may offer the same type: de-duplicate by id_servicio.
  const porId = new Map();
  for (const fila of data ?? []) {
    const servicio = fila.servicio;
    if (!servicio || porId.has(servicio.id_servicio)) continue;
    porId.set(servicio.id_servicio, {
      id_servicio: servicio.id_servicio,
      nombre: servicio.nombre,
      descripcion: servicio.descripcion ?? null,
    });
  }

  const servicios = [...porId.values()].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));

  return { data: servicios };
};
