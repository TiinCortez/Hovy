# Hovy — Sistema de Gestión Operativa para "Valle La Armonía"

Sistema web para la gestión operativa de la empresa de mantenimiento de espacios verdes: clientes, inmuebles, solicitudes, presupuestos, turnos, ejecución de servicios, cobros y fidelización.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite + React Router |
| Backend | Node.js + Express |
| Base de datos / Auth / Storage | Supabase (PostgreSQL + RLS) |
| CI/CD & DevSecOps | GitHub Actions + Docker + Azure VM + Cloudflare |

## Requisitos

- Node.js **22** (usar `.nvmrc`)
- Git
- Acceso al proyecto Supabase del equipo (pedir las variables al DevOps)

## Estructura del repo

```
Hovy/
├── client/           # Frontend React + Vite
├── server/           # Backend Express (API, seguridad e integraciones)
├── scripts/          # Herramientas DX, verificador y motor de migraciones SQL
├── infra/            # Infraestructura como Código (Nginx, hardening, monitoreo)
├── docs/             # GUIA_DESARROLLADORES.md, GITFLOW.md, migrations/, runbooks/
└── .github/          # Pipelines CI/CD, DevSecOps, CODEOWNERS y plantillas de PR
```

> 📖 **Lectura obligatoria para el equipo:** Mirá la [**Guía Oficial para Desarrolladores (`docs/GUIA_DESARROLLADORES.md`)**](docs/GUIA_DESARROLLADORES.md) para conocer todas las herramientas automatizadas, cómo crear migraciones SQL con `npm run db:new` y cómo pasar los 5 checks obligatorios de GitHub Actions.

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

# 3. Diagnosticar que tu entorno esté completo
npm run doctor

# 4. Levantar todo (client + server)
npm run dev

#   client → http://localhost:5173
#   server → http://localhost:4000
```

## Comandos rápidos de desarrollo y DevOps

| Comando | Descripción |
|---|---|
| `npm run doctor` | Diagnostica versión de Node, `node_modules` y variables faltantes en `server/.env`. |
| `npm run check` | **Escudo pre-PR:** corre verificador de migraciones + linter + build de React + 80 tests del backend. |
| `npm run db:new <nombre>` | Crea automáticamente la siguiente migración `.sql` correlativa y actualiza `docs/migrations/README.md`. |
| `npm run db:status` | Muestra qué migraciones SQL están aplicadas y cuáles están pendientes. |
| `npm run db:migrate` | Aplica automáticamente las migraciones SQL pendientes por HTTPS. |

## Cómo trabajar (resumen)

1. Traer lo último: `git checkout develop && git pull origin develop`
2. Diagnosticar entorno: `npm run doctor`
3. Crear rama de la historia: `git checkout -b feat/VAL-XXX-nombre-corto`
4. Si tocás base de datos: crear la migración con `npm run db:new nombre_cambio` (nunca tocar Supabase a mano sin su `.sql`)
5. Antes de subir cambios, validar todo localmente con **`npm run check`**
6. Abrir **PR a `develop`** (nunca a `main`) y esperar **CI verde + revisión de un compañero**

Reglas completas en [`docs/GUIA_DESARROLLADORES.md`](docs/GUIA_DESARROLLADORES.md) y [`docs/GITFLOW.md`](docs/GITFLOW.md).

## Documentación del proyecto

La documentación académica (estudio inicial, plan de proyecto, definición del producto, seguimiento) vive en la carpeta `documentacion/` del equipo.
