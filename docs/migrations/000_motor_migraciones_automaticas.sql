-- =============================================================================
-- MOTOR DE MIGRACIONES AUTOMÁTICAS (100% COMPATIBLE CON SUPABASE FREE TIER)
-- Ejecutar una única vez en el SQL Editor de Staging y de Producción.
-- =============================================================================

-- 1. Tabla de control de migraciones aplicadas
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version     TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  checksum    TEXT NOT NULL,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;

-- 2. Función RPC transaccional blindada exclusivamente para service_role
CREATE OR REPLACE FUNCTION public.exec_migration(
  p_version  TEXT,
  p_name     TEXT,
  p_checksum TEXT,
  p_sql      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_existing_checksum TEXT;
BEGIN
  -- Validar que solo pueda invocarse con service_role o desde el SQL Editor (postgres)
  v_role := COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    current_user
  );

  IF v_role NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Acceso denegado: exec_migration requiere service_role (rol actual: %)', v_role
      USING ERRCODE = '42501';
  END IF;

  -- Candado transaccional (Advisory Lock) para evitar ejecuciones simultáneas
  PERFORM pg_advisory_xact_lock(84729104);

  -- Si la versión ya fue aplicada, no volver a ejecutarla
  SELECT checksum INTO v_existing_checksum
  FROM public.schema_migrations
  WHERE version = p_version;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'already_applied',
      'version', p_version,
      'name', p_name,
      'checksum', v_existing_checksum
    );
  END IF;

  -- Ejecutar el DDL/SQL de la migración dentro de esta misma transacción atómica
  EXECUTE p_sql;

  -- Registrar la migración como aplicada
  INSERT INTO public.schema_migrations (version, name, checksum)
  VALUES (p_version, p_name, p_checksum);

  -- Notificar a PostgREST para recargar el caché de tablas y columnas inmediatamente
  NOTIFY pgrst, 'reload schema';

  RETURN jsonb_build_object(
    'status', 'applied',
    'version', p_version,
    'name', p_name,
    'checksum', p_checksum
  );
END;
$$;

-- Bloquear ejecución para usuarios públicos o logueados en la web; permitir solo a service_role
REVOKE ALL ON FUNCTION public.exec_migration(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exec_migration(TEXT, TEXT, TEXT, TEXT) TO service_role, postgres;

-- 3. Registrar las migraciones históricas (001 a 009) que ya están en Staging y Producción
INSERT INTO public.schema_migrations (version, name, checksum) VALUES
  ('001', '001_auth_inicial.sql', 'bootstrap-initial'),
  ('002', '002_codigos_verificacion_v2.sql', 'bootstrap-initial'),
  ('003', '003_password_temporal_y_estados.sql', 'bootstrap-initial'),
  ('004', '004_servicios_catalogo.sql', 'bootstrap-initial'),
  ('005', '005_presupuestos_estimados.sql', 'bootstrap-initial'),
  ('006', '006_mercadopago_oauth.sql', 'bootstrap-initial'),
  ('007', '007_cobros_mercadopago.sql', 'bootstrap-initial'),
  ('008', '008_triggers_cuenta_corriente.sql', 'bootstrap-initial'),
  ('009', '009_ajuste_valor_final_presupuesto.sql', 'bootstrap-initial')
ON CONFLICT (version) DO NOTHING;

-- Recargar caché de PostgREST para que exponga la nueva RPC exec_migration de inmediato
NOTIFY pgrst, 'reload schema';
