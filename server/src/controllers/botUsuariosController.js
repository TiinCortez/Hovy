// GET /api/bot/usuarios/:telefono
//
// Primer paso del flujo de n8n, antes del de clientes: saber si el número que
// escribe es de alguien del equipo. Si lo es, la conversación va a un flujo
// interno; si devuelve 404, n8n sigue al endpoint de clientes y de ahí al alta.
// Esas tres ramas son excluyentes porque un teléfono no puede estar en las dos
// tablas (lo garantizan los triggers de docs/supabase-usuarios-telefono.sql).
//
// La búsqueda la hace resolverUsuarioPorTelefono, el middleware que la ruta
// monta antes de este handler: es el mismo paso que van a necesitar las
// operaciones de staff cuando se definan, así que vive ahí y no acá. El 400 por
// teléfono inválido y el 404 del número que no es del equipo —la rama donde n8n
// sigue de largo— los devuelve ese middleware.
//
// req.usuario ya viene sin password_hash: el middleware selecciona una lista
// explícita de columnas (CAMPOS_PUBLICOS_USUARIO) justamente para que devolver
// la fila entera desde acá sea seguro.
export const getUsuarioByTelefono = (req, res) => {
  return res.status(200).json({ ok: true, data: req.usuario });
};
