import test from 'node:test';
import assert from 'node:assert/strict';

// Cliente aislado: nunca usa credenciales ni base reales.
process.env.SUPABASE_URL = 'https://cobro-cliente-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'cobro-cliente-tests-sin-conexion';

const {
  resolverVendedorDeCobros,
  obtenerDeudasDelCliente,
  crearCobroDelCliente,
  consultarCobroDelCliente,
  armarMensajeCobroCliente,
} = await import('../services/cobroClienteService.js');
const { obtenerTurnosPendientesCobro } = await import('../services/turnosPendientesCobroService.js');

// ---- Base falsa ---------------------------------------------------------------------------
// Cada tabla responde con lo que le pasemos; registra las consultas para poder verificarlas.
const baseFalsa = (respuestas = {}) => {
  const consultas = [];
  const cliente = {
    from(tabla) {
      const consulta = { tabla, ops: [] };
      consultas.push(consulta);
      const resolver = () => {
        const valor = respuestas[tabla];
        return typeof valor === 'function' ? valor(consulta) : (valor ?? { data: [], error: null });
      };
      const builder = {};
      for (const op of ['select', 'eq', 'in', 'neq', 'gte', 'order', 'limit', 'is']) {
        builder[op] = (...args) => { consulta.ops.push([op, ...args]); return builder; };
      }
      builder.maybeSingle = () => Promise.resolve(resolver());
      builder.then = (resolve, reject) => Promise.resolve(resolver()).then(resolve, reject);
      return builder;
    },
  };
  return { cliente, consultas };
};
const filtro = (consulta, op, columna) => consulta.ops.find(([o, c]) => o === op && c === columna);

// ---- resolverVendedorDeCobros -------------------------------------------------------------

test('vendedor: con una sola cuenta de administrador conectada, esa es la que cobra', async () => {
  const { cliente } = baseFalsa({
    mercadopago_conexion: { data: [{ id_usuario: 3 }, { id_usuario: 8 }], error: null },
    usuarios: { data: [{ id: 3 }], error: null },
  });
  const r = await resolverVendedorDeCobros({ cliente, env: {} });
  assert.deepEqual(r, { data: { idUsuario: 3 } });
});

test('vendedor: solo cuentas Conectadas y solo usuarios con rol admin', async () => {
  const { cliente, consultas } = baseFalsa({
    mercadopago_conexion: { data: [{ id_usuario: 3 }], error: null },
    usuarios: { data: [{ id: 3 }], error: null },
  });
  await resolverVendedorDeCobros({ cliente, env: {} });
  const conexion = consultas.find((c) => c.tabla === 'mercadopago_conexion');
  const usuarios = consultas.find((c) => c.tabla === 'usuarios');
  assert.deepEqual(filtro(conexion, 'eq', 'estado').slice(1), ['estado', 'Conectada']);
  assert.deepEqual(filtro(usuarios, 'eq', 'rol').slice(1), ['rol', 'admin']);
  assert.deepEqual(filtro(usuarios, 'in', 'id').slice(1), ['id', [3]]);
});

test('vendedor: sin ninguna cuenta de administrador conectada devuelve 503 con un mensaje claro', async () => {
  const { cliente } = baseFalsa({
    mercadopago_conexion: { data: [{ id_usuario: 8 }], error: null },
    usuarios: { data: [], error: null },
  });
  const r = await resolverVendedorDeCobros({ cliente, env: {} });
  assert.equal(r.error.status, 503);
  assert.match(r.error.message, /Mercado Pago/);
});

test('vendedor: sin conexiones ni siquiera consulta usuarios', async () => {
  const { cliente, consultas } = baseFalsa({ mercadopago_conexion: { data: [], error: null } });
  const r = await resolverVendedorDeCobros({ cliente, env: {} });
  assert.equal(r.error.status, 503);
  assert.equal(consultas.some((c) => c.tabla === 'usuarios'), false);
});

test('vendedor: con más de un administrador conectado y sin configuración no adivina (503)', async () => {
  const { cliente } = baseFalsa({
    mercadopago_conexion: { data: [{ id_usuario: 3 }, { id_usuario: 4 }], error: null },
    usuarios: { data: [{ id: 3 }, { id: 4 }], error: null },
  });
  const r = await resolverVendedorDeCobros({ cliente, env: {} });
  assert.equal(r.error.status, 503);
  assert.match(r.error.message, /más de una cuenta/);
});

test('vendedor: MERCADOPAGO_COBRO_CLIENTES_ID_USUARIO fija la cuenta si esa conexión está vigente', async () => {
  const { cliente, consultas } = baseFalsa({ mercadopago_conexion: { data: { id_usuario: 4 }, error: null } });
  const r = await resolverVendedorDeCobros({ cliente, env: { MERCADOPAGO_COBRO_CLIENTES_ID_USUARIO: '4' } });
  assert.deepEqual(r, { data: { idUsuario: 4 } });
  const conexion = consultas.find((c) => c.tabla === 'mercadopago_conexion');
  assert.deepEqual(filtro(conexion, 'eq', 'id_usuario').slice(1), ['id_usuario', 4]);
  assert.deepEqual(filtro(conexion, 'eq', 'estado').slice(1), ['estado', 'Conectada']);
});

test('vendedor: la cuenta fijada por configuración pero desconectada da 503 (no cae en otra)', async () => {
  const { cliente } = baseFalsa({ mercadopago_conexion: { data: null, error: null } });
  const r = await resolverVendedorDeCobros({ cliente, env: { MERCADOPAGO_COBRO_CLIENTES_ID_USUARIO: '4' } });
  assert.equal(r.error.status, 503);
});

test('vendedor: una configuración inválida da 503 sin consultar', async () => {
  for (const valor of ['abc', '0', '-2', '1.5']) {
    const { cliente, consultas } = baseFalsa();
    const r = await resolverVendedorDeCobros({ cliente, env: { MERCADOPAGO_COBRO_CLIENTES_ID_USUARIO: valor } });
    assert.equal(r.error.status, 503, valor);
    assert.equal(consultas.length, 0, valor);
  }
});

test('vendedor: un error de base devuelve 500 sin filtrar el detalle', async () => {
  const { cliente } = baseFalsa({ mercadopago_conexion: { data: null, error: { code: 'XX000', message: 'detalle interno secreto' } } });
  const r = await resolverVendedorDeCobros({ cliente, env: {} });
  assert.equal(r.error.status, 500);
  assert.doesNotMatch(r.error.message, /secreto/);
});

// ---- obtenerTurnosPendientesCobro con idCliente (el staff sigue igual) ----------------------

test('pendientes: con idCliente solo mira turnos de los inmuebles de ese cliente', async () => {
  const { cliente, consultas } = baseFalsa({ inmuebles: { data: [{ id_inmueble: 10 }, { id_inmueble: 11 }], error: null }, turnos: { data: [], error: null } });
  const r = await obtenerTurnosPendientesCobro({ idCliente: 5, cliente });
  assert.deepEqual(r.data, []);
  const inmuebles = consultas.find((c) => c.tabla === 'inmuebles');
  assert.deepEqual(filtro(inmuebles, 'eq', 'id_cliente').slice(1), ['id_cliente', 5]);
  const turnos = consultas.find((c) => c.tabla === 'turnos');
  assert.deepEqual(filtro(turnos, 'in', 'id_inmueble').slice(1), ['id_inmueble', [10, 11]]);
});

test('pendientes: un cliente sin inmuebles no consulta turnos y devuelve vacío', async () => {
  const { cliente, consultas } = baseFalsa({ inmuebles: { data: [], error: null } });
  const r = await obtenerTurnosPendientesCobro({ idCliente: 5, cliente });
  assert.deepEqual(r.data, []);
  assert.equal(consultas.some((c) => c.tabla === 'turnos'), false);
});

test('pendientes: sin idCliente (staff) no filtra por inmueble ni consulta inmuebles', async () => {
  const { cliente, consultas } = baseFalsa({ turnos: { data: [], error: null } });
  await obtenerTurnosPendientesCobro({ cliente });
  assert.equal(consultas.some((c) => c.tabla === 'inmuebles'), false);
  assert.equal(filtro(consultas.find((c) => c.tabla === 'turnos'), 'in', 'id_inmueble'), undefined);
});

// ---- obtenerDeudasDelCliente --------------------------------------------------------------

const PENDIENTE = {
  id_turno: 12, fecha: '2026-11-20', hora_inicio: '08:00:00', hora_fin: '10:00:00', estado: 'Realizado', prioridad: 'P3_Casual',
  direccion: 'San Lorenzo 287', barrio: 'Centro', cliente: 'Juan Pérez', telefono_cliente: '5493510000000',
  total_presupuestado: 20000, saldo_pendiente: 12000, link_maps: 'https://maps/x',
};

test('deudas: pide solo los turnos del cliente y devuelve solo lo que el cliente necesita ver', async () => {
  const llamadas = [];
  const obtenerPendientes = async (args) => { llamadas.push(args); return { data: [PENDIENTE], mensaje: 'x' }; };

  const r = await obtenerDeudasDelCliente({ idCliente: 5, limite: 7, deps: { obtenerPendientes } });

  assert.equal(llamadas[0].idCliente, 5);
  assert.equal(llamadas[0].limite, 7);
  assert.deepEqual(r.data, [{
    id_turno: 12, fecha: '2026-11-20', hora_inicio: '08:00', hora_fin: '10:00',
    direccion: 'San Lorenzo 287', barrio: 'Centro', total_presupuestado: 20000, saldo_pendiente: 12000,
  }]);
  assert.equal(JSON.stringify(r).includes('5493510000000'), false, 'no expone teléfono');
  assert.equal(JSON.stringify(r).includes('maps'), false);
});

test('deudas: el mensaje lista cada turno con su saldo y el total, sin datos de otros', async () => {
  const obtenerPendientes = async () => ({ data: [PENDIENTE, { ...PENDIENTE, id_turno: 13, saldo_pendiente: 5000.5 }], mensaje: 'x' });
  const r = await obtenerDeudasDelCliente({ idCliente: 5, deps: { obtenerPendientes } });
  assert.match(r.mensaje, /2 turnos con saldo pendiente/);
  assert.match(r.mensaje, /\$12\.000,00/);
  assert.match(r.mensaje, /\$5\.000,50/);
  assert.doesNotMatch(r.mensaje, /Juan/);
});

test('deudas: sin deudas lo dice con amabilidad', async () => {
  const r = await obtenerDeudasDelCliente({ idCliente: 5, deps: { obtenerPendientes: async () => ({ data: [] }) } });
  assert.deepEqual(r.data, []);
  assert.match(r.mensaje, /No tenés deudas/);
});

test('deudas: sin id de cliente o con un error del servicio, no devuelve datos', async () => {
  assert.equal((await obtenerDeudasDelCliente({ idCliente: undefined, deps: { obtenerPendientes: async () => ({ data: [PENDIENTE] }) } })).error.status, 400);
  const r = await obtenerDeudasDelCliente({ idCliente: 5, deps: { obtenerPendientes: async () => ({ error: { status: 500, message: 'boom' } }) } });
  assert.equal(r.error.status, 500);
});

// ---- crearCobroDelCliente -----------------------------------------------------------------

const TURNO_PROPIO = { data: { id_turno: 12, estado: 'Realizado', inmueble: { id_cliente: 5 } }, error: null };
const vendedorOk = async () => ({ data: { idUsuario: 3 } });
const saldo = (pendiente) => async () => ({ data: { id_turno: 12, pendiente, total: 20000 } });
const cobroOk = (extra = {}) => async (idUsuario, idTurno, { montoDeseado }) => ({
  data: { id: 77, monto: montoDeseado ? Number(montoDeseado) : 12000, init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=abc', estado: 'Pendiente', external_reference: 'ref-interna', id_usuario: idUsuario, ...extra },
  reutilizado: false,
});

test('crear cobro: genera el link con la cuenta del administrador y el monto pedido', async () => {
  const { cliente } = baseFalsa({ turnos: TURNO_PROPIO });
  const llamadas = [];
  const crearCobro = async (...args) => { llamadas.push(args); return cobroOk()(...args); };

  const r = await crearCobroDelCliente({ idCliente: 5, idTurno: '12', monto: 6000, cliente, deps: { resolverVendedor: vendedorOk, obtenerSaldo: saldo(12000), crearCobro } });

  assert.equal(r.error, undefined);
  assert.deepEqual(llamadas[0], [3, 12, { montoDeseado: 6000 }]);
  assert.equal(r.data.init_point, 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=abc');
  assert.equal(r.data.monto, 6000);
  assert.equal(r.data.saldo_pendiente, 12000);
  assert.equal(r.data.id_turno, 12);
  assert.equal(r.data.reutilizado, false);
});

test('crear cobro: sin monto cobra el saldo total', async () => {
  const { cliente } = baseFalsa({ turnos: TURNO_PROPIO });
  const llamadas = [];
  const crearCobro = async (...args) => { llamadas.push(args); return cobroOk()(...args); };
  const r = await crearCobroDelCliente({ idCliente: 5, idTurno: 12, cliente, deps: { resolverVendedor: vendedorOk, obtenerSaldo: saldo(12000), crearCobro } });
  assert.equal(r.error, undefined);
  assert.deepEqual(llamadas[0], [3, 12, { montoDeseado: null }]);
});

test('crear cobro: no expone datos internos del cobro (referencia, usuario vendedor)', async () => {
  const { cliente } = baseFalsa({ turnos: TURNO_PROPIO });
  const r = await crearCobroDelCliente({ idCliente: 5, idTurno: 12, cliente, deps: { resolverVendedor: vendedorOk, obtenerSaldo: saldo(12000), crearCobro: cobroOk() } });
  const texto = JSON.stringify(r);
  assert.equal(texto.includes('ref-interna'), false);
  assert.equal(texto.includes('id_usuario'), false);
  assert.deepEqual(Object.keys(r.data).sort(), ['id_cobro', 'id_turno', 'init_point', 'monto', 'reutilizado', 'saldo_pendiente']);
});

test('crear cobro: un turno ajeno o inexistente da 404 y no genera nada', async () => {
  const { cliente, consultas } = baseFalsa({ turnos: { data: null, error: null } });
  let generado = 0;
  const r = await crearCobroDelCliente({ idCliente: 5, idTurno: 12, cliente, deps: { resolverVendedor: vendedorOk, obtenerSaldo: saldo(1), crearCobro: async () => { generado += 1; } } });
  assert.equal(r.error.status, 404);
  assert.equal(generado, 0);
  const lectura = consultas.find((c) => c.tabla === 'turnos');
  assert.deepEqual(filtro(lectura, 'eq', 'inmueble.id_cliente').slice(1), ['inmueble.id_cliente', 5]);
});

test('crear cobro: el monto no puede superar el saldo ni ser inválido (se valida antes de llamar a Mercado Pago)', async () => {
  for (const monto of [12000.01, 99999, 0, -5, 'abc', 1.234]) {
    const { cliente } = baseFalsa({ turnos: TURNO_PROPIO });
    let generado = 0;
    const r = await crearCobroDelCliente({ idCliente: 5, idTurno: 12, monto, cliente, deps: { resolverVendedor: vendedorOk, obtenerSaldo: saldo(12000), crearCobro: async () => { generado += 1; } } });
    assert.equal(r.error.status, 400, String(monto));
    assert.equal(generado, 0, String(monto));
  }
});

test('crear cobro: el mensaje de monto excedido habla del saldo del cliente, no de "QR"', async () => {
  const { cliente } = baseFalsa({ turnos: TURNO_PROPIO });
  const r = await crearCobroDelCliente({ idCliente: 5, idTurno: 12, monto: 99999, cliente, deps: { resolverVendedor: vendedorOk, obtenerSaldo: saldo(12000), crearCobro: cobroOk() } });
  assert.match(r.error.message, /saldo pendiente/);
  assert.match(r.error.message, /\$12\.000,00/);
  assert.doesNotMatch(r.error.message, /QR/);
});

test('crear cobro: acepta el monto con coma decimal y como texto', async () => {
  const { cliente } = baseFalsa({ turnos: TURNO_PROPIO });
  const llamadas = [];
  const crearCobro = async (...args) => { llamadas.push(args); return cobroOk()(...args); };
  const r = await crearCobroDelCliente({ idCliente: 5, idTurno: 12, monto: '5000,50', cliente, deps: { resolverVendedor: vendedorOk, obtenerSaldo: saldo(12000), crearCobro } });
  assert.equal(r.error, undefined);
  assert.deepEqual(llamadas[0], [3, 12, { montoDeseado: 5000.5 }]);
});

test('crear cobro: sin saldo pendiente da 409 y no llama a Mercado Pago', async () => {
  for (const pendiente of [0, null]) {
    const { cliente } = baseFalsa({ turnos: TURNO_PROPIO });
    let generado = 0;
    const r = await crearCobroDelCliente({ idCliente: 5, idTurno: 12, cliente, deps: { resolverVendedor: vendedorOk, obtenerSaldo: saldo(pendiente), crearCobro: async () => { generado += 1; } } });
    assert.equal(r.error.status, 409);
    assert.equal(generado, 0);
  }
});

test('crear cobro: si no hay cuenta de Mercado Pago del negocio, devuelve el 503 y no genera nada', async () => {
  const { cliente } = baseFalsa({ turnos: TURNO_PROPIO });
  let generado = 0;
  const r = await crearCobroDelCliente({ idCliente: 5, idTurno: 12, cliente, deps: {
    resolverVendedor: async () => ({ error: { status: 503, message: 'sin cuenta' } }), obtenerSaldo: saldo(12000), crearCobro: async () => { generado += 1; },
  } });
  assert.equal(r.error.status, 503);
  assert.equal(generado, 0);
});

test('crear cobro: si ya hay un cobro del staff en otra cuenta, el cliente recibe un mensaje propio', async () => {
  const { cliente } = baseFalsa({ turnos: TURNO_PROPIO });
  const crearCobro = async () => ({ error: { status: 409, message: 'Este turno ya tiene un cobro generado desde otra cuenta de Mercado Pago.' } });
  const r = await crearCobroDelCliente({ idCliente: 5, idTurno: 12, cliente, deps: { resolverVendedor: vendedorOk, obtenerSaldo: saldo(12000), crearCobro } });
  assert.equal(r.error.status, 409);
  assert.doesNotMatch(r.error.message, /otra cuenta/);
  assert.match(r.error.message, /equipo/);
});

test('crear cobro: reutiliza el link vigente (reutilizado) y otros errores del cobro pasan tal cual', async () => {
  const { cliente } = baseFalsa({ turnos: TURNO_PROPIO });
  const reutiliza = async () => ({ data: { id: 77, monto: 12000, init_point: 'https://mp/x' }, reutilizado: true });
  const r = await crearCobroDelCliente({ idCliente: 5, idTurno: 12, cliente, deps: { resolverVendedor: vendedorOk, obtenerSaldo: saldo(12000), crearCobro: reutiliza } });
  assert.equal(r.data.reutilizado, true);
  const yaCobrado = async () => ({ error: { status: 409, message: 'Este turno ya fue cobrado.' } });
  const r2 = await crearCobroDelCliente({ idCliente: 5, idTurno: 12, cliente, deps: { resolverVendedor: vendedorOk, obtenerSaldo: saldo(12000), crearCobro: yaCobrado } });
  assert.equal(r2.error.message, 'Este turno ya fue cobrado.');
});

test('crear cobro: id de turno inválido da 400 sin consultar', async () => {
  for (const idTurno of ['abc', '0', '-1', '1.5', '', null, undefined]) {
    const { cliente, consultas } = baseFalsa();
    const r = await crearCobroDelCliente({ idCliente: 5, idTurno, cliente, deps: {} });
    assert.equal(r.error.status, 400, String(idTurno));
    assert.equal(consultas.length, 0);
  }
});

// ---- consultarCobroDelCliente -------------------------------------------------------------

test('consultar cobro: devuelve el estado con un mensaje pensado para el cliente', async () => {
  const { cliente } = baseFalsa({ turnos: TURNO_PROPIO });
  const llamadas = [];
  const consultarCobro = async (...args) => { llamadas.push(args); return { data: { estado: 'Aprobado', impactado: true, monto: 6000, mensaje: 'texto interno del staff' } }; };

  const r = await consultarCobroDelCliente({ idCliente: 5, idTurno: 12, cliente, deps: { resolverVendedor: vendedorOk, consultarCobro } });

  assert.deepEqual(llamadas[0], [3, 12]);
  assert.equal(r.data.estado, 'Aprobado');
  assert.equal(r.data.impactado, true);
  assert.equal(r.data.monto, 6000);
  assert.match(r.data.mensaje, /Recibimos tu pago de \$6\.000,00/);
  assert.doesNotMatch(r.data.mensaje, /staff|cuenta del cliente/);
});

test('consultar cobro: un turno ajeno da 404 y no consulta Mercado Pago', async () => {
  const { cliente } = baseFalsa({ turnos: { data: null, error: null } });
  let consultado = 0;
  const r = await consultarCobroDelCliente({ idCliente: 5, idTurno: 12, cliente, deps: { resolverVendedor: vendedorOk, consultarCobro: async () => { consultado += 1; } } });
  assert.equal(r.error.status, 404);
  assert.equal(consultado, 0);
});

// ---- mensajes -----------------------------------------------------------------------------

test('mensaje del cobro para el cliente, según el estado', () => {
  assert.match(armarMensajeCobroCliente({ estado: 'Aprobado', impactado: true, monto: 6000 }), /Recibimos tu pago de \$6\.000,00/);
  assert.match(armarMensajeCobroCliente({ estado: 'Aprobado', impactado: false, monto: 6000 }), /aprobó tu pago/);
  assert.match(armarMensajeCobroCliente({ estado: 'Pendiente', impactado: false, monto: 6000 }), /Todavía no recibimos tu pago de \$6\.000,00/);
  assert.match(armarMensajeCobroCliente({ estado: 'Rechazado', impactado: false, monto: 6000 }), /rechazó/);
  assert.match(armarMensajeCobroCliente({ estado: 'Expirado', impactado: false, monto: 6000 }), /venció/);
  assert.match(armarMensajeCobroCliente({ estado: 'Cancelado', impactado: false, monto: 6000 }), /venció|cancel/i);
  assert.match(armarMensajeCobroCliente({ estado: 'Sin cobro', impactado: false, monto: null }), /Todavía no generaste/);
});
