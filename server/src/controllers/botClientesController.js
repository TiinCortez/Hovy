import { supabaseAdmin } from '../config/supabase.js';
import { normalizarTelefono, ERROR_TELEFONO_INVALIDO } from '../utils/telefono.js';
import { crearYEnviarCodigo, validarCodigo } from '../services/codigosVerificacionService.js';
import { plantillaVerificacionEmailCliente, plantillaRecuperacionTelefono } from '../services/emailTemplates.js';
import { TIPOS_CLIENTE_VALIDOS, responderErrorCliente } from './clientesController.js';

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

// POST /api/bot/clientes (alta por WhatsApp)
//
// A diferencia de createCliente (canal admin), acá `email` es obligatorio: sin
// email no hay a dónde mandar el código, y el punto de este endpoint es que el
// cliente quede con `email_verificado` en verdadero antes de poder recuperarse
// más adelante si cambia de celular.
export const crearClienteBot = async (req, res) => {
  const {
    nombre,
    apellido,
    telefono,
    tipo_cliente,
    email,
    domicilio_fiscal,
    cuit_cuil,
    razon_social,
  } = req.body ?? {};

  const camposFaltantes = [];
  if (!nombre) camposFaltantes.push('nombre');
  if (!apellido) camposFaltantes.push('apellido');
  if (!telefono) camposFaltantes.push('telefono');
  if (!tipo_cliente) camposFaltantes.push('tipo_cliente');
  if (!email) camposFaltantes.push('email');

  if (camposFaltantes.length > 0) {
    return res.status(400).json({
      ok: false,
      error: `Faltan campos obligatorios: ${camposFaltantes.join(', ')}`,
    });
  }

  if (!TIPOS_CLIENTE_VALIDOS.includes(tipo_cliente)) {
    return res.status(400).json({
      ok: false,
      error: `tipo_cliente inválido: "${tipo_cliente}". Valores permitidos: ${TIPOS_CLIENTE_VALIDOS.join(', ')}`,
    });
  }

  const telefonoNormalizado = normalizarTelefono(telefono);
  if (!telefonoNormalizado) {
    return res.status(400).json({ ok: false, error: ERROR_TELEFONO_INVALIDO });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('clientes')
      .insert({
        nombre,
        apellido,
        telefono: telefonoNormalizado,
        tipo_cliente,
        email,
        domicilio_fiscal: domicilio_fiscal ?? null,
        cuit_cuil: cuit_cuil ?? null,
        razon_social: razon_social ?? null,
        calificacion_promedio: 0,
      })
      .select()
      .single();

    if (error) {
      if (responderErrorCliente(error, res)) return;
      console.error('Error al crear cliente por bot:', error);
      return res.status(500).json({
        ok: false,
        error: 'No se pudo registrar el cliente. Intentá de nuevo más tarde.',
      });
    }

    await crearYEnviarCodigo({
      entidadColumna: 'cliente_id',
      entidadId: data.id_cliente,
      tipo: 'verificacion_email_cliente',
      email: data.email,
      plantilla: plantillaVerificacionEmailCliente,
    });

    return res.status(201).json({
      ok: true,
      mensaje: 'Cuenta creada. Revisá tu email para verificar la cuenta.',
      data,
    });
  } catch (err) {
    console.error('Error inesperado al crear cliente por bot:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al registrar el cliente.',
    });
  }
};

// POST /api/bot/clientes/:telefono/verificar-email
export const verificarEmailCliente = async (req, res) => {
  const { codigo } = req.body ?? {};
  const cliente = req.cliente;

  if (!codigo) {
    return res.status(400).json({ ok: false, error: 'codigo es obligatorio' });
  }

  if (cliente.email_verificado) {
    return res.status(200).json({ ok: true, mensaje: 'El email ya estaba verificado' });
  }

  try {
    const resultado = await validarCodigo({
      entidadColumna: 'cliente_id',
      entidadId: cliente.id_cliente,
      tipo: 'verificacion_email_cliente',
      codigoIngresado: codigo,
    });

    if (!resultado.ok) {
      return res.status(400).json({ ok: false, error: resultado.error });
    }

    const { data, error } = await supabaseAdmin
      .from('clientes')
      .update({ email_verificado: true })
      .eq('id_cliente', cliente.id_cliente)
      .select()
      .single();

    if (error) {
      console.error('Error al marcar email de cliente como verificado:', error);
      return res.status(500).json({ ok: false, error: 'No se pudo verificar el email.' });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error('Error inesperado al verificar email de cliente:', err);
    return res.status(500).json({ ok: false, error: 'Ocurrió un error inesperado al verificar el email.' });
  }
};

// Encuentra al cliente que está pidiendo recuperar su cuenta a partir de un
// identificador que puede ser su email o su teléfono anterior: se prueba
// primero como teléfono (normalizarTelefono es estricto, así que un email
// simplemente no matchea el formato y devuelve null) y si no, como email.
// La comparten recuperarCliente y confirmarRecuperacionCliente para no
// duplicar esta resolución.
const resolverClienteRecuperable = async (identificador) => {
  const telefono = normalizarTelefono(identificador);

  const { data, error } = telefono
    ? await supabaseAdmin.from('clientes').select('*').eq('telefono', telefono).maybeSingle()
    : await supabaseAdmin.from('clientes').select('*').eq('email', identificador).maybeSingle();

  if (error) throw new Error(error.message);

  return data;
};

// POST /api/bot/clientes/recuperar
//
// Responde 404 explícito (no una respuesta genérica siempre-200 como en
// olvide-password de usuarios) porque esto es una conversación privada 1 a 1
// por WhatsApp: n8n necesita saber si no encontró nada para poder ofrecerle al
// cliente la opción de crear una cuenta nueva.
export const recuperarCliente = async (req, res) => {
  const { identificador } = req.body ?? {};

  if (!identificador) {
    return res.status(400).json({ ok: false, error: 'identificador es obligatorio' });
  }

  try {
    const cliente = await resolverClienteRecuperable(identificador);

    if (!cliente) {
      return res.status(404).json({ ok: false, error: 'No encontramos ninguna cuenta con ese dato.' });
    }

    if (!cliente.email) {
      return res.status(409).json({
        ok: false,
        error: 'Esta cuenta no tiene un email cargado, así que no se puede recuperar por este medio.',
      });
    }

    await crearYEnviarCodigo({
      entidadColumna: 'cliente_id',
      entidadId: cliente.id_cliente,
      tipo: 'recuperacion_telefono_cliente',
      email: cliente.email,
      plantilla: plantillaRecuperacionTelefono,
    });

    return res.status(200).json({ ok: true, mensaje: 'Te enviamos un código a tu email.' });
  } catch (err) {
    console.error('Error al iniciar recuperación de cliente:', err);
    return res.status(500).json({ ok: false, error: 'Ocurrió un error inesperado al procesar la solicitud.' });
  }
};

// POST /api/bot/clientes/confirmar-recuperacion
export const confirmarRecuperacionCliente = async (req, res) => {
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
    const cliente = await resolverClienteRecuperable(identificador);

    if (!cliente) {
      return res.status(404).json({ ok: false, error: 'No encontramos ninguna cuenta con ese dato.' });
    }

    const resultado = await validarCodigo({
      entidadColumna: 'cliente_id',
      entidadId: cliente.id_cliente,
      tipo: 'recuperacion_telefono_cliente',
      codigoIngresado: codigo,
    });

    if (!resultado.ok) {
      return res.status(400).json({ ok: false, error: resultado.error });
    }

    // De paso confirma el email: para llegar hasta acá tuvo que recibir el
    // código en esa casilla y reenviarlo, así que quedó probado que es suya.
    const { data, error } = await supabaseAdmin
      .from('clientes')
      .update({ telefono: telefonoNormalizado, email_verificado: true })
      .eq('id_cliente', cliente.id_cliente)
      .select()
      .single();

    if (error) {
      if (responderErrorCliente(error, res)) return;
      console.error('Error al confirmar recuperación de cliente:', error);
      return res.status(500).json({ ok: false, error: 'No se pudo actualizar el teléfono.' });
    }

    return res.status(200).json({ ok: true, mensaje: 'Listo, tu cuenta ya está asociada a este número.', data });
  } catch (err) {
    console.error('Error inesperado al confirmar recuperación de cliente:', err);
    return res.status(500).json({ ok: false, error: 'Ocurrió un error inesperado al confirmar la recuperación.' });
  }
};
