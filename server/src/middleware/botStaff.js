import { resolverUsuarioPorTelefono } from './botUsuario.js';

// Compuerta de las operaciones de staff por WhatsApp (agendar turnos después
// de una visita). resolverUsuarioPorTelefono ya identifica si el número es de
// alguien del equipo (req.usuario); acá se suma que además tenga rol admin.
//
// Por qué no alcanza con estar en `usuarios`: esa tabla también tiene rol
// 'user' y 'viewer' (docs/supabase-auth.sql), pensados para gente del equipo
// sin permiso de gestión. Crear un cliente, un inmueble o un turno es una
// escritura de negocio, el mismo criterio que ya usa el panel web
// (requireRole(['admin']) en /api/turnos e /api/inmuebles) — acá se aplica el
// mismo corte, solo que la identidad sale del teléfono y no de un JWT.
export const resolverStaffPorTelefono = [
  resolverUsuarioPorTelefono,
  (req, res, next) => {
    if (req.usuario.rol !== 'admin') {
      return res.status(403).json({
        ok: false,
        error: 'Este número no tiene permisos para operar turnos.',
      });
    }
    return next();
  },
];
