import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'hovy-dev-secret-change-me';

export const authMiddleware = (req, res, next) => {
  const publicRoutes = ['/auth/login', '/auth/register', '/auth/health'];

  if (publicRoutes.includes(req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Token requerido' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ ok: false, error: 'Token inválido o expirado' });
  }
};

export const requireRole = (roles = []) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: 'No autenticado' });
  }

  if (roles.length > 0 && !roles.includes(req.user.rol)) {
    return res.status(403).json({ ok: false, error: 'No tienes permisos suficientes' });
  }

  next();
};
