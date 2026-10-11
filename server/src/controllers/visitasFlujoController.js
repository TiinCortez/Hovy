// Web (admin panel) entry points of the visit workflow. The business logic is
// shared with the WhatsApp bot: the route handlers are the SAME ones the staff
// bot routes use (confirmarSolicitudVisita, cargarServiciosVisitaStaff,
// obtenerEstimadoVisitaStaff, cargarPresupuestoStaff, cancelarSolicitudVisita,
// consultarDisponibilidadStaff, crearTurnoDesdeSolicitud), which are thin
// wrappers over visitaFlujoService.js / presupuestoService.js. The only
// channel-specific piece is who the acting admin is, solved here.

// The bot handlers read the acting admin from req.usuario (resolved by
// resolverStaffPorTelefono from the WhatsApp number). On the web the admin
// comes from the JWT: authMiddleware leaves the payload in req.user, whose
// `sub` claim is the usuarios.id (see authController.js). This adapter exposes
// it as req.usuario so the same handlers work unchanged. Role admin is already
// enforced by requireRole(['admin']) where /api/visitas is mounted (app.js).
export const usarAdminDelJwt = (req, res, next) => {
  const id = Number(req.user?.sub);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(401).json({ ok: false, error: 'Token inválido o expirado' });
  }

  req.usuario = { id, rol: req.user.rol };
  return next();
};
