#!/usr/bin/env node

/**
 * db-new-migration.mjs
 * Generador automático de migraciones SQL para desarrolladores de Hovy.
 *
 * Uso:
 *   npm run db:new agregar_campo_observacion
 *
 * Qué hace automáticamente:
 * 1. Calcula el siguiente número correlativo de 3 dígitos (ej. 010).
 * 2. Crea el archivo docs/migrations/010_agregar_campo_observacion.sql con plantilla idempotente.
 * 3. Registra automáticamente la nueva migración en docs/migrations/README.md para cumplir con CI.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const migrationsDir = path.join(rootDir, 'docs', 'migrations');
const readmePath = path.join(migrationsDir, 'README.md');

const rawName = process.argv.slice(2).join('_').trim();
if (!rawName) {
  console.error('❌ Uso: npm run db:new <nombre_descriptivo_de_la_migracion>');
  console.error('   Ejemplo: npm run db:new agregar_descuento_presupuesto');
  process.exit(1);
}

const cleanName = rawName
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

if (!cleanName) {
  console.error('❌ El nombre de la migración debe contener letras o números.');
  process.exit(1);
}

const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
let maxNum = 0;
for (const file of files) {
  const m = file.match(/^(\d{3})_/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n > maxNum) maxNum = n;
  }
}

const nextNum = maxNum + 1;
const prefix = String(nextNum).padStart(3, '0');
const fileName = `${prefix}_${cleanName}.sql`;
const filePath = path.join(migrationsDir, fileName);

const template = `-- =============================================================================
-- ${fileName}
-- Fecha de creación: ${new Date().toISOString().slice(0, 10)}
--
-- Reglas de idempotencia (Expand/Contract):
--   - Usá CREATE TABLE IF NOT EXISTS ...
--   - Usá ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
--   - Usá CREATE INDEX IF NOT EXISTS ...
-- =============================================================================

-- Escribí tus sentencias SQL idempotentes acá abajo:

`;

fs.writeFileSync(filePath, template, 'utf8');

// Actualizar docs/migrations/README.md automáticamente
if (fs.existsSync(readmePath)) {
  const readme = fs.readFileSync(readmePath, 'utf8');
  if (!readme.includes(fileName)) {
    const lines = readme.split(/\r?\n/);
    let lastMigrationLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\d+\.\s+\*\*`\d{3}_[a-zA-Z0-9_-]+\.sql`\*\*/.test(lines[i].trim())) {
        lastMigrationLineIdx = i;
      }
    }

    const newEntry = `${nextNum}. **\`${fileName}\`**: Migración \`${cleanName.replace(/_/g, ' ')}\`.`;
    if (lastMigrationLineIdx !== -1) {
      lines.splice(lastMigrationLineIdx + 1, 0, newEntry);
      fs.writeFileSync(readmePath, lines.join('\n'), 'utf8');
    }
  }
}

console.log(`✅ Migración creada exitosamente: docs/migrations/${fileName}`);
console.log(`📝 Documentada automáticamente en: docs/migrations/README.md`);
console.log(`💡 Próximo paso: editá el archivo SQL y luego corré 'npm run check' antes de abrir tu PR.`);
