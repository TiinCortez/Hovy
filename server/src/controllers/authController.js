import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase.js';
import { normalizarTelefono, ERROR_TELEFONO_INVALIDO } from '../utils/telefono.js';
import { normalizarEmail } from '../utils/email.js';
import {
  generarPasswordTemporal,
  calcularExpiracionPasswordTemporal,
  TTL_PASSWORD_TEMPORAL_HORAS,
} from '../utils/passwordTemporal.js';
import { plantillaPasswordTemporal, plantillaRecuperacionPassword } from '../services/emailTemplates.js';
import { enviarEmail } from '../services/emailService.js';
import {
  crearYEnviarCodigo as crearYEnviarCodigoEntidad,
  validarCodigo as validarCodigoEntidad,
} from '../services/codigosVerificacionService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'hovy-dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const ROLES_PERMITIDOS = ['admin', 'user', 'viewer'];

// Columnas de `usuarios` que pueden salir por la API: la tabla guarda
// password_hash y ningún endpoint tiene que devolverlo. Exportada para la
// recuperación por WhatsApp, que también actualiza `usuarios`.
export const CAMPOS_PUBLICOS =
  'id, usuario, rol, created_at, email, telefono, email_verificado, debe_cambiar_password, password_temporal_expira';

const LARGO_MINIMO_PASSWORD = 8;

// Los errores de Postgres que el alta y la edición mapean igual. Devuelve true
// si ya respondió, para que el caller corte.
//
// Vive acá y no repetido en cada handler porque las dos constraints nuevas
// (UNIQUE de telefono y el trigger de exclusión con clientes) aplican a
// cualquier escritura sobre `usuarios`, y olvidarse de una en un handler nuevo
// la convierte en un 500 sin explicación.
export const respondioErrorConocido = (error, res) => {
  if (error.code === '23505') {
    // Desde que usuarios.telefono es UNIQUE hay dos constraints que caen acá, y
    // "El usuario ya existe" sería una pista falsa para la del teléfono. El
    // detalle de Postgres nombra la columna en conflicto.
    const detalle = `${error.message ?? ''} ${error.details ?? ''}`;
    if (detalle.includes('telefono')) {
      res.status(409).json({
        ok: false,
        error: 'Ya existe un usuario registrado con ese teléfono',
      });
      return true;
    }
    res.status(409).json({ ok: false, error: 'El usuario ya existe' });
    return true;
  }

  // P0001 = el trigger trg_usuario_telefono_libre: ese teléfono ya está cargado
  // como cliente. El mensaje lo escribe la base, así que lo pasamos tal cual en
  // vez de reescribirlo acá.
  if (error.code === 'P0001') {
    res.status(409).json({ ok: false, error: error.message });
    return true;
  }

  // 23502 sobre telefono: no debería llegar nunca (register y actualizarUsuario
  // ya validan que venga y sea válido antes de tocar la base), pero si algún
  // caller nuevo se olvida de esa validación, mejor un 400 claro que un 500
  // mudo — usuarios.telefono es NOT NULL a propósito, no es una migración
  // pendiente.
  if (error.code === '23502' && `${error.message ?? ''}`.includes('telefono')) {
    res.status(400).json({ ok: false, error: 'El teléfono es obligatorio y no puede quedar vacío.' });
    return true;
  }

  return false;
};

const generarToken = (usuario) => jwt.sign(
  {
    sub: usuario.id,
    usuario: usuario.usuario,
    rol: usuario.rol,
    email: usuario.email,
  },
  JWT_SECRET,
  { expiresIn: JWT_EXPIRES_IN }
);

// Wrappers finos sobre el servicio genérico de codigos_verificacion para la
// recuperación de contraseña, el único código de staff que queda.
const crearYEnviarCodigo = (usuario, tipo) => crearYEnviarCodigoEntidad({
  entidadColumna: 'usuario_id',
  entidadId: usuario.id,
  tipo,
  email: usuario.email,
  plantilla: plantillaRecuperacionPassword,
});

const validarCodigo = (usuario, tipo, codigoIngresado) => validarCodigoEntidad({
  tipo,
  filtro: { usuario_id: usuario.id },
  codigoIngresado,
});

// Genera una contraseña temporal, la deja guardada (hasheada) en el usuario y
// devuelve el texto plano para mandarlo por mail. La usan el alta y la
// regeneración que hace el admin.
const camposPasswordTemporal = async () => {
  const password = generarPasswordTemporal();
  return {
    password,
    campos: {
      password_hash: await bcrypt.hash(password, 10),
      debe_cambiar_password: true,
      password_temporal_expira: calcularExpiracionPasswordTemporal().toISOString(),
    },
  };
};

const enviarPasswordTemporal = ({ usuario, email, password }) => enviarEmail({
  to: email,
  ...plantillaPasswordTemporal({ usuario, password, ttlHoras: TTL_PASSWORD_TEMPORAL_HORAS }),
});

const passwordTemporalVencida = (usuario) =>
  !usuario.password_temporal_expira || new Date(usuario.password_temporal_expira) <= new Date();

// Chequeos de duplicado previos al INSERT, para devolver un mensaje claro por
// cada caso. El INSERT igual puede chocar en carrera y eso lo mapea
// respondioErrorConocido.
const conflictoAltaUsuario = async ({ usuario, email, telefono }) => {
  const [porUsuario, porEmail, porTelefono, clientePorTelefono] = await Promise.all([
    supabaseAdmin.from('usuarios').select('id').eq('usuario', usuario).maybeSingle(),
    supabaseAdmin.from('usuarios').select('id').eq('email', email).maybeSingle(),
    supabaseAdmin.from('usuarios').select('id').eq('telefono', telefono).maybeSingle(),
    supabaseAdmin.from('clientes').select('id_cliente').eq('telefono', telefono).maybeSingle(),
  ]);

  const error = porUsuario.error || porEmail.error || porTelefono.error || clientePorTelefono.error;
  if (error) throw new Error(error.message);

  if (porUsuario.data) return 'El usuario ya existe';
  if (porEmail.data) return 'Ya existe un usuario registrado con ese email';
  if (porTelefono.data) return 'Ya existe un usuario registrado con ese teléfono';
  if (clientePorTelefono.data) return 'Ese teléfono ya está registrado como cliente';
  return null;
};

// POST /auth/login
export const login = async (req, res) => {
  const { password } = req.body ?? {};
  const email = normalizarEmail(req.body?.email);

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'email y password son obligatorios' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) {
      return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
    }

    const passwordValida = await bcrypt.compare(password, data.password_hash);

    if (!passwordValida) {
      return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
    }

    // Recién creado (o con temporal regenerada): la contraseña temporal no da
    // sesión, solo habilita /auth/cambiar-password-inicial.
    if (data.debe_cambiar_password) {
      if (passwordTemporalVencida(data)) {
        return res.status(403).json({
          ok: false,
          error: 'La contraseña temporal venció. Pedí una nueva al administrador o usá "Olvidé mi contraseña".',
        });
      }
      return res.status(403).json({
        ok: false,
        requiereCambioPassword: true,
        error: 'Tenés que elegir una contraseña nueva.',
      });
    }

    // Usuarios creados antes de la contraseña temporal que nunca activaron.
    if (!data.email_verificado) {
      return res.status(403).json({
        ok: false,
        error: 'Tu cuenta no está activada. Pedí al administrador una contraseña temporal.',
      });
    }

    const token = generarToken(data);

    return res.status(200).json({
      ok: true,
      token,
      user: {
        id: data.id,
        usuario: data.usuario,
        rol: data.rol,
        email: data.email,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Error al iniciar sesión' });
  }
};

// POST /auth/register
//
// Solo un admin da de alta staff (la ruta monta authMiddleware +
// requireRole(['admin'])): si fuera público, cualquiera elegiría rol 'admin'.
// El usuario se crea en el momento con una contraseña temporal aleatoria que
// le llega por email; en el primer login tiene que cambiarla
// (/auth/cambiar-password-inicial), y eso además prueba que el email es suyo.
export const register = async (req, res) => {
  const { usuario, rol, telefono } = req.body ?? {};
  const email = normalizarEmail(req.body?.email);

  if (!usuario || !email || !telefono) {
    return res.status(400).json({ ok: false, error: 'usuario, email y telefono son obligatorios' });
  }

  if (!ROLES_PERMITIDOS.includes(rol)) {
    return res.status(400).json({ ok: false, error: 'rol inválido' });
  }

  // usuarios.telefono es NOT NULL: todo el staff tiene que ser ubicable por
  // WhatsApp, así que a diferencia de la edición no hay "sin teléfono" válido
  // acá. Se normaliza por el mismo motivo que en clientes: es con lo que el
  // bot busca (GET /api/bot/usuarios/:telefono).
  const telefonoNormalizado = normalizarTelefono(telefono);
  if (!telefonoNormalizado) {
    return res.status(400).json({ ok: false, error: ERROR_TELEFONO_INVALIDO });
  }

  try {
    const conflicto = await conflictoAltaUsuario({ usuario, email, telefono: telefonoNormalizado });
    if (conflicto) {
      return res.status(409).json({ ok: false, error: conflicto });
    }

    const { password, campos } = await camposPasswordTemporal();

    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .insert({
        usuario,
        rol,
        email,
        telefono: telefonoNormalizado,
        email_verificado: false,
        ...campos,
      })
      .select(CAMPOS_PUBLICOS)
      .single();

    if (error) {
      if (respondioErrorConocido(error, res)) return;
      return res.status(500).json({ ok: false, error: error.message || 'No se pudo crear el usuario' });
    }

    // Sin el mail el usuario no tiene cómo entrar: se borra para no dejar una
    // cuenta inaccesible, y el admin puede reintentar el alta tal cual.
    try {
      await enviarPasswordTemporal({ usuario, email, password });
    } catch (errMail) {
      await supabaseAdmin.from('usuarios').delete().eq('id', data.id);
      console.error('No se pudo enviar la contraseña temporal:', errMail);
      return res.status(500).json({
        ok: false,
        error: 'No se pudo enviar el email con la contraseña temporal. El usuario no se creó.',
      });
    }

    return res.status(201).json({
      ok: true,
      mensaje: 'Usuario creado. Le enviamos la contraseña temporal por email.',
      user: data,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Error al crear usuario' });
  }
};

// PUT /auth/usuarios/:id
//
// Edición de un usuario. Existe sobre todo para poder asignarle el teléfono al
// staff que va a operar por WhatsApp: hasta ahora la única forma de cargarlo era
// en el alta, así que los usuarios que ya estaban no tenían manera de entrar al
// flujo del bot sin tocar Supabase a mano.
//
// Va con authMiddleware + requireRole(['admin']) y no con la API key del bot: es
// el canal web, y deja cambiar el rol, así que un usuario editándose a sí mismo
// podría promoverse a admin. Se identifica por :id y no por :telefono porque
// email y telefono son NOT NULL pero igual pueden querer editarse, y el
// teléfono es justo el campo que este endpoint sirve para actualizar.
export const actualizarUsuario = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: 'id de usuario inválido' });
  }

  const { usuario, password, rol, telefono } = req.body ?? {};
  const email = normalizarEmail(req.body?.email);

  // Actualización parcial: `undefined` es "no lo mandes", que es distinto de
  // mandarlo vacío. Por eso se compara contra undefined y no por truthiness.
  // email va acá también (no en el bloque de telefono) porque a diferencia de
  // este último no necesita normalizarse, solo no puede quedar vacío.
  const camposInvalidos = [];
  if (usuario !== undefined && !usuario) camposInvalidos.push('usuario');
  if (password !== undefined && !password) camposInvalidos.push('password');
  if (email !== undefined && !email) camposInvalidos.push('email');

  if (camposInvalidos.length > 0) {
    return res.status(400).json({
      ok: false,
      error: `Los siguientes campos no pueden quedar vacíos: ${camposInvalidos.join(', ')}`,
    });
  }

  if (rol !== undefined && !ROLES_PERMITIDOS.includes(rol)) {
    return res.status(400).json({ ok: false, error: 'rol inválido' });
  }

  const camposParaActualizar = {};
  if (usuario !== undefined) camposParaActualizar.usuario = usuario;
  if (rol !== undefined) camposParaActualizar.rol = rol;
  if (email !== undefined) camposParaActualizar.email = email;

  // El teléfono se normaliza igual que en el alta, con el mismo helper: es lo
  // que hace que el bot lo encuentre venga como venga cargado desde el panel.
  // usuarios.telefono es NOT NULL, así que a diferencia de otros campos
  // opcionales acá no hay forma válida de "vaciarlo": si se manda, tiene que
  // normalizar a un número real.
  if (telefono !== undefined) {
    const telefonoNormalizado = normalizarTelefono(telefono);
    if (!telefonoNormalizado) {
      return res.status(400).json({ ok: false, error: ERROR_TELEFONO_INVALIDO });
    }
    camposParaActualizar.telefono = telefonoNormalizado;
  }

  if (Object.keys(camposParaActualizar).length === 0 && password === undefined) {
    return res.status(400).json({ ok: false, error: 'No se envió ningún campo para actualizar.' });
  }

  try {
    // El hash se calcula recién acá, después de todas las validaciones: bcrypt
    // con 10 rondas es deliberadamente lento y no tiene sentido pagarlo para
    // después rechazar el request por un rol inválido.
    if (password !== undefined) {
      camposParaActualizar.password_hash = await bcrypt.hash(password, 10);
    }

    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .update(camposParaActualizar)
      .eq('id', id)
      .select(CAMPOS_PUBLICOS)
      .single();

    if (error) {
      if (respondioErrorConocido(error, res)) return;
      if (error.code === 'PGRST116') {
        return res.status(404).json({ ok: false, error: `No existe un usuario con el id ${id}.` });
      }
      console.error('Error al actualizar usuario:', error);
      return res.status(500).json({
        ok: false,
        error: 'No se pudo actualizar el usuario. Intentá de nuevo más tarde.',
      });
    }

    return res.status(200).json({ ok: true, user: data });
  } catch (err) {
    console.error('Error inesperado al actualizar usuario:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al actualizar el usuario.',
    });
  }
};

// GET /auth/health
export const health = (req, res) => {
  res.status(200).json({ ok: true, message: 'Auth OK' });
};

// GET /auth/me
export const me = (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Token requerido' });
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = jwt.verify(token, JWT_SECRET);

    return res.status(200).json({ ok: true, user: payload });
  } catch (error) {
    return res.status(401).json({ ok: false, error: 'Token inválido o expirado' });
  }
};

// POST /auth/cambiar-password-inicial
//
// Primer ingreso de un usuario con contraseña temporal: el login le respondió
// 403 con requiereCambioPassword y el front le pide una nueva. Se vuelve a
// validar la temporal acá (en vez de emitir un token intermedio) para que el
// endpoint no dependa de ningún estado previo. Al terminar queda logueado.
export const cambiarPasswordInicial = async (req, res) => {
  const { passwordTemporal, nuevaPassword } = req.body ?? {};
  const email = normalizarEmail(req.body?.email);

  if (!email || !passwordTemporal || !nuevaPassword) {
    return res.status(400).json({ ok: false, error: 'email, passwordTemporal y nuevaPassword son obligatorios' });
  }

  if (String(nuevaPassword).length < LARGO_MINIMO_PASSWORD) {
    return res.status(400).json({
      ok: false,
      error: `La contraseña nueva tiene que tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`,
    });
  }

  if (nuevaPassword === passwordTemporal) {
    return res.status(400).json({ ok: false, error: 'La contraseña nueva tiene que ser distinta a la temporal.' });
  }

  try {
    const { data: usuario, error } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    const passwordValida = usuario && await bcrypt.compare(String(passwordTemporal), usuario.password_hash);

    if (!passwordValida) {
      return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
    }

    if (!usuario.debe_cambiar_password) {
      return res.status(400).json({ ok: false, error: 'Esta cuenta no tiene una contraseña temporal pendiente.' });
    }

    if (passwordTemporalVencida(usuario)) {
      return res.status(403).json({
        ok: false,
        error: 'La contraseña temporal venció. Pedí una nueva al administrador o usá "Olvidé mi contraseña".',
      });
    }

    const { data, error: updateError } = await supabaseAdmin
      .from('usuarios')
      .update({
        password_hash: await bcrypt.hash(String(nuevaPassword), 10),
        debe_cambiar_password: false,
        password_temporal_expira: null,
        // Entró con la contraseña que le llegó al email: la casilla es suya.
        email_verificado: true,
      })
      .eq('id', usuario.id)
      .select(CAMPOS_PUBLICOS)
      .single();

    if (updateError) {
      return res.status(500).json({ ok: false, error: updateError.message });
    }

    return res.status(200).json({
      ok: true,
      token: generarToken(data),
      user: {
        id: data.id,
        usuario: data.usuario,
        rol: data.rol,
        email: data.email,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Error al cambiar la contraseña' });
  }
};

// POST /auth/usuarios/:id/password-temporal
//
// Solo admin. Genera y envía otra contraseña temporal: para cuando la anterior
// venció o no llegó, y para activar a los usuarios creados antes de este flujo
// (que quedaron con email_verificado en false). La contraseña actual deja de
// servir en el momento.
export const regenerarPasswordTemporal = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: 'id de usuario inválido' });
  }

  try {
    const { data: usuario, error } = await supabaseAdmin
      .from('usuarios')
      .select('id, usuario, email')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    if (!usuario) {
      return res.status(404).json({ ok: false, error: `No existe un usuario con el id ${id}.` });
    }

    if (!usuario.email) {
      return res.status(409).json({
        ok: false,
        error: 'El usuario no tiene email cargado. Cargale uno antes de enviarle la contraseña temporal.',
      });
    }

    // Primero el mail y después el UPDATE: si el envío falla, el usuario
    // conserva la contraseña que tenía y no queda bloqueado con una que nunca
    // recibió.
    const { password, campos } = await camposPasswordTemporal();

    try {
      await enviarPasswordTemporal({ usuario: usuario.usuario, email: usuario.email, password });
    } catch (errMail) {
      console.error('No se pudo enviar la contraseña temporal:', errMail);
      return res.status(500).json({ ok: false, error: 'No se pudo enviar el email con la contraseña temporal.' });
    }

    const { data, error: updateError } = await supabaseAdmin
      .from('usuarios')
      .update(campos)
      .eq('id', id)
      .select(CAMPOS_PUBLICOS)
      .single();

    if (updateError) {
      return res.status(500).json({ ok: false, error: updateError.message });
    }

    return res.status(200).json({
      ok: true,
      mensaje: 'Le enviamos una contraseña temporal nueva por email.',
      user: data,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Error al generar la contraseña temporal' });
  }
};

// POST /auth/olvide-password
export const olvidePassword = async (req, res) => {
  const email = normalizarEmail(req.body?.email);

  if (!email) {
    return res.status(400).json({ ok: false, error: 'email es obligatorio' });
  }

  try {
    const { data: usuario } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (usuario) {
      await crearYEnviarCodigo(usuario, 'recuperacion_password');
    }

    // Misma respuesta exista o no el email: evita que este endpoint sirva
    // para averiguar qué emails están registrados.
    return res.status(200).json({
      ok: true,
      mensaje: 'Si el email está registrado, vas a recibir un código de recuperación',
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Error al procesar la solicitud' });
  }
};

// POST /auth/restablecer-password
export const restablecerPassword = async (req, res) => {
  const { codigo, nuevaPassword } = req.body ?? {};
  const email = normalizarEmail(req.body?.email);

  if (!email || !codigo || !nuevaPassword) {
    return res.status(400).json({ ok: false, error: 'email, codigo y nuevaPassword son obligatorios' });
  }

  try {
    const { data: usuario, error } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !usuario) {
      return res.status(400).json({ ok: false, error: 'Código inválido o vencido' });
    }

    const resultado = await validarCodigo(usuario, 'recuperacion_password', codigo);

    if (!resultado.ok) {
      return res.status(400).json({ ok: false, error: resultado.error });
    }

    const passwordHash = await bcrypt.hash(nuevaPassword, 10);

    // Recibir el código en la casilla prueba el email, así que también sirve
    // para salir de una contraseña temporal vencida sin depender del admin.
    const { error: updateError } = await supabaseAdmin
      .from('usuarios')
      .update({
        password_hash: passwordHash,
        debe_cambiar_password: false,
        password_temporal_expira: null,
        email_verificado: true,
      })
      .eq('id', usuario.id);

    if (updateError) {
      return res.status(500).json({ ok: false, error: updateError.message });
    }

    return res.status(200).json({ ok: true, mensaje: 'Contraseña actualizada correctamente' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Error al restablecer la contraseña' });
  }
};

// POST /auth/reenviar-codigo
export const reenviarCodigo = async (req, res) => {
  const { tipo } = req.body ?? {};
  const email = normalizarEmail(req.body?.email);
  const tiposValidos = ['recuperacion_password'];

  if (!email || !tipo) {
    return res.status(400).json({ ok: false, error: 'email y tipo son obligatorios' });
  }

  if (!tiposValidos.includes(tipo)) {
    return res.status(400).json({ ok: false, error: `tipo inválido. Valores permitidos: ${tiposValidos.join(', ')}` });
  }

  try {
    const { data: usuario } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (usuario) {
      await crearYEnviarCodigo(usuario, tipo);
    }

    return res.status(200).json({
      ok: true,
      mensaje: 'Si el email está registrado, vas a recibir un nuevo código',
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Error al reenviar el código' });
  }
};
