-- Revierte TODO lo cargado por seed_demo_historico.sql (y la cadena de prueba del presupuesto 94).
-- Solo toca filas marcadas DEMO-SEED. Ejecutar en Supabase > SQL Editor.
BEGIN;
SET LOCAL session_replication_role = replica;
CREATE TEMP TABLE _p ON COMMIT DROP AS SELECT id_presupuesto FROM presupuestos WHERE nota='DEMO-SEED';
CREATE TEMP TABLE _t ON COMMIT DROP AS SELECT id_turno FROM turnos WHERE id_presupuesto IN (SELECT id_presupuesto FROM _p);
CREATE TEMP TABLE _w ON COMMIT DROP AS SELECT id_trabajo FROM trabajos_ejecutados WHERE id_turno IN (SELECT id_turno FROM _t);
DELETE FROM pagos WHERE id_trabajo IN (SELECT id_trabajo FROM _w);
DELETE FROM movimientos_cuenta WHERE id_trabajo IN (SELECT id_trabajo FROM _w) OR id_presupuesto IN (SELECT id_presupuesto FROM _p);
DELETE FROM trabajos_ejecutados WHERE id_trabajo IN (SELECT id_trabajo FROM _w);
DELETE FROM turnos WHERE id_turno IN (SELECT id_turno FROM _t);
DELETE FROM detalle_presupuesto WHERE id_presupuesto IN (SELECT id_presupuesto FROM _p);
DELETE FROM presupuestos WHERE id_presupuesto IN (SELECT id_presupuesto FROM _p);
COMMIT;
