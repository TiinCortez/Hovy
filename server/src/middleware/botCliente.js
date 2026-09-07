import { supabaseAdmin } from '../config/supabase.js';
import { normalizarTelefono, ERROR_TELEFONO_INVALIDO } from '../utils/telefono.js';

// Resuelve qué cliente es el que está escribiendo por WhatsApp.
//
// Es el equivalente del canal bot a lo que authMiddleware hace con req.user:
// establece la identidad antes de que el handler corra. La diferencia es de
// dónde sale esa identidad. En la web el cliente la afirma con un JWT firmado;
// acá sale del número del que vino el mensaje, que es un dato que el emisor no
// elige. Por eso ningún endpoint del bot puede aceptar un id_cliente en el
// body: sería dejar que el caller diga sobre quién opera.
//
// Va como middleware y no como una función más dentro de cada controller para
// que los recursos que vengan después (turnos, solicitudes) lo reusen y la
// normalización del teléfono siga teniendo un solo lugar.
export const resolverClientePorTelefono = async (req, res, next) => {
  const telefono = normalizarTelefono(req.params.telefono);

  if (!telefono) {
    return res.status(400).json({ ok: false, error: ERROR_TELEFONO_INVALIDO });
  }

  try {
    // maybeSingle y no single: single devuelve error PGRST116 cuando no hay
    // filas, pero acá "no existe" es una respuesta esperada (número que todavía
    // no es cliente), no un error.
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

    req.cliente = data;
    return next();
  } catch (err) {
    console.error('Error inesperado al buscar cliente por teléfono:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al consultar el cliente.',
    });
  }
};
