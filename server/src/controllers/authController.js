import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase.js';
import { normalizarTelefono, ERROR_TELEFONO_INVALIDO } from '../utils/telefono.js';
import { plantillaVerificacionEmail, plantillaRecuperacionPassword } from '../services/emailTemplates.js';
import { crearYEnviarCodigo as crearYEnviarCodigoEntidad, validarCodigo as validarCodigoEntidad } from '../services/codigosVerificacionService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'hovy-dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const ROLES_PERMITIDOS = ['admin', 'user', 'viewer'];

// Columnas de `usuarios` que pueden salir por la API: la tabla guarda
// password_hash y ningún endpoint tiene que devolverlo.
const CAMPOS_PUBLICOS = 'id, usuario, rol, created_at, email, telefono, email_verificado';

// Los errores de Postgres que el alta y la edición mapean igual. Devuelve true
// si ya respondió, para que el caller corte.
//
// Vive acá y no repetido en cada handler porque las dos constraints nuevas
// (UNIQUE de telefono y el trigger de exclusión con clientes) aplican a
// cualquier escritura sobre `usuarios`, y olvidarse de una en un handler nuevo
// la convierte en un 500 sin explicación.
const respondioErrorConocido = (error, res) => {
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

// Wrappers finos sobre el servicio genérico de codigos_verificacion, fijando
// `entidadColumna: 'usuario_id'` y la plantilla según `tipo` — así el resto de
// este archivo (register, verificarEmail, olvidePassword, etc.) no cambia.
const crearYEnviarCodigo = (usuario, tipo) => crearYEnviarCodigoEntidad({
  entidadColumna: 'usuario_id',
  entidadId: usuario.id,
  tipo,
  email: usuario.email,
  plantilla: tipo === 'verificacion_email' ? plantillaVerificacionEmail : plantillaRecuperacionPassword,
});

const validarCodigo = (usuario, tipo, codigoIngresado) => validarCodigoEntidad({
  entidadColumna: 'usuario_id',
  entidadId: usuario.id,
  tipo,
  codigoIngresado,
});

// POST /auth/login
export const login = async (req, res) => {
  const { email, password } = req.body ?? {};

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

    if (!data.email_verificado) {
      return res.status(403).json({ ok: false, error: 'Debés verificar tu email antes de iniciar sesión' });
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
export const register = async (req, res) => {
  const { usuario, password, rol, email, telefono } = req.body ?? {};

  if (!usuario || !password || !email || !telefono) {
    return res.status(400).json({ ok: false, error: 'usuario, password, email y telefono son obligatorios' });
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
    const passwordHash = await bcrypt.hash(password, 10);

    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .insert({
        usuario,
        password_hash: passwordHash,
        rol,
        email,
        telefono: telefonoNormalizado,
      })
      .select(CAMPOS_PUBLICOS)
      .single();

    if (error) {
      if (respondioErrorConocido(error, res)) return;
      return res.status(500).json({ ok: false, error: error.message || 'No se pudo crear el usuario' });
    }

    await crearYEnviarCodigo(data, 'verificacion_email');

    return res.status(201).json({
      ok: true,
      mensaje: 'Cuenta creada. Revisá tu email para verificar la cuenta.',
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

  const { usuario, password, rol, email, telefono } = req.body ?? {};

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

// POST /auth/verificar-email
export const verificarEmail = async (req, res) => {
  const { email, codigo } = req.body ?? {};

  if (!email || !codigo) {
    return res.status(400).json({ ok: false, error: 'email y codigo son obligatorios' });
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

    if (usuario.email_verificado) {
      return res.status(200).json({ ok: true, mensaje: 'El email ya estaba verificado' });
    }

    const resultado = await validarCodigo(usuario, 'verificacion_email', codigo);

    if (!resultado.ok) {
      return res.status(400).json({ ok: false, error: resultado.error });
    }

    const { error: updateError } = await supabaseAdmin
      .from('usuarios')
      .update({ email_verificado: true })
      .eq('id', usuario.id);

    if (updateError) {
      return res.status(500).json({ ok: false, error: updateError.message });
    }

    const token = generarToken(usuario);

    return res.status(200).json({
      ok: true,
      token,
      user: {
        id: usuario.id,
        usuario: usuario.usuario,
        rol: usuario.rol,
        email: usuario.email,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Error al verificar el email' });
  }
};

// POST /auth/olvide-password
export const olvidePassword = async (req, res) => {
  const { email } = req.body ?? {};

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
  const { email, codigo, nuevaPassword } = req.body ?? {};

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

    const { error: updateError } = await supabaseAdmin
      .from('usuarios')
      .update({ password_hash: passwordHash })
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
  const { email, tipo } = req.body ?? {};
  const tiposValidos = ['verificacion_email', 'recuperacion_password'];

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

    const yaVerificado = tipo === 'verificacion_email' && usuario?.email_verificado;

    if (usuario && !yaVerificado) {
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
