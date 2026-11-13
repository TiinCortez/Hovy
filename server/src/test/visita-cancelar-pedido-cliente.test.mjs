import test from 'node:test';
import assert from 'node:assert/strict';

// Isolated client: never uses the project's real credentials or database.
process.env.SUPABASE_URL = 'https://visita-cancelar-pedido-cliente-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'visita-cancelar-pedido-cliente-tests-sin-conexion';

const { supabaseAdmin } = await import('../config/supabase.js');
const { cancelarVisita } = await import('../services/presupuestoService.js');

// Fake supabaseAdmin.from: records every query; answers by "tabla:operacion".
const mockBase = (t, respuestas) => {
  const consultas = [];
  t.mock.method(supabaseAdmin, 'from', (tabla) => {
    const consulta = { tabla, ops: [] };
    consultas.push(consulta);
    const operacion = () => (consulta.ops.some(([o]) => o === 'update') ? 'update' : 'select');
    const resolver = () => {
      const valor = respuestas[`${tabla}:${operacion()}`];
      return typeof valor === 'function' ? valor(consulta) : (valor ?? { data: null, error: null });
    };
    const builder = {};
    for (const op of ['select', 'eq', 'update']) {
      builder[op] = (...args) => { consulta.ops.push([op, ...args]); return builder; };
    }
    builder.maybeSingle = () => Promise.resolve(resolver());
    return builder;
  });
  return consultas;
};

const updateDe = (consultas) =>
  consultas.find((c) => c.tabla === 'solicitudes_visita' && c.ops.some(([o]) => o === 'update'));

for (const estado of ['Pendiente', 'Contactada', 'Confirmada']) {
  test(`cancelarVisita: un pedido de cliente en ${estado} se puede cancelar`, async (t) => {
    const solicitud = { id_solicitud: 8, tipo_solicitud: 'cliente', estado };
    const consultas = mockBase(t, {
      'solicitudes_visita:select': { data: solicitud, error: null },
      'solicitudes_visita:update': { data: { ...solicitud, estado: 'Cancelada' }, error: null },
    });

    const resultado = await cancelarVisita(8);

    assert.equal(resultado.error, undefined);
    assert.equal(resultado.cancelada.estado, 'Cancelada');
    const update = updateDe(consultas);
    assert.deepEqual(update.ops.find(([o]) => o === 'update')[1], { estado: 'Cancelada' });
    // Race guard: only cancels if the row is still in the state that was read.
    assert.deepEqual(update.ops.filter(([o]) => o === 'eq'), [
      ['eq', 'id_solicitud', 8],
      ['eq', 'estado', estado],
    ]);
  });
}

for (const estado of ['Pendiente', 'Contactada']) {
  test(`cancelarVisita: una solicitud de contacto nuevo en ${estado} sigue sin poder cancelarse`, async (t) => {
    const consultas = mockBase(t, {
      'solicitudes_visita:select': { data: { id_solicitud: 9, tipo_solicitud: 'nuevo', estado }, error: null },
    });

    const resultado = await cancelarVisita(9);

    assert.equal(resultado.error.status, 409);
    assert.equal(updateDe(consultas), undefined);
  });
}

test('cancelarVisita: una solicitud de contacto nuevo Confirmada se sigue cancelando', async (t) => {
  const solicitud = { id_solicitud: 10, tipo_solicitud: 'nuevo', estado: 'Confirmada' };
  mockBase(t, {
    'solicitudes_visita:select': { data: solicitud, error: null },
    'solicitudes_visita:update': { data: { ...solicitud, estado: 'Cancelada' }, error: null },
  });

  const resultado = await cancelarVisita(10);

  assert.equal(resultado.cancelada.estado, 'Cancelada');
});

test('cancelarVisita: un pedido de cliente ya Cancelada devuelve 409', async (t) => {
  const consultas = mockBase(t, {
    'solicitudes_visita:select': { data: { id_solicitud: 11, tipo_solicitud: 'cliente', estado: 'Cancelada' }, error: null },
  });

  const resultado = await cancelarVisita(11);

  assert.equal(resultado.error.status, 409);
  assert.equal(updateDe(consultas), undefined);
});
