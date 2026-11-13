import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { geocodificarDireccion } from '../services/geocodingService.js';
import { validarDireccionEscrita } from '../controllers/botInmueblesController.js';

const fetchOriginal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchOriginal; });

const responderNominatim = (resultados, urls = []) => {
  globalThis.fetch = async (url) => {
    urls.push(new URL(String(url)));
    return { ok: true, json: async () => resultados };
  };
  return urls;
};

const crearRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (codigo) => { res.statusCode = codigo; return res; };
  res.json = (cuerpo) => { res.body = cuerpo; return res; };
  return res;
};

const RESULTADO_CASA = {
  lat: '-24.1858', lon: '-65.2995', addresstype: 'building', display_name: 'Belgrano 450, San Salvador de Jujuy, Jujuy, Argentina',
  address: { house_number: '450', road: 'Belgrano', city: 'San Salvador de Jujuy', state: 'Jujuy' },
};
const RESULTADO_CALLE = {
  lat: '-24.19', lon: '-65.30', addresstype: 'road', display_name: 'Belgrano, San Salvador de Jujuy, Jujuy, Argentina',
  address: { road: 'Belgrano', city: 'San Salvador de Jujuy', state: 'Jujuy' },
};
const RESULTADO_CIUDAD = {
  lat: '-24.18', lon: '-65.31', addresstype: 'city', display_name: 'San Salvador de Jujuy, Jujuy, Argentina',
  address: { city: 'San Salvador de Jujuy', state: 'Jujuy' },
};

test('geocodificarDireccion manda la localidad en city y el barrio no la pisa', async () => {
  const urls = responderNominatim([RESULTADO_CASA]);
  await geocodificarDireccion({ direccion: 'Belgrano 450', localidad: 'San Salvador de Jujuy', barrio: 'Centro', provincia: 'Jujuy' });
  const p = urls[0].searchParams;
  assert.equal(p.get('street'), 'Belgrano 450');
  assert.equal(p.get('city'), 'San Salvador de Jujuy');
  assert.equal(p.get('state'), 'Jujuy');
  assert.equal(p.get('country'), 'Argentina');
  assert.equal(p.get('addressdetails'), '1');
});

test('geocodificarDireccion sin localidad sigue usando el barrio en city (alta actual)', async () => {
  const urls = responderNominatim([RESULTADO_CASA]);
  const r = await geocodificarDireccion({ direccion: 'Belgrano 450', barrio: 'Centro', provincia: 'Jujuy' });
  assert.equal(urls[0].searchParams.get('city'), 'Centro');
  assert.equal(r.latitud, -24.1858);
  assert.equal(r.longitud, -65.2995);
});

test('geocodificarDireccion informa la precision: exacta, calle o zona', async () => {
  responderNominatim([RESULTADO_CASA]);
  assert.equal((await geocodificarDireccion({ direccion: 'Belgrano 450', provincia: 'Jujuy' })).precision, 'exacta');
  responderNominatim([RESULTADO_CALLE]);
  assert.equal((await geocodificarDireccion({ direccion: 'Belgrano 450', provincia: 'Jujuy' })).precision, 'calle');
  responderNominatim([RESULTADO_CIUDAD]);
  assert.equal((await geocodificarDireccion({ direccion: 'Belgrano 450', provincia: 'Jujuy' })).precision, 'zona');
  responderNominatim([]);
  const vacio = await geocodificarDireccion({ direccion: 'Belgrano 450', provincia: 'Jujuy' });
  assert.deepEqual(vacio, { latitud: null, longitud: null, precision: null, direccion_encontrada: null });
});

test('POST /ubicacion/directa devuelve coordenadas, precision y direccion encontrada', async () => {
  responderNominatim([RESULTADO_CASA]);
  const res = crearRes();
  await validarDireccionEscrita({ body: { direccion: 'Belgrano 450', localidad: 'San Salvador de Jujuy', provincia: 'Jujuy' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    ok: true,
    data: { latitud: -24.1858, longitud: -65.2995, precision: 'exacta', direccion_encontrada: 'Belgrano 450, San Salvador de Jujuy, Jujuy, Argentina' },
  });
});

test('POST /ubicacion/directa sin resultado devuelve 200 con todo en null', async () => {
  responderNominatim([]);
  const res = crearRes();
  await validarDireccionEscrita({ body: { direccion: 'Calle inventada 1', provincia: 'Jujuy' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, { latitud: null, longitud: null, precision: null, direccion_encontrada: null });
});

test('POST /ubicacion/directa sin direccion o sin provincia devuelve 400 y no consulta Nominatim', async () => {
  const urls = responderNominatim([RESULTADO_CASA]);
  const sinDireccion = crearRes();
  await validarDireccionEscrita({ body: { provincia: 'Jujuy' } }, sinDireccion);
  assert.equal(sinDireccion.statusCode, 400);
  assert.equal(sinDireccion.body.ok, false);
  const sinProvincia = crearRes();
  await validarDireccionEscrita({ body: { direccion: 'Belgrano 450' } }, sinProvincia);
  assert.equal(sinProvincia.statusCode, 400);
  assert.equal(urls.length, 0);
});
