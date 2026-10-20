# Runbook 03 — Schema Drift y Excepciones de Triggers SQL (P0001)

> **Severidad:** P2 (Alto)  
> **Objetivo MTTR:** < 10 minutos  
> **Responsable:** DevOps & SRE Lead (Aramayo, Leg. 410995)

---

## 1. Detección y Síntomas
- La API devuelve error `409 Conflict` con mensaje: `"Conflicto con las reglas de negocio de la base de datos"`.
- Los logs estructurados registran: `errorCode: 'P0001'` al intentar marcar un turno como `Realizado` o `Cancelado` desde la App Web o el Bot de WhatsApp (n8n).
- Comportamiento dispar entre el entorno de Staging y Producción.

---

## 2. Causa Raíz
El error `P0001` es emitido por los triggers PL/pgSQL de Supabase:
- `trg_turno_realizado` (función `fn_turno_realizado_cuenta_corriente`): falla si el turno no posee un presupuesto asociado con total imputable o cliente válido.
- `trg_turno_cancelado` (función `fn_turno_cancelado_cuenta_corriente`): falla si se intenta cancelar un turno que no cumple los estados de transición.

---

## 3. Diagnóstico y Mitigación

### A. Verificar si las migraciones están aplicadas
En Supabase SQL Editor de Producción o Staging, verificar la existencia de los triggers:
```sql
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_name IN ('trg_turno_realizado', 'trg_turno_cancelado');
```

### B. Aplicar la migración pendiente
Si la base de datos carece de estos triggers (por ejemplo tras clonar un entorno):
1. Abrir [`docs/migrations/008_triggers_cuenta_corriente.sql`](../migrations/008_triggers_cuenta_corriente.sql).
2. Ejecutar el script SQL completo en el SQL Editor del proyecto Supabase correspondiente.
3. Verificar que no haya arrojado errores de compilación PL/pgSQL.

### C. Correr el verificador Anti-Schema-Drift localmente
```bash
node scripts/verify-migrations.mjs
```
