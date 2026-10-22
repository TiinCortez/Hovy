import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeChecksum,
  discoverMigrations,
  planMigrations
} from '../../../scripts/db-migrate.mjs';
import { compareSchemas } from '../../../scripts/db-drift-check.mjs';

test('automatización BD: computeChecksum normaliza saltos de línea CRLF y LF de forma idéntica', () => {
  const sqlLf = 'ALTER TABLE public.turnos\nADD COLUMN IF NOT EXISTS nota TEXT;\n';
  const sqlCrlf = 'ALTER TABLE public.turnos\r\nADD COLUMN IF NOT EXISTS nota TEXT;\r\n';
  assert.equal(computeChecksum(sqlLf), computeChecksum(sqlCrlf));
});

test('automatización BD: discoverMigrations descubre archivos 001..009 en orden numérico y excluye 000', () => {
  const migrations = discoverMigrations();
  assert.ok(migrations.length >= 9, `Se esperaban al menos 9 migraciones aplicables, se encontraron ${migrations.length}`);
  assert.equal(migrations[0].version, '001');
  assert.equal(migrations.some(m => m.version === '000'), false);

  for (let i = 1; i < migrations.length; i++) {
    assert.ok(Number(migrations[i].version) > Number(migrations[i - 1].version));
  }
});

test('automatización BD: planMigrations identifica pendientes y respeta bootstrap-initial sin falso drift', () => {
  const sampleLocal = [
    { version: '001', name: '001_init.sql', checksum: 'aaa111', sql: 'SELECT 1;' },
    { version: '002', name: '002_users.sql', checksum: 'bbb222', sql: 'SELECT 2;' },
    { version: '003', name: '003_new.sql', checksum: 'ccc333', sql: 'SELECT 3;' }
  ];

  const appliedInDb = [
    { version: '001', name: '001_init.sql', checksum: 'bootstrap-initial' },
    { version: '002', name: '002_users.sql', checksum: 'bbb222' }
  ];

  const plan = planMigrations(sampleLocal, appliedInDb);
  assert.equal(plan.applied.length, 2);
  assert.equal(plan.pending.length, 1);
  assert.equal(plan.pending[0].version, '003');
  assert.equal(plan.driftWarnings.length, 0);
});

test('automatización BD: planMigrations detecta modificación ilegal de una migración ya aplicada', () => {
  const sampleLocal = [
    { version: '002', name: '002_users.sql', checksum: 'checksum_modificado', sql: 'SELECT 99;' }
  ];
  const appliedInDb = [
    { version: '002', name: '002_users.sql', checksum: 'checksum_original' }
  ];

  const plan = planMigrations(sampleLocal, appliedInDb);
  assert.equal(plan.driftWarnings.length, 1);
  assert.equal(plan.driftWarnings[0].version, '002');
});

test('automatización BD: compareSchemas detecta diferencias de tablas y columnas entre Staging y Producción', () => {
  const staging = {
    usuarios: ['id', 'email', 'rol'],
    presupuestos: ['id_presupuesto', 'monto_total', 'diferencia_ajuste'],
    tabla_solo_staging: ['id']
  };
  const prod = {
    usuarios: ['id', 'email', 'rol'],
    presupuestos: ['id_presupuesto', 'monto_total'],
    tabla_legado_prod: ['id']
  };

  const diff = compareSchemas(staging, prod);
  assert.equal(diff.identical.length, 1);
  assert.equal(diff.identical[0].table, 'usuarios');
  assert.deepEqual(diff.missingInProd, ['tabla_solo_staging']);
  assert.deepEqual(diff.extraInProd, ['tabla_legado_prod']);
  assert.equal(diff.columnDrifts.length, 1);
  assert.deepEqual(diff.columnDrifts[0].onlyInStaging, ['diferencia_ajuste']);
});
