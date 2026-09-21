import { supabaseAdmin } from '../config/supabase.js';
import { normalizarTelefono, ERROR_TELEFONO_INVALIDO } from '../utils/telefono.js';
import { normalizarEmail } from '../utils/email.js';
import { crearYEnviarCodigo, validarCodigo, eliminarCodigo } from '../services/codigosVerificacionService.js';
import { plantillaVerificacionEmailCliente, plantillaCambioEmail } from '../services/emailTemplates.js';
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

// Chequeos de duplicado previos al envío del código: si el teléfono o el email
// ya están tomados, conviene decirlo ahora y no después de que el cliente fue
// a buscar el código a su casilla. El INSERT final igual puede chocar (dos
// altas en carrera) y eso lo mapea responderErrorCliente.
const conflictoAltaCliente = async ({ telefono, email }) => {
  const [clientePorTelefono, usuarioPorTelefono, clientePorEmail] = await Promise.all([
    supabaseAdmin.from('clientes').select('id_cliente').eq('telefono', telefono).maybeSingle(),
    supabaseAdmin.from('usuarios').select('id').eq('telefono', telefono).maybeSingle(),
    supabaseAdmin.from('clientes').select('id_cliente').eq('email', email).maybeSingle(),
  ]);

  const error = clientePorTelefono.error || usuarioPorTelefono.error || clientePorEmail.error;
  if (error) throw new Error(error.message);

  if (clientePorTelefono.data) return 'Ya existe un cliente registrado con ese teléfono.';
  if (usuarioPorTelefono.data) return 'Ese teléfono ya está registrado como usuario del sistema.';
  if (clientePorEmail.data) return 'Ya existe un cliente registrado con ese email.';
  return null;
};

// POST /api/bot/clientes (alta por WhatsApp)
//
// No inserta en `clientes`: guarda el alta junto al código en
// codigos_verificacion y manda el mail. El cliente recién se crea cuando
// confirma el código en /clientes/:telefono/verificar-email, así la tabla solo
// tiene cuentas con email verificado. Volver a llamar este endpoint con el
// mismo teléfono reemplaza el alta anterior, que es la forma de reenviar el
// código.
export const crearClienteBot = async (req, res) => {
  const {
    nombre,
    apellido,
    telefono,
    tipo_cliente,
    domicilio_fiscal,
    cuit_cuil,
    razon_social,
  } = req.body ?? {};
  const email = normalizarEmail(req.body?.email);

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
    const conflicto = await conflictoAltaCliente({ telefono: telefonoNormalizado, email });
    if (conflicto) {
      return res.status(409).json({ ok: false, error: conflicto });
    }

    await crearYEnviarCodigo({
      tipo: 'alta_cliente',
      email,
      telefono: telefonoNormalizado,
      datos: {
        nombre,
        apellido,
        telefono: telefonoNormalizado,
        tipo_cliente,
        email,
        domicilio_fiscal: domicilio_fiscal ?? null,
        cuit_cuil: cuit_cuil ?? null,
        razon_social: razon_social ?? null,
      },
      plantilla: plantillaVerificacionEmailCliente,
    });

    return res.status(202).json({
      ok: true,
      mensaje: 'Te enviamos un código a tu email. Respondelo para terminar el registro.',
    });
  } catch (err) {
    console.error('Error al iniciar alta de cliente por bot:', err);
    return res.status(500).json({
      ok: false,
      error: 'No pudimos enviarte el código. Intentá de nuevo más tarde.',
    });
  }
};

// POST /api/bot/clientes/:telefono/verificar-email
//
// Cierra el alta: valida el código y recién ahí inserta el cliente con los
// datos que quedaron guardados en el código. No monta
// resolverClientePorTelefono porque el cliente todavía no existe.
export const verificarEmailCliente = async (req, res) => {
  const { codigo } = req.body ?? {};

  if (!codigo) {
    return res.status(400).json({ ok: false, error: 'codigo es obligatorio' });
  }

  const telefono = normalizarTelefono(req.params.telefono);
  if (!telefono) {
    return res.status(400).json({ ok: false, error: ERROR_TELEFONO_INVALIDO });
  }

  try {
    const resultado = await validarCodigo({
      tipo: 'alta_cliente',
      filtro: { telefono },
      codigoIngresado: codigo,
    });

    if (!resultado.ok) {
      return res.status(400).json({ ok: false, error: resultado.error });
    }

    const { data, error } = await supabaseAdmin
      .from('clientes')
      .insert({
        ...resultado.registro.datos,
        email_verificado: true,
        calificacion_promedio: 0,
      })
      .select()
      .single();

    // El código ya quedó consumido: se borra salga bien o mal el INSERT, así
    // no queda la copia de los datos del alta en codigos_verificacion.
    await eliminarCodigo(resultado.registro.id);

    if (error) {
      if (responderErrorCliente(error, res)) return;
      console.error('Error al crear cliente verificado:', error);
      return res.status(500).json({ ok: false, error: 'No se pudo registrar el cliente.' });
    }

    return res.status(201).json({ ok: true, mensaje: 'Listo, tu cuenta quedó creada.', data });
  } catch (err) {
    console.error('Error inesperado al verificar alta de cliente:', err);
    return res.status(500).json({ ok: false, error: 'Ocurrió un error inesperado al verificar el email.' });
  }
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
