import test from 'node:test';
import assert from 'node:assert/strict';

// Isolated client: these tests never touch the real project database.
process.env.SUPABASE_URL = 'https://pago-manual-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'pago-manual-sin-conexion';

const { validarPagoManual, MEDIOS_MANUALES } = await import('../utils/pagoManual.js');
const { registrarPagoTurno } = await import('../services/pagoManualService.js');
const { registrarPago } = await import('../controllers/pagosController.js');

// ---- validarPagoManual ------------------------------------------------------

test('validarPagoManual: acepta Efectivo y Transferencia, sin importar mayusculas ni espacios', () => {
  assert.deepEqual(MEDIOS_MANUALES, ['Efectivo', 'Transferencia']);
  assert.equal(validarPagoManual({ medio: 'Efectivo', monto: 5000 }).valores.medio, 'Efectivo');
  assert.equal(validarPagoManual({ medio: '  transferencia ', monto: 5000 }).valores.medio, 'Transferencia');
});

test('validarPagoManual: rechaza cualquier otro medio (Mercado Pago tiene su propio camino)', () => {
  for (const medio of ['MercadoPago', 'QR', 'Anotar', 'Cheque', '', null, undefined, 5]) {
    assert.equal(validarPagoManual({ medio, monto: 100 }).error?.status, 400, String(medio));
  }
  assert.equal(validarPagoManual(null).error?.status, 400);
  assert.equal(validarPagoManual(undefined).error?.status, 400);
});

test('validarPagoManual: el monto es un numero mayor a 0 con hasta 2 decimales', () => {
  assert.equal(validarPagoManual({ medio: 'Efectivo', monto: '1500.50' }).valores.monto, 1500.5);
  assert.equal(validarPagoManual({ medio: 'Efectivo', monto: 3000 }).valores.monto, 3000);
  for (const monto of [0, -5, 'abc', '', null, undefined, true, 1.005, Infinity, NaN]) {
    assert.equal(validarPagoManual({ medio: 'Efectivo', monto }).error?.status, 400, String(monto));
  }
});

test('validarPagoManual: la referencia es opcional, se recorta y tiene tope de 100', () => {
  assert.equal(validarPagoManual({ medio: 'Transferencia', monto: 10 }).valores.referencia, null);
  assert.equal(validarPagoManual({ medio: 'Transferencia', monto: 10, referencia: '  Op 8841  ' }).valores.referencia, 'Op 8841');
  assert.equal(validarPagoManual({ medio: 'Transferencia', monto: 10, referencia: '   ' }).valores.referencia, null);
  assert.equal(validarPagoManual({ medio: 'Transferencia', monto: 10, referencia: 884177 }).valores.referencia, '884177');
  assert.equal(validarPagoManual({ medio: 'Transferencia', monto: 10, referencia: 'x'.repeat(101) }).error?.status, 400);
});

test('validarPagoManual: junta todos los problemas en un solo mensaje', () => {
  const r = validarPagoManual({ medio: 'Cheque', monto: -1 });
  assert.match(r.error.message, /medio/i);
  assert.match(r.error.message, /monto/i);
});

// ---- registrarPagoTurno -----------------------------------------------------

const rpcFalso = (respuesta) => {
  const llamadas = [];
  return {
    llamadas,
    rpc: async (nombre, parametros) => {
      llamadas.push({ nombre, parametros });
      return respuesta;
    },
  };
};

const RESULTADO_SQL = { registrado: true, id_pago: 31, id_movimiento: 77, pendiente: 2000, cobrado: false, cobros_cancelados: 1 };

test('registrarPagoTurno: valida antes de llamar a la base', async () => {
  const { rpc, llamadas } = rpcFalso({ data: RESULTADO_SQL });
  assert.equal((await registrarPagoTurno({ idUsuario: 4, idTurno: 'x', body: { medio: 'Efectivo', monto: 1 } }, { rpc })).error.status, 400);
  assert.equal((await registrarPagoTurno({ idUsuario: 4, idTurno: 12, body: { medio: 'Cheque', monto: 1 } }, { rpc })).error.status, 400);
  assert.equal(llamadas.length, 0);
});

test('registrarPagoTurno: llama a la funcion con el usuario que registra y devuelve el resultado', async () => {
  const { rpc, llamadas } = rpcFalso({ data: RESULTADO_SQL });
  const r = await registrarPagoTurno(
    { idUsuario: 4, idTurno: '12', body: { medio: 'transferencia', monto: '3000', referencia: 'Op 8841' } },
    { rpc }
  );
  assert.equal(llamadas[0].nombre, 'fn_registrar_pago_turno');
  assert.deepEqual(llamadas[0].parametros, {
    p_id_turno: 12,
    p_monto: 3000,
    p_medio: 'Transferencia',
    p_referencia: 'Op 8841',
    p_id_usuario: 4,
  });
  assert.equal(r.data.id_pago, 31);
  assert.equal(r.data.medio, 'Transferencia');
  assert.equal(r.data.pendiente, 2000);
  assert.equal(r.data.cobrado, false);
  assert.equal(r.data.cobros_cancelados, 1);
});

test('registrarPagoTurno: una regla de negocio de la base (P0001) es un 409 con su mensaje', async () => {
  const { rpc } = rpcFalso({ error: { code: 'P0001', message: 'El pago supera lo que el cliente debe de este trabajo.' } });
  const r = await registrarPagoTurno({ idUsuario: 4, idTurno: 12, body: { medio: 'Efectivo', monto: 99999 } }, { rpc });
  assert.equal(r.error.status, 409);
  assert.match(r.error.message, /supera/);
});

test('registrarPagoTurno: otro error de base es un 500 que no filtra el detalle', async () => {
  const { rpc } = rpcFalso({ error: { code: '42883', message: 'function fn_registrar_pago_turno does not exist xyz' } });
  const r = await registrarPagoTurno({ idUsuario: 4, idTurno: 12, body: { medio: 'Efectivo', monto: 100 } }, { rpc });
  assert.equal(r.error.status, 500);
  assert.equal(JSON.stringify(r).includes('xyz'), false);
});

test('registrarPagoTurno: una excepcion inesperada tampoco rompe', async () => {
  const rpc = async () => { throw new Error('boom'); };
  const r = await registrarPagoTurno({ idUsuario: 4, idTurno: 12, body: { medio: 'Efectivo', monto: 100 } }, { rpc });
  assert.equal(r.error.status, 500);
});

// ---- controller -------------------------------------------------------------

const res = () => ({
  codigo: 200,
  status(codigo) { this.codigo = codigo; return this; },
  json(body) { this.body = body; return this; },
});

test('controller: sin usuario identificable es un 401', async () => {
  const r = res();
  await registrarPago({ params: { id: '12' }, body: { medio: 'Efectivo', monto: 100 }, user: {} }, r);
  assert.equal(r.codigo, 401);
});

test('controller: un pedido invalido es un 400 con el motivo', async () => {
  const r = res();
  await registrarPago({ params: { id: '12' }, body: { medio: 'Cheque', monto: 100 }, user: { sub: 4 } }, r);
  assert.equal(r.codigo, 400);
  assert.equal(r.body.ok, false);
  assert.match(r.body.error, /medio/i);
});
