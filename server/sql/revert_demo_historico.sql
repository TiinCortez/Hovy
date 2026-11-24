-- Revierte TODO lo cargado por seed_demo_historico.sql (y la cadena de prueba del presupuesto 94).
-- Solo toca filas marcadas DEMO-SEED. Ejecutar en Supabase > SQL Editor.
DO $$
BEGIN
  PERFORM set_config('session_replication_role','replica',true);
  DELETE FROM pagos WHERE id_trabajo IN (SELECT id_trabajo FROM trabajos_ejecutados WHERE observaciones='DEMO-SEED');
  DELETE FROM movimientos_cuenta WHERE id_presupuesto IN (SELECT id_presupuesto FROM presupuestos WHERE nota='DEMO-SEED');
  DELETE FROM trabajos_ejecutados WHERE observaciones='DEMO-SEED';
  DELETE FROM turnos WHERE id_presupuesto IN (SELECT id_presupuesto FROM presupuestos WHERE nota='DEMO-SEED');
  DELETE FROM detalle_presupuesto WHERE id_presupuesto IN (SELECT id_presupuesto FROM presupuestos WHERE nota='DEMO-SEED');
  DELETE FROM presupuestos WHERE nota='DEMO-SEED';
END $$;
