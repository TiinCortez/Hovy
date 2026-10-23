import test from 'node:test';
import assert from 'node:assert/strict';

// Isolated client: these tests never touch the real project database.
process.env.SUPABASE_URL = 'https://salida-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'salida-tests-sin-conexion';

const {
  armarDomicilio,
  validarSalida,
  sugerirSalida,
  obtenerSalida,
  guardarSalida,
  quitarSalida,
} = await import('../services/salidaService.js');

// In-memory stand-in for the usuarios columns that hold the departure point.
const repoEnMemoria = (inicial = {}) => {
  const estado = { fila: { domicilio_base: null, latitud_base: null, longitud_base: null, ...inicial } };
  return {
    estado,
    leer: async () => ({ data: estado.fila }),
    guardar: async (idUsuario, valores) => {
      estado.fila = {
        domicilio_base: valores.domicilio,
        latitud_base: valores.latitud,
        longitud_base: valores.longitud,
      };
      return { data: estado.fila };
    },
    limpiar: async () => {
      estado.fila = { domicilio_base: null, latitud_base: null, longitud_base: null };
      return { data: estado.fila };
    },
  };
};

test('armarDomicilio: une solo las partes que existen', () => {
  assert.equal(
    armarDomicilio({ direccion: 'Belgrano 120', barrio: 'Centro', provincia: 'Jujuy' }),
    'Belgrano 120, Centro, Jujuy'
  );
  assert.equal(armarDomicilio({ direccion: null, barrio: 'Centro', provincia: 'Jujuy' }), 'Centro, Jujuy');
  assert.equal(armarDomicilio({ direccion: null, barrio: null, provincia: null }), null);
  assert.equal(armarDomicilio(undefined), null);
});

test('validarSalida: acepta coordenadas dentro de Argentina y las redondea a 5 decimales', () => {
  const r = validarSalida({ latitud: '-24.185812345', longitud: -65.299512345, domicilio: '  Belgrano 120  ' });
  assert.equal(r.error, undefined);
  assert.equal(r.valores.latitud, -24.18581);
  assert.equal(r.valores.longitud, -65.29951);
  assert.equal(r.valores.domicilio, 'Belgrano 120');
});

test('validarSalida: el domicilio es opcional', () => {
  const r = validarSalida({ latitud: -24.18, longitud: -65.3 });
  assert.equal(r.valores.domicilio, null);
});

test('validarSalida: rechaza coordenadas faltantes, invertidas o fuera de Argentina', () => {
  for (const body of [
    {},
    { latitud: -24.18 },
    { latitud: 'abc', longitud: -65.3 },
    { latitud: -65.3, longitud: -24.18 },
    { latitud: 40.7, longitud: -74 },
    null,
  ]) {
    assert.equal(validarSalida(body).error?.status, 400, JSON.stringify(body));
  }
});

test('validarSalida: rechaza un domicilio demasiado largo', () => {
  const r = validarSalida({ latitud: -24.18, longitud: -65.3, domicilio: 'x'.repeat(201) });
  assert.equal(r.error.status, 400);
});

test('sugerirSalida: devuelve la direccion aproximada de las coordenadas', async () => {
  const r = await sugerirSalida(
    { latitud: -24.1858, longitud: -65.2995 },
    { geocodificar: async () => ({ direccion: 'Belgrano 120', barrio: 'Centro', provincia: 'Jujuy' }) }
  );
  assert.equal(r.data.direccion, 'Belgrano 120, Centro, Jujuy');
  assert.equal(r.data.latitud, -24.1858);
  assert.equal(r.data.longitud, -65.2995);
});

test('sugerirSalida: si no se puede obtener la direccion igual devuelve las coordenadas', async () => {
  const r = await sugerirSalida(
    { latitud: -24.1858, longitud: -65.2995 },
    { geocodificar: async () => ({ direccion: null, barrio: null, provincia: null }) }
  );
  assert.equal(r.data.direccion, null);
  assert.equal(r.data.latitud, -24.1858);
});

test('sugerirSalida: coordenadas invalidas son un 400 y no consultan', async () => {
  const r = await sugerirSalida(
    { latitud: 40.7, longitud: -74 },
    { geocodificar: async () => assert.fail('no debe consultar') }
  );
  assert.equal(r.error.status, 400);
});

test('obtenerSalida: sin punto cargado devuelve configurada=false', async () => {
  const r = await obtenerSalida(1, { repo: repoEnMemoria() });
  assert.deepEqual(r.data, { configurada: false, domicilio: null, latitud: null, longitud: null });
});

test('guardarSalida y obtenerSalida: ida y vuelta', async () => {
  const repo = repoEnMemoria();
  const guardado = await guardarSalida(1, { latitud: -24.1858, longitud: -65.2995, domicilio: 'Belgrano 120' }, { repo });
  assert.equal(guardado.data.configurada, true);
  const leido = await obtenerSalida(1, { repo });
  assert.equal(leido.data.domicilio, 'Belgrano 120');
  assert.equal(leido.data.latitud, -24.1858);
});

test('guardarSalida: coordenadas invalidas no escriben', async () => {
  const repo = repoEnMemoria();
  const r = await guardarSalida(1, { latitud: 40.7, longitud: -74 }, { repo });
  assert.equal(r.error.status, 400);
  assert.equal(repo.estado.fila.latitud_base, null);
});

test('quitarSalida: borra el punto de salida', async () => {
  const repo = repoEnMemoria({ domicilio_base: 'X', latitud_base: -24.18, longitud_base: -65.3 });
  const r = await quitarSalida(1, { repo });
  assert.equal(r.data.configurada, false);
  assert.equal(repo.estado.fila.latitud_base, null);
});

test('un error de base se traduce a 500 sin filtrar el detalle', async () => {
  const repo = { leer: async () => ({ dbError: new Error('columna inexistente xyz') }) };
  const r = await obtenerSalida(1, { repo });
  assert.equal(r.error.status, 500);
  assert.equal(r.error.message.includes('xyz'), false);
});
