-- Verificación v2: el alta de clientes por WhatsApp ya no inserta en
-- `clientes` hasta que se confirma el código. Mientras tanto, el alta vive en
-- codigos_verificacion: sin cliente_id y con los datos a insertar en `datos`.
--
-- Correr una vez en el SQL Editor de Supabase, y DESPUÉS
-- supabase-password-temporal.sql, que deja las restricciones finales de la
-- tabla (los CHECK de tipo y de entidad se definen allá).

ALTER TABLE public.codigos_verificacion
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS telefono TEXT,
  ADD COLUMN IF NOT EXISTS datos JSONB;

-- Quita el CHECK original "exactamente uno de usuario_id/cliente_id", que no
-- admite altas pendientes. Como no sabemos con qué nombre se creó, se borran
-- todos los CHECK de la tabla que mencionen usuario_id o cliente_id, y también
-- el de la lista de tipos: supabase-password-temporal.sql crea los dos nuevos.
DO $$
DECLARE
  restriccion RECORD;
BEGIN
  FOR restriccion IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.codigos_verificacion'::regclass
      AND contype = 'c'
      AND (pg_get_constraintdef(oid) ILIKE '%usuario_id%' OR pg_get_constraintdef(oid) ILIKE '%cliente_id%')
  LOOP
    EXECUTE format('ALTER TABLE public.codigos_verificacion DROP CONSTRAINT %I', restriccion.conname);
  END LOOP;
END $$;

ALTER TABLE public.codigos_verificacion DROP CONSTRAINT IF EXISTS codigos_verificacion_tipo_check;

CREATE INDEX IF NOT EXISTS codigos_alta_idx
  ON public.codigos_verificacion (tipo, email, telefono);
