import test from 'node:test';
import assert from 'node:assert/strict';

// Isolated client: never uses the project's real credentials or database.
process.env.SUPABASE_URL = 'https://visita-rechazar-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'visita-rechazar-tests-sin-conexion';

const { rechazarVisita, variantesWaId, armarAvisoRechazo, MAX_MOTIVO_RECHAZO } = await import('../services/rechazoVisitaService.js');

const AHORA = new Date('2026-11-23T15:00:00Z');

const SOLICITUD = {
  id_solicitud: 12, estado: 'Pendiente', tipo_solicitud: null, id_cliente: null, id_inmueble: null,
  nombre: 'Ana', apellido: 'Perez', telefono: '5493514330429',
};

// Fake Supabase client: records every query and resolves by "tabla:operacion".
const crearDb = (respuestas = {}) => {
  const consultas = [];
  return {
    consultas,
    from(tabla) {
      const consulta = { tabla, ops: [] };
      consultas.push(consulta);
      const operacion = () => (['update', 'delete'].find((o) => consulta.ops.some(([op]) => op === o)) ?? 'select');
      const resolver = () => {
        const valor = respuestas[`${tabla}:${operacion()}`];
        return typeof valor === 'function' ? valor(consulta) : (valor ?? { data: null, error: null });
      };
      const builder = {};
      for (const op of ['select', 'eq', 'in', 'update', 'delete']) {
        builder[op] = (...args) => { consulta.ops.push([op, ...args]); return builder; };
      }
      builder.maybeSingle = () => Promise.resolve(resolver());
      builder.then = (resolve, reject) => Promise.resolve(resolver()).then(resolve, reject);
      return builder;
    },
  };
};

const respuestasOk = (solicitud = SOLICITUD) => ({
  'solicitudes_visita:select': { data: solicitud, error: null },
  'solicitudes_visita:update': (c) => ({ data: { ...solicitud, ...c.ops.find(([o]) => o === 'update')[1] }, error: null }),
  'sesiones_wa:delete': { data: null, error: null },
});

const avisoOk = () => {
  const enviados = [];
  return { enviados, enviar: async (body) => { enviados.push(body); return { enviado: true, motivo: null }; } };
};

const ejecutar = (body, db, aviso = avisoOk()) =>
  rechazarVisita({ idSolicitud: 12, idUsuario: 3, body, ahora: AHORA, db, enviarAviso: aviso.enviar });

const opsDe = (db, tabla, op) => db.consultas.find((c) => c.tabla === tabla && c.ops.some(([o]) => o === op));

// ---- happy path ---------------------------------------------------------------

for (const estado of ['Pendiente', 'Contactada']) {
  test(`rechazarVisita: una solicitud de contacto nuevo en ${estado} queda Rechazada con motivo, fecha y quién`, async () => {
    const db = crearDb(respuestasOk({ ...SOLICITUD, estado }));
    const resultado = await ejecutar({ motivo: '  Fuera de la zona de trabajo  ' }, db);

    assert.equal(resultado.error, undefined);
    const update = opsDe(db, 'solicitudes_visita', 'update');
    assert.deepEqual(update.ops.find(([o]) => o === 'update')[1], {
      estado: 'Rechazada',
      motivo_rechazo: 'Fuera de la zona de trabajo',
      fecha_rechazo: AHORA.toISOString(),
      rechazada_por: 3,
    });
    // Race guard: only rejects if the row is still in the state that was read.
    assert.deepEqual(update.ops.filter(([o]) => o === 'eq'), [['eq', 'id_solicitud', 12], ['eq', 'estado', estado]]);
    assert.equal(resultado.rechazada.estado, 'Rechazada');
  });
}

test('rechazarVisita: borra la sesión de WhatsApp del número, con y sin el 9', async () => {
  const db = crearDb(respuestasOk());
  const resultado = await ejecutar({}, db);
  const borrado = opsDe(db, 'sesiones_wa', 'delete');
  assert.deepEqual(borrado.ops.find(([o]) => o === 'in'), ['in', 'wa_id', ['5493514330429', '543514330429']]);
  assert.equal(resultado.sesionBorrada, true);
});

test('rechazarVisita: avisa al número con el motivo por el webhook del aviso', async () => {
  const db = crearDb(respuestasOk());
  const aviso = avisoOk();
  const resultado = await ejecutar({ motivo: 'Fuera de zona' }, db, aviso);
  assert.deepEqual(aviso.enviados, [{ tipo: 'rechazo_visita', telefono: '5493514330429', nombre: 'Ana', motivo: 'Fuera de zona' }]);
  assert.deepEqual(resultado.aviso, { enviado: true, motivo: null });
});

test('rechazarVisita: sin motivo queda null y el aviso sale igual, sin motivo', async () => {
  const db = crearDb(respuestasOk());
  const aviso = avisoOk();
  await ejecutar({ motivo: '   ' }, db, aviso);
  assert.equal(opsDe(db, 'solicitudes_visita', 'update').ops.find(([o]) => o === 'update')[1].motivo_rechazo, null);
  assert.equal(aviso.enviados[0].motivo, null);
});

test('rechazarVisita: si falla el borrado de la sesión o el aviso, el rechazo igual queda hecho', async () => {
  const db = crearDb({ ...respuestasOk(), 'sesiones_wa:delete': { data: null, error: { message: 'boom' } } });
  const resultado = await rechazarVisita({
    idSolicitud: 12, idUsuario: 3, body: {}, ahora: AHORA, db,
    enviarAviso: async () => { throw new Error('caido'); },
  });
  assert.equal(resultado.error, undefined);
  assert.equal(resultado.rechazada.estado, 'Rechazada');
  assert.equal(resultado.sesionBorrada, false);
  assert.deepEqual(resultado.aviso, { enviado: false, motivo: 'error_inesperado' });
});

// ---- rejections -----------------------------------------------------------------

for (const estado of ['Confirmada', 'Realizada', 'Cancelada', 'Rechazada']) {
  test(`rechazarVisita: una solicitud en ${estado} no se puede rechazar (409) y no toca nada`, async () => {
    const db = crearDb(respuestasOk({ ...SOLICITUD, estado }));
    const aviso = avisoOk();
    const resultado = await ejecutar({}, db, aviso);
    assert.equal(resultado.error.status, 409);
    assert.match(resultado.error.message, /Pendiente, Contactada/);
    assert.equal(opsDe(db, 'solicitudes_visita', 'update'), undefined);
    assert.equal(opsDe(db, 'sesiones_wa', 'delete'), undefined);
    assert.equal(aviso.enviados.length, 0);
  });
}

test('rechazarVisita: el pedido de un cliente registrado no se rechaza (409): se cancela', async () => {
  for (const extra of [{ tipo_solicitud: 'cliente' }, { id_cliente: 42 }]) {
    const db = crearDb(respuestasOk({ ...SOLICITUD, ...extra }));
    const resultado = await ejecutar({}, db);
    assert.equal(resultado.error.status, 409, JSON.stringify(extra));
    assert.match(resultado.error.message, /cliente registrado/);
    assert.equal(opsDe(db, 'solicitudes_visita', 'update'), undefined);
  }
});

test('rechazarVisita: id inexistente devuelve 404', async () => {
  const db = crearDb({ 'solicitudes_visita:select': { data: null, error: null } });
  const resultado = await ejecutar({}, db);
  assert.equal(resultado.error.status, 404);
});

test('rechazarVisita: motivo que no es texto o demasiado largo devuelve 400 sin tocar la base', async () => {
  for (const motivo of [123, 'x'.repeat(MAX_MOTIVO_RECHAZO + 1)]) {
    const db = crearDb(respuestasOk());
    const resultado = await ejecutar({ motivo }, db);
    assert.equal(resultado.error.status, 400);
    assert.match(resultado.error.message, /motivo/);
    assert.equal(db.consultas.length, 0);
  }
});

test('rechazarVisita: si otra conversación la cambió antes (update sin filas) devuelve 409 y no borra la sesión', async () => {
  const db = crearDb({ ...respuestasOk(), 'solicitudes_visita:update': { data: null, error: null } });
  const resultado = await ejecutar({}, db);
  assert.equal(resultado.error.status, 409);
  assert.equal(opsDe(db, 'sesiones_wa', 'delete'), undefined);
});

// ---- helpers --------------------------------------------------------------------

test('variantesWaId: el canónico con 9 y la forma en que suele llegar el wa_id', () => {
  assert.deepEqual(variantesWaId('5493514330429'), ['5493514330429', '543514330429']);
  assert.deepEqual(variantesWaId('3514330429'), ['5493514330429', '543514330429']);
  assert.deepEqual(variantesWaId('nada'), []);
});

test('armarAvisoRechazo: sin teléfono válido no se avisa', () => {
  assert.deepEqual(armarAvisoRechazo({ telefono: '' }, null), { ok: false, motivo: 'sin_telefono' });
});

// ---- controller and route -------------------------------------------------------

const { rechazarSolicitudVisita } = await import('../controllers/rechazoVisitaController.js');
const { default: visitasRoutes } = await import('../routes/visitas.routes.js');

const crearRes = () => ({ status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } });

test('rechazarSolicitudVisita: responde 200 con el estado de la sesión y del aviso', async () => {
  const res = crearRes();
  let recibido;
  await rechazarSolicitudVisita(
    { params: { id: '12' }, usuario: { id: 3 }, body: { motivo: 'Fuera de zona' } },
    res,
    { rechazar: async (args) => { recibido = args; return { solicitud: SOLICITUD, rechazada: { ...SOLICITUD, estado: 'Rechazada' }, sesionBorrada: true, aviso: { enviado: false, motivo: 'fuera_de_ventana' } }; } },
  );
  assert.deepEqual(recibido, { idSolicitud: 12, idUsuario: 3, body: { motivo: 'Fuera de zona' } });
  assert.equal(res.code, 200);
  assert.equal(res.body.mensaje, 'La solicitud de Ana Perez quedó rechazada.');
  assert.equal(res.body.sesion_borrada, true);
  assert.equal(res.body.aviso_enviado, false);
  assert.equal(res.body.aviso_motivo, 'fuera_de_ventana');
});

test('rechazarSolicitudVisita: id inválido devuelve 400 y un error del servicio se traduce', async () => {
  const invalido = crearRes();
  await rechazarSolicitudVisita({ params: { id: 'abc' }, body: {} }, invalido, { rechazar: async () => assert.fail('no debe llamar') });
  assert.equal(invalido.code, 400);

  const conflicto = crearRes();
  await rechazarSolicitudVisita({ params: { id: '12' }, body: {} }, conflicto,
    { rechazar: async () => ({ error: { status: 409, message: 'no' } }) });
  assert.equal(conflicto.code, 409);
  assert.deepEqual(conflicto.body, { ok: false, error: 'no' });
});

test('visitas.routes: POST /:id/rechazar está registrada', () => {
  const capa = visitasRoutes.stack.find((l) => l.route?.path === '/:id/rechazar');
  assert.ok(capa?.route?.methods?.post);
});
