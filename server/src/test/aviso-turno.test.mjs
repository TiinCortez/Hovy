import test from 'node:test';
import assert from 'node:assert/strict';

// Cliente aislado: nunca usa credenciales ni base reales.
process.env.SUPABASE_URL = 'https://aviso-turno-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'aviso-turno-tests-sin-conexion';

const { armarDatosAviso, enviarAviso, avisarTurnoAsignado } = await import('../services/avisoTurnoService.js');

const DATOS = {
  turno: { id_turno: 12, fecha_programada: '2026-11-26', inicio_desde: '08:00:00', hasta: '10:00:00', estado: 'Confirmado' },
  inmueble: { direccion: 'San Lorenzo 287', provincia: 'Córdoba' },
  cliente: { nombre: 'Juan', telefono: '5493510000000' },
  servicios: ['Corte de césped'],
  total: 17400,
};

const respuesta = (status, json) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (json === undefined) throw new Error('sin cuerpo JSON');
    return json;
  },
});

const CONFIG = { url: 'https://n8n.test/webhook/aviso-turno', apiKey: 'clave-de-prueba' };

// ---- armarDatosAviso ---------------------------------------------------------

test('armarDatosAviso: arma el cuerpo que espera el workflow de n8n', () => {
  const r = armarDatosAviso(DATOS);
  assert.equal(r.ok, true);
  assert.deepEqual(r.body, {
    telefono: '5493510000000',
    nombre: 'Juan',
    servicio: 'Corte de césped',
    fecha: '2026-11-26',
    hora_desde: '08:00',
    hora_hasta: '10:00',
    direccion: 'San Lorenzo 287, Córdoba',
    total: 17400,
  });
});

test('armarDatosAviso: varios servicios se unen; la fecha puede venir como timestamp', () => {
  const r = armarDatosAviso({
    ...DATOS,
    turno: { ...DATOS.turno, fecha_programada: '2026-11-26T00:00:00+00:00' },
    servicios: ['Corte de césped', 'Poda'],
  });
  assert.equal(r.body.servicio, 'Corte de césped, Poda');
  assert.equal(r.body.fecha, '2026-11-26');
});

test('armarDatosAviso: sin franja horaria manda las horas en null', () => {
  const r = armarDatosAviso({ ...DATOS, turno: { ...DATOS.turno, inicio_desde: null, hasta: null } });
  assert.equal(r.ok, true);
  assert.equal(r.body.hora_desde, null);
  assert.equal(r.body.hora_hasta, null);
});

test('armarDatosAviso: sin servicios usa un nombre genérico en vez de fallar', () => {
  const r = armarDatosAviso({ ...DATOS, servicios: [] });
  assert.equal(r.ok, true);
  assert.ok(r.body.servicio.length > 0);
});

test('armarDatosAviso: solo se avisa con precio final (mayor a 0)', () => {
  for (const total of [0, null, undefined, '', -5, 'abc']) {
    const r = armarDatosAviso({ ...DATOS, total });
    assert.equal(r.ok, false, `total ${String(total)}`);
    assert.equal(r.motivo, 'sin_precio');
  }
});

test('armarDatosAviso: sin teléfono, sin fecha o turno cancelado no se avisa', () => {
  assert.equal(armarDatosAviso({ ...DATOS, cliente: { nombre: 'Juan', telefono: null } }).motivo, 'sin_telefono');
  assert.equal(armarDatosAviso({ ...DATOS, cliente: null }).motivo, 'sin_telefono');
  assert.equal(armarDatosAviso({ ...DATOS, turno: { ...DATOS.turno, fecha_programada: null } }).motivo, 'sin_fecha');
  assert.equal(armarDatosAviso({ ...DATOS, turno: { ...DATOS.turno, estado: 'Cancelado' } }).motivo, 'turno_cancelado');
});

// ---- enviarAviso -------------------------------------------------------------

test('enviarAviso: sin URL configurada no llama a nadie', async () => {
  let llamadas = 0;
  const r = await enviarAviso({ telefono: '1' }, { url: '', apiKey: 'x', fetch: async () => { llamadas++; } });
  assert.deepEqual(r, { enviado: false, motivo: 'no_configurado' });
  assert.equal(llamadas, 0);
});

test('enviarAviso: sin clave no llama a nadie', async () => {
  let llamadas = 0;
  const r = await enviarAviso({ telefono: '1' }, { url: CONFIG.url, apiKey: '', fetch: async () => { llamadas++; } });
  assert.deepEqual(r, { enviado: false, motivo: 'sin_clave' });
  assert.equal(llamadas, 0);
});

test('enviarAviso: éxito, con la clave en el header y el cuerpo como JSON', async () => {
  const llamadas = [];
  const fetchFalso = async (url, opciones) => { llamadas.push({ url, opciones }); return respuesta(200, { ok: true, enviado: true, id_mensaje: 'wamid.X' }); };
  const body = armarDatosAviso(DATOS).body;

  const r = await enviarAviso(body, { ...CONFIG, fetch: fetchFalso });

  assert.deepEqual(r, { enviado: true, motivo: null });
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].url, CONFIG.url);
  assert.equal(llamadas[0].opciones.method, 'POST');
  assert.equal(llamadas[0].opciones.headers['x-api-key'], 'clave-de-prueba');
  assert.equal(llamadas[0].opciones.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(llamadas[0].opciones.body), body);
  assert.ok(llamadas[0].opciones.signal, 'tiene tiempo máximo de espera');
});

test('enviarAviso: fuera de las 24 h devuelve el motivo y NO reintenta (no hay costo)', async () => {
  let llamadas = 0;
  const fetchFalso = async () => { llamadas++; return respuesta(200, { ok: false, enviado: false, motivo: 'fuera_de_ventana' }); };

  const r = await enviarAviso({ telefono: '1' }, { ...CONFIG, fetch: fetchFalso });

  assert.deepEqual(r, { enviado: false, motivo: 'fuera_de_ventana' });
  assert.equal(llamadas, 1, 'una sola llamada: nunca se reintenta');
});

test('enviarAviso: errores del workflow (401, 400, 5xx sin cuerpo) se traducen sin romper', async () => {
  assert.deepEqual(
    await enviarAviso({}, { ...CONFIG, fetch: async () => respuesta(401, { ok: false, motivo: 'no_autorizado' }) }),
    { enviado: false, motivo: 'no_autorizado' },
  );
  assert.deepEqual(
    await enviarAviso({}, { ...CONFIG, fetch: async () => respuesta(400, { ok: false, motivo: 'datos_invalidos' }) }),
    { enviado: false, motivo: 'datos_invalidos' },
  );
  assert.deepEqual(
    await enviarAviso({}, { ...CONFIG, fetch: async () => respuesta(502, undefined) }),
    { enviado: false, motivo: 'error_webhook_502' },
  );
});

test('enviarAviso: un 200 que no confirma el envío no se da por enviado', async () => {
  const r = await enviarAviso({}, { ...CONFIG, fetch: async () => respuesta(200, { ok: true }) });
  assert.equal(r.enviado, false);
});

test('enviarAviso: n8n caído o con timeout no lanza excepción', async () => {
  const caido = await enviarAviso({}, { ...CONFIG, fetch: async () => { throw new TypeError('fetch failed'); } });
  assert.deepEqual(caido, { enviado: false, motivo: 'sin_conexion' });

  const lento = await enviarAviso({}, { ...CONFIG, fetch: async () => { const e = new Error('timeout'); e.name = 'TimeoutError'; throw e; } });
  assert.deepEqual(lento, { enviado: false, motivo: 'timeout' });
});

// ---- avisarTurnoAsignado -----------------------------------------------------

test('avisarTurnoAsignado: arma y envía solo texto libre (nunca una plantilla)', async () => {
  const llamadas = [];
  const fetchFalso = async (url, opciones) => { llamadas.push(JSON.parse(opciones.body)); return respuesta(200, { ok: true, enviado: true }); };

  const r = await avisarTurnoAsignado(DATOS, { ...CONFIG, fetch: fetchFalso });

  assert.deepEqual(r, { enviado: true, motivo: null });
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].telefono, '5493510000000');
  assert.equal(llamadas[0].template, undefined, 'el cuerpo no trae nada de plantillas');
  assert.equal(llamadas[0].type, undefined);
});

test('avisarTurnoAsignado: sin precio no llama a n8n y explica el motivo', async () => {
  let llamadas = 0;
  const r = await avisarTurnoAsignado({ ...DATOS, total: 0 }, { ...CONFIG, fetch: async () => { llamadas++; } });
  assert.deepEqual(r, { enviado: false, motivo: 'sin_precio' });
  assert.equal(llamadas, 0);
});

test('avisarTurnoAsignado: nunca lanza, aunque los datos estén rotos', async () => {
  const r1 = await avisarTurnoAsignado(undefined, CONFIG);
  assert.equal(r1.enviado, false);
  const r2 = await avisarTurnoAsignado({ turno: null }, CONFIG);
  assert.equal(r2.enviado, false);
});

test('avisarTurnoAsignado: sin configuración (como en desarrollo y tests) no hace nada', async () => {
  const r = await avisarTurnoAsignado(DATOS, { url: undefined, apiKey: undefined });
  assert.deepEqual(r, { enviado: false, motivo: 'no_configurado' });
});
