#!/usr/bin/env node

/**
 * db-migrate.mjs
 * Ejecutor de migraciones SQL 100% automático para Hovy (Compatible con Supabase Free Tier sobre HTTPS IPv4).
 *
 * Modos de uso:
 *   node scripts/db-migrate.mjs --status     Muestra el estado de migraciones aplicadas y pendientes
 *   node scripts/db-migrate.mjs --dry-run    Muestra qué migraciones se aplicarían sin ejecutarlas
 *   node scripts/db-migrate.mjs --apply      Aplica en orden estricto las migraciones pendientes
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const defaultMigrationsDir = path.join(rootDir, 'docs', 'migrations');

export function computeChecksum(content) {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

export function loadEnvCredentials(baseDir = rootDir) {
  let url = process.env.SUPABASE_URL || '';
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (url && key) return { url, key };

  const candidates = [
    path.join(baseDir, 'server', '.env'),
    path.join(baseDir, '.env')
  ];

  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const k = trimmed.slice(0, idx).trim();
      let v = trimmed.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (k === 'SUPABASE_URL' && !url) url = v;
      if (k === 'SUPABASE_SERVICE_ROLE_KEY' && !key) key = v;
    }
  }

  return { url, key };
}

export function discoverMigrations(migrationsDir = defaultMigrationsDir) {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Directorio de migraciones no encontrado: ${migrationsDir}`);
  }

  const pattern = /^(\d{3})_([a-zA-Z0-9_-]+)\.sql$/;
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  const migrations = [];

  for (const file of files) {
    const match = file.match(pattern);
    if (!match) continue;
    const version = match[1];
    // 000 es el script de bootstrap del motor RPC en sí mismo
    if (version === '000') continue;

    const fullPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(fullPath, 'utf8');
    const checksum = computeChecksum(sql);

    migrations.push({
      version,
      name: file,
      checksum,
      sql
    });
  }

  return migrations.sort((a, b) => Number(a.version) - Number(b.version));
}

export function planMigrations(localMigrations, appliedRows = []) {
  const appliedMap = new Map(appliedRows.map(r => [String(r.version), r]));
  const applied = [];
  const pending = [];
  const driftWarnings = [];

  for (const mig of localMigrations) {
    const existing = appliedMap.get(mig.version);
    if (existing) {
      applied.push({ ...mig, applied_at: existing.applied_at });
      if (
        existing.checksum &&
        existing.checksum !== 'bootstrap-initial' &&
        existing.checksum !== mig.checksum
      ) {
        driftWarnings.push({
          version: mig.version,
          name: mig.name,
          expectedChecksum: existing.checksum,
          currentChecksum: mig.checksum
        });
      }
    } else {
      pending.push(mig);
    }
  }

  return { applied, pending, driftWarnings };
}

async function fetchAppliedMigrations(url, key) {
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/schema_migrations?select=version,name,checksum,applied_at&order=version.asc`;
  const res = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json'
    }
  });

  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(`Error consultando schema_migrations (${res.status}): ${errText}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

async function executeMigrationRpc(url, key, mig) {
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/rpc/exec_migration`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      p_version: mig.version,
      p_name: mig.name,
      p_checksum: mig.checksum,
      p_sql: mig.sql
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Fallo al aplicar migración ${mig.name} (${res.status}): ${errText}`);
  }

  return res.json();
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--status')
    ? 'status'
    : args.includes('--dry-run')
      ? 'dry-run'
      : 'apply';

  const { url, key } = loadEnvCredentials();
  if (!url || !key) {
    console.error('❌ Error: Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno o en server/.env.');
    process.exit(1);
  }

  console.log(`🗄️  Conectando al motor de migraciones en: ${url}`);
  const localMigrations = discoverMigrations();

  let appliedRows;
  try {
    appliedRows = await fetchAppliedMigrations(url, key);
  } catch (err) {
    console.error(`❌ No se pudo leer la tabla public.schema_migrations: ${err.message}`);
    console.error('💡 Ejecutá primero docs/migrations/000_motor_migraciones_automaticas.sql en el SQL Editor de Supabase.');
    process.exit(1);
  }

  const { applied, pending, driftWarnings } = planMigrations(localMigrations, appliedRows);

  console.log(`📊 Resumen: ${applied.length} aplicadas | ${pending.length} pendientes | ${localMigrations.length} totales`);

  if (driftWarnings.length > 0) {
    console.error('❌ Se detectaron archivos de migración ya aplicados cuyo contenido fue modificado:');
    for (const w of driftWarnings) {
      console.error(`   - [${w.version}] ${w.name}: checksum en BD (${w.expectedChecksum.slice(0, 10)}...) != archivo (${w.currentChecksum.slice(0, 10)}...)`);
    }
    console.error('🔒 Regla de inmutabilidad: nunca modifiques una migración ya aplicada; creá una nueva con npm run db:new.');
    process.exit(1);
  }

  if (mode === 'status') {
    for (const m of applied) {
      console.log(`  ✅ [${m.version}] ${m.name} (aplicada)`);
    }
    for (const m of pending) {
      console.log(`  ⏳ [${m.version}] ${m.name} (PENDIENTE)`);
    }
    return;
  }

  if (pending.length === 0) {
    console.log('✅ La base de datos está 100% al día. No hay migraciones pendientes.');
    return;
  }

  if (mode === 'dry-run') {
    console.log('🧪 [DRY-RUN] Se aplicarían en orden las siguientes migraciones:');
    for (const m of pending) {
      console.log(`  ➡️  [${m.version}] ${m.name} (SHA-256: ${m.checksum.slice(0, 12)}...)`);
    }
    return;
  }

  console.log(`🚀 Aplicando ${pending.length} migración(es) pendiente(s) en transacción atómica...`);
  for (const mig of pending) {
    process.stdout.write(`  ⏳ Aplicando [${mig.version}] ${mig.name}... `);
    const result = await executeMigrationRpc(url, key, mig);
    console.log(`✅ OK (${result?.status || 'applied'})`);
  }

  console.log('🎉 Todas las migraciones pendientes se aplicaron con éxito.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch(err => {
    console.error(`❌ Error fatal en db-migrate: ${err.message}`);
    process.exit(1);
  });
}
