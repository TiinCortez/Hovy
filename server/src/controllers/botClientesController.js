import { supabaseAdmin } from '../config/supabase.js';
import { normalizarEmail } from '../utils/email.js';
import { crearYEnviarCodigo, validarCodigo } from '../services/codigosVerificacionService.js';
import { plantillaCambioEmail } from '../services/emailTemplates.js';
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

// Lo único que un cliente puede editar de sí mismo por WhatsApp. Lo que queda
// afuera o es de gestión interna (estado, calificacion_promedio) o es
// identidad y tiene su propio flujo con código (telefono, email).
const CAMPOS_EDITABLES_BOT = ['nombre', 'apellido', 'tipo_cliente', 'domicilio_fiscal', 'cuit_cuil', 'razon_social'];
const CAMPOS_OBLIGATORIOS_BOT = ['nombre', 'apellido', 'tipo_cliente'];
// El pin de ubicación: resolverDomicilioFiscal ya lo convirtió en
// domicilio_fiscal y deja las coordenadas en el body; no se guardan.
const CAMPOS_IGNORADOS_BOT = ['latitud', 'longitud'];

// PUT /api/bot/clientes/:telefono
//
// No reusa updateCliente del canal admin: ese acepta cualquier campo, y acá el
// que manda es el propio cliente. El cliente sale de resolverClientePorTelefono
// (el número que escribe), así que solo puede tocarse a sí mismo.
export const updateClienteBot = async (req, res) => {
  const body = Object.fromEntries(
    Object.entries(req.body ?? {}).filter(([campo]) => !CAMPOS_IGNORADOS_BOT.includes(campo))
  );
  const cliente = req.cliente;

  if (body.telefono !== undefined) {
    return res.status(400).json({
      ok: false,
      error: 'El teléfono no se cambia por acá. Usá /recuperar y /confirmar-recuperacion.',
    });
  }

  if (body.email !== undefined) {
    return res.status(400).json({
      ok: false,
      error: 'El email no se cambia por acá. Usá /clientes/:telefono/cambiar-email.',
    });
  }

  const noPermitidos = Object.keys(body).filter((campo) => !CAMPOS_EDITABLES_BOT.includes(campo));
  if (noPermitidos.length > 0) {
    return res.status(400).json({
      ok: false,
      error: `Estos campos no se pueden modificar por WhatsApp: ${noPermitidos.join(', ')}`,
    });
  }

  const vacios = CAMPOS_OBLIGATORIOS_BOT.filter((campo) => body[campo] !== undefined && !body[campo]);
  if (vacios.length > 0) {
    return res.status(400).json({
      ok: false,
      error: `Los siguientes campos no pueden quedar vacíos: ${vacios.join(', ')}`,
    });
  }

  if (body.tipo_cliente !== undefined && !TIPOS_CLIENTE_VALIDOS.includes(body.tipo_cliente)) {
    return res.status(400).json({
      ok: false,
      error: `tipo_cliente inválido: "${body.tipo_cliente}". Valores permitidos: ${TIPOS_CLIENTE_VALIDOS.join(', ')}`,
    });
  }

  if (Object.keys(body).length === 0) {
    return res.status(400).json({ ok: false, error: 'No se envió ningún campo para actualizar.' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('clientes')
      .update(body)
      .eq('id_cliente', cliente.id_cliente)
      .select()
      .single();

    if (error) {
      if (responderErrorCliente(error, res)) return;
      console.error('Error al actualizar cliente por bot:', error);
      return res.status(500).json({ ok: false, error: 'No se pudo actualizar el cliente.' });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error('Error inesperado al actualizar cliente por bot:', err);
    return res.status(500).json({ ok: false, error: 'Ocurrió un error inesperado al actualizar el cliente.' });
  }
};

// POST /api/bot/clientes/:telefono/cambiar-email
//
// El email no se pisa acá: se manda un código a la casilla nueva y el cambio
// se aplica en /confirmar-cambio-email. Sin eso, cualquiera con el celular
// podría redirigir la recuperación de la cuenta a una casilla que no probó.
export const solicitarCambioEmailCliente = async (req, res) => {
  const emailNuevo = normalizarEmail(req.body?.emailNuevo);
  const cliente = req.cliente;

  if (!emailNuevo) {
    return res.status(400).json({ ok: false, error: 'emailNuevo es obligatorio' });
  }

  if (emailNuevo === normalizarEmail(cliente.email)) {
    return res.status(400).json({ ok: false, error: 'Ese ya es tu email actual.' });
  }

  try {
    const { data: otroCliente, error } = await supabaseAdmin
      .from('clientes')
      .select('id_cliente')
      .eq('email', emailNuevo)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (otroCliente) {
      return res.status(409).json({ ok: false, error: 'Ya existe un cliente registrado con ese email.' });
    }

    await crearYEnviarCodigo({
      entidadColumna: 'cliente_id',
      entidadId: cliente.id_cliente,
      tipo: 'cambio_email_cliente',
      email: emailNuevo,
      plantilla: plantillaCambioEmail,
    });

    return res.status(200).json({ ok: true, mensaje: 'Te enviamos un código al email nuevo.' });
  } catch (err) {
    console.error('Error al solicitar cambio de email de cliente:', err);
    return res.status(500).json({ ok: false, error: 'No pudimos enviarte el código. Intentá de nuevo más tarde.' });
  }
};

// POST /api/bot/clientes/:telefono/confirmar-cambio-email
export const confirmarCambioEmailCliente = async (req, res) => {
  const { codigo } = req.body ?? {};
  const cliente = req.cliente;

  if (!codigo) {
    return res.status(400).json({ ok: false, error: 'codigo es obligatorio' });
  }

  try {
    const resultado = await validarCodigo({
      tipo: 'cambio_email_cliente',
      filtro: { cliente_id: cliente.id_cliente },
      codigoIngresado: codigo,
    });

    if (!resultado.ok) {
      return res.status(400).json({ ok: false, error: resultado.error });
    }

    const { data, error } = await supabaseAdmin
      .from('clientes')
      .update({ email: resultado.registro.email, email_verificado: true })
      .eq('id_cliente', cliente.id_cliente)
      .select()
      .single();

    if (error) {
      if (responderErrorCliente(error, res)) return;
      console.error('Error al confirmar cambio de email de cliente:', error);
      return res.status(500).json({ ok: false, error: 'No se pudo actualizar el email.' });
    }

    return res.status(200).json({ ok: true, mensaje: 'Listo, tu email quedó actualizado.', data });
  } catch (err) {
    console.error('Error inesperado al confirmar cambio de email de cliente:', err);
    return res.status(500).json({ ok: false, error: 'Ocurrió un error inesperado al confirmar el cambio de email.' });
  }
};
