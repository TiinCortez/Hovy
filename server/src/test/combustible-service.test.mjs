import test from 'node:test';
import assert from 'node:assert/strict';
import {
  consultarNaftas,
  obtenerPrecios,
  listarCiudades,
  reiniciarCacheCiudades,
  validarConfig,
} from '../services/combustibleService.js';
import { TTL_PRECIOS_MS } from '../utils/combustible.js';

const AHORA = Date.parse('2026-10-23T12:00:00Z');

const RESPUESTA_API = {
  'SAN SALVADOR DE JUJUY': {
    empresas: {
      YPF: {
        SUPER: { precio: 2109, fecha_vigencia: '2026-10-16T00:14:00' },
        GNC: { precio: 750, fecha_vigencia: '2025-03-27T19:06:00' },
      },
    },
  },
};

const respuestaJson = (cuerpo, ok = true, status = 200) => ({ ok, status, json: async () => cuerpo });

// In-memory stand-in for the combustible_precios table.
const repoEnMemoria = (filasIniciales = []) => {
  const estado = { filas: [...filasIniciales], guardados: 0, depuraciones: 0 };
  return {
    estado,
    leer: async (ciudad) => ({ data: estado.filas.filter((f) => f.ciudad === ciudad) }),
    guardar: async (filas, actualizadoEn) => {
      estado.guardados += 1;
      estado.filas = filas.map((f) => ({ ...f, actualizado_en: actualizadoEn }));
      return { data: true };
    },
    depurar: async () => {
      estado.depuraciones += 1;
      return { data: true };
    },
  };
};

const filaCache = (actualizadoEn, extra = {}) => ({
  ciudad: 'SAN SALVADOR DE JUJUY',
  empresa: 'YPF',
  producto: 'SUPER',
  tipo: 'nafta',
  unidad: 'l',
  precio: 2000,
  fecha_vigencia: null,
  desde_ciudad: null,
  precision: null,
  actualizado_en: actualizadoEn,
  ...extra,
});

test('consultarNaftas: devuelve el cuerpo cuando la API responde bien', async () => {
  const r = await consultarNaftas('JUJUY', async () => respuestaJson(RESPUESTA_API));
  assert.deepEqual(r.data, RESPUESTA_API);
});

test('consultarNaftas: ciudad desconocida devuelve la lista de ciudades', async () => {
  const fetchFn = async () => respuestaJson({ error: 'City not found', availableCities: ['A', 'B'] }, false, 404);
  const r = await consultarNaftas('X', fetchFn);
  assert.equal(r.ciudadNoEncontrada, true);
  assert.deepEqual(r.ciudades, ['A', 'B']);
});

test('consultarNaftas: error de red o status inesperado no tira, marca fallo', async () => {
  assert.equal((await consultarNaftas('X', async () => { throw new Error('boom'); })).fallo, true);
  assert.equal((await consultarNaftas('X', async () => respuestaJson({}, false, 500))).fallo, true);
});

test('obtenerPrecios: ciudad vacia es un 400', async () => {
  const r = await obtenerPrecios('  ', { repo: repoEnMemoria(), fetchFn: async () => assert.fail('no debe consultar') });
  assert.equal(r.error.status, 400);
});

test('obtenerPrecios: con cache vigente no consulta la API', async () => {
  const repo = repoEnMemoria([filaCache(new Date(AHORA - 1000).toISOString())]);
  const r = await obtenerPrecios('San Salvador de Jujuy', {
    repo,
    ahora: AHORA,
    fetchFn: async () => assert.fail('no debe consultar'),
  });
  assert.equal(r.data.desactualizado, false);
  assert.equal(r.data.precios[0].precio, 2000);
});

test('obtenerPrecios: con cache vencida refresca, guarda y depura', async () => {
  const repo = repoEnMemoria([filaCache(new Date(AHORA - TTL_PRECIOS_MS - 1000).toISOString())]);
  const r = await obtenerPrecios('SAN SALVADOR DE JUJUY', {
    repo,
    ahora: AHORA,
    fetchFn: async () => respuestaJson(RESPUESTA_API),
  });
  assert.equal(r.data.desactualizado, false);
  assert.equal(r.data.precios.find((p) => p.producto === 'SUPER').precio, 2109);
  assert.equal(r.data.precios.find((p) => p.producto === 'GNC').unidad, 'm3');
  assert.equal(repo.estado.guardados, 1);
  assert.equal(repo.estado.depuraciones, 1);
});

test('obtenerPrecios: si la API falla y hay cache vieja, la devuelve marcada desactualizada', async () => {
  const repo = repoEnMemoria([filaCache(new Date(AHORA - TTL_PRECIOS_MS - 1000).toISOString())]);
  const r = await obtenerPrecios('SAN SALVADOR DE JUJUY', {
    repo,
    ahora: AHORA,
    fetchFn: async () => { throw new Error('boom'); },
  });
  assert.equal(r.data.desactualizado, true);
  assert.equal(r.data.precios[0].precio, 2000);
});

test('obtenerPrecios: si la API falla y no hay cache, es un 502', async () => {
  const r = await obtenerPrecios('SAN SALVADOR DE JUJUY', {
    repo: repoEnMemoria(),
    ahora: AHORA,
    fetchFn: async () => { throw new Error('boom'); },
  });
  assert.equal(r.error.status, 502);
});

test('obtenerPrecios: ciudad inexistente es un 404', async () => {
  const r = await obtenerPrecios('NOEXISTE', {
    repo: repoEnMemoria(),
    ahora: AHORA,
    fetchFn: async () => respuestaJson({ error: 'City not found', availableCities: ['A'] }, false, 404),
  });
  assert.equal(r.error.status, 404);
});

test('obtenerPrecios: marca como precio de referencia los de precision baja', async () => {
  const repo = repoEnMemoria([
    filaCache(new Date(AHORA - 1000).toISOString(), { desde_ciudad: 'COMODORO RIVADAVIA', precision: 'low' }),
  ]);
  const r = await obtenerPrecios('SAN SALVADOR DE JUJUY', { repo, ahora: AHORA });
  assert.equal(r.data.precios[0].precio_de_referencia, true);
  assert.equal(r.data.precios[0].desde_ciudad, 'COMODORO RIVADAVIA');
});

test('listarCiudades: usa availableCities de la API y la cachea', async () => {
  reiniciarCacheCiudades();
  let llamadas = 0;
  const fetchFn = async () => {
    llamadas += 1;
    return respuestaJson({ error: 'City not found', availableCities: ['A', 'B'] }, false, 404);
  };
  const primera = await listarCiudades({ fetchFn, ahora: AHORA });
  const segunda = await listarCiudades({ fetchFn, ahora: AHORA + 1000 });
  assert.deepEqual(primera.data, ['A', 'B']);
  assert.deepEqual(segunda.data, ['A', 'B']);
  assert.equal(llamadas, 1);
});

test('listarCiudades: sin respuesta util y sin cache es un 502', async () => {
  reiniciarCacheCiudades();
  const r = await listarCiudades({ fetchFn: async () => { throw new Error('boom'); }, ahora: AHORA });
  assert.equal(r.error.status, 502);
});

const configValida = {
  ciudad: 'San Salvador de Jujuy',
  tipo: 'nafta',
  empresa: 'YPF',
  producto: 'SUPER',
  consumo_100km: '8,5'.replace(',', '.'),
};

test('validarConfig: acepta una configuracion completa y normaliza la ciudad', () => {
  const r = validarConfig(configValida);
  assert.equal(r.error, undefined);
  assert.equal(r.valores.ciudad, 'SAN SALVADOR DE JUJUY');
  assert.equal(r.valores.consumo_100km, 8.5);
});

test('validarConfig: el consumo es obligatorio y se valida', () => {
  for (const consumo of [undefined, null, '', 0, -3, 101, 'abc', true]) {
    const r = validarConfig({ ...configValida, consumo_100km: consumo });
    assert.equal(r.error?.status, 400, `consumo ${String(consumo)} debe rechazarse`);
  }
});

test('validarConfig: tipo invalido o campos vacios son un 400 que los nombra', () => {
  const r = validarConfig({ ciudad: '', tipo: 'kerosene', empresa: '', producto: '', consumo_100km: 8 });
  assert.equal(r.error.status, 400);
  assert.match(r.error.message, /tipo/);
  assert.match(r.error.message, /ciudad/);
  assert.match(r.error.message, /empresa/);
  assert.match(r.error.message, /producto/);
});

test('validarConfig: acepta GNC con consumo en m3', () => {
  const r = validarConfig({ ...configValida, tipo: 'gnc', producto: 'GNC', consumo_100km: 9.2 });
  assert.equal(r.valores.tipo, 'gnc');
  assert.equal(r.valores.consumo_100km, 9.2);
});
