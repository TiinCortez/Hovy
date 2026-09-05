# Hovy — Sistema de Gestión Operativa para "Valle La Armonía"

Sistema web para la gestión operativa de la empresa de mantenimiento de espacios verdes: clientes, inmuebles, solicitudes, presupuestos, turnos, ejecución de servicios, cobros y fidelización.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite + React Router |
| Backend | Node.js + Express |
| Base de datos / Auth / Storage | Supabase (PostgreSQL + RLS) |
| CI/CD | GitHub Actions |

## Requisitos

- Node.js **22** (usar `.nvmrc`)
- Git
- Acceso al proyecto Supabase del equipo (pedir las variables al DevOps)

## Estructura del repo

```
Hovy/
├── client/           # Frontend React + Vite
├── server/           # Backend Express (API e integraciones)
├── docs/             # GITFLOW.md, ARQUITECTURA.md
└── .github/          # CI, plantilla de PR, dependabot
```

## Puesta en marcha (primera vez)

```bash
git clone https://github.com/TiinCortez/Hovy.git
cd Hovy

# 1. Variables de entorno (pedir valores al equipo)
cp client/.env.example client/.env
cp server/.env.example server/.env
#   → completar con las claves reales de Supabase

# 2. Dependencias
npm install                # scripts de raíz (concurrently)
npm run install:all        # instala client/ y server/

# 3. Levantar todo (client + server)
npm run dev

#   client → http://localhost:5173
#   server → http://localhost:4000
```

## Cómo trabajar (resumen)

1. Traer lo último: `git checkout develop && git pull origin develop`
2. Crear rama de la historia: `git checkout -b feat/US-XXX-nombre-corto`
3. Trabajar, commitear en pasos pequeños y pushear
4. Abrir **PR a `develop`** (nunca a `main`) y esperar **CI verde + revisión de un compañero**
5. El CI corre automáticamente: lint + build (client) y chequeo de sintaxis (server)

Reglas completas en [`docs/GITFLOW.md`](docs/GITFLOW.md).

## Documentación del proyecto

La documentación académica (estudio inicial, plan de proyecto, definición del producto, seguimiento) vive en la carpeta `documentacion/` del equipo.