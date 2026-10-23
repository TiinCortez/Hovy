# Guía de Migraciones de Base de Datos - Hovy (Supabase PostgreSQL)

Esta carpeta contiene los scripts SQL de esquema y modificaciones de la base de datos de Hovy ordenados cronológicamente y ejecutados automáticamente por el motor de migraciones (`scripts/db-migrate.mjs`).

---

## ⚠️ Aislamiento de Entornos: Dos Bases de Datos Separadas

En Hovy trabajamos con **dos instancias independientes de Supabase**:

| Entorno | Propósito | Supabase Project Ref | URL / Endpoint |
| :--- | :--- | :--- | :--- |
| **STAGING** | Usada por `dev.hovyapp.com.ar` y por los desarrolladores en sus máquinas locales (`localhost`) para pruebas. Contiene datos de test y fixtures. | `kzfziqdmtvrcwotemvyj` | `https://kzfziqdmtvrcwotemvyj.supabase.co` |
| **PRODUCCIÓN** | Usada exclusivamente por `hovyapp.com.ar`. Contiene los datos reales y operativos del barrio Valle la Armonía. | `dulaaxavsvgkqqbrvltd` | `https://dulaaxavsvgkqqbrvltd.supabase.co` |

> 🔒 **Regla de Oro:** NUNCA ejecutes pruebas o scripts experimentales directamente en la base de Producción. Todo cambio se versiona en esta carpeta y se despliega automáticamente vía CI/CD.

---

## 📋 Secuencia de Migraciones

Los scripts se aplican en orden numérico estricto indicado por su prefijo de 3 dígitos:

0. **`000_motor_migraciones_automaticas.sql`**: Tabla de control `public.schema_migrations` y función RPC transaccional `public.exec_migration` protegida por `service_role` para ejecución automática en el Plan Gratuito de Supabase.
1. **`001_auth_inicial.sql`**: Creación de la tabla `usuarios` y usuario administrador semilla por defecto (`ON CONFLICT DO NOTHING`).
2. **`002_codigos_verificacion_v2.sql`**: Modificación de `codigos_verificacion` para soportar altas pendientes vía bot de WhatsApp con datos JSONB.
3. **`003_password_temporal_y_estados.sql`**: Soporte para contraseñas temporales enviadas por email en el alta de staff (`debe_cambiar_password`, `password_temporal_expira`).
4. **`004_servicios_catalogo.sql`**: Reestructuración del catálogo de servicios global y creación de la tabla puente `usuario_servicio` con precios base y límites operativos.
5. **`005_presupuestos_estimados.sql`**: Soporte de estimación interna de presupuestos (`solicitud_servicio` y columna `monto_estimado` en `presupuestos`).
6. **`006_mercadopago_oauth.sql`**: Vinculación de cuentas vendedor de Mercado Pago (`mercadopago_oauth_state` y `mercadopago_conexion` cifrada con AES-256).
7. **`007_cobros_mercadopago.sql`**: Tabla `cobros_mercadopago` (links de pago Checkout Pro del vendedor con QR; el estado lo actualiza el webhook de Mercado Pago).
8. **`008_triggers_cuenta_corriente.sql`**: Tablas `cuentas_corrientes`, `trabajos_ejecutados`, `movimientos_cuenta` y triggers `trg_turno_realizado` (imputación automática al completar turno con validación P0001) y `trg_turno_cancelado` (bloqueo de cancelación con P0001 si ya tiene trabajo registrado), más vistas `v_estado_cuenta` y `v_deudores`.
9. **`009_ajuste_valor_final_presupuesto.sql`**: Columnas `diferencia_ajuste` y `motivo_ajuste` en `presupuestos` para edición de valor final (VAL-168) y eliminación de columna obsoleta `documento_pdf_url`.
10. **`010_agregar_columna_cobrado_turnos.sql`**: Incorporación estandarizada de la columna booleana `cobrado` (`DEFAULT FALSE`) en la tabla `turnos`.
11. **`011_combustible_usuario_y_precios.sql`**: Migración `combustible usuario y precios`.
12. **`012_presupuesto_traslado.sql`**: Migración `presupuesto traslado`.
13. **`013_cobro_por_turno_y_registro_de_pago.sql`**: Migración `cobro por turno y registro de pago`.
14. **`014_pago_manual_efectivo_transferencia.sql`**: Migración `pago manual efectivo transferencia`.

---

## 🛠️ Cómo Crear y Aplicar una Nueva Migración (100% Automatizado)

Si tu tarea requiere agregar una columna, una tabla, un trigger o un índice:

1. **Generá la plantilla automáticamente desde la raíz del proyecto:**
   ```bash
   npm run db:new nombre_descriptivo
   ```
   *(Esto calcula automáticamente el próximo número correlativo, crea el archivo `.sql` en `docs/migrations/` y agrega la línea de documentación en este `README.md`).*

2. **Escribí tu SQL de forma idempotente (seguro de re-ejecutar):**
   - Usá `CREATE TABLE IF NOT EXISTS...`
   - Usá `ALTER TABLE ... ADD COLUMN IF NOT EXISTS...`
   - Usá `CREATE INDEX IF NOT EXISTS...`
   - Seguí el patrón **Expand/Contract**: primero agregá columnas nuevas con valores por defecto sin borrar columnas que el código actual todavía lee.

3. **Verificá el estado y probá en tu entorno local / Staging:**
   ```bash
   npm run db:status
   npm run db:migrate:dry
   npm run db:migrate
   ```

4. **Subí el archivo SQL en tu Pull Request:**
   - Al hacer merge a `develop`, el pipeline `deploy-dev.yml` ejecutará automáticamente `node scripts/db-migrate.mjs --apply` en Staging antes de reiniciar el contenedor.
   - Al hacer merge a `main`, el pipeline `deploy-prod.yml` generará un backup cifrado previo y aplicará automáticamente las migraciones pendientes en Producción.
