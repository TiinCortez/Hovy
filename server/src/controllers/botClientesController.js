// GET /api/bot/clientes/:telefono
//
// Primer paso del flujo de n8n: bifurcar la conversación según si el número ya
// es cliente o no. Existe como endpoint (en vez de que n8n consulte Postgres
// directo) para que las credenciales de Supabase no vivan dentro de n8n y para
// que la normalización del teléfono tenga un solo lugar.
//
// La búsqueda en sí la hace resolverClientePorTelefono, el middleware que la
// ruta monta antes de este handler: es el mismo paso que necesitan los
// inmuebles (y los turnos, cuando existan), así que vive ahí y no acá. El 400
// por teléfono inválido y el 404 del número que todavía no es cliente —la rama
// donde n8n arranca el alta— los devuelve ese middleware.
export const getClienteByTelefono = (req, res) => {
  return res.status(200).json({ ok: true, data: req.cliente });
};
