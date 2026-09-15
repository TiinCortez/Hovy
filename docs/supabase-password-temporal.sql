-- Alta de staff con contraseña temporal. Correr una vez en el SQL Editor de
-- Supabase, DESPUÉS de supabase-verificacion-v2.sql. Este archivo deja el
-- estado final de codigos_verificacion.
--
-- El staff lo carga un admin desde la web: el usuario se crea en el momento
-- con una contraseña temporal (enviada por email) que tiene que cambiar en el
-- primer login. Reemplaza al alta de staff con código, que se elimina.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS password_temporal_expira TIMESTAMPTZ;

-- Códigos que ya no genera ningún flujo: el alta de staff con código
-- (alta_usuario, verificacion_email) y la verificación vieja de clientes
-- (verificacion_email_cliente).
DELETE FROM public.codigos_verificacion
WHERE tipo IN ('alta_usuario', 'verificacion_email', 'verificacion_email_cliente');

ALTER TABLE public.codigos_verificacion DROP CONSTRAINT IF EXISTS codigos_verificacion_tipo_check;
ALTER TABLE public.codigos_verificacion ADD CONSTRAINT codigos_verificacion_tipo_check CHECK (
  tipo IN (
    'alta_cliente',
    'cambio_email_cliente',
    'recuperacion_password',
    'recuperacion_telefono_cliente',
    'recuperacion_telefono_usuario'
  )
);

-- Solo el alta de cliente vive sin cuenta asociada (los datos van en `datos`
-- hasta confirmar el código); el resto es sobre un cliente o usuario que existe.
ALTER TABLE public.codigos_verificacion DROP CONSTRAINT IF EXISTS codigos_entidad_chk;
ALTER TABLE public.codigos_verificacion ADD CONSTRAINT codigos_entidad_chk CHECK (
  (tipo = 'alta_cliente' AND usuario_id IS NULL AND cliente_id IS NULL AND datos IS NOT NULL)
  OR
  (tipo <> 'alta_cliente' AND num_nonnulls(usuario_id, cliente_id) = 1)
);
