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
  km_aproximados: true,
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

// The database computes monto_estimado = monto_subtotal - descuento + recargo_logistico
// with a trigger, so the trip cost must travel in recargo_logistico.
const SIN_TRASLADO = {
  recargo_logistico: 0,
  monto_traslado: null,
  traslado_km: null,
  traslado_consumo_100km: null,
  traslado_precio_unidad: null,
  traslado_unidad: null,
  traslado_combustible: null,
  traslado_aproximado: null,
};

test('camposTrasladoPresupuesto: sin traslado limpia el recargo y la foto anterior', () => {
  assert.deepEqual(camposTrasladoPresupuesto({ incluido: false, motivo: 'sin_origen' }), SIN_TRASLADO);
  assert.deepEqual(camposTrasladoPresupuesto(null), SIN_TRASLADO);
});

test('camposTrasladoPresupuesto: con traslado manda el recargo y la foto completa', () => {
  assert.deepEqual(camposTrasladoPresupuesto(TRASLADO), {
    recargo_logistico: 2530.8,
    monto_traslado: 2530.8,
    traslado_km: 12,
    traslado_consumo_100km: 10,
    traslado_precio_unidad: 2109,
    traslado_unidad: 'l',
    traslado_combustible: 'YPF SUPER',
    traslado_aproximado: true,
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
  assert.equal(insert.recargo_logistico, 2530.8);
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

test('turno: sin traslado el recargo queda en 0 y no queda una foto vieja', async (t) => {
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
  assert.equal(insert.recargo_logistico, 0);
  assert.equal(insert.monto_traslado, null);
  assert.equal(insert.traslado_km, null);
  assert.equal(r.traslado.incluido, false);
});
