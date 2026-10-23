#!/usr/bin/env node

/**
 * doctor.mjs
 * Diagnóstico rápido del entorno local para los desarrolladores de Hovy (`npm run doctor`).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🩺 Ejecutando diagnóstico de entorno Hovy (Doctor)...\n');
let warnings = 0;
let errors = 0;

// 1. Versión de Node.js
const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
if (nodeMajor >= 20) {
  console.log(`✅ Node.js v${process.versions.node} (compatible)`);
} else {
  console.error(`❌ Node.js v${process.versions.node} es demasiado antiguo. Se requiere Node 20 o 22.`);
  errors++;
}

// 2. Dependencias instaladas
for (const sub of ['server', 'client']) {
  const nm = path.join(rootDir, sub, 'node_modules');
  if (fs.existsSync(nm)) {
    console.log(`✅ Dependencias instaladas en ${sub}/node_modules`);
  } else {
    console.error(`❌ Faltan dependencias en ${sub}/. Ejecutá 'npm run install:all'.`);
    errors++;
  }
}

// 3. Variables de entorno en server/.env vs server/.env.example
const envExamplePath = path.join(rootDir, 'server', '.env.example');
const envPath = path.join(rootDir, 'server', '.env');
const requiredKeys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'];

if (!fs.existsSync(envPath)) {
  console.warn('⚠️  No existe server/.env. Copiá server/.env.example a server/.env para correr el backend localmente.');
  warnings++;
} else {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const definedKeys = new Set(
    envContent
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#') && l.includes('='))
      .map(l => l.split('=')[0].trim())
  );

  const missingReq = requiredKeys.filter(k => !definedKeys.has(k));
  if (missingReq.length === 0) {
    console.log(`✅ server/.env contiene todas las variables obligatorias (${requiredKeys.join(', ')})`);
  } else {
    console.error(`❌ Faltan variables obligatorias en server/.env: ${missingReq.join(', ')}`);
    errors++;
  }

  if (fs.existsSync(envExamplePath)) {
    const exampleKeys = fs
      .readFileSync(envExamplePath, 'utf8')
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#') && l.includes('='))
      .map(l => l.split('=')[0].trim());

    const missingOptional = exampleKeys.filter(k => !definedKeys.has(k));
    if (missingOptional.length > 0) {
      console.log(`ℹ️  Variables opcionales no definidas en server/.env: ${missingOptional.join(', ')}`);
    }
  }
}

console.log('\n--------------------------------------------------');
if (errors > 0) {
  console.error(`❌ Diagnóstico finalizado con ${errors} error(es) y ${warnings} advertencia(s).`);
  process.exit(1);
}
console.log(`🎉 Entorno saludable (${warnings} advertencias). Listo para desarrollar.`);
