import test from 'node:test';
import assert from 'node:assert/strict';

// Isolated client: never uses the project's real credentials or database.
process.env.SUPABASE_URL = 'https://bot-visitas-servicios-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'bot-visitas-servicios-tests-sin-conexion';

const { leerServiciosVisita } = await import('../controllers/botVisitasController.js');

test('leerServiciosVisita: sin servicio ni servicios devuelve null', () => {
  assert.deepEqual(leerServiciosVisita({}), { valor: null });
  assert.deepEqual(leerServiciosVisita({ servicio: '  ' }), { valor: null });
});

test('leerServiciosVisita: un servicio de texto queda igual que antes', () => {
  assert.deepEqual(leerServiciosVisita({ servicio: ' Poda ' }), { valor: 'Poda' });
});

test('leerServiciosVisita: servicios en array se guardan juntos, sin repetidos ni vacíos', () => {
  assert.deepEqual(
    leerServiciosVisita({ servicios: ['Cortar Pasto', ' Poda ', 'cortar pasto', ''] }),
    { valor: 'Cortar Pasto, Poda' },
  );
});

test('leerServiciosVisita: servicios gana sobre servicio cuando vienen los dos', () => {
  assert.deepEqual(leerServiciosVisita({ servicio: 'Poda', servicios: ['Cortar Pasto'] }), { valor: 'Cortar Pasto' });
});

test('leerServiciosVisita: servicios que no es una lista de textos, o con más de 10, devuelve error', () => {
  for (const servicios of ['Poda', [1, 2], Array.from({ length: 11 }, (_, i) => 'S' + i)]) {
    const r = leerServiciosVisita({ servicios });
    assert.match(r.error, /servicios/, JSON.stringify(servicios));
  }
});
