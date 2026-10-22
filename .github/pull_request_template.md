## Resumen

<!-- Qué hace este PR y a qué historia de Jira corresponde (ej: VAL-168 - Editar presupuesto) -->

**Jira:** VAL-XXX - Título de la historia

## Cambios principales

-

## Base de Datos y Migraciones

- [ ] No requiere cambios de base de datos, **O BIEN:**
- [ ] Creé la migración con `npm run db:new <nombre>` en `docs/migrations/` usando sentencias idempotentes (`IF NOT EXISTS`).

## Cómo se probó

-

## Checklist antes de pedir revisión

- [ ] Ejecuté `npm run check` en la raíz (verifica migraciones + lint + build cliente + tests servidor).
- [ ] El CI en GitHub está en verde.
- [ ] No se subieron archivos `.env` ni secretos.
- [ ] La rama se creó desde `develop` siguiendo GitFlow.
