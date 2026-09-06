import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'hovy-dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const generarToken = (usuario) => jwt.sign(
  {
    sub: usuario.id,
    usuario: usuario.usuario,
    rol: usuario.rol,
  },
  JWT_SECRET,
  { expiresIn: JWT_EXPIRES_IN }
);

router.post('/login', async (req, res) => {
  const { usuario, password } = req.body ?? {};

  if (!usuario || !password) {
    return res.status(400).json({ ok: false, error: 'usuario y password son obligatorios' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .eq('usuario', usuario)
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
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Error al iniciar sesión' });
  }
});

router.post('/register', async (req, res) => {
  const { usuario, password, rol = 'user' } = req.body ?? {};

  const rolesPermitidos = ['admin', 'user', 'viewer'];

  if (!usuario || !password) {
    return res.status(400).json({ ok: false, error: 'usuario y password son obligatorios' });
  }

  if (!rolesPermitidos.includes(rol)) {
    return res.status(400).json({ ok: false, error: 'rol inválido' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .insert({
        usuario,
        password_hash: passwordHash,
        rol,
      })
      .select('id, usuario, rol, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ ok: false, error: 'El usuario ya existe' });
      }
      return res.status(500).json({ ok: false, error: error.message || 'No se pudo crear el usuario' });
    }

    return res.status(201).json({ ok: true, user: data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Error al crear usuario' });
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
