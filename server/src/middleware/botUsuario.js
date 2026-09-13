import { supabaseAdmin } from '../config/supabase.js';
import { normalizarTelefono, ERROR_TELEFONO_INVALIDO } from '../utils/telefono.js';

// Columnas de `usuarios` que pueden salir por la API.
//
// Es una lista explícita y no un select('*') a propósito: la tabla guarda
// password_hash, y el handler devuelve la fila entera tal como vino. Un '*' acá
// mandaría el hash de la contraseña del admin dentro del JSON que n8n recibe y
// loguea. La lista es corta y el costo de mantenerla es enterarse cuando la
// tabla crece, que es exactamente el momento en que uno quiere decidir si el
// campo nuevo es público o no.
export const CAMPOS_PUBLICOS_USUARIO = 'id, usuario, rol, email, telefono, created_at';

// Resuelve si el número que escribe por WhatsApp es de un usuario del sistema.
//
// Es el gemelo de resolverClientePorTelefono para la otra tabla: misma idea de
// que la identidad sale del número del que vino el mensaje (un dato que el
// emisor no elige) y no de algo que el caller afirme en el body.
//
// Deja el resultado en req.usuario y no en req.user porque req.user ya lo ocupa
// authMiddleware con el payload de un JWT. Son dos cosas distintas: una es una
// sesión web autenticada, la otra es "el mensaje vino de este número". Pisar el
// nombre haría que un handler futuro confundiera una con la otra.
//
// Va como middleware y no dentro del controller para que las operaciones de la
// rama de staff —cuando existan— lo reusen y la normalización del teléfono siga
// teniendo un solo lugar.
export const resolverUsuarioPorTelefono = async (req, res, next) => {
  const telefono = normalizarTelefono(req.params.telefono);

  if (!telefono) {
    return res.status(400).json({ ok: false, error: ERROR_TELEFONO_INVALIDO });
  }

  try {
    // maybeSingle y no single: acá "no existe" es la respuesta esperada más
    // frecuente (todo cliente que escribe no es usuario), no un error.
    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select(CAMPOS_PUBLICOS_USUARIO)
      .eq('telefono', telefono)
      .maybeSingle();

    if (error) {
      console.error('Error al buscar usuario por teléfono:', error);
      return res.status(500).json({
        ok: false,
        error: 'No se pudo consultar el usuario. Intentá de nuevo más tarde.',
      });
    }

    if (!data) {
      return res.status(404).json({
        ok: false,
        error: `No existe un usuario con el teléfono ${telefono}.`,
      });
    }

    req.usuario = data;
    return next();
  } catch (err) {
    console.error('Error inesperado al buscar usuario por teléfono:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al consultar el usuario.',
    });
  }
};
