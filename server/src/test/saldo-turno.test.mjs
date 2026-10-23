import test from 'node:test';
import assert from 'node:assert/strict';

// Isolated client: these tests never touch the real project database.
process.env.SUPABASE_URL = 'https://saldo-turno-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'saldo-turno-sin-conexion';

const { armarSaldoTurno } = await import('../utils/saldoTurno.js');
const { obtenerSaldoTurno } = await import('../services/saldoTurnoService.js');
const { saldoTurno } = await import('../controllers/pagosController.js');

const turno = (extra = {}) => ({ id_turno: 12, estado: 'Realizado', cobrado: false, ...extra });
const presupuesto = (extra = {}) => ({ monto_total: 60000, estado: 'Aceptado', ...extra });

// ---- armarSaldoTurno --------------------------------------------------------

test('armarSaldoTurno: un turno realizado debe lo que dice el libro de movimientos', () => {
  const r = armarSaldoTurno({
    turno: turno(),
    movimientos: [{ tipo: 'Debito', monto: 60000 }, { tipo: 'Credito', monto: 25000 }],
    presupuesto: presupuesto(),
    pagos: [],
  });
  assert.equal(r.total, 60000);
  assert.equal(r.pendiente, 35000);
  assert.equal(r.cobrado, false);
  assert.equal(r.estado, 'Realizado');
});

test('armarSaldoTurno: sin movimientos debe el total del presupuesto aceptado', () => {
  const r = armarSaldoTurno({ turno: turno(), movimientos: [], presupuesto: presupuesto(), pagos: [] });
  assert.equal(r.pendiente, 60000);
});

test('armarSaldoTurno: un turno que no esta realizado todavia no tiene deuda, solo total', () => {
  for (const estado of ['Coordinado', 'Confirmado', 'En ejecución']) {
    const r = armarSaldoTurno({ turno: turno({ estado }), movimientos: [], presupuesto: presupuesto(), pagos: [] });
    assert.equal(r.pendiente, null, estado);
    assert.equal(r.total, 60000, estado);
  }
});

test('armarSaldoTurno: sin presupuesto aceptado no hay total ni deuda inventada', () => {
  const r = armarSaldoTurno({ turno: turno(), movimientos: [], presupuesto: presupuesto({ estado: 'Borrador' }), pagos: [] });
  assert.equal(r.total, null);
  assert.equal(r.pendiente, null);
  assert.equal(armarSaldoTurno({ turno: turno(), movimientos: [], presupuesto: null, pagos: [] }).total, null);
});

test('armarSaldoTurno: un turno saldado queda con pendiente 0 y cobrado', () => {
  const r = armarSaldoTurno({
    turno: turno({ cobrado: true }),
    movimientos: [{ tipo: 'Debito', monto: 60000 }, { tipo: 'Credito', monto: 60000 }],
    presupuesto: presupuesto(),
    pagos: [],
  });
  assert.equal(r.pendiente, 0);
  assert.equal(r.cobrado, true);
});

test('armarSaldoTurno: lista los pagos con medio, monto y fecha', () => {
  const r = armarSaldoTurno({
    turno: turno(),
    movimientos: [],
    presupuesto: presupuesto(),
    pagos: [{ id_pago: 3, medio_pago: 'Efectivo', monto: '1000.50', estado: 'Aprobado', fecha_pago: '2026-10-23T12:00:00Z', referencia_comprobante: 'secreto' }],
  });
  assert.deepEqual(r.pagos, [{ id_pago: 3, medio: 'Efectivo', monto: 1000.5, estado: 'Aprobado', fecha: '2026-10-23T12:00:00Z' }]);
});

// ---- obtenerSaldoTurno ------------------------------------------------------

const depsConDatos = (extra = {}) => ({
  leerContexto: async () => ({
    data: { turno: turno(), movimientos: [{ tipo: 'Debito', monto: 60000 }], presupuesto: presupuesto(), idTrabajo: 9 },
  }),
  listarPagos: async () => ({ data: [{ id_pago: 1, medio_pago: 'Transferencia', monto: 1000, estado: 'Aprobado', fecha_pago: null }] }),
  ...extra,
});

test('obtenerSaldoTurno: un id invalido es un 400', async () => {
  assert.equal((await obtenerSaldoTurno('x', depsConDatos())).error.status, 400);
  assert.equal((await obtenerSaldoTurno(0, depsConDatos())).error.status, 400);
});

test('obtenerSaldoTurno: un turno inexistente es un 404', async () => {
  const r = await obtenerSaldoTurno(99, depsConDatos({ leerContexto: async () => ({ data: { turno: null, movimientos: [] } }) }));
  assert.equal(r.error.status, 404);
});

test('obtenerSaldoTurno: arma el saldo y trae los pagos del trabajo', async () => {
  let idTrabajoPedido;
  const r = await obtenerSaldoTurno(12, depsConDatos({
    listarPagos: async (idTrabajo) => { idTrabajoPedido = idTrabajo; return { data: [] }; },
  }));
  assert.equal(r.data.pendiente, 60000);
  assert.equal(r.data.total, 60000);
  assert.equal(idTrabajoPedido, 9);
});

test('obtenerSaldoTurno: sin trabajo registrado no consulta pagos', async () => {
  const r = await obtenerSaldoTurno(12, depsConDatos({
    leerContexto: async () => ({
      data: { turno: turno({ estado: 'Coordinado' }), movimientos: [], presupuesto: presupuesto(), idTrabajo: null },
    }),
    listarPagos: async () => assert.fail('no debe consultar pagos'),
  }));
  assert.deepEqual(r.data.pagos, []);
});

test('obtenerSaldoTurno: un error de base es un 500 sin detalle', async () => {
  const r = await obtenerSaldoTurno(12, depsConDatos({ leerContexto: async () => ({ dbError: new Error('detalle xyz') }) }));
  assert.equal(r.error.status, 500);
  assert.equal(JSON.stringify(r).includes('xyz'), false);
  const r2 = await obtenerSaldoTurno(12, depsConDatos({ listarPagos: async () => ({ dbError: new Error('detalle xyz') }) }));
  assert.equal(r2.error.status, 500);
});

// ---- controller -------------------------------------------------------------

const res = () => ({
  codigo: 200,
  status(codigo) { this.codigo = codigo; return this; },
  json(body) { this.body = body; return this; },
});

test('controller: un id invalido es un 400', async () => {
  const r = res();
  await saldoTurno({ params: { id: 'abc' } }, r);
  assert.equal(r.codigo, 400);
});
