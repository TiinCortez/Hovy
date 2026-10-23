import test from 'node:test';
import assert from 'node:assert/strict';

// Isolated client: these tests never touch the real project database.
process.env.SUPABASE_URL = 'https://presupuesto-traslado-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'presupuesto-traslado-tests-sin-conexion';
const { supabaseAdmin } = await import('../config/supabase.js');
const { guardarPresupuestoParaTurno } = await import('../services/presupuestoService.js');
const { camposTrasladoPresupuesto } = await import('../services/trasladoService.js');

const TRASLADO = {
  incluido: true,
  km: 12,
  costo: 2530.8,
  consumo_100km: 10,
  precio_unidad: 2109,
  unidad: 'l',
  combustible: 'YPF SUPER',
  tramos: 1,
};

// Minimal stand-in for the tables the budget touches.
const preparar = (t) => {
  const consultas = [];
  t.mock.method(supabaseAdmin, 'from', (tabla) => {
    const consulta = { tabla };
    consultas.push(consulta);
    const query = {
      select() { return this; },
      insert(payload) { consulta.insert = payload; return this; },
      update(payload) { consulta.update = payload; return this; },
      delete() { return this; },
      eq() { return this; },
      maybeSingle() {
        if (tabla === 'inmuebles') {
          return Promise.resolve({ data: { id_inmueble: 1, id_cliente: 10, superficie_mantenible: 120, superficie_total: 150 }, error: null });
        }
        return Promise.resolve({
          data: { id_servicio: 2, precio_base: 500, activo: true, servicio: { nombre: 'Corte' } },
          error: null,
        });
      },
      single() {
        return Promise.resolve({ data: { id_presupuesto: 42, ...consulta.insert }, error: null });
      },
      then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); },
    };
    return query;
  });
  return consultas;
};

const insertPresupuesto = (consultas) =>
  consultas.find((c) => c.tabla === 'presupuestos' && c.insert).insert;

test('camposTrasladoPresupuesto: vacio cuando el traslado no se incluyo', () => {
  assert.deepEqual(camposTrasladoPresupuesto({ incluido: false, motivo: 'sin_origen' }), {});
  assert.deepEqual(camposTrasladoPresupuesto(null), {});
});

test('camposTrasladoPresupuesto: foto completa cuando se incluyo', () => {
  assert.deepEqual(camposTrasladoPresupuesto(TRASLADO), {
    monto_traslado: 2530.8,
    traslado_km: 12,
    traslado_consumo_100km: 10,
    traslado_precio_unidad: 2109,
    traslado_unidad: 'l',
    traslado_combustible: 'YPF SUPER',
  });
});

test('turno: el traslado se suma al estimado y al total, y se guarda la foto', async (t) => {
  const consultas = preparar(t);
  const r = await guardarPresupuestoParaTurno({
    idInmueble: 1,
    idServicio: 2,
    idUsuario: 1,
    calcularTrasladoFn: async () => TRASLADO,
  });
  const insert = insertPresupuesto(consultas);
  assert.equal(r.error, undefined);
  assert.equal(insert.monto_subtotal, 60000);
  assert.equal(insert.monto_estimado, 62530.8);
  assert.equal(insert.monto_total, 62530.8);
  assert.equal(insert.monto_traslado, 2530.8);
  assert.equal(insert.traslado_combustible, 'YPF SUPER');
  assert.equal(r.traslado.costo, 2530.8);
});

test('turno: el valor final que el jefe edita manda, el estimado conserva el traslado', async (t) => {
  const consultas = preparar(t);
  await guardarPresupuestoParaTurno({
    idInmueble: 1,
    idServicio: 2,
    idUsuario: 1,
    montoTotal: 65000,
    calcularTrasladoFn: async () => TRASLADO,
  });
  const insert = insertPresupuesto(consultas);
  assert.equal(insert.monto_total, 65000);
  assert.equal(insert.monto_estimado, 62530.8);
});

test('turno: sin traslado el presupuesto queda como antes y no escribe columnas nuevas', async (t) => {
  const consultas = preparar(t);
  const r = await guardarPresupuestoParaTurno({
    idInmueble: 1,
    idServicio: 2,
    idUsuario: 1,
    calcularTrasladoFn: async () => ({ incluido: false, motivo: 'sin_origen' }),
  });
  const insert = insertPresupuesto(consultas);
  assert.equal(insert.monto_estimado, 60000);
  assert.equal(insert.monto_total, 60000);
  assert.equal('monto_traslado' in insert, false);
  assert.equal('traslado_km' in insert, false);
  assert.equal(r.traslado.incluido, false);
});
