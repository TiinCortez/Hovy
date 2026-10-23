import test from 'node:test';
import assert from 'node:assert/strict';

// Isolated client: these tests never touch the real project database.
process.env.SUPABASE_URL = 'https://cobro-verificacion-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'cobro-verificacion-sin-conexion';

const { elegirPagoDeBusqueda } = await import('../integrations/mercadopago/cobros/estadoPago.js');
const { aplicarPagoACobro } = await import('../integrations/mercadopago/cobros/aplicarPago.js');
const { armarMensajeCobro } = await import('../integrations/mercadopago/cobros/cobroTurno.js');
const { buscarPagosPorReferencia } = await import('../integrations/mercadopago/cobros/mpPagosClient.js');
const { verificarCobro, consultarCobroDeTurno, reiniciarVerificaciones } =
  await import('../integrations/mercadopago/cobros/cobrosService.js');

const cobro = (extra = {}) => ({
  id: 7,
  id_usuario: 4,
  id_turno: 12,
  id_pago: null,
  monto: 60000,
  estado: 'Pendiente',
  external_reference: 'ref-abc',
  mp_payment_id: null,
  init_point: 'https://mp/pagar',
  ...extra,
});
const pago = (extra = {}) => ({ id: 555, status: 'approved', transaction_amount: 60000, currency_id: 'ARS', ...extra });

// In-memory stand-in for the cobros repository: records what was called.
const repoFalso = ({ transicionError = false, registroError = false, filas = {} } = {}) => {
  const llamadas = { transiciones: [], registros: [] };
  return {
    llamadas,
    transicionarDesdePendiente: async (id, estado, mpId) => {
      llamadas.transiciones.push({ id, estado, mpId });
      return transicionError ? { dbError: new Error('boom') } : { data: [{ id }] };
    },
    registrarPagoCobro: async (id) => {
      llamadas.registros.push(id);
      return registroError ? { dbError: new Error('boom') } : { data: { registrado: true, id_pago: 99 } };
    },
    obtenerCobro: async (id, idUsuario) => ({ data: filas[`${id}:${idUsuario}`] ?? null }),
  };
};

// ---- elegirPagoDeBusqueda ---------------------------------------------------

test('elegirPagoDeBusqueda: sin resultados no hay pago', () => {
  assert.equal(elegirPagoDeBusqueda([]), null);
  assert.equal(elegirPagoDeBusqueda(null), null);
  assert.equal(elegirPagoDeBusqueda('x'), null);
});

test('elegirPagoDeBusqueda: prefiere un pago aprobado aunque no sea el primero', () => {
  const aprobado = pago({ id: 2, status: 'approved' });
  assert.equal(elegirPagoDeBusqueda([pago({ id: 1, status: 'rejected' }), aprobado]), aprobado);
});

test('elegirPagoDeBusqueda: sin aprobados toma el mas reciente (la busqueda viene en orden descendente)', () => {
  const reciente = pago({ id: 1, status: 'pending' });
  assert.equal(elegirPagoDeBusqueda([reciente, pago({ id: 2, status: 'rejected' })]), reciente);
});

// ---- aplicarPagoACobro ------------------------------------------------------

test('aplicarPagoACobro: un pago aprobado de un turno aprueba el cobro y registra el pago', async () => {
  const repo = repoFalso();
  const r = await aplicarPagoACobro(cobro(), pago(), repo);
  assert.equal(r.cobro.estado, 'Aprobado');
  assert.deepEqual(repo.llamadas.transiciones, [{ id: 7, estado: 'Aprobado', mpId: 555 }]);
  assert.deepEqual(repo.llamadas.registros, [7]);
});

test('aplicarPagoACobro: un monto distinto no aprueba ni registra', async () => {
  const repo = repoFalso();
  const r = await aplicarPagoACobro(cobro(), pago({ transaction_amount: 100 }), repo);
  assert.equal(r.cobro.estado, 'Pendiente');
  assert.equal(repo.llamadas.transiciones.length, 0);
  assert.equal(repo.llamadas.registros.length, 0);
});

test('aplicarPagoACobro: un pago todavia pendiente no cambia nada', async () => {
  const repo = repoFalso();
  await aplicarPagoACobro(cobro(), pago({ status: 'pending' }), repo);
  assert.equal(repo.llamadas.transiciones.length, 0);
  assert.equal(repo.llamadas.registros.length, 0);
});

test('aplicarPagoACobro: un cobro aprobado sin pago registrado solo reintenta el registro', async () => {
  const repo = repoFalso();
  await aplicarPagoACobro(cobro({ estado: 'Aprobado', mp_payment_id: '555' }), pago(), repo);
  assert.equal(repo.llamadas.transiciones.length, 0);
  assert.deepEqual(repo.llamadas.registros, [7]);
});

test('aplicarPagoACobro: un cobro ya registrado no se vuelve a registrar', async () => {
  const repo = repoFalso();
  await aplicarPagoACobro(cobro({ estado: 'Aprobado', id_pago: 3 }), pago(), repo);
  assert.equal(repo.llamadas.registros.length, 0);
});

test('aplicarPagoACobro: un pago rechazado marca el cobro Rechazado y no registra', async () => {
  const repo = repoFalso();
  const r = await aplicarPagoACobro(cobro(), pago({ status: 'rejected' }), repo);
  assert.equal(r.cobro.estado, 'Rechazado');
  assert.equal(repo.llamadas.registros.length, 0);
});

test('aplicarPagoACobro: un cobro que no es de un turno se aprueba pero no pasa por la cuenta', async () => {
  const repo = repoFalso();
  await aplicarPagoACobro(cobro({ id_turno: null }), pago(), repo);
  assert.equal(repo.llamadas.transiciones.length, 1);
  assert.equal(repo.llamadas.registros.length, 0);
});

test('aplicarPagoACobro: un error de base se informa para que el llamador reintente', async () => {
  assert.ok((await aplicarPagoACobro(cobro(), pago(), repoFalso({ transicionError: true }))).dbError);
  assert.ok((await aplicarPagoACobro(cobro(), pago(), repoFalso({ registroError: true }))).dbError);
});

// ---- armarMensajeCobro ------------------------------------------------------

test('armarMensajeCobro: aprobado e impactado en la cuenta', () => {
  const m = armarMensajeCobro(cobro({ estado: 'Aprobado', id_pago: 3 }));
  assert.match(m, /aprobado/);
  assert.match(m, /impactó/);
  assert.match(m, /\$60\.000/);
});

test('armarMensajeCobro: aprobado pero todavia no registrado en la cuenta', () => {
  const m = armarMensajeCobro(cobro({ estado: 'Aprobado', id_pago: null }));
  assert.match(m, /todavía no se registró/);
});

test('armarMensajeCobro: pendiente, rechazado, cancelado, expirado y sin cobro', () => {
  assert.match(armarMensajeCobro(cobro({ estado: 'Pendiente' })), /Todavía no se recibió el pago/);
  assert.match(armarMensajeCobro(cobro({ estado: 'Rechazado' })), /rechazó/);
  assert.match(armarMensajeCobro(cobro({ estado: 'Cancelado' })), /cancelado/);
  assert.match(armarMensajeCobro(cobro({ estado: 'Expirado' })), /venció/);
  assert.match(armarMensajeCobro(null), /todavía no tiene un cobro/);
});

// ---- buscarPagosPorReferencia (cliente HTTP) -------------------------------

test('buscarPagosPorReferencia: consulta la busqueda por external_reference con el token del vendedor', async (t) => {
  let pedido;
  t.mock.method(globalThis, 'fetch', async (url, opciones) => {
    pedido = { url: new URL(url), opciones };
    return { ok: true, json: async () => ({ paging: { total: 1 }, results: [{ id: 1 }] }) };
  });
  const r = await buscarPagosPorReferencia('TOKEN-VENDEDOR', 'ref con espacio&x');
  assert.deepEqual(r.results, [{ id: 1 }]);
  assert.equal(pedido.url.pathname, '/v1/payments/search');
  assert.equal(pedido.url.searchParams.get('external_reference'), 'ref con espacio&x');
  assert.equal(pedido.url.searchParams.get('criteria'), 'desc');
  assert.equal(pedido.opciones.headers.Authorization, 'Bearer TOKEN-VENDEDOR');
  assert.equal(pedido.url.search.includes('TOKEN-VENDEDOR'), false);
});

// ---- verificarCobro ---------------------------------------------------------

const AHORA = Date.parse('2026-10-23T12:00:00Z');

const entorno = (cobroActual, extra = {}) => {
  const repo = repoFalso({ filas: { [`${cobroActual.id}:4`]: cobroActual, ...(extra.filas ?? {}) } });
  const llamadasMp = { busquedas: [], lecturas: [] };
  return {
    llamadasMp,
    repo,
    deps: {
      repo,
      ahora: AHORA,
      obtenerToken: async () => extra.token ?? { data: { accessToken: 'tok' } },
      // `busqueda: null` simulates Mercado Pago not answering.
      buscarPagos: async (token, ref) => {
        llamadasMp.busquedas.push(ref);
        return 'busqueda' in extra ? extra.busqueda : { results: [] };
      },
      obtenerPago: async (token, id) => { llamadasMp.lecturas.push(id); return extra.pago ?? null; },
    },
  };
};

test('verificarCobro: un id invalido es un 400 y uno ajeno un 404', async () => {
  reiniciarVerificaciones();
  const { deps } = entorno(cobro());
  assert.equal((await verificarCobro('x', 4, deps)).error.status, 400);
  assert.equal((await verificarCobro(7, 99, deps)).error.status, 404);
});

test('verificarCobro: un cobro ya impactado no consulta a Mercado Pago', async () => {
  reiniciarVerificaciones();
  const { deps, llamadasMp } = entorno(cobro({ estado: 'Aprobado', id_pago: 3 }));
  const r = await verificarCobro(7, 4, deps);
  assert.equal(r.verificado, false);
  assert.equal(r.data.impactado, true);
  assert.equal(llamadasMp.busquedas.length, 0);
});

test('verificarCobro: un cobro cancelado o rechazado tampoco consulta', async () => {
  reiniciarVerificaciones();
  for (const estado of ['Cancelado', 'Rechazado', 'Expirado']) {
    const { deps, llamadasMp } = entorno(cobro({ estado }));
    await verificarCobro(7, 4, deps);
    assert.equal(llamadasMp.busquedas.length, 0, estado);
  }
});

test('verificarCobro: un cobro pendiente pagado se aprueba y se registra en la cuenta', async () => {
  reiniciarVerificaciones();
  const pendiente = cobro();
  const aprobado = cobro({ estado: 'Aprobado', id_pago: 99, mp_payment_id: '555' });
  const { deps, repo, llamadasMp } = entorno(pendiente, { busqueda: { results: [pago()] } });
  // After applying the payment the cobro is read again: it now has its pago.
  let lecturas = 0;
  const leer = repo.obtenerCobro;
  repo.obtenerCobro = async (...args) => { lecturas += 1; return lecturas === 1 ? leer(...args) : { data: aprobado }; };

  const r = await verificarCobro(7, 4, deps);
  assert.deepEqual(llamadasMp.busquedas, ['ref-abc']);
  assert.equal(r.verificado, true);
  assert.equal(r.data.estado, 'Aprobado');
  assert.equal(r.data.impactado, true);
  assert.deepEqual(repo.llamadas.registros, [7]);
});

test('verificarCobro: si todavia no hay pago devuelve el estado actual sin error', async () => {
  reiniciarVerificaciones();
  const { deps, llamadasMp } = entorno(cobro(), { busqueda: { results: [] } });
  const r = await verificarCobro(7, 4, deps);
  assert.equal(llamadasMp.busquedas.length, 1);
  assert.equal(r.error, undefined);
  assert.equal(r.verificado, false);
  assert.equal(r.data.estado, 'Pendiente');
});

test('verificarCobro: no consulta a Mercado Pago mas de una vez cada 15 segundos por cobro', async () => {
  reiniciarVerificaciones();
  const { deps, llamadasMp } = entorno(cobro());
  await verificarCobro(7, 4, deps);
  await verificarCobro(7, 4, { ...deps, ahora: AHORA + 5_000 });
  assert.equal(llamadasMp.busquedas.length, 1);
  await verificarCobro(7, 4, { ...deps, ahora: AHORA + 16_000 });
  assert.equal(llamadasMp.busquedas.length, 2);
});

test('verificarCobro: si Mercado Pago no responde o no hay token devuelve el estado actual', async () => {
  reiniciarVerificaciones();
  const sinRespuesta = entorno(cobro(), { busqueda: null });
  assert.equal((await verificarCobro(7, 4, sinRespuesta.deps)).data.estado, 'Pendiente');
  reiniciarVerificaciones();
  const sinToken = entorno(cobro(), { token: { error: { code: 'NO_CONECTADA' } } });
  const r = await verificarCobro(7, 4, sinToken.deps);
  assert.equal(r.error, undefined);
  assert.equal(r.data.estado, 'Pendiente');
  assert.equal(sinToken.llamadasMp.busquedas.length, 0);
});

test('verificarCobro: un cobro aprobado sin registrar relee el pago por su id y reintenta el registro', async () => {
  reiniciarVerificaciones();
  const atascado = cobro({ estado: 'Aprobado', id_pago: null, mp_payment_id: '555' });
  const { deps, repo, llamadasMp } = entorno(atascado, { pago: pago() });
  await verificarCobro(7, 4, deps);
  assert.deepEqual(llamadasMp.lecturas, ['555']);
  assert.equal(llamadasMp.busquedas.length, 0);
  assert.deepEqual(repo.llamadas.registros, [7]);
});

// ---- consultarCobroDeTurno (bot: "¿ya pago?") -----------------------------

test('consultarCobroDeTurno: un turno sin cobro lo dice', async () => {
  reiniciarVerificaciones();
  const repo = { ...repoFalso(), buscarUltimoPorTurno: async () => ({ data: null }) };
  const r = await consultarCobroDeTurno(4, 12, { repo });
  assert.equal(r.data.estado, 'Sin cobro');
  assert.match(r.data.mensaje, /todavía no tiene un cobro/);
});

test('consultarCobroDeTurno: informa el estado, si impacto en la cuenta y un mensaje', async () => {
  reiniciarVerificaciones();
  const aprobado = cobro({ estado: 'Aprobado', id_pago: 3 });
  const repo = {
    ...repoFalso({ filas: { '7:4': aprobado } }),
    buscarUltimoPorTurno: async () => ({ data: aprobado }),
  };
  const r = await consultarCobroDeTurno(4, 12, { repo, ahora: AHORA });
  assert.equal(r.data.estado, 'Aprobado');
  assert.equal(r.data.impactado, true);
  assert.equal(r.data.monto, 60000);
  assert.match(r.data.mensaje, /impactó/);
});

test('consultarCobroDeTurno: el cobro de otra cuenta de Mercado Pago es un 409', async () => {
  reiniciarVerificaciones();
  const ajeno = cobro({ id_usuario: 99 });
  const repo = { ...repoFalso(), buscarUltimoPorTurno: async () => ({ data: ajeno }) };
  const r = await consultarCobroDeTurno(4, 12, { repo });
  assert.equal(r.error.status, 409);
});
