# Arquitectura de Hovy

> Resumen ejecutivo para el equipo. Versión: Sprint 0 (septiembre 2026).

## Visión general

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  client (React + Vite)      │        │  server (Node + Express)     │
│  · Interfaz del Jefe (PWA)  │  HTTP  │  · API /api/*                │
│  · Formulario del cliente   │ ─────▶ │  · Integraciones externas    │
│  · Caché local (offline)    │        │    (WhatsApp, Mercado Pago,  │
└──────────────┬──────────────┘        │     clima, mapas, ARCA)      │
               │ supabase-js (anon)    └──────────────┬───────────────┘
               ▼                                      │ supabase-js (service)
        ┌─────────────────────────────────────────────▼────────────────┐
        │                    Supabase (cloud)                          │
        │  · PostgreSQL (datos del negocio) + RLS                      │
        │  · Auth (login Jefe, recuperar contraseña)                   │
        │  · Storage (fotos de evidencia de servicios)                 │
        │  · Realtime (notificaciones/alertas)                         │
        └─────────────────────────────────────────────────────────────┘
```

## Principios

1. **El cliente nunca ve el precio** hasta que el Jefe lo comunica (regla central del negocio). El frontend del cliente solo muestra el formulario de solicitud.
2. **Offline-first (PWA):** el Jefe opera en el campo sin señal. La app guarda localmente (IndexedDB + cola de operaciones) y sincroniza cuando vuelve la conexión. La capa de sync se diseña como módulo propio.
3. **Seguridad por RLS:** cada tabla de Supabase tiene Row Level Security habilitado. El frontend usa la **anon key** (pública pero limitada por RLS). La **service key** vive SOLO en el server, para tareas de administración e integraciones.
4. **El operario no tiene interfaz** — todo se gestiona desde la vista del Jefe.

## Flujo de datos típico (ej: registrar cliente)

```
Jefe → client (formulario) → supabase-js (anon key) → INSERT en tabla clientes
      → RLS valida que el usuario autenticado pueda insertar → OK
      → el server NO interviene en CRUD simple (solo integraciones)
```

## Reglas de negocio que condicionan la arquitectura

- Solo un presupuesto **aprobado** genera un turno.
- La verificación de pagos es **manual** (botón "Pagado"); la automática es opcional.
- El sistema **solo sugiere** asignaciones/reasignaciones; la decisión final es del Jefe.
- Integraciones externas (WhatsApp, Mercado Pago, clima, mapas, ARCA) se desarrollan con **mocks** hasta el Sprint 6.

## Decisiones registradas (ADR-lite)

| Fecha | Decisión | Estado |
|---|---|---|
| 2026-09 | Supabase cloud (plan free) para desarrollo local del equipo | ✅ activa |
| 2026-09 | Producción: Cloud Pro vs self-hosted en VPS | ⏳ pendiente (no bloquea el desarrollo) |
| 2026-09 | Node 22 como versión única del equipo (`.nvmrc`) | ✅ activa |
| 2026-09 | CI obligatorio (lint + build) antes de mergear a develop | ✅ activa |

## Deuda técnica conocida (se atiende en próximos sprints)

- CORS abierto (`app.use(cors())`) → restringir a dominio propio en producción.
- Endpoint `GET /api/clientes` sin autenticación → proteger con auth + RLS.
- Esquema de BD sin migraciones versionadas → `supabase db pull` + carpeta `supabase/migrations/`.
- Rotar service role key (fue compartida por chat).
- Sin tests automatizados → preparar vitest cuando el equipo arranque a testear.