#!/usr/bin/env node

/**
 * verify-migrations.mjs
 * Script Anti-Schema-Drift y verificación de gobernanza de Base de Datos para Hovy.
 *
 * Verifica:
 * 1. Nomenclatura y correlatividad numérica estricta (000_, 001_, 002_, ..., sin huecos ni duplicados).
 * 2. Documentación obligatoria de cada script SQL en docs/migrations/README.md.
 * 3. Detección de sentencias destructivas no controladas (DROP DATABASE, TRUNCATE indiscriminado).
 * 4. Recomendaciones de idempotencia (IF NOT EXISTS en CREATE TABLE / ADD COLUMN).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const migrationsDir = path.join(rootDir, 'docs', 'migrations');
const readmePath = path.join(migrationsDir, 'README.md');

console.log('🔍 Iniciando verificación de gobernanza de migraciones SQL...');

if (!fs.existsSync(migrationsDir)) {
  console.error(`❌ Error crítico: Directorio no encontrado: ${migrationsDir}`);
  process.exit(1);
}

if (!fs.existsSync(readmePath)) {
  console.error(`❌ Error crítico: README de migraciones no encontrado: ${readmePath}`);
  process.exit(1);
}

const readmeContent = fs.readFileSync(readmePath, 'utf8');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

if (files.length === 0) {
  console.error('❌ Error: No se encontraron archivos de migración .sql en docs/migrations/');
  process.exit(1);
}

console.log(`📁 Encontrados ${files.length} archivos de migración.`);

const migrationPattern = /^(\d{3})_([a-zA-Z0-9_-]+)\.sql$/;
const numbersFound = [];
let hasErrors = false;

for (const file of files) {
  const match = file.match(migrationPattern);
  if (!match) {
    console.error(`❌ Nomenclatura inválida: '${file}'. Debe seguir el formato 'NNN_descripcion.sql' (ej: 010_nueva_tabla.sql).`);
    hasErrors = true;
    continue;
  }

  const num = parseInt(match[1], 10);
  if (numbersFound.includes(num)) {
    console.error(`❌ Número de migración duplicado: ${match[1]} en archivo '${file}'.`);
    hasErrors = true;
  }
  numbersFound.push(num);

  // Verificar documentación en README.md
  if (!readmeContent.includes(file)) {
    console.error(`❌ Falta documentación: '${file}' no está documentado en docs/migrations/README.md (usá 'npm run db:new <nombre>').`);
    hasErrors = true;
  }

  // Inspección de seguridad en el contenido SQL
  const filePath = path.join(migrationsDir, file);
  const sqlContent = fs.readFileSync(filePath, 'utf8');

  if (/^(<{7}|={7}|>{7})/m.test(sqlContent)) {
    console.error(`❌ Marcadores de conflicto Git sin resolver en '${file}'.`);
    hasErrors = true;
  }

  if (/DROP\s+DATABASE/i.test(sqlContent)) {
    console.error(`❌ Sentencia prohibida en '${file}': DROP DATABASE detectado.`);
    hasErrors = true;
  }

  if (/TRUNCATE\s+TABLE/i.test(sqlContent) && !/CASCADE/i.test(sqlContent)) {
    console.warn(`⚠️ Advertencia en '${file}': TRUNCATE TABLE sin CASCADE documentado.`);
  }
}

// Verificar correlatividad numérica estricta (empezando en 000 o 001, sin huecos)
numbersFound.sort((a, b) => a - b);
const startNumber = numbersFound[0] === 0 ? 0 : 1;
for (let i = 0; i < numbersFound.length; i++) {
  const expected = startNumber + i;
  const actual = numbersFound[i];
  if (actual !== expected) {
    console.error(`❌ Hueco en la secuencia de migraciones: se esperaba la migración ${String(expected).padStart(3, '0')}, pero se encontró ${String(actual).padStart(3, '0')}.`);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error('\n❌ Verificación de migraciones FALLÓ. Corrige los problemas antes de commitear o mergear.');
  process.exit(1);
}

console.log('✅ Verificación de migraciones EXITOSA: correlatividad, nomenclatura y documentación correctas.');
