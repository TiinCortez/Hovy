import test from 'node:test';
import assert from 'node:assert/strict';

// Isolated client: these tests never touch the real project database.
process.env.SUPABASE_URL = 'https://bot-qr-turno-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'bot-qr-turno-sin-conexion';
process.env.MERCADOPAGO_PUBLIC_BASE_URL = 'https://hovy.example.com';

const { supabaseAdmin } = await import('../config/supabase.js');
const { qrTurnoStaff } = await import('../controllers/botStaffController.js');
const { crearCobroDeTurno } = await import('../integrations/mercadopago/cobros/cobrosService.js');

const res = () => ({
  codigo: 200,
  cabeceras: {},
  status(codigo) { this.codigo = codigo; return this; },
  json(body) { this.body = body; return this; },
  set(cabeceras) { this.cabeceras = cabeceras; return this; },
  send(cuerpo) { this.cuerpo = cuerpo; return this; },
});

// Stand-in for the tables read to decide how much a turno owes.
const simular = (t, { turno = null, activos = [], movimientos = [], presupuesto = null } = {}) => {
  const lecturas = [];
  t.mock.method(supabaseAdmin, 'from', (tabla) => {
    lecturas.push(tabla);
    const query = {
      select() { return this; },
      eq() { return this; },
      in() { return this; },
      limit() { return this; },
      maybeSingle() {
        if (tabla === 'turnos') return Promise.resolve({ data: turno, error: null });
        if (tabla === 'presupuestos') return Promise.resolve({ data: presupuesto, error: null });
        return Promise.resolve({ data: null, error: null });
      },
      then(resolve, reject) {
        const data = tabla === 'cobros_mercadopago' ? activos
          : tabla === 'movimientos_cuenta' ? movimientos
            : [];
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return query;
  });
  return lecturas;
};

test('bot QR: un id de turno invalido es un 400 y no consulta la base', async (t) => {
  const lecturas = simular(t);
  const r = res();
  await qrTurnoStaff({ params: { id: 'abc' }, usuario: { id: 4 } }, r);
  assert.equal(r.codigo, 400);
  assert.equal(lecturas.length, 0);
});

test('bot QR: un turno inexistente es un 404', async (t) => {
  simular(t, { turno: null });
  const r = res();
  await qrTurnoStaff({ params: { id: '99' }, usuario: { id: 4 } }, r);
  assert.equal(r.codigo, 404);
});

test('bot QR: un turno que no esta Realizado es un 409 que dice el estado', async (t) => {
  simular(t, { turno: { id_turno: 12, estado: 'Coordinado', cobrado: false, id_presupuesto: null, inmueble: { id_cliente: 3 } } });
  const r = res();
  await qrTurnoStaff({ params: { id: '12' }, usuario: { id: 4 } }, r);
  assert.equal(r.codigo, 409);
  assert.match(r.body.error, /Realizado/);
  assert.match(r.body.error, /Coordinado/);
});

test('bot QR: un turno ya cobrado es un 409', async (t) => {
  simular(t, { turno: { id_turno: 12, estado: 'Realizado', cobrado: true, id_presupuesto: null, inmueble: { id_cliente: 3 } } });
  const r = res();
  await qrTurnoStaff({ params: { id: '12' }, usuario: { id: 4 } }, r);
  assert.equal(r.codigo, 409);
  assert.match(r.body.error, /ya fue cobrado/);
});

test('bot QR: ya no genera el QR provisorio con el id del turno', async (t) => {
  simular(t, { turno: { id_turno: 12, estado: 'Realizado', cobrado: true, id_presupuesto: null, inmueble: { id_cliente: 3 } } });
  const r = res();
  await qrTurnoStaff({ params: { id: '12' }, usuario: { id: 4 } }, r);
  assert.equal(r.cuerpo, undefined);
  const turnosBot = await import('../utils/turnosBot.js');
  assert.equal('contenidoQrTurno' in turnosBot, false);
});

test('cobro de turno: sin la URL publica configurada es un 503', async (t) => {
  simular(t);
  const anterior = process.env.MERCADOPAGO_PUBLIC_BASE_URL;
  delete process.env.MERCADOPAGO_PUBLIC_BASE_URL;
  try {
    const r = await crearCobroDeTurno(4, 12);
    assert.equal(r.error.status, 503);
  } finally {
    process.env.MERCADOPAGO_PUBLIC_BASE_URL = anterior;
  }
});

test('cobro de turno: un id invalido es un 400', async (t) => {
  simular(t);
  assert.equal((await crearCobroDeTurno(4, 'x')).error.status, 400);
  assert.equal((await crearCobroDeTurno(4, 0)).error.status, 400);
});

test('cobro de turno: un cobro de otra cuenta de Mercado Pago no se reutiliza ni se pisa', async (t) => {
  simular(t, {
    turno: { id_turno: 12, estado: 'Realizado', cobrado: false, id_presupuesto: 5, inmueble: { id_cliente: 3 } },
    movimientos: [],
    presupuesto: { monto_total: 60000, estado: 'Aceptado' },
    activos: [{ id: 7, id_usuario: 99, estado: 'Pendiente', monto: 60000, init_point: 'https://mp/x', created_at: new Date().toISOString() }],
  });
  const r = await crearCobroDeTurno(4, 12);
  assert.equal(r.error.status, 409);
  assert.match(r.error.message, /otra cuenta/);
});

test('cobro de turno: reutiliza el link propio si el monto no cambio', async (t) => {
  simular(t, {
    turno: { id_turno: 12, estado: 'Realizado', cobrado: false, id_presupuesto: 5, inmueble: { id_cliente: 3 } },
    presupuesto: { monto_total: 60000, estado: 'Aceptado' },
    activos: [{ id: 7, id_usuario: 4, id_turno: 12, estado: 'Pendiente', monto: 60000, init_point: 'https://mp/x', created_at: new Date().toISOString() }],
  });
  const r = await crearCobroDeTurno(4, 12);
  assert.equal(r.reutilizado, true);
  assert.equal(r.data.id, 7);
  assert.equal(r.data.init_point, 'https://mp/x');
});
