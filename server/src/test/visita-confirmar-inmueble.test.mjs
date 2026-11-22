import test from 'node:test';
import assert from 'node:assert/strict';

// Isolated client: never uses the project's real credentials or database.
process.env.SUPABASE_URL = 'https://visita-confirmar-inmueble-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'visita-confirmar-inmueble-tests-sin-conexion';

const { supabaseAdmin } = await import('../config/supabase.js');
const { confirmarVisita, agendarTurnoVisita } = await import('../services/visitaFlujoService.js');

const SOLICITUD_BASE = {
  id_solicitud: 30,
  estado: 'Contactada',
  telefono: '5493514330429',
  nombre: 'Lucas',
  apellido: 'Aguirre',
  direccion: 'Capitán Martel 1900',
  barrio: 'Centro',
  provincia: 'Córdoba',
  latitud: -31.4,
  longitud: -64.18,
  superficie_aproximada: 500,
  id_cliente: 42,
  id_inmueble: null,
};

// Fake supabaseAdmin.from: records every query; answers by "tabla:operacion".
const mockBase = (t, respuestas) => {
  const consultas = [];
  t.mock.method(supabaseAdmin, 'from', (tabla) => {
    const consulta = { tabla, ops: [] };
    consultas.push(consulta);
    const operacion = () => {
      for (const op of ['insert', 'update']) if (consulta.ops.some(([o]) => o === op)) return op;
      return 'select';
    };
    const resolver = () => {
      const valor = respuestas[`${tabla}:${operacion()}`];
      return typeof valor === 'function' ? valor(consulta) : (valor ?? { data: null, error: null });
    };
    const builder = {};
    for (const op of ['select', 'eq', 'neq', 'not', 'lt', 'gt', 'is', 'in', 'limit', 'insert', 'update']) {
      builder[op] = (...args) => { consulta.ops.push([op, ...args]); return builder; };
    }
    builder.maybeSingle = () => Promise.resolve(resolver());
    builder.single = () => Promise.resolve(resolver());
    builder.then = (resolve, reject) => Promise.resolve(resolver()).then(resolve, reject);
    return builder;
  });
  return consultas;
};

const opDe = (consultas, tabla, op) =>
  consultas.find((c) => c.tabla === tabla && c.ops.some(([o]) => o === op));

const BODY = { tipo_inmueble: 'Lote Vacio', superficie_total: 420 };

test('confirmarVisita: una solicitud de cliente con inmueble ya cargado actualiza ese inmueble con la medida real', async (t) => {
  const consultas = mockBase(t, {
    'solicitudes_visita:select': { data: { ...SOLICITUD_BASE, id_inmueble: 7 }, error: null },
    'inmuebles:update': { data: { id_inmueble: 7, superficie_total: 420 }, error: null },
    'solicitudes_visita:update': (c) => ({ data: { ...SOLICITUD_BASE, ...c.ops.find(([o]) => o === 'update')[1] }, error: null }),
  });

  const resultado = await confirmarVisita(30, BODY);

  assert.equal(resultado.error, undefined);
  assert.equal(opDe(consultas, 'inmuebles', 'insert'), undefined, 'no crea un inmueble duplicado');
  const update = opDe(consultas, 'inmuebles', 'update');
  assert.deepEqual(update.ops.find(([o]) => o === 'update')[1], {
    tipo_inmueble: 'Lote Vacio',
    superficie_total: 420,
    superficie_mantenible: null,
    provincia: 'Córdoba',
  });
  assert.deepEqual(update.ops.filter(([o]) => o === 'eq'), [
    ['eq', 'id_inmueble', 7],
    ['eq', 'id_cliente', 42],
    ['eq', 'activo', true],
  ]);
  assert.equal(resultado.inmueble.id_inmueble, 7);
  const solicitudUpdate = opDe(consultas, 'solicitudes_visita', 'update').ops.find(([o]) => o === 'update')[1];
  assert.deepEqual(solicitudUpdate, { id_cliente: 42, id_inmueble: 7, estado: 'Confirmada' });
});

test('confirmarVisita: si el inmueble de la solicitud ya no es del cliente o fue dado de baja devuelve 409 y no confirma', async (t) => {
  const consultas = mockBase(t, {
    'solicitudes_visita:select': { data: { ...SOLICITUD_BASE, id_inmueble: 7 }, error: null },
    'inmuebles:update': { data: null, error: null },
  });

  const resultado = await confirmarVisita(30, BODY);

  assert.equal(resultado.error.status, 409);
  assert.equal(opDe(consultas, 'solicitudes_visita', 'update'), undefined);
});

test('confirmarVisita: una solicitud sin inmueble sigue creando uno nuevo (flujo de visita de siempre)', async (t) => {
  const consultas = mockBase(t, {
    'solicitudes_visita:select': { data: SOLICITUD_BASE, error: null },
    'inmuebles:insert': (c) => ({ data: { id_inmueble: 99, ...c.ops.find(([o]) => o === 'insert')[1] }, error: null }),
    'solicitudes_visita:update': (c) => ({ data: { ...SOLICITUD_BASE, ...c.ops.find(([o]) => o === 'update')[1] }, error: null }),
  });

  const resultado = await confirmarVisita(30, BODY);

  assert.equal(resultado.error, undefined);
  assert.equal(opDe(consultas, 'inmuebles', 'update'), undefined);
  assert.deepEqual(opDe(consultas, 'inmuebles', 'insert').ops.find(([o]) => o === 'insert')[1], {
    id_cliente: 42,
    direccion: 'Capitán Martel 1900',
    barrio: 'Centro',
    provincia: 'Córdoba',
    tipo_inmueble: 'Lote Vacio',
    superficie_total: 420,
    superficie_mantenible: null,
    latitud: -31.4,
    longitud: -64.18,
  });
  assert.equal(resultado.inmueble.id_inmueble, 99);
});

test('agendarTurnoVisita: un turno agendado desde solicitudes se crea en estado Confirmado', async (t) => {
  const consultas = mockBase(t, {
    'solicitudes_visita:select': {
      data: { ...SOLICITUD_BASE, estado: 'Confirmada', id_inmueble: 7, id_presupuesto: 15 },
      error: null,
    },
    'presupuestos:select': {
      data: { id_presupuesto: 15, estado: 'Aceptado' },
      error: null,
    },
    'turnos:select': { data: [], error: null },
    'turnos:insert': (c) => ({
      data: { id_turno: 501, ...c.ops.find(([o]) => o === 'insert')[1] },
      error: null,
    }),
    'solicitudes_visita:update': (c) => ({
      data: { ...SOLICITUD_BASE, ...c.ops.find(([o]) => o === 'update')[1] },
      error: null,
    }),
  });

  const resultado = await agendarTurnoVisita(30, {
    fecha_programada: '2099-12-20',
    inicio_desde: '09:00',
    hasta: '11:00',
    prioridad: 'P3_Casual',
  });

  assert.equal(resultado.error, undefined);
  const insertTurno = opDe(consultas, 'turnos', 'insert').ops.find(([o]) => o === 'insert')[1];
  assert.equal(insertTurno.estado, 'Confirmado');
  assert.equal(resultado.turno.estado, 'Confirmado');
});

// ---- Aviso del turno por WhatsApp al agendar desde una solicitud ---------------------------

const respuestasAgendar = () => ({
  'solicitudes_visita:select': {
    data: { ...SOLICITUD_BASE, estado: 'Confirmada', id_inmueble: 7, id_presupuesto: 15 },
    error: null,
  },
  'presupuestos:select': (c) => {
    const campos = c.ops.find(([o]) => o === 'select')[1];
    return campos.includes('monto_total')
      ? { data: { monto_total: 17400 }, error: null }
      : { data: { id_presupuesto: 15, estado: 'Aceptado' }, error: null };
  },
  'detalle_presupuesto:select': { data: [{ servicio: { nombre: 'Corte de césped' } }], error: null },
  'turnos:select': (c) => {
    const campos = c.ops.find(([o]) => o === 'select')[1];
    return campos.includes('inmueble:inmuebles')
      ? {
        data: {
          id_turno: 501, id_presupuesto: 15, fecha_programada: '2099-12-20', inicio_desde: '09:00:00', hasta: '11:00:00', estado: 'Confirmado',
          inmueble: { direccion: 'Capitán Martel 1900', provincia: 'Córdoba', cliente: { nombre: 'Lucas', telefono: '5493514330429' } },
        },
        error: null,
      }
      : { data: [], error: null };
  },
  'turnos:insert': (c) => ({ data: { id_turno: 501, ...c.ops.find(([o]) => o === 'insert')[1] }, error: null }),
  'solicitudes_visita:update': (c) => ({ data: { ...SOLICITUD_BASE, ...c.ops.find(([o]) => o === 'update')[1] }, error: null }),
});

const BODY_TURNO = { fecha_programada: '2099-12-20', inicio_desde: '09:00', hasta: '11:00', prioridad: 'P3_Casual' };

const conAvisoConfigurado = (t) => {
  const anterior = { url: process.env.N8N_AVISO_TURNO_URL, clave: process.env.BOT_API_KEY };
  process.env.N8N_AVISO_TURNO_URL = 'https://n8n.test/webhook/aviso-turno';
  process.env.BOT_API_KEY = 'clave-de-prueba';
  t.after(() => {
    if (anterior.url === undefined) delete process.env.N8N_AVISO_TURNO_URL; else process.env.N8N_AVISO_TURNO_URL = anterior.url;
    if (anterior.clave === undefined) delete process.env.BOT_API_KEY; else process.env.BOT_API_KEY = anterior.clave;
  });
};

test('agendarTurnoVisita: avisa al cliente por WhatsApp una sola vez, con el precio final y los datos del turno', async (t) => {
  conAvisoConfigurado(t);
  mockBase(t, respuestasAgendar());
  const llamadas = [];
  t.mock.method(globalThis, 'fetch', async (url, opciones) => {
    llamadas.push({ url, body: JSON.parse(opciones.body), clave: opciones.headers['x-api-key'] });
    return { ok: true, status: 200, json: async () => ({ ok: true, enviado: true }) };
  });

  const resultado = await agendarTurnoVisita(30, BODY_TURNO);

  assert.equal(resultado.error, undefined);
  assert.deepEqual(resultado.aviso, { enviado: true, motivo: null });
  assert.equal(llamadas.length, 1, 'un solo envío por turno');
  assert.equal(llamadas[0].url, 'https://n8n.test/webhook/aviso-turno');
  assert.equal(llamadas[0].clave, 'clave-de-prueba');
  assert.deepEqual(llamadas[0].body, {
    telefono: '5493514330429',
    nombre: 'Lucas',
    servicio: 'Corte de césped',
    fecha: '2099-12-20',
    hora_desde: '09:00',
    hora_hasta: '11:00',
    direccion: 'Capitán Martel 1900, Córdoba',
    total: 17400,
  });
});

test('agendarTurnoVisita: si n8n falla o el cliente está fuera de las 24 h, el turno se agenda igual', async (t) => {
  conAvisoConfigurado(t);
  mockBase(t, respuestasAgendar());
  let llamadas = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    llamadas += 1;
    return { ok: true, status: 200, json: async () => ({ ok: false, enviado: false, motivo: 'fuera_de_ventana' }) };
  });

  const resultado = await agendarTurnoVisita(30, BODY_TURNO);

  assert.equal(resultado.error, undefined);
  assert.equal(resultado.turno.id_turno, 501);
  assert.equal(resultado.solicitudFinal.estado, 'Realizada');
  assert.deepEqual(resultado.aviso, { enviado: false, motivo: 'fuera_de_ventana' });
  assert.equal(llamadas, 1, 'no se reintenta');
});

test('agendarTurnoVisita: con n8n caído el turno se agenda y el aviso queda como no enviado', async (t) => {
  conAvisoConfigurado(t);
  mockBase(t, respuestasAgendar());
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('fetch failed'); });

  const resultado = await agendarTurnoVisita(30, BODY_TURNO);

  assert.equal(resultado.error, undefined);
  assert.equal(resultado.turno.id_turno, 501);
  assert.deepEqual(resultado.aviso, { enviado: false, motivo: 'sin_conexion' });
});

test('agendarTurnoVisita: sin el webhook configurado no se llama a nadie', async (t) => {
  const anterior = process.env.N8N_AVISO_TURNO_URL;
  delete process.env.N8N_AVISO_TURNO_URL;
  t.after(() => { if (anterior !== undefined) process.env.N8N_AVISO_TURNO_URL = anterior; });
  mockBase(t, respuestasAgendar());
  let llamadas = 0;
  t.mock.method(globalThis, 'fetch', async () => { llamadas += 1; });

  const resultado = await agendarTurnoVisita(30, BODY_TURNO);

  assert.equal(resultado.error, undefined);
  assert.deepEqual(resultado.aviso, { enviado: false, motivo: 'no_configurado' });
  assert.equal(llamadas, 0);
});

test('agendarTurnoVisita: un presupuesto sin precio final no dispara el aviso', async (t) => {
  conAvisoConfigurado(t);
  const respuestas = respuestasAgendar();
  respuestas['presupuestos:select'] = (c) => {
    const campos = c.ops.find(([o]) => o === 'select')[1];
    return campos.includes('monto_total')
      ? { data: { monto_total: 0 }, error: null }
      : { data: { id_presupuesto: 15, estado: 'Aceptado' }, error: null };
  };
  mockBase(t, respuestas);
  let llamadas = 0;
  t.mock.method(globalThis, 'fetch', async () => { llamadas += 1; });

  const resultado = await agendarTurnoVisita(30, BODY_TURNO);

  assert.equal(resultado.error, undefined);
  assert.deepEqual(resultado.aviso, { enviado: false, motivo: 'sin_precio' });
  assert.equal(llamadas, 0);
});
