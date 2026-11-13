import test from 'node:test';
import assert from 'node:assert/strict';

// Isolated client: never uses the project's real credentials or database.
process.env.SUPABASE_URL = 'https://bot-solicitud-cliente-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'bot-solicitud-cliente-tests-sin-conexion';

const { crearSolicitudCliente } = await import('../services/solicitudClienteService.js');
const { crearSolicitudClienteBot } = await import('../controllers/botSolicitudesClienteController.js');
const { default: botRoutes } = await import('../routes/bot.routes.js');

const AHORA_FIJO = new Date('2026-11-12T15:00:00Z'); // 2026-11-12 in Argentina

const CLIENTE = { id_cliente: 42, nombre: 'Lucas', apellido: 'Aguirre', telefono: '5493514330429' };

const INMUEBLE = {
  id_inmueble: 7,
  id_cliente: 42,
  activo: true,
  direccion: 'Capitán Martel 1900',
  barrio: 'Centro',
  provincia: 'Córdoba',
  latitud: -31.4,
  longitud: -64.18,
  superficie_mantenible: 120,
  superficie_total: 300,
};

const SERVICIOS = [
  { id_servicio: 3, nombre: 'Cortar Pasto', descripcion: null },
  { id_servicio: 5, nombre: 'Poda de árboles', descripcion: null },
];

// Fake Supabase client: records every query and resolves by "tabla:operacion".
const crearDb = (respuestas = {}) => {
  const consultas = [];
  return {
    consultas,
    from(tabla) {
      const consulta = { tabla, ops: [] };
      consultas.push(consulta);
      const resolver = () => {
        const operacion = consulta.ops.some(([op]) => op === 'insert') ? 'insert' : 'select';
        const valor = respuestas[`${tabla}:${operacion}`];
        return typeof valor === 'function' ? valor(consulta) : (valor ?? { data: null, error: null });
      };
      const builder = {};
      for (const op of ['select', 'eq', 'is', 'in', 'limit', 'order', 'insert']) {
        builder[op] = (...args) => { consulta.ops.push([op, ...args]); return builder; };
      }
      builder.maybeSingle = () => Promise.resolve(resolver());
      builder.single = () => Promise.resolve(resolver());
      builder.then = (resolve, reject) => Promise.resolve(resolver()).then(resolve, reject);
      return builder;
    },
  };
};

const respuestasOk = (extra = {}) => ({
  'inmuebles:select': { data: INMUEBLE, error: null },
  'solicitudes_visita:select': { data: [], error: null },
  'solicitudes_visita:insert': (consulta) => ({
    data: { id_solicitud: 90, ...consulta.ops.find(([op]) => op === 'insert')[1] },
    error: null,
  }),
  'solicitud_servicio:insert': { data: null, error: null },
  ...extra,
});

const listarServicios = async () => ({ data: SERVICIOS });

const BODY_OK = {
  id_inmueble: 7,
  id_servicio: 3,
  fecha_preferida: '2026-11-20',
  franja_preferida: 'Mañana',
  nota_horario: 'Después de las 9',
};

const ejecutar = (body, db, extra = {}) =>
  crearSolicitudCliente({ cliente: CLIENTE, body, ahora: AHORA_FIJO, db, listarServicios, ...extra });

const insertDe = (db, tabla) =>
  db.consultas.find((c) => c.tabla === tabla && c.ops.some(([op]) => op === 'insert'))?.ops.find(([op]) => op === 'insert')[1];

// ---- validation ---------------------------------------------------------------

test('crearSolicitudCliente: sin id_inmueble ni id_servicio devuelve 400 con los dos errores juntos', async () => {
  const db = crearDb(respuestasOk());
  const resultado = await ejecutar({}, db);
  assert.equal(resultado.error.status, 400);
  assert.match(resultado.error.message, /id_inmueble/);
  assert.match(resultado.error.message, /id_servicio/);
  assert.equal(db.consultas.length, 0, 'no toca la base si el body es inválido');
});

test('crearSolicitudCliente: franja inválida y fecha pasada devuelven 400', async () => {
  const db = crearDb(respuestasOk());
  const resultado = await ejecutar({ ...BODY_OK, franja_preferida: 'Noche', fecha_preferida: '2026-11-01' }, db);
  assert.equal(resultado.error.status, 400);
  assert.match(resultado.error.message, /franja_preferida inválida: "Noche"/);
  assert.match(resultado.error.message, /fecha_preferida no puede ser anterior a hoy/);
});

test('crearSolicitudCliente: un inmueble que no es del cliente (o está inactivo) devuelve 404', async () => {
  const db = crearDb(respuestasOk({ 'inmuebles:select': { data: null, error: null } }));
  const resultado = await ejecutar(BODY_OK, db);
  assert.equal(resultado.error.status, 404);
  const consulta = db.consultas.find((c) => c.tabla === 'inmuebles');
  assert.deepEqual(consulta.ops.filter(([op]) => op === 'eq'), [
    ['eq', 'id_inmueble', 7],
    ['eq', 'id_cliente', 42],
    ['eq', 'activo', true],
  ]);
  assert.equal(insertDe(db, 'solicitudes_visita'), undefined);
});

test('crearSolicitudCliente: un servicio fuera del catálogo activo devuelve 400', async () => {
  const db = crearDb(respuestasOk());
  const resultado = await ejecutar({ ...BODY_OK, id_servicio: 99 }, db);
  assert.equal(resultado.error.status, 400);
  assert.match(resultado.error.message, /servicio/i);
  assert.equal(insertDe(db, 'solicitudes_visita'), undefined);
});

test('crearSolicitudCliente: si el inmueble ya tiene un pedido abierto devuelve 409 y no crea otro', async () => {
  const db = crearDb(respuestasOk({ 'solicitudes_visita:select': { data: [{ id_solicitud: 55 }], error: null } }));
  const resultado = await ejecutar(BODY_OK, db);
  assert.equal(resultado.error.status, 409);
  assert.match(resultado.error.message, /#55/);
  const busqueda = db.consultas.find((c) => c.tabla === 'solicitudes_visita');
  assert.deepEqual(busqueda.ops.filter(([op]) => op === 'eq' || op === 'is'), [
    ['eq', 'id_inmueble', 7],
    ['eq', 'tipo_solicitud', 'cliente'],
    ['eq', 'estado', 'Confirmada'],
    ['is', 'id_turno', null],
  ]);
  assert.equal(insertDe(db, 'solicitudes_visita'), undefined);
});

test('crearSolicitudCliente: el 409 de un pedido que ya tiene presupuesto habla del turno, no del presupuesto', async () => {
  const db = crearDb(respuestasOk({
    'solicitudes_visita:select': { data: [{ id_solicitud: 55, id_presupuesto: 12 }], error: null },
  }));
  const resultado = await ejecutar(BODY_OK, db);
  assert.equal(resultado.error.status, 409);
  assert.match(resultado.error.message, /turno/);
  assert.doesNotMatch(resultado.error.message, /enviar el presupuesto/);
});

test('crearSolicitudCliente: si la base rechaza un pedido abierto duplicado (23505) devuelve 409', async () => {
  const db = crearDb(respuestasOk({
    'solicitudes_visita:insert': { data: null, error: { code: '23505', message: 'duplicate key' } },
  }));
  const resultado = await ejecutar(BODY_OK, db);
  assert.equal(resultado.error.status, 409);
  assert.match(resultado.error.message, /pedido en curso/);
  assert.equal(insertDe(db, 'solicitud_servicio'), undefined);
});

// ---- success ------------------------------------------------------------------

test('crearSolicitudCliente: crea la solicitud Confirmada de tipo cliente con los datos del cliente y del inmueble', async () => {
  const db = crearDb(respuestasOk());
  const resultado = await ejecutar(BODY_OK, db);

  assert.equal(resultado.error, undefined);
  assert.deepEqual(insertDe(db, 'solicitudes_visita'), {
    telefono: '5493514330429',
    nombre: 'Lucas',
    apellido: 'Aguirre',
    direccion: 'Capitán Martel 1900',
    barrio: 'Centro',
    provincia: 'Córdoba',
    latitud: -31.4,
    longitud: -64.18,
    superficie_aproximada: 120,
    servicio: 'Cortar Pasto',
    fecha_preferida: '2026-11-20',
    franja_preferida: 'Mañana',
    nota_horario: 'Después de las 9',
    id_cliente: 42,
    id_inmueble: 7,
    estado: 'Confirmada',
    tipo_solicitud: 'cliente',
  });
  assert.equal(resultado.solicitud.id_solicitud, 90);
  assert.equal(resultado.servicio.nombre, 'Cortar Pasto');
  assert.equal(resultado.servicioCargado, true);
});

test('crearSolicitudCliente: precarga el servicio con los m² mantenibles del inmueble', async () => {
  const db = crearDb(respuestasOk());
  await ejecutar(BODY_OK, db);
  assert.deepEqual(insertDe(db, 'solicitud_servicio'), { id_solicitud: 90, id_servicio: 3, superficie_m2: 120 });
});

test('crearSolicitudCliente: sin m² mantenibles usa la superficie total; sin ninguna no precarga el servicio', async () => {
  const conTotal = crearDb(respuestasOk({
    'inmuebles:select': { data: { ...INMUEBLE, superficie_mantenible: null }, error: null },
  }));
  await ejecutar(BODY_OK, conTotal);
  assert.equal(insertDe(conTotal, 'solicitud_servicio').superficie_m2, 300);

  const sinSuperficie = crearDb(respuestasOk({
    'inmuebles:select': { data: { ...INMUEBLE, superficie_mantenible: null, superficie_total: null }, error: null },
  }));
  const resultado = await ejecutar(BODY_OK, sinSuperficie);
  assert.equal(insertDe(sinSuperficie, 'solicitud_servicio'), undefined);
  assert.equal(insertDe(sinSuperficie, 'solicitudes_visita').superficie_aproximada, null);
  assert.equal(resultado.servicioCargado, false);
});

test('crearSolicitudCliente: sin franja usa Indistinto y los opcionales vacíos quedan en null', async () => {
  const db = crearDb(respuestasOk());
  await ejecutar({ id_inmueble: '7', id_servicio: '3' }, db);
  const fila = insertDe(db, 'solicitudes_visita');
  assert.equal(fila.franja_preferida, 'Indistinto');
  assert.equal(fila.fecha_preferida, null);
  assert.equal(fila.nota_horario, null);
});

test('crearSolicitudCliente: si falla la precarga del servicio la solicitud igual se crea', async () => {
  const db = crearDb(respuestasOk({ 'solicitud_servicio:insert': { data: null, error: { message: 'boom' } } }));
  const errorOriginal = console.error;
  console.error = () => {};
  try {
    const resultado = await ejecutar(BODY_OK, db);
    assert.equal(resultado.error, undefined);
    assert.equal(resultado.servicioCargado, false);
  } finally {
    console.error = errorOriginal;
  }
});

// ---- controller and route -----------------------------------------------------

const respuesta = () => {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};

test('crearSolicitudClienteBot: responde 201 con la solicitud y un mensaje para el cliente', async () => {
  const res = respuesta();
  await crearSolicitudClienteBot(
    { cliente: CLIENTE, body: BODY_OK },
    res,
    { crear: async () => ({ solicitud: { id_solicitud: 90, direccion: 'Capitán Martel 1900' }, servicio: SERVICIOS[0], servicioCargado: true }) },
  );
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.data.id_solicitud, 90);
  assert.equal(res.body.servicio_cargado, true);
  assert.match(res.body.mensaje, /Cortar Pasto/);
  assert.match(res.body.mensaje, /Capitán Martel 1900/);
});

test('crearSolicitudClienteBot: traduce el error del servicio a { ok: false, error }', async () => {
  const res = respuesta();
  await crearSolicitudClienteBot(
    { cliente: CLIENTE, body: {} },
    res,
    { crear: async () => ({ error: { status: 409, message: 'Ya hay un pedido en curso.' } }) },
  );
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, { ok: false, error: 'Ya hay un pedido en curso.' });
});

test('bot.routes: POST /clientes/:telefono/solicitudes resuelve el cliente por teléfono antes del handler', () => {
  const capa = botRoutes.stack.find((l) => l.route?.path === '/clientes/:telefono/solicitudes');
  assert.ok(capa, 'la ruta existe');
  assert.equal(capa.route.methods.post, true);
  const nombres = capa.route.stack.map((s) => s.handle.name);
  assert.deepEqual(nombres, ['resolverClientePorTelefono', 'crearSolicitudClienteBot']);
});
