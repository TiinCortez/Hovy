# Autenticación de staff (`/auth`)

Endpoints para las cuentas de **staff** (tabla `usuarios`). Los clientes no usan
estos endpoints: tienen su propio flujo por el bot (`/api/bot/...`).

- Base URL local: `http://localhost:4000`
- Las rutas van en `/auth/...`, **sin** `/api`.
- Todas las respuestas son JSON con `ok: true | false`. Si hay error viene en `error`.
- Ejemplos listos para correr: [server/src/test/auth.http](../server/src/test/auth.http)

## Índice

| Método | Ruta | Acceso | Para qué |
|---|---|---|---|
| POST | [`/auth/login`](#post-authlogin) | Público | Iniciar sesión |
| GET | [`/auth/me`](#get-authme) | Token | Ver los datos del token |
| GET | [`/auth/health`](#get-authhealth) | Público | Chequeo de que el módulo responde |
| POST | [`/auth/register`](#post-authregister) | Admin · rate limit | Alta de staff (manda contraseña temporal) |
| PUT | [`/auth/usuarios/:id`](#put-authusuariosid) | Admin | Editar un usuario |
| POST | [`/auth/usuarios/:id/password-temporal`](#post-authusuariosidpassword-temporal) | Admin · rate limit | Reenviar contraseña temporal |
| POST | [`/auth/cambiar-password-inicial`](#post-authcambiar-password-inicial) | Público | Cambiar la temporal por una definitiva |
| POST | [`/auth/olvide-password`](#post-autholvide-password) | Público · rate limit | Pedir código de recuperación |
| POST | [`/auth/reenviar-codigo`](#post-authreenviar-codigo) | Público · rate limit | Reenviar el código de recuperación |
| POST | [`/auth/restablecer-password`](#post-authrestablecer-password) | Público | Cambiar la contraseña con el código |

---

## Conceptos

### Contraseña temporal vs. código de recuperación

Son dos cosas distintas, llegan por mail y **cada una va a un endpoint distinto**.
Confundirlas es el error más común.

| | Contraseña temporal | Código de recuperación |
|---|---|---|
| Quién la dispara | Un **admin** (alta o reenvío) | El **propio usuario** ("Olvidé mi contraseña") |
| Formato | 12 caracteres alfanuméricos, ej. `4udc58q46aMc` | 6 dígitos, ej. `048213` |
| Vence a las | 72 h (`PASSWORD_TEMPORAL_TTL_HORAS`) | 15 min (`CODIGO_VERIFICACION_TTL_MIN`) |
| Se usa en | `POST /auth/cambiar-password-inicial` | `POST /auth/restablecer-password` |
| Campo del body | `passwordTemporal` | `codigo` |
| ¿Sirve para `/auth/login`? | Sí, pero devuelve 403 `requiereCambioPassword` | No |

Si mandás la temporal a `restablecer-password` responde **"Código inválido o vencido"**.
Si mandás el body de `cambiar-password-inicial` a `restablecer-password` responde
**"email, codigo y nuevaPassword son obligatorios"**. En los dos casos el problema
es la URL, no los datos.

### Estado de la cuenta

Tres columnas de `usuarios` definen si alguien puede entrar:

| Columna | Significado |
|---|---|
| `debe_cambiar_password` | `true` si su contraseña actual es temporal. No puede loguearse hasta cambiarla. |
| `password_temporal_expira` | Fecha de vencimiento de la temporal (`null` si no tiene). |
| `email_verificado` | `true` cuando probó que el mail es suyo (cambió la temporal o usó un código). |

Para loguearse hace falta `debe_cambiar_password = false` **y** `email_verificado = true`.

### Token

- JWT firmado con `JWT_SECRET`, dura `JWT_EXPIRES_IN` (default `8h`).
- Payload: `{ sub, usuario, rol, email }`.
- Se manda como header: `Authorization: Bearer <token>`.
- Roles válidos: `admin`, `user`, `viewer`.

Errores comunes de las rutas protegidas:

| Status | `error` | Causa |
|---|---|---|
| 401 | `Token requerido` | Falta el header o no empieza con `Bearer ` |
| 401 | `Token inválido o expirado` | Firma incorrecta (otro `JWT_SECRET`) o vencido |
| 403 | `No tienes permisos suficientes` | El rol no es `admin` |

### Rate limit

`register`, `usuarios/:id/password-temporal`, `olvide-password` y `reenviar-codigo`
mandan mails y están limitados **por IP**: 5 pedidos por hora por defecto
(`EMAIL_RATE_LIMIT_MAX`, `EMAIL_RATE_LIMIT_WINDOW_MS`). Al pasarse:

```json
429 { "ok": false, "error": "Demasiados intentos. Probá de nuevo más tarde." }
```

El contador es en memoria: reiniciar el server lo resetea.

---

## Flujos

### 1. Alta de un usuario nuevo

```
Admin: POST /auth/register
   └─> mail con contraseña temporal
Usuario: POST /auth/login con la temporal         -> 403 requiereCambioPassword: true
Usuario: POST /auth/cambiar-password-inicial      -> 200 con token
```

### 2. La temporal venció o no llegó

```
Admin: POST /auth/usuarios/:id/password-temporal
   └─> mail con otra contraseña temporal
Usuario: POST /auth/cambiar-password-inicial      -> 200 con token
```

### 3. Olvidé mi contraseña (sin admin)

También sirve para salir de una temporal vencida.

```
Usuario: POST /auth/olvide-password
   └─> mail con código de 6 dígitos
Usuario: POST /auth/restablecer-password          -> 200 (sin token)
Usuario: POST /auth/login con la nueva            -> 200 con token
```

---

## Endpoints

### POST /auth/login

Inicia sesión con email y contraseña.

**Body**
```json
{ "email": "agustin10boca@hotmail.com", "password": "andres123" }
```

**200**
```json
{
  "ok": true,
  "token": "eyJhbGciOi...",
  "user": { "id": 3, "usuario": "agustin", "rol": "admin", "email": "agustin10boca@hotmail.com" }
}
```

**Errores**

| Status | `error` | Qué hacer |
|---|---|---|
| 400 | `email y password son obligatorios` | Completar el body |
| 401 | `Credenciales inválidas` | No existe ese email o la contraseña no coincide |
| 403 | `Tenés que elegir una contraseña nueva.` (+ `requiereCambioPassword: true`) | Ir a `cambiar-password-inicial` |
| 403 | `La contraseña temporal venció...` | Flujo 2 o 3 |
| 403 | `Tu cuenta no está activada...` | Usuario viejo sin activar: flujo 2 |

---

### GET /auth/me

Devuelve el payload del token. **No consulta la base**: si cambió el rol del
usuario, esto sigue mostrando el rol viejo hasta que vuelva a loguearse.

**Headers:** `Authorization: Bearer <token>`

**200**
```json
{ "ok": true, "user": { "sub": 3, "usuario": "agustin", "rol": "admin", "email": "...", "iat": 1757800000, "exp": 1757828800 } }
```

---

### GET /auth/health

**200** `{ "ok": true, "message": "Auth OK" }`

---

### POST /auth/register

Crea un usuario de staff y le manda una contraseña temporal por mail. El admin
**no** elige la contraseña: la genera el backend.

**Acceso:** admin · rate limit
**Headers:** `Authorization: Bearer <token de admin>`

**Body**
```json
{
  "usuario": "prueba1",
  "rol": "user",
  "email": "prueba1@example.com",
  "telefono": "3514330429"
}
```

| Campo | Obligatorio | Notas |
|---|---|---|
| `usuario` | Sí | Único |
| `rol` | Sí | `admin`, `user` o `viewer` |
| `email` | Sí | Único. Se normaliza (minúsculas, sin espacios) |
| `telefono` | Sí | Único, se normaliza. No puede estar cargado como cliente |

**201**
```json
{ "ok": true, "mensaje": "Usuario creado. Le enviamos la contraseña temporal por email.", "user": { ... } }
```

**Errores**

| Status | `error` |
|---|---|
| 400 | `usuario, email y telefono son obligatorios` · `rol inválido` · teléfono inválido |
| 409 | `El usuario ya existe` · `Ya existe un usuario registrado con ese email` · `...con ese teléfono` · `Ese teléfono ya está registrado como cliente` |
| 500 | `No se pudo enviar el email con la contraseña temporal. El usuario no se creó.` |

Si el mail falla, el usuario se borra: se puede reintentar el alta tal cual.

---

### PUT /auth/usuarios/:id

Edición parcial de un usuario: solo se tocan los campos que vienen en el body.

**Acceso:** admin
**Headers:** `Authorization: Bearer <token de admin>`

**Body** (todos opcionales, al menos uno)
```json
{ "usuario": "nuevo", "rol": "viewer", "email": "otro@example.com", "telefono": "3514330430", "password": "..." }
```

- Un campo enviado vacío da 400 (`Los siguientes campos no pueden quedar vacíos: ...`).
- `password` se guarda hasheada, pero **no** toca `debe_cambiar_password` ni
  `email_verificado`: no sirve para destrabar a un usuario con temporal pendiente.
  Para eso usar el flujo 2 o 3.

**200** `{ "ok": true, "user": { ... } }`

**Errores:** 400 (id/rol/teléfono inválido, sin campos), 404 (`No existe un usuario con el id X.`),
409 (email/teléfono/usuario duplicado, teléfono de cliente).

---

### POST /auth/usuarios/:id/password-temporal

Genera una contraseña temporal nueva y la manda por mail. La contraseña que el
usuario tenía **deja de servir** en el momento.

Usarlo cuando la temporal venció, no llegó, o para activar usuarios viejos con
`email_verificado = false`.

**Acceso:** admin · rate limit
**Headers:** `Authorization: Bearer <token de admin>`
**Body:** ninguno. El `:id` es el id numérico del usuario, no el email.

**200**
```json
{ "ok": true, "mensaje": "Le enviamos una contraseña temporal nueva por email.", "user": { ... } }
```

**Errores**

| Status | `error` |
|---|---|
| 400 | `id de usuario inválido` |
| 404 | `No existe un usuario con el id X.` |
| 409 | `El usuario no tiene email cargado...` |
| 500 | `No se pudo enviar el email con la contraseña temporal.` (el usuario conserva su contraseña anterior) |

---

### POST /auth/cambiar-password-inicial

Cambia la **contraseña temporal** por una definitiva. Activa la cuenta y
devuelve el token, así que el usuario queda logueado.

**Body**
```json
{
  "email": "agustin10boca@hotmail.com",
  "passwordTemporal": "4udc58q46aMc",
  "nuevaPassword": "andres123"
}
```

| Campo | Notas |
|---|---|
| `passwordTemporal` | La del mail, tal cual (distingue mayúsculas) |
| `nuevaPassword` | Mínimo 8 caracteres y distinta de la temporal |

**200** igual que `login`: `{ ok, token, user }`.

**Errores**

| Status | `error` |
|---|---|
| 400 | `email, passwordTemporal y nuevaPassword son obligatorios` |
| 400 | `La contraseña nueva tiene que tener al menos 8 caracteres.` |
| 400 | `La contraseña nueva tiene que ser distinta a la temporal.` |
| 400 | `Esta cuenta no tiene una contraseña temporal pendiente.` (ya la cambió: usar `login`) |
| 401 | `Credenciales inválidas` (email inexistente o temporal incorrecta) |
| 403 | `La contraseña temporal venció...` |

---

### POST /auth/olvide-password

Manda un **código de 6 dígitos** al mail del usuario.

**Acceso:** público · rate limit

**Body**
```json
{ "email": "agustin10boca@hotmail.com" }
```

**200** (siempre, exista o no el email, para no revelar qué mails están registrados)
```json
{ "ok": true, "mensaje": "Si el email está registrado, vas a recibir un código de recuperación" }
```

---

### POST /auth/reenviar-codigo

Genera y manda otro código de recuperación. Se valida el código más reciente,
así que los anteriores dejan de servir en la práctica.

**Acceso:** público · rate limit

**Body**
```json
{ "email": "agustin10boca@hotmail.com", "tipo": "recuperacion_password" }
```

`tipo` hoy solo acepta `recuperacion_password`.

**200** `{ "ok": true, "mensaje": "Si el email está registrado, vas a recibir un nuevo código" }`

---

### POST /auth/restablecer-password

Cambia la contraseña usando el **código** de `olvide-password`. Activa la cuenta
y limpia cualquier temporal pendiente. **No** devuelve token: después hay que
hacer `login`.

**Body**
```json
{
  "email": "agustin10boca@hotmail.com",
  "codigo": "048213",
  "nuevaPassword": "andres123"
}
```

- El código vence a los 15 minutos y es de un solo uso.
- 5 intentos fallidos lo invalidan: hay que pedir otro.

**200** `{ "ok": true, "mensaje": "Contraseña actualizada correctamente" }`

**Errores**

| Status | `error` |
|---|---|
| 400 | `email, codigo y nuevaPassword son obligatorios` |
| 400 | `Código inválido o vencido` (email inexistente, código incorrecto, vencido, usado o sin intentos) |

> Este endpoint hoy **no** valida el largo mínimo de `nuevaPassword`, a diferencia de
> `cambiar-password-inicial`.

---

## Variables de entorno

| Variable | Default | Uso |
|---|---|---|
| `JWT_SECRET` | `hovy-dev-secret-change-me` | Firma de los tokens |
| `JWT_EXPIRES_IN` | `8h` | Duración del token |
| `PASSWORD_TEMPORAL_TTL_HORAS` | `72` | Vencimiento de la contraseña temporal |
| `CODIGO_VERIFICACION_TTL_MIN` | `15` | Vencimiento del código de recuperación |
| `EMAIL_RATE_LIMIT_MAX` | `5` | Pedidos por ventana en endpoints que mandan mail |
| `EMAIL_RATE_LIMIT_WINDOW_MS` | `3600000` | Ventana del rate limit (1 h) |

## Destrabar un usuario en desarrollo

Si ningún admin puede entrar y no querés depender del mail:

1. Generar un hash desde `server/`:
   ```
   node -e "console.log(require('bcryptjs').hashSync('andres123', 10))"
   ```
2. En el SQL Editor de Supabase:
   ```sql
   UPDATE public.usuarios
   SET password_hash            = 'HASH_DEL_PASO_1',
       debe_cambiar_password    = false,
       password_temporal_expira = null,
       email_verificado         = true
   WHERE email = 'usuario@ejemplo.com';
   ```

Para conseguir un token de admin sin login (desde `server/`, así toma el `JWT_SECRET` del `.env`):
```
node --env-file=.env -e "console.log(require('jsonwebtoken').sign({sub:1,usuario:'hovy',rol:'admin'}, process.env.JWT_SECRET || 'hovy-dev-secret-change-me', {expiresIn:'1h'}))"
```
