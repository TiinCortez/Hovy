# Guía de Migraciones de Base de Datos - Hovy (Supabase PostgreSQL)

Esta carpeta contiene los scripts SQL de esquema y modificaciones de la base de datos de Hovy ordenados cronológicamente.

---

## ⚠️ Aislamiento de Entornos: Dos Bases de Datos Separadas

En Hovy trabajamos con **dos instancias independientes de Supabase**:

| Entorno | Propósito | Supabase Project Ref | URL / Endpoint |
| :--- | :--- | :--- | :--- |
| **STAGING** | Usada por `dev.hovyapp.com.ar` y por los desarrolladores en sus máquinas locales (`localhost`) para pruebas. Contiene datos de test y fixtures. | `kzfziqdmtvrcwotemvyj` | `https://kzfziqdmtvrcwotemvyj.supabase.co` |
| **PRODUCCIÓN** | Usada exclusivamente por `hovyapp.com.ar`. Contiene los datos reales y operativos del barrio Valle la Armonía. | `dulaaxavsvgkqqbrvltd` | `https://dulaaxavsvgkqqbrvltd.supabase.co` |

> 🔒 **Regla de Oro:** NUNCA ejecutes pruebas o scripts experimentales directamente en la base de Producción. Todo cambio se prueba primero en Staging.

---

## 📋 Secuencia de Migraciones

Los scripts deben ejecutarse en el **SQL Editor de Supabase** en el orden numérico exacto indicado por el prefijo:

1. **`001_auth_inicial.sql`**: Creación de la tabla `usuarios` y usuario administrador semilla por defecto.
2. **`002_codigos_verificacion_v2.sql`**: Modificación de `codigos_verificacion` para soportar altas pendientes vía bot de WhatsApp con datos JSONB.
3. **`003_password_temporal_y_estados.sql`**: Soporte para contraseñas temporales enviadas por email en el alta de staff (`debe_cambiar_password`, `password_temporal_expira`).
4. **`004_servicios_catalogo.sql`**: Reestructuración del catálogo de servicios global y creación de la tabla puente `usuario_servicio` con precios base y límites operativos.
5. **`005_presupuestos_estimados.sql`**: Soporte de estimación interna de presupuestos (`solicitud_servicio` y columna `monto_estimado` en `presupuestos`).
6. **`006_mercadopago_oauth.sql`**: Vinculación de cuentas vendedor de Mercado Pago (`mercadopago_oauth_state` y `mercadopago_conexion` cifrada con AES-256).

---

## 🛠️ Cómo Crear una Nueva Migración (Para Desarrolladores)

Si tu tarea requiere agregar una columna, una tabla, un trigger o un índice:

1. **Creá un nuevo archivo numerado en esta carpeta:**
   - Ejemplo: `007_notificaciones_push.sql`.
2. **Hacé tu script idempotente (seguro de re-ejecutar):**
   - Usá `CREATE TABLE IF NOT EXISTS...`
   - Usá `ALTER TABLE ... ADD COLUMN IF NOT EXISTS...`
   - Usá `CREATE INDEX IF NOT EXISTS...`
3. **Probá la migración en STAGING:**
   - Entrá al SQL Editor de Supabase Staging (`kzfziqdmtvrcwotemvyj`) y ejecutá tu script.
   - Probá tu código en `localhost` o en tu rama.
4. **Subí el archivo SQL en tu Pull Request:**
   - El archivo versionado en Git permite que tus compañeros y el equipo de DevOps sepan qué cambios de base de datos introduce tu PR.
5. **Pase a Producción:**
   - Una vez que la PR sea aprobada y se mergee a `main`, el administrador ejecutará ese mismo archivo `007_...sql` en el SQL Editor de Supabase Producción (`dulaaxavsvgkqqbrvltd`).
