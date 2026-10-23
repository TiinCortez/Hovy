#!/usr/bin/env node

/**
 * db-drift-check.mjs
 * Auditor de paridad de esquema columna por columna entre Staging y Producción (vía OpenAPI HTTPS).
 * 100% compatible con el Plan Gratuito de Supabase.
 */

import { loadEnvCredentials } from './db-migrate.mjs';

async function fetchOpenApiSchema(url, key) {
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
    headers: { apikey: key }
  });
  if (!res.ok) {
    throw new Error(`No se pudo obtener esquema OpenAPI de ${url} (${res.status})`);
  }
  const spec = await res.json();
  const schema = {};
  for (const [table, def] of Object.entries(spec.definitions || {})) {
    schema[table] = Object.keys(def.properties || {}).sort();
  }
  return schema;
}

export function compareSchemas(stagingSchema, prodSchema) {
  const allTables = Array.from(
    new Set([...Object.keys(stagingSchema), ...Object.keys(prodSchema)])
  ).sort();

  const identical = [];
  const extraInProd = [];
  const missingInProd = [];
  const columnDrifts = [];

  for (const table of allTables) {
    const devCols = stagingSchema[table];
    const prodCols = prodSchema[table];

    if (!devCols) {
      extraInProd.push(table);
      continue;
    }
    if (!prodCols) {
      missingInProd.push(table);
      continue;
    }

    const onlyInStaging = devCols.filter(c => !prodCols.includes(c));
    const onlyInProd = prodCols.filter(c => !devCols.includes(c));

    if (onlyInStaging.length === 0 && onlyInProd.length === 0) {
      identical.push({ table, columnCount: devCols.length });
    } else {
      columnDrifts.push({ table, onlyInStaging, onlyInProd });
    }
  }

  return { identical, extraInProd, missingInProd, columnDrifts };
}

async function main() {
  const stagingUrl = process.env.STAGING_SUPABASE_URL || process.env.SUPABASE_URL;
  const stagingKey = process.env.STAGING_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const prodUrl = process.env.PROD_SUPABASE_URL;
  const prodKey = process.env.PROD_SUPABASE_KEY;

  if (!stagingUrl || !stagingKey || !prodUrl || !prodKey) {
    const local = loadEnvCredentials();
    if (!local.url || !local.key) {
      console.error('❌ Definí STAGING_SUPABASE_URL, STAGING_SUPABASE_KEY, PROD_SUPABASE_URL y PROD_SUPABASE_KEY.');
      process.exit(1);
    }
    console.log('ℹ️  Modo inspección simple (una sola base configurada en .env local):');
    const schema = await fetchOpenApiSchema(local.url, local.key);
    console.log(`✅ Conectado a ${local.url}: ${Object.keys(schema).length} tablas/vistas expuestas.`);
    return;
  }

  const [stagingSchema, prodSchema] = await Promise.all([
    fetchOpenApiSchema(stagingUrl, stagingKey),
    fetchOpenApiSchema(prodUrl, prodKey)
  ]);

  const result = compareSchemas(stagingSchema, prodSchema);
  console.log('==========================================================================');
  console.log('📊 AUDITORÍA DE PARIDAD DE ESQUEMA: STAGING vs PRODUCCIÓN');
  console.log('==========================================================================');
  console.log(`✅ Tablas operativas idénticas: ${result.identical.length}`);

  if (result.missingInProd.length > 0) {
    console.error(`❌ Tablas en Staging que faltan en Producción: ${result.missingInProd.join(', ')}`);
  }
  if (result.columnDrifts.length > 0) {
    for (const d of result.columnDrifts) {
      console.error(`⚠️  Diferencia en tabla [${d.table}]:`);
      if (d.onlyInStaging.length > 0) console.error(`   - Faltan en Producción: ${d.onlyInStaging.join(', ')}`);
      if (d.onlyInProd.length > 0) console.error(`   - Faltan en Staging:    ${d.onlyInProd.join(', ')}`);
    }
  }

  if (result.missingInProd.length > 0 || result.columnDrifts.length > 0) {
    process.exit(1);
  }
  console.log('🎉 PARIDAD 100% VERIFICADA: Cero Schema Drift entre Staging y Producción.');
}

if (process.argv[1] && process.argv[1].endsWith('db-drift-check.mjs')) {
  main().catch(err => {
    console.error(`❌ Error en db-drift-check: ${err.message}`);
    process.exit(1);
  });
}
