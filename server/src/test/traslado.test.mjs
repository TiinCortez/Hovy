import test from 'node:test';
import assert from 'node:assert/strict';

// Isolated client: these tests never touch the real project database.
process.env.SUPABASE_URL = 'https://traslado-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'traslado-tests-sin-conexion';

const { distanciaKm, reiniciarCacheRutas } = await import('../services/rutaService.js');
const { calcularTraslado, TRAMOS_TRASLADO } = await import('../services/trasladoService.js');
const { kmAproximados } = await import('../utils/distancia.js');

const ORIGEN = { latitud: -24.1858, longitud: -65.2995 };
const DESTINO = { latitud: -24.2177, longitud: -65.2781 };

const respuestaJson = (cuerpo, ok = true, status = 200) => ({ ok, status, json: async () => cuerpo });
const respuestaRuta = (metros) => respuestaJson({ routes: [{ summary: { distance: metros, duration: 600 } }] });

// ---- rutaService ------------------------------------------------------------

test('distanciaKm: sin clave no consulta y usa la distancia aproximada', async () => {
  reiniciarCacheRutas();
  const r = await distanciaKm(
    { origen: ORIGEN, destino: DESTINO },
    { apiKey: '', fetchFn: async () => assert.fail('no debe consultar') }
  );
  assert.equal(r.aproximado, true);
  assert.equal(r.km, kmAproximados(ORIGEN, DESTINO));
});

test('distanciaKm: sin clave y con el respaldo apagado avisa que no hay ruteo', async () => {
  reiniciarCacheRutas();
  const r = await distanciaKm(
    { origen: ORIGEN, destino: DESTINO },
    { apiKey: '', respaldoAproximado: false, fetchFn: async () => assert.fail('no debe consultar') }
  );
  assert.equal(r.motivo, 'sin_ruteo');
});

test('distanciaKm: convierte metros a km y manda [lon, lat] con la clave en el header', async () => {
  reiniciarCacheRutas();
  let pedido;
  const r = await distanciaKm(
    { origen: ORIGEN, destino: DESTINO },
    {
      apiKey: 'clave-de-prueba',
      fetchFn: async (url, opciones) => {
        pedido = { url: String(url), opciones };
        return respuestaRuta(12345.6);
      },
    }
  );
  assert.equal(r.km, 12.35);
  assert.equal(r.aproximado, false);
  assert.match(pedido.url, /v2\/directions\/driving-car$/);
  assert.equal(pedido.opciones.method, 'POST');
  assert.equal(pedido.opciones.headers.Authorization, 'clave-de-prueba');
  assert.deepEqual(JSON.parse(pedido.opciones.body).coordinates, [
    [ORIGEN.longitud, ORIGEN.latitud],
    [DESTINO.longitud, DESTINO.latitud],
  ]);
});

test('distanciaKm: acepta tambien la forma GeoJSON de la respuesta', async () => {
  reiniciarCacheRutas();
  const r = await distanciaKm(
    { origen: ORIGEN, destino: DESTINO },
    {
      apiKey: 'k',
      fetchFn: async () => respuestaJson({ features: [{ properties: { summary: { distance: 5000 } } }] }),
    }
  );
  assert.equal(r.km, 5);
});

test('distanciaKm: cachea por par de coordenadas', async () => {
  reiniciarCacheRutas();
  let llamadas = 0;
  const deps = { apiKey: 'k', fetchFn: async () => { llamadas += 1; return respuestaRuta(8000); } };
  await distanciaKm({ origen: ORIGEN, destino: DESTINO }, deps);
  const segunda = await distanciaKm({ origen: ORIGEN, destino: DESTINO }, deps);
  assert.equal(segunda.km, 8);
  assert.equal(llamadas, 1);
});

const FALLAS_ORS = [
  async () => { throw new Error('boom'); },
  async () => respuestaJson({ error: { code: 2010 } }, false, 404),
  async () => respuestaJson({ routes: [] }),
];

test('distanciaKm: si OpenRouteService falla usa la distancia aproximada y no la cachea', async () => {
  for (const fetchFn of FALLAS_ORS) {
    reiniciarCacheRutas();
    const r = await distanciaKm({ origen: ORIGEN, destino: DESTINO }, { apiKey: 'k', fetchFn });
    assert.equal(r.aproximado, true);
    assert.equal(r.km, kmAproximados(ORIGEN, DESTINO));
  }
  // The approximation must not be cached: once ORS is back, the real route wins.
  const real = await distanciaKm(
    { origen: ORIGEN, destino: DESTINO },
    { apiKey: 'k', fetchFn: async () => respuestaRuta(9000) }
  );
  assert.equal(real.aproximado, false);
  assert.equal(real.km, 9);
});

test('distanciaKm: con el respaldo apagado, la falla de OpenRouteService no tira', async () => {
  for (const fetchFn of FALLAS_ORS) {
    reiniciarCacheRutas();
    const r = await distanciaKm(
      { origen: ORIGEN, destino: DESTINO },
      { apiKey: 'k', fetchFn, respaldoAproximado: false }
    );
    assert.equal(r.motivo, 'ruta_no_disponible');
  }
});

// ---- trasladoService --------------------------------------------------------

const CONFIG = {
  combustible_ciudad: 'SAN SALVADOR DE JUJUY',
  combustible_tipo: 'nafta',
  combustible_empresa: 'YPF',
  combustible_producto: 'SUPER',
  consumo_100km: 10,
  latitud_base: '-24.1858',
  longitud_base: '-65.2995',
};

const PRECIOS = {
  data: {
    ciudad: 'SAN SALVADOR DE JUJUY',
    desactualizado: false,
    precios: [
      { empresa: 'YPF', producto: 'SUPER', tipo: 'nafta', unidad: 'l', precio: 2109, precio_de_referencia: false },
      { empresa: 'YPF', producto: 'GNC', tipo: 'gnc', unidad: 'm3', precio: 750, precio_de_referencia: true },
    ],
  },
};

const deps = (extra = {}) => ({
  leerConfigUsuario: async () => ({ data: CONFIG }),
  leerInmueble: async () => ({ data: { latitud: '-24.2177', longitud: '-65.2781' } }),
  obtenerPrecios: async () => PRECIOS,
  distanciaKm: async () => ({ km: 12 }),
  ...extra,
});

test('calcularTraslado: solo ida, devuelve costo y la foto de los datos usados', async () => {
  assert.equal(TRAMOS_TRASLADO, 1);
  const r = await calcularTraslado({ idUsuario: 1, idInmueble: 5 }, deps());
  assert.equal(r.incluido, true);
  assert.equal(r.km, 12);
  assert.equal(r.costo, 2530.8);
  assert.equal(r.consumo_100km, 10);
  assert.equal(r.precio_unidad, 2109);
  assert.equal(r.unidad, 'l');
  assert.equal(r.combustible, 'YPF SUPER');
  assert.equal(r.desactualizado, false);
  assert.equal(r.km_aproximados, false);
});

test('calcularTraslado: con distancia aproximada lo indica en el resultado', async () => {
  const r = await calcularTraslado(
    { idUsuario: 1, idInmueble: 5 },
    deps({ distanciaKm: async () => ({ km: 12, aproximado: true }) })
  );
  assert.equal(r.incluido, true);
  assert.equal(r.km_aproximados, true);
  assert.equal(r.costo, 2530.8);
});

test('calcularTraslado: GNC usa m3 y marca el precio de referencia', async () => {
  const r = await calcularTraslado(
    { idUsuario: 1, idInmueble: 5 },
    deps({
      leerConfigUsuario: async () => ({
        data: { ...CONFIG, combustible_tipo: 'gnc', combustible_producto: 'GNC', consumo_100km: 9 },
      }),
    })
  );
  assert.equal(r.unidad, 'm3');
  assert.equal(r.costo, 810);
  assert.equal(r.precio_de_referencia, true);
});

test('calcularTraslado: sin ajuste de combustible o sin consumo no calcula', async () => {
  for (const config of [
    { ...CONFIG, consumo_100km: null },
    { ...CONFIG, combustible_producto: null },
    { ...CONFIG, combustible_ciudad: null },
  ]) {
    const r = await calcularTraslado(
      { idUsuario: 1, idInmueble: 5 },
      deps({ leerConfigUsuario: async () => ({ data: config }) })
    );
    assert.equal(r.incluido, false);
    assert.equal(r.motivo, 'sin_configuracion');
  }
});

test('calcularTraslado: sin punto de salida avisa', async () => {
  const r = await calcularTraslado(
    { idUsuario: 1, idInmueble: 5 },
    deps({ leerConfigUsuario: async () => ({ data: { ...CONFIG, latitud_base: null } }) })
  );
  assert.equal(r.motivo, 'sin_origen');
});

test('calcularTraslado: inmueble sin coordenadas validas avisa', async () => {
  for (const inmueble of [{ latitud: null, longitud: null }, { latitud: '40.7', longitud: '-74' }]) {
    const r = await calcularTraslado(
      { idUsuario: 1, idInmueble: 5 },
      deps({ leerInmueble: async () => ({ data: inmueble }) })
    );
    assert.equal(r.motivo, 'inmueble_sin_ubicacion');
  }
});

test('calcularTraslado: producto que ya no existe en la ciudad avisa', async () => {
  const r = await calcularTraslado(
    { idUsuario: 1, idInmueble: 5 },
    deps({ leerConfigUsuario: async () => ({ data: { ...CONFIG, combustible_producto: 'INFINIA' } }) })
  );
  assert.equal(r.motivo, 'sin_precio');
});

test('calcularTraslado: usa precios desactualizados pero lo indica', async () => {
  const r = await calcularTraslado(
    { idUsuario: 1, idInmueble: 5 },
    deps({ obtenerPrecios: async () => ({ data: { ...PRECIOS.data, desactualizado: true } }) })
  );
  assert.equal(r.incluido, true);
  assert.equal(r.desactualizado, true);
});

test('calcularTraslado: propaga los motivos del ruteo', async () => {
  for (const motivo of ['sin_ruteo', 'ruta_no_disponible']) {
    const r = await calcularTraslado(
      { idUsuario: 1, idInmueble: 5 },
      deps({ distanciaKm: async () => ({ motivo }) })
    );
    assert.equal(r.incluido, false);
    assert.equal(r.motivo, motivo);
  }
});

test('calcularTraslado: nunca tira, cualquier falla interna es motivo error', async () => {
  const r = await calcularTraslado(
    { idUsuario: 1, idInmueble: 5 },
    deps({ leerConfigUsuario: async () => { throw new Error('boom'); } })
  );
  assert.equal(r.incluido, false);
  assert.equal(r.motivo, 'error');
});

test('calcularTraslado: error de base al leer la configuracion es motivo error', async () => {
  const r = await calcularTraslado(
    { idUsuario: 1, idInmueble: 5 },
    deps({ leerConfigUsuario: async () => ({ dbError: new Error('columna inexistente') }) })
  );
  assert.equal(r.motivo, 'error');
});
