import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase.js';
import { interpretarTelefonoOpcional, ERROR_TELEFONO_INVALIDO } from '../utils/telefono.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'hovy-dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const ROLES_PERMITIDOS = ['admin', 'user', 'viewer'];

// Columnas de `usuarios` que pueden salir por la API: la tabla guarda
// password_hash y ningún endpoint tiene que devolverlo.
const CAMPOS_PUBLICOS = 'id, usuario, rol, created_at, email, telefono';

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

  // 23502 sobre telefono = la columna todavía es NOT NULL, o sea que falta
  // correr docs/supabase-usuarios-telefono.sql. Sin este mapeo el síntoma es un
  // 500 mudo justo en los dos casos que dependen de la migración: dar de alta un
  // usuario sin teléfono y borrarle el teléfono a uno existente.
  if (error.code === '23502' && `${error.message ?? ''}`.includes('telefono')) {
    res.status(500).json({
      ok: false,
      error: 'La columna usuarios.telefono todavía es NOT NULL: falta correr docs/supabase-usuarios-telefono.sql.',
    });
    return true;
  }

  return false;
};

const generarToken = (usuario) => jwt.sign(
  {
    sub: usuario.id,
    usuario: usuario.usuario,
    rol: usuario.rol,
    email: usuario.email
  },
  JWT_SECRET,
  { expiresIn: JWT_EXPIRES_IN }
);

router.post('/login', async (req, res) => {
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
});

router.post('/register', async (req, res) => {
  const { usuario, password, rol , email= 'user', telefono } = req.body ?? {};

  if (!usuario || !password) {
    return res.status(400).json({ ok: false, error: 'usuario y password son obligatorios' });
  }

  if (!ROLES_PERMITIDOS.includes(rol)) {
    return res.status(400).json({ ok: false, error: 'rol inválido' });
  }

  // El teléfono es opcional: solo lo necesita el staff que va a operar por
  // WhatsApp. Cuando viene, se guarda normalizado por el mismo motivo que en
  // clientes: es con lo que el bot busca (GET /api/bot/usuarios/:telefono), así
  // que un número guardado en otro formato es un número que el bot no encuentra.
  const telefonoAlta = interpretarTelefonoOpcional(telefono);
  if (!telefonoAlta.valido) {
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
        telefono: telefonoAlta.telefono
      })
      .select(CAMPOS_PUBLICOS)
      .single();

    if (error) {
      if (respondioErrorConocido(error, res)) return;
      return res.status(500).json({ ok: false, error: error.message || 'No se pudo crear el usuario' });
    }

    return res.status(201).json({ ok: true, user: data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Error al crear usuario' });
  }
});

// PUT /auth/usuarios/:id
//
// Edición de un usuario. Existe sobre todo para poder asignarle el teléfono al
// staff que va a operar por WhatsApp: hasta ahora la única forma de cargarlo era
// en el alta, así que los usuarios que ya estaban no tenían manera de entrar al
// flujo del bot sin tocar Supabase a mano.
//
// Va con authMiddleware + requireRole(['admin']) y no con la API key del bot: es
// el canal web, y deja cambiar el rol, así que un usuario editándose a sí mismo
// podría promoverse a admin. Se identifica por :id y no por :telefono como
// clientes porque acá el teléfono es opcional —un usuario sin teléfono no
// tendría URL— y encima es el campo que este endpoint sirve para setear.
router.put('/usuarios/:id', authMiddleware, requireRole(['admin']), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: 'id de usuario inválido' });
  }

  const { usuario, password, rol, email, telefono } = req.body ?? {};

  // Actualización parcial: `undefined` es "no lo mandes", que es distinto de
  // mandarlo vacío. Por eso se compara contra undefined y no por truthiness.
  const camposInvalidos = [];
  if (usuario !== undefined && !usuario) camposInvalidos.push('usuario');
  if (password !== undefined && !password) camposInvalidos.push('password');

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
  // Mandarlo vacío a propósito borra el teléfono (lo deja en NULL), que es como
  // se le saca a alguien el acceso por WhatsApp.
  if (telefono !== undefined) {
    const telefonoEdicion = interpretarTelefonoOpcional(telefono);
    if (!telefonoEdicion.valido) {
      return res.status(400).json({ ok: false, error: ERROR_TELEFONO_INVALIDO });
    }
    camposParaActualizar.telefono = telefonoEdicion.telefono;
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
});

router.get('/health', (req, res) => {
  res.status(200).json({ ok: true, message: 'Auth OK' });
});

router.get('/me', (req, res) => {
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
});

export default router;
