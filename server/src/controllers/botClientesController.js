import { supabaseAdmin } from '../config/supabase.js';
import { normalizarTelefono, ERROR_TELEFONO_INVALIDO } from '../utils/telefono.js';

// GET /api/bot/clientes/:telefono
//
// Primer paso del flujo de n8n: bifurcar la conversación según si el número ya
// es cliente o no. Existe como endpoint (en vez de que n8n consulte Postgres
// directo) para que las credenciales de Supabase no vivan dentro de n8n y para
// que la normalización del teléfono tenga un solo lugar.
export const getClienteByTelefono = async (req, res) => {
  const telefono = normalizarTelefono(req.params.telefono);

  if (!telefono) {
    return res.status(400).json({ ok: false, error: ERROR_TELEFONO_INVALIDO });
  }

  try {
    // maybeSingle y no single: single devuelve error PGRST116 cuando no hay
    // filas, pero acá "no existe" es la rama esperada del flujo (cliente
    // nuevo), no un error.
    const { data, error } = await supabaseAdmin
      .from('clientes')
      .select('*')
      .eq('telefono', telefono)
      .maybeSingle();

    if (error) {
      console.error('Error al buscar cliente por teléfono:', error);
      return res.status(500).json({
        ok: false,
        error: 'No se pudo consultar el cliente. Intentá de nuevo más tarde.',
      });
    }

    if (!data) {
      return res.status(404).json({
        ok: false,
        error: `No existe un cliente con el teléfono ${telefono}.`,
      });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error('Error inesperado al buscar cliente por teléfono:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al consultar el cliente.',
    });
  }
};
