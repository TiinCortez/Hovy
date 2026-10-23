import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Isolated client: these tests never touch the real project database.
process.env.SUPABASE_URL = 'https://precios-memoria-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'precios-memoria-sin-conexion';

const { obtenerPrecios, reiniciarCachePrecios } = await import('../services/combustibleService.js');
const { TTL_PRECIOS_MS } = await import('../utils/combustible.js');

const AHORA = Date.parse('2026-10-23T12:00:00Z');
const DIA = 24 * 60 * 60 * 1000;
const MINUTO = 60 * 1000;

const RESPUESTA_API = {
  'SAN SALVADOR DE JUJUY': {
    empresas: { YPF: { SUPER: { precio: 2109, fecha_vigencia: '2026-10-16T00:14:00' } } },
  },
  CORDOBA: {
    empresas: { YPF: { SUPER: { precio: 2200, fecha_vigencia: '2026-10-16T00:14:00' } } },
  },
};

const respuestaJson = (cuerpo, ok = true, status = 200) => ({ ok, status, json: async () => cuerpo });

// fetch stand-in that counts the calls to the naftas API and answers by city.
const apiNaftas = ({ falla = false } = {}) => {
  const estado = { llamadas: 0 };
  const fetchFn = async (url) => {
    estado.llamadas += 1;
    if (falla) throw new Error('boom');
    const ciudad = new URL(url).searchParams.get('city');
    if (!RESPUESTA_API[ciudad]) {
      return respuestaJson({ error: 'City not found', availableCities: Object.keys(RESPUESTA_API) }, false, 404);
    }
    return respuestaJson({ [ciudad]: RESPUESTA_API[ciudad] });
  };
  return { estado, fetchFn };
};

// In-memory stand-in for the combustible_precios table that counts the reads.
const repoEnMemoria = (filasIniciales = []) => {
  const estado = { filas: [...filasIniciales], lecturas: 0, guardados: 0 };
  return {
    estado,
    leer: async (ciudad) => {
      estado.lecturas += 1;
      return { data: estado.filas.filter((f) => f.ciudad === ciudad) };
    },
    guardar: async (filas, actualizadoEn) => {
      estado.guardados += 1;
      estado.filas = [
        ...estado.filas.filter((f) => !filas.some((n) => n.ciudad === f.ciudad)),
        ...filas.map((f) => ({ ...f, actualizado_en: actualizadoEn })),
      ];
      return { data: true };
    },
    depurar: async () => ({ data: true }),
  };
};

const filaCache = (ciudad, actualizadoEn, precio = 2000) => ({
  ciudad,
  empresa: 'YPF',
  producto: 'SUPER',
  tipo: 'nafta',
  unidad: 'l',
  precio,
  fecha_vigencia: null,
  desde_ciudad: null,
  precision: null,
  actualizado_en: new Date(actualizadoEn).toISOString(),
});

const JUJUY = 'SAN SALVADOR DE JUJUY';

beforeEach(() => reiniciarCachePrecios());

test('memoria: la segunda consulta de la misma ciudad no lee la base ni llama a la API', async () => {
  const repo = repoEnMemoria([filaCache(JUJUY, AHORA - 1000)]);
  const api = apiNaftas();
  const primera = await obtenerPrecios(JUJUY, { repo, ahora: AHORA, fetchFn: api.fetchFn });
  const segunda = await obtenerPrecios(JUJUY, { repo, ahora: AHORA + 5 * MINUTO, fetchFn: api.fetchFn });
  assert.equal(repo.estado.lecturas, 1);
  assert.equal(api.estado.llamadas, 0);
  assert.deepEqual(segunda.data, primera.data);
});

test('memoria: lo que se trae de la API tambien queda en memoria', async () => {
  const repo = repoEnMemoria();
  const api = apiNaftas();
  await obtenerPrecios(JUJUY, { repo, ahora: AHORA, fetchFn: api.fetchFn });
  const segunda = await obtenerPrecios(JUJUY, { repo, ahora: AHORA + MINUTO, fetchFn: api.fetchFn });
  assert.equal(api.estado.llamadas, 1);
  assert.equal(repo.estado.lecturas, 1);
  assert.equal(segunda.data.precios[0].precio, 2109);
});

test('memoria: vale hasta cumplirse los 3 dias de la ultima actualizacion y recien ahi revisa de nuevo', async () => {
  const repo = repoEnMemoria([filaCache(JUJUY, AHORA - DIA)]);
  const api = apiNaftas();
  await obtenerPrecios(JUJUY, { repo, ahora: AHORA, fetchFn: api.fetchFn });

  // 1,9 dias despues: todavia dentro de los 3 dias contados desde la actualizacion
  await obtenerPrecios(JUJUY, { repo, ahora: AHORA + 1.9 * DIA, fetchFn: api.fetchFn });
  assert.equal(api.estado.llamadas, 0);
  assert.equal(repo.estado.lecturas, 1);

  // 2,1 dias despues: ya pasaron los 3 dias de la actualizacion original
  const renovada = await obtenerPrecios(JUJUY, { repo, ahora: AHORA + 2.1 * DIA, fetchFn: api.fetchFn });
  assert.equal(api.estado.llamadas, 1);
  assert.equal(renovada.data.precios[0].precio, 2109);
  assert.equal(TTL_PRECIOS_MS, 3 * DIA);
});

test('memoria: pedidos simultaneos con la cache vencida comparten una sola consulta a la API', async () => {
  const repo = repoEnMemoria([filaCache(JUJUY, AHORA - TTL_PRECIOS_MS - 1000)]);
  const api = apiNaftas();
  const resultados = await Promise.all([
    obtenerPrecios(JUJUY, { repo, ahora: AHORA, fetchFn: api.fetchFn }),
    obtenerPrecios(JUJUY, { repo, ahora: AHORA, fetchFn: api.fetchFn }),
    obtenerPrecios(JUJUY, { repo, ahora: AHORA, fetchFn: api.fetchFn }),
  ]);
  assert.equal(api.estado.llamadas, 1);
  assert.equal(repo.estado.guardados, 1);
  for (const r of resultados) assert.equal(r.data.precios[0].precio, 2109);
});

test('memoria: si la API falla y se sirve lo viejo, no reintenta enseguida sino pasados 10 minutos', async () => {
  const repo = repoEnMemoria([filaCache(JUJUY, AHORA - TTL_PRECIOS_MS - 1000)]);
  const api = apiNaftas({ falla: true });

  const primera = await obtenerPrecios(JUJUY, { repo, ahora: AHORA, fetchFn: api.fetchFn });
  assert.equal(primera.data.desactualizado, true);
  assert.equal(api.estado.llamadas, 1);

  const enseguida = await obtenerPrecios(JUJUY, { repo, ahora: AHORA + MINUTO, fetchFn: api.fetchFn });
  assert.equal(enseguida.data.desactualizado, true);
  assert.equal(api.estado.llamadas, 1);

  await obtenerPrecios(JUJUY, { repo, ahora: AHORA + 11 * MINUTO, fetchFn: api.fetchFn });
  assert.equal(api.estado.llamadas, 2);
});

test('memoria: cada ciudad tiene la suya', async () => {
  const repo = repoEnMemoria();
  const api = apiNaftas();
  const jujuy = await obtenerPrecios(JUJUY, { repo, ahora: AHORA, fetchFn: api.fetchFn });
  const cordoba = await obtenerPrecios('Córdoba', { repo, ahora: AHORA, fetchFn: api.fetchFn });
  assert.equal(jujuy.data.precios[0].precio, 2109);
  assert.equal(cordoba.data.precios[0].precio, 2200);
  const otraVez = await obtenerPrecios(JUJUY, { repo, ahora: AHORA, fetchFn: api.fetchFn });
  assert.equal(otraVez.data.precios[0].precio, 2109);
  assert.equal(api.estado.llamadas, 2);
});

test('memoria: los errores no se guardan', async () => {
  const repo = repoEnMemoria();
  const api = apiNaftas();
  const mala = await obtenerPrecios('NOEXISTE', { repo, ahora: AHORA, fetchFn: api.fetchFn });
  assert.equal(mala.error.status, 404);
  await obtenerPrecios('NOEXISTE', { repo, ahora: AHORA, fetchFn: api.fetchFn });
  assert.equal(api.estado.llamadas, 2);
});

test('memoria: la ciudad se normaliza, asi "jujuy" escrito distinto usa la misma entrada', async () => {
  const repo = repoEnMemoria([filaCache(JUJUY, AHORA - 1000)]);
  const api = apiNaftas();
  await obtenerPrecios('San Salvador de Jujuy', { repo, ahora: AHORA, fetchFn: api.fetchFn });
  await obtenerPrecios('  SAN  SALVADOR DE JUJUY ', { repo, ahora: AHORA, fetchFn: api.fetchFn });
  assert.equal(repo.estado.lecturas, 1);
});
