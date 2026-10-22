#!/usr/bin/env node

/**
 * db-backup-https.mjs
 * Exportador de backup lógico y esquema OpenAPI por HTTPS IPv4 (100% compatible con Supabase Free Tier).
 * No requiere conexión directa al puerto 5432 ni el add-on pago de IPv4.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { loadEnvCredentials } from './db-migrate.mjs';

const CORE_TABLES = [
  'usuarios',
  'clientes',
  'inmuebles',
  'solicitudes_visita',
  'turnos',
  'presupuestos',
  'detalle_presupuesto',
  'servicios_catalogo',
  'usuario_servicio',
  'solicitud_servicio',
  'cobros_mercadopago',
  'cuentas_corrientes',
  'trabajos_ejecutados',
  'movimientos_cuenta',
  'pagos',
  'operarios',
  'schema_migrations'
];

async function main() {
  const { url, key } = loadEnvCredentials();
  if (!url || !key) {
    console.error('❌ Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para ejecutar el backup por HTTPS.');
    process.exit(1);
  }

  const outArg = process.argv.slice(2).find(a => !a.startsWith('--'));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = outArg || path.resolve(process.cwd(), `backup_https_${timestamp}.json.gz`);

  console.log(`📦 Iniciando backup lógico por HTTPS desde ${url}...`);
  const baseUrl = url.replace(/\/$/, '');

  // 1. Obtener definición OpenAPI de esquema
  const specRes = await fetch(`${baseUrl}/rest/v1/`, { headers: { apikey: key } });
  const openApiSpec = specRes.ok ? await specRes.json() : null;

  // 2. Exportar registros de las tablas operativas
  const snapshot = {
    metadata: {
      createdAt: new Date().toISOString(),
      supabaseUrl: baseUrl,
      tablesExported: []
    },
    schemaDefinitions: openApiSpec?.definitions || {},
    data: {}
  };

  for (const table of CORE_TABLES) {
    const res = await fetch(`${baseUrl}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json'
      }
    });

    if (res.ok) {
      const rows = await res.json();
      snapshot.data[table] = rows;
      snapshot.metadata.tablesExported.push({ table, rows: rows.length });
      console.log(`  ✅ ${table.padEnd(24)}: ${rows.length} fila(s)`);
    } else {
      console.warn(`  ⚠️  ${table.padEnd(24)}: omitida (${res.status})`);
    }
  }

  const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(snapshot, null, 2), 'utf8'));
  fs.writeFileSync(outPath, compressed);
  console.log(`🎉 Backup HTTPS comprimido guardado en: ${outPath} (${compressed.length} bytes)`);
}

main().catch(err => {
  console.error(`❌ Error generando backup HTTPS: ${err.message}`);
  process.exit(1);
});
