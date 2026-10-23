import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TTL_PRECIOS_MS,
  normalizarCiudad,
  clasificarProducto,
  aplanarPrecios,
  preciosVencidos,
  calcularCostoTraslado,
} from '../utils/combustible.js';

const RESPUESTA = {
  'SAN SALVADOR DE JUJUY': {
    coordenadas: { latitud: -24.21774, longitud: -65.27818 },
    horario: 'Diurno',
    empresas: {
      AXION: {
        'Axion SUPER': {
          precio: 1999,
          fecha_vigencia: '2026-10-14T09:43:00',
          fromNearby: 'COMODORO RIVADAVIA',
          fromNearbyDistanceKm: 2415,
          fromNearbyPrecision: 'low',
        },
        GNC: { precio: 620, fecha_vigencia: '2026-10-15T07:33:00' },
        'AXION Diesel X10': { precio: 2499, fecha_vigencia: '2026-10-15T11:26:00' },
      },
      YPF: {
        SUPER: { precio: 2109, fecha_vigencia: '2026-10-16T00:14:00' },
        'PRECIO ROTO': { precio: 0, fecha_vigencia: '2026-10-16T00:14:00' },
        'SIN PRECIO': { fecha_vigencia: '2026-10-16T00:14:00' },
      },
    },
  },
};

test('normalizarCiudad: mayusculas, sin tildes ni espacios sobrantes', () => {
  assert.equal(normalizarCiudad('  San Salvador   de Jujuy '), 'SAN SALVADOR DE JUJUY');
  assert.equal(normalizarCiudad('Tucumán'), 'TUCUMAN');
});

test('normalizarCiudad: valores vacios o no texto devuelven cadena vacia', () => {
  assert.equal(normalizarCiudad(''), '');
  assert.equal(normalizarCiudad(null), '');
  assert.equal(normalizarCiudad(undefined), '');
});

test('clasificarProducto: GNC se mide en m3', () => {
  assert.deepEqual(clasificarProducto('GNC'), { tipo: 'gnc', unidad: 'm3' });
});

test('clasificarProducto: cualquier diesel es gasoil en litros', () => {
  assert.deepEqual(clasificarProducto('AXION Diesel X10'), { tipo: 'gasoil', unidad: 'l' });
  assert.deepEqual(clasificarProducto('DIESEL500'), { tipo: 'gasoil', unidad: 'l' });
  assert.deepEqual(clasificarProducto('Shell V-Power Diesel'), { tipo: 'gasoil', unidad: 'l' });
});

test('clasificarProducto: el resto es nafta en litros', () => {
  assert.deepEqual(clasificarProducto('SUPER'), { tipo: 'nafta', unidad: 'l' });
  assert.deepEqual(clasificarProducto('QUANTIUM'), { tipo: 'nafta', unidad: 'l' });
  assert.deepEqual(clasificarProducto('INFINIA'), { tipo: 'nafta', unidad: 'l' });
});

test('aplanarPrecios: una fila por empresa y producto con tipo y unidad', () => {
  const filas = aplanarPrecios(RESPUESTA);
  const axionSuper = filas.find((f) => f.empresa === 'AXION' && f.producto === 'Axion SUPER');
  assert.equal(axionSuper.ciudad, 'SAN SALVADOR DE JUJUY');
  assert.equal(axionSuper.tipo, 'nafta');
  assert.equal(axionSuper.unidad, 'l');
  assert.equal(axionSuper.precio, 1999);
  assert.equal(axionSuper.desde_ciudad, 'COMODORO RIVADAVIA');
  assert.equal(axionSuper.precision, 'low');
  const gnc = filas.find((f) => f.producto === 'GNC');
  assert.equal(gnc.unidad, 'm3');
  assert.equal(gnc.desde_ciudad, null);
});

test('aplanarPrecios: descarta precios ausentes o no positivos', () => {
  const productos = aplanarPrecios(RESPUESTA).map((f) => f.producto);
  assert.equal(productos.includes('PRECIO ROTO'), false);
  assert.equal(productos.includes('SIN PRECIO'), false);
  assert.equal(productos.length, 4);
});

test('aplanarPrecios: entradas invalidas devuelven lista vacia', () => {
  assert.deepEqual(aplanarPrecios(null), []);
  assert.deepEqual(aplanarPrecios({}), []);
  assert.deepEqual(aplanarPrecios({ error: 'City not found' }), []);
});

test('preciosVencidos: sin filas, siempre vencidos', () => {
  assert.equal(preciosVencidos([], Date.now()), true);
});

test('preciosVencidos: dentro de los 3 dias no vencen', () => {
  const ahora = Date.parse('2026-10-23T12:00:00Z');
  const filas = [{ actualizado_en: new Date(ahora - TTL_PRECIOS_MS + 60_000).toISOString() }];
  assert.equal(preciosVencidos(filas, ahora), false);
});

test('preciosVencidos: pasados los 3 dias vencen, se mira la fila mas vieja', () => {
  const ahora = Date.parse('2026-10-23T12:00:00Z');
  const filas = [
    { actualizado_en: new Date(ahora - 1000).toISOString() },
    { actualizado_en: new Date(ahora - TTL_PRECIOS_MS - 1000).toISOString() },
  ];
  assert.equal(preciosVencidos(filas, ahora), true);
});

test('calcularCostoTraslado: km x consumo/100 x precio, solo ida', () => {
  assert.equal(calcularCostoTraslado({ km: 12, consumo100km: 10, precioUnidad: 2109 }), 2530.8);
});

test('calcularCostoTraslado: tramos=2 duplica el costo (ida y vuelta)', () => {
  assert.equal(calcularCostoTraslado({ km: 12, consumo100km: 10, precioUnidad: 2109, tramos: 2 }), 5061.6);
});

test('calcularCostoTraslado: redondea a 2 decimales', () => {
  assert.equal(calcularCostoTraslado({ km: 7.3, consumo100km: 8.5, precioUnidad: 620 }), 384.71);
});

test('calcularCostoTraslado: datos invalidos devuelven null', () => {
  assert.equal(calcularCostoTraslado({ km: 12, consumo100km: null, precioUnidad: 2109 }), null);
  assert.equal(calcularCostoTraslado({ km: 12, consumo100km: 0, precioUnidad: 2109 }), null);
  assert.equal(calcularCostoTraslado({ km: -1, consumo100km: 10, precioUnidad: 2109 }), null);
  assert.equal(calcularCostoTraslado({ km: 12, consumo100km: 10, precioUnidad: 'abc' }), null);
  assert.equal(calcularCostoTraslado({ km: 12, consumo100km: 10, precioUnidad: 2109, tramos: 0 }), null);
});
