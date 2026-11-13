import test from 'node:test';
import assert from 'node:assert/strict';

// Isolated client: never uses the project's real credentials or database.
process.env.SUPABASE_URL = 'https://visita-confirmar-inmueble-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'visita-confirmar-inmueble-tests-sin-conexion';

const { supabaseAdmin } = await import('../config/supabase.js');
const { confirmarVisita } = await import('../services/visitaFlujoService.js');

const SOLICITUD_BASE = {
  id_solicitud: 30,
  estado: 'Contactada',
  telefono: '5493514330429',
  nombre: 'Lucas',
  apellido: 'Aguirre',
  direccion: 'Capitán Martel 1900',
  barrio: 'Centro',
  provincia: 'Córdoba',
  latitud: -31.4,
  longitud: -64.18,
  superficie_aproximada: 500,
  id_cliente: 42,
  id_inmueble: null,
};

// Fake supabaseAdmin.from: records every query; answers by "tabla:operacion".
const mockBase = (t, respuestas) => {
  const consultas = [];
  t.mock.method(supabaseAdmin, 'from', (tabla) => {
    const consulta = { tabla, ops: [] };
    consultas.push(consulta);
    const operacion = () => {
      for (const op of ['insert', 'update']) if (consulta.ops.some(([o]) => o === op)) return op;
      return 'select';
    };
    const resolver = () => {
      const valor = respuestas[`${tabla}:${operacion()}`];
      return typeof valor === 'function' ? valor(consulta) : (valor ?? { data: null, error: null });
    };
    const builder = {};
    for (const op of ['select', 'eq', 'is', 'in', 'limit', 'insert', 'update']) {
      builder[op] = (...args) => { consulta.ops.push([op, ...args]); return builder; };
    }
    builder.maybeSingle = () => Promise.resolve(resolver());
    builder.single = () => Promise.resolve(resolver());
    builder.then = (resolve, reject) => Promise.resolve(resolver()).then(resolve, reject);
    return builder;
  });
  return consultas;
};

const opDe = (consultas, tabla, op) =>
  consultas.find((c) => c.tabla === tabla && c.ops.some(([o]) => o === op));

const BODY = { tipo_inmueble: 'Lote Vacio', superficie_total: 420 };

test('confirmarVisita: una solicitud de cliente con inmueble ya cargado actualiza ese inmueble con la medida real', async (t) => {
  const consultas = mockBase(t, {
    'solicitudes_visita:select': { data: { ...SOLICITUD_BASE, id_inmueble: 7 }, error: null },
    'inmuebles:update': { data: { id_inmueble: 7, superficie_total: 420 }, error: null },
    'solicitudes_visita:update': (c) => ({ data: { ...SOLICITUD_BASE, ...c.ops.find(([o]) => o === 'update')[1] }, error: null }),
  });

  const resultado = await confirmarVisita(30, BODY);

  assert.equal(resultado.error, undefined);
  assert.equal(opDe(consultas, 'inmuebles', 'insert'), undefined, 'no crea un inmueble duplicado');
  const update = opDe(consultas, 'inmuebles', 'update');
  assert.deepEqual(update.ops.find(([o]) => o === 'update')[1], {
    tipo_inmueble: 'Lote Vacio',
    superficie_total: 420,
    superficie_mantenible: null,
    provincia: 'Córdoba',
  });
  assert.deepEqual(update.ops.filter(([o]) => o === 'eq'), [
    ['eq', 'id_inmueble', 7],
    ['eq', 'id_cliente', 42],
    ['eq', 'activo', true],
  ]);
  assert.equal(resultado.inmueble.id_inmueble, 7);
  const solicitudUpdate = opDe(consultas, 'solicitudes_visita', 'update').ops.find(([o]) => o === 'update')[1];
  assert.deepEqual(solicitudUpdate, { id_cliente: 42, id_inmueble: 7, estado: 'Confirmada' });
});

test('confirmarVisita: si el inmueble de la solicitud ya no es del cliente o fue dado de baja devuelve 409 y no confirma', async (t) => {
  const consultas = mockBase(t, {
    'solicitudes_visita:select': { data: { ...SOLICITUD_BASE, id_inmueble: 7 }, error: null },
    'inmuebles:update': { data: null, error: null },
  });

  const resultado = await confirmarVisita(30, BODY);

  assert.equal(resultado.error.status, 409);
  assert.equal(opDe(consultas, 'solicitudes_visita', 'update'), undefined);
});

test('confirmarVisita: una solicitud sin inmueble sigue creando uno nuevo (flujo de visita de siempre)', async (t) => {
  const consultas = mockBase(t, {
    'solicitudes_visita:select': { data: SOLICITUD_BASE, error: null },
    'inmuebles:insert': (c) => ({ data: { id_inmueble: 99, ...c.ops.find(([o]) => o === 'insert')[1] }, error: null }),
    'solicitudes_visita:update': (c) => ({ data: { ...SOLICITUD_BASE, ...c.ops.find(([o]) => o === 'update')[1] }, error: null }),
  });

  const resultado = await confirmarVisita(30, BODY);

  assert.equal(resultado.error, undefined);
  assert.equal(opDe(consultas, 'inmuebles', 'update'), undefined);
  assert.deepEqual(opDe(consultas, 'inmuebles', 'insert').ops.find(([o]) => o === 'insert')[1], {
    id_cliente: 42,
    direccion: 'Capitán Martel 1900',
    barrio: 'Centro',
    provincia: 'Córdoba',
    tipo_inmueble: 'Lote Vacio',
    superficie_total: 420,
    superficie_mantenible: null,
    latitud: -31.4,
    longitud: -64.18,
  });
  assert.equal(resultado.inmueble.id_inmueble, 99);
});
