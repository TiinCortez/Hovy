#!/usr/bin/env node

/**
 * verify-migrations.mjs
 * Script Anti-Schema-Drift y verificación de gobernanza de Base de Datos para Hovy.
 * 
 * Verifica:
 * 1. Nomenclatura y correlatividad numérica estricta (001_, 002_, ..., sin huecos ni duplicados).
 * 2. Documentación obligatoria de cada script SQL en docs/migrations/README.md.
 * 3. Detección de sentencias destructivas no controladas (DROP DATABASE, TRUNCATE indiscriminado).
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
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

if (files.length === 0) {
  console.error('❌ Error: No se encontraron archivos de migración .sql en docs/migrations/');
  process.exit(1);
}

console.log(`📁 Encontrados ${files.length} archivos de migración.`);

const migrationPattern = /^(\d{3})_([a-zA-Z0-9_\-]+)\.sql$/;
const numbersFound = [];
let hasErrors = false;

for (const file of files) {
  const match = file.match(migrationPattern);
  if (!match) {
    console.error(`❌ Nomenclatura inválida: '${file}'. Debe seguir el formato 'NNN_descripcion.sql' (ej: 001_initial.sql).`);
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
    console.error(`❌ Falta documentación: '${file}' no está documentado en docs/migrations/README.md.`);
    hasErrors = true;
  }

  // Inspección de seguridad en el contenido SQL
  const filePath = path.join(migrationsDir, file);
  const sqlContent = fs.readFileSync(filePath, 'utf8');

  if (/DROP\s+DATABASE/i.test(sqlContent)) {
    console.error(`❌ Sentencia prohibida en '${file}': DROP DATABASE detectado.`);
    hasErrors = true;
  }

  if (/TRUNCATE\s+TABLE/i.test(sqlContent) && !/CASCADE/i.test(sqlContent)) {
    console.warn(`⚠️ Advertencia en '${file}': TRUNCATE TABLE sin CASCADE documentado.`);
  }
}

// Verificar correlatividad numérica estricta (1, 2, 3, ...)
numbersFound.sort((a, b) => a - b);
for (let i = 0; i < numbersFound.length; i++) {
  const expected = i + 1;
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
