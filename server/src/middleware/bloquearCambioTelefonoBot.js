// PUT /api/bot/clientes/:telefono ya no puede cambiar el teléfono sin
// verificación: eso es exactamente lo que abre /clientes/recuperar +
// /clientes/confirmar-recuperacion. Este middleware solo corta ese campo
// puntual del body antes de llegar a updateCliente (que sí lo permite en el
// canal admin/web, donde lo hace el staff con su propio criterio).
export const bloquearCambioTelefonoBot = (req, res, next) => {
  if (req.body?.telefono !== undefined) {
    return res.status(400).json({
      ok: false,
      error: 'El teléfono no se cambia por acá. Usá /clientes/recuperar y /clientes/confirmar-recuperacion.',
    });
  }
  return next();
};
