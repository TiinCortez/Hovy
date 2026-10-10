import test from 'node:test';
import assert from 'node:assert/strict';

// Cliente aislado: nunca usa las credenciales ni la base real del proyecto.
process.env.SUPABASE_URL = 'https://abmc-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'abmc-tests-sin-conexion';
const { supabaseAdmin } = await import('../config/supabase.js');
const { createTurno, updateTurno } = await import('../controllers/turnosController.js');

const actual = {
  id_turno: 7, fecha_programada: '2026-10-06', inicio_desde: '10:00:00', hasta: '11:00:00',
  estado: 'Coordinado', prioridad: 'P2_Fijo'
};

function preparar(t, { registro = actual, choque = false } = {}) {
  const consultas = [];
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-06T15:00:00Z').getTime() });
  t.mock.method(globalThis, 'fetch', () => { throw new Error('La prueba no permite conexiones de red.'); });
  t.mock.method(supabaseAdmin, 'from', (tabla) => {
    assert.equal(tabla, 'turnos');
    const consulta = { filtros: [] };
    consultas.push(consulta);
    const resultado = () => ({ data: choque ? [{ id_turno: 9 }] : [], error: null });
    const query = {
      select(campos) { consulta.campos = campos; return this; },
      insert(payload) { consulta.insert = payload; return this; },
      update(payload) { consulta.update = payload; return this; },
      eq(...args) { consulta.filtros.push(['eq', ...args]); return this; },
      neq(...args) { consulta.filtros.push(['neq', ...args]); return this; },
      not(...args) { consulta.filtros.push(['not', ...args]); return this; },
      lt(...args) { consulta.filtros.push(['lt', ...args]); return this; },
      gt(...args) { consulta.filtros.push(['gt', ...args]); return this; },
      maybeSingle() { return Promise.resolve({ data: registro, error: null }); },
      single() { return Promise.resolve({ data: { ...registro, ...consulta.update, ...consulta.insert }, error: null }); },
      then(resolve, reject) { return Promise.resolve(resultado()).then(resolve, reject); }
    };
    return query;
  });
  const res = {
    codigo: 200,
    status(codigo) { this.codigo = codigo; return this; },
    json(body) { this.body = body; return this; }
  };
  return { consultas, res };
}

test('el alta rechaza horarios pasados y conflictos sin escribir en la base', async (t) => {
  const { consultas, res } = preparar(t, { choque: true });
  const body = { id_inmueble: 1, fecha_programada: '2026-10-06', inicio_desde: '10:00', hasta: '11:00', prioridad: 'P2_FIJO' };
  await createTurno({ body }, res);
  assert.equal(res.codigo, 400);
  assert.equal(consultas.length, 0);
  await createTurno({ body: { ...body, inicio_desde: '14:00', hasta: '16:00' } }, res);
  assert.equal(res.codigo, 409);
  assert.equal(consultas.some((consulta) => consulta.insert), false);
});

test('el alta usa la consulta existente de superposición y admite una franja libre', async (t) => {
  const { consultas, res } = preparar(t);
  await createTurno({ body: { id_inmueble: 1, fecha_programada: '2026-10-07', inicio_desde: '13:00', hasta: '15:00', prioridad: 'P2_FIJO' } }, res);
  assert.equal(res.codigo, 201);
  assert.ok(consultas[0].filtros.some((filtro) => filtro[0] === 'neq' && filtro[1] === 'estado' && filtro[2] === 'Cancelado'));
  assert.equal(consultas.find((consulta) => consulta.insert).insert.inicio_desde, '13:00');
});

test('reprogramar rechaza horas pasadas sin modificar el registro', async (t) => {
  const { consultas, res } = preparar(t);
  await updateTurno({ params: { id: '7' }, body: { inicio_desde: '09:00', hasta: '10:00' } }, res);
  assert.equal(res.codigo, 400);
  assert.equal(consultas.some((consulta) => consulta.update), false);
});

test('reprogramar detecta conflictos excluyendo el propio turno', async (t) => {
  const { consultas, res } = preparar(t, { choque: true });
  await updateTurno({ params: { id: '7' }, body: { fecha_programada: '2026-10-07' } }, res);
  assert.equal(res.codigo, 409);
  assert.ok(consultas.some((consulta) => consulta.filtros.some((filtro) => filtro[0] === 'neq' && filtro[1] === 'id_turno' && filtro[2] === '7')));
  assert.equal(consultas.some((consulta) => consulta.update), false);
});

test('cambiar el estado de un turno pasado conserva la agenda y acepta HH:MM o HH:MM:SS', async (t) => {
  const { consultas, res } = preparar(t);
  await updateTurno({ params: { id: '7' }, body: { fecha_programada: actual.fecha_programada, inicio_desde: '10:00', hasta: '11:00', estado: 'REALIZADO' } }, res);
  assert.equal(res.codigo, 200);
  assert.equal(consultas.length, 2);
  assert.equal(consultas[1].update.estado, 'Realizado');
  assert.equal(consultas[1].update.fecha_programada, actual.fecha_programada);
});

test('un turno sin horario puede cambiar de estado y luego recibir una franja futura', async (t) => {
  const registro = { ...actual, inicio_desde: null, hasta: null };
  const { consultas, res } = preparar(t, { registro });
  await updateTurno({ params: { id: '7' }, body: { estado: 'CONFIRMADO' } }, res);
  assert.equal(res.codigo, 200);
  assert.equal(consultas[1].update.inicio_desde, null);
  await updateTurno({ params: { id: '7' }, body: { inicio_desde: '14:00', hasta: '16:00' } }, res);
  assert.equal(res.codigo, 200);
  assert.equal(res.body.data.franjaHoraria.horaInicio, '14:00');
});

test('la modificación responde 404 si el turno dejó de existir', async (t) => {
  const { consultas, res } = preparar(t, { registro: null });
  await updateTurno({ params: { id: '7' }, body: { estado: 'CONFIRMADO' } }, res);
  assert.equal(res.codigo, 404);
  assert.equal(consultas.some((consulta) => consulta.update), false);
});
