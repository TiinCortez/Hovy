import { supabaseAdmin } from '../config/supabase.js';
import { normalizarTelefono, ERROR_TELEFONO_INVALIDO } from '../utils/telefono.js';
import { normalizarEmail } from '../utils/email.js';
import { crearYEnviarCodigo, validarCodigo } from '../services/codigosVerificacionService.js';
import { plantillaRecuperacionTelefono } from '../services/emailTemplates.js';
import { responderErrorCliente } from './clientesController.js';
import { CAMPOS_PUBLICOS, respondioErrorConocido } from './authController.js';

// Recuperación de cuenta por WhatsApp para clientes y staff: el que escribe
// cambió de celular y ya no es ubicable por su teléfono actual, así que se
// identifica con su email o su teléfono anterior. Las dos tablas comparten el
// mecanismo; lo único que cambia es sobre qué tabla/columna se opera.
const CUENTAS = {
  cliente: {
    tabla: 'clientes',
    columnaId: 'id_cliente',
    entidadColumna: 'cliente_id',
    tipoCodigo: 'recuperacion_telefono_cliente',
    select: '*',
    responderError: responderErrorCliente,
  },
  usuario: {
    tabla: 'usuarios',
    columnaId: 'id',
    entidadColumna: 'usuario_id',
    tipoCodigo: 'recuperacion_telefono_usuario',
    // usuarios guarda password_hash: nunca se selecciona entero.
    select: CAMPOS_PUBLICOS,
    responderError: respondioErrorConocido,
  },
};

class CuentaAmbiguaError extends Error {}

// Busca el identificador en clientes y usuarios; decide solo si es email o
// teléfono. Por teléfono no puede haber dos resultados (el trigger de
// exclusión lo impide); por email sí, porque el UNIQUE es por tabla. En ese
// caso no adivinamos cuál quiere recuperar.
const resolverCuentaRecuperable = async (identificador) => {
  // Con '@' es email sí o sí: normalizarTelefono descarta lo que no es dígito,
  // así que "3514330429@gmail.com" pasaría por un teléfono válido.
  const telefono = String(identificador).includes('@') ? null : normalizarTelefono(identificador);
  const [columna, valor] = telefono ? ['telefono', telefono] : ['email', normalizarEmail(identificador)];

  const [cliente, usuario] = await Promise.all(
    Object.values(CUENTAS).map((cuenta) =>
      supabaseAdmin.from(cuenta.tabla).select(cuenta.select).eq(columna, valor).maybeSingle()
    )
  );

  const error = cliente.error || usuario.error;
  if (error) throw new Error(error.message);

  if (cliente.data && usuario.data) throw new CuentaAmbiguaError();
  if (cliente.data) return { tipoCuenta: 'cliente', cuenta: cliente.data };
  if (usuario.data) return { tipoCuenta: 'usuario', cuenta: usuario.data };
  return null;
};

const responderAmbigua = (res) => res.status(409).json({
  ok: false,
  error: 'Ese email está en dos cuentas distintas. Escribí tu teléfono anterior para identificarte.',
});

// POST /api/bot/recuperar
//
// Responde 404 explícito (no una respuesta genérica siempre-200 como en
// olvide-password de usuarios) porque esto es una conversación privada 1 a 1
// por WhatsApp: n8n necesita saber si no encontró nada para poder ofrecer
// crear una cuenta nueva.
export const recuperarCuenta = async (req, res) => {
  const { identificador } = req.body ?? {};

  if (!identificador) {
    return res.status(400).json({ ok: false, error: 'identificador es obligatorio' });
  }

  try {
    const encontrada = await resolverCuentaRecuperable(identificador);

    if (!encontrada) {
      return res.status(404).json({ ok: false, error: 'No encontramos ninguna cuenta con ese dato.' });
    }

    const { tipoCuenta, cuenta } = encontrada;
    const config = CUENTAS[tipoCuenta];

    if (!cuenta.email) {
      return res.status(409).json({
        ok: false,
        error: 'Esta cuenta no tiene un email cargado, así que no se puede recuperar por este medio.',
      });
    }

    await crearYEnviarCodigo({
      entidadColumna: config.entidadColumna,
      entidadId: cuenta[config.columnaId],
      tipo: config.tipoCodigo,
      email: cuenta.email,
      plantilla: plantillaRecuperacionTelefono,
    });

    return res.status(200).json({ ok: true, tipoCuenta, mensaje: 'Te enviamos un código a tu email.' });
  } catch (err) {
    if (err instanceof CuentaAmbiguaError) return responderAmbigua(res);
    console.error('Error al iniciar recuperación de cuenta:', err);
    return res.status(500).json({ ok: false, error: 'Ocurrió un error inesperado al procesar la solicitud.' });
  }
};

// POST /api/bot/confirmar-recuperacion
export const confirmarRecuperacionCuenta = async (req, res) => {
  const { identificador, codigo, telefonoNuevo } = req.body ?? {};

  if (!identificador || !codigo || !telefonoNuevo) {
    return res.status(400).json({
      ok: false,
      error: 'identificador, codigo y telefonoNuevo son obligatorios',
    });
  }

  const telefonoNormalizado = normalizarTelefono(telefonoNuevo);
  if (!telefonoNormalizado) {
    return res.status(400).json({ ok: false, error: ERROR_TELEFONO_INVALIDO });
  }

  try {
    const encontrada = await resolverCuentaRecuperable(identificador);

    if (!encontrada) {
      return res.status(404).json({ ok: false, error: 'No encontramos ninguna cuenta con ese dato.' });
    }

    const { tipoCuenta, cuenta } = encontrada;
    const config = CUENTAS[tipoCuenta];

    const resultado = await validarCodigo({
      tipo: config.tipoCodigo,
      filtro: { [config.entidadColumna]: cuenta[config.columnaId] },
      codigoIngresado: codigo,
    });

    if (!resultado.ok) {
      return res.status(400).json({ ok: false, error: resultado.error });
    }

    // De paso confirma el email: para llegar hasta acá tuvo que recibir el
    // código en esa casilla y reenviarlo, así que quedó probado que es suya.
    const { data, error } = await supabaseAdmin
      .from(config.tabla)
      .update({ telefono: telefonoNormalizado, email_verificado: true })
      .eq(config.columnaId, cuenta[config.columnaId])
      .select(config.select)
      .single();

    if (error) {
      if (config.responderError(error, res)) return;
      console.error('Error al confirmar recuperación de cuenta:', error);
      return res.status(500).json({ ok: false, error: 'No se pudo actualizar el teléfono.' });
    }

    return res.status(200).json({
      ok: true,
      tipoCuenta,
      mensaje: 'Listo, tu cuenta ya está asociada a este número.',
      data,
    });
  } catch (err) {
    if (err instanceof CuentaAmbiguaError) return responderAmbigua(res);
    console.error('Error inesperado al confirmar recuperación de cuenta:', err);
    return res.status(500).json({ ok: false, error: 'Ocurrió un error inesperado al confirmar la recuperación.' });
  }
};
