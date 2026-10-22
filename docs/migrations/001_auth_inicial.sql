CREATE TABLE IF NOT EXISTS public.usuarios (
  id BIGSERIAL PRIMARY KEY,
  usuario TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'user', 'viewer')) DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Semilla inicial idempotente: nunca sobrescribe la contraseña si el usuario ya existe
INSERT INTO public.usuarios (usuario, password_hash, rol)
VALUES (
  'hovy',
  '$2b$10$I304t/p.IXucJPg0wFdZcujf2E7kK2GLxqjiAE1O8Qi8VWEDz9ux6',
  'admin'
)
ON CONFLICT (usuario) DO NOTHING;

SELECT id, usuario, rol, created_at
FROM public.usuarios
WHERE usuario = 'hovy';
