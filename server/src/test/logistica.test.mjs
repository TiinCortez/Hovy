import test from 'node:test';
import assert from 'node:assert/strict';

// Isolated client: these tests never touch the real project database.
process.env.SUPABASE_URL = 'https://logistica-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'logistica-tests-sin-conexion';

const { armarRutaDelDia, armarMensajeLogistica } = await import('../utils/rutaDia.js');
const { calcularConsumoEstimado } = await import('../utils/combustible.js');
const { distanciaRutaKm, reiniciarCacheRutas } = await import('../services/rutaService.js');
const { obtenerLogisticaDia } = await import('../services/logisticaService.js');
const { kmAproximados } = await import('../utils/distancia.js');

const turno = (id, hora, cliente, lat, lon, estado = 'Coordinado') => ({
  id_turno: id,
  inicio_desde: hora,
  estado,
  inmueble: { id_cliente: cliente, latitud: lat, longitud: lon },
});

// ---- armarRutaDelDia --------------------------------------------------------

test('armarRutaDelDia: ignora los cancelados y cuenta turnos y clientes distintos', () => {
  const dia = armarRutaDelDia([
    turno(1, '09:00:00', 10, '-24.18', '-65.30'),
    turno(2, '11:00:00', 10, '-24.19', '-65.29'),
    turno(3, '13:00:00', 11, '-24.20', '-65.28'),
    turno(4, '15:00:00', 12, '-24.21', '-65.27', 'Cancelado'),
  ]);
  assert.equal(dia.turnos, 3);
  assert.equal(dia.clientes, 2);
});

test('armarRutaDelDia: ordena por hora y deja los turnos sin horario al final', () => {
  const dia = armarRutaDelDia([
    turno(1, '13:00:00', 10, '-24.30', '-65.30'),
    turno(2, null, 11, '-24.50', '-65.50'),
    turno(3, '09:00:00', 12, '-24.10', '-65.10'),
  ]);
  assert.deepEqual(dia.puntos.map((p) => p.latitud), [-24.1, -24.3, -24.5]);
  assert.equal(dia.sin_horario, 1);
});

test('armarRutaDelDia: los turnos sin ubicacion valida no entran a la ruta y se cuentan', () => {
  const dia = armarRutaDelDia([
    turno(1, '09:00:00', 10, '-24.18', '-65.30'),
    turno(2, '10:00:00', 11, null, null),
    turno(3, '11:00:00', 12, '40.7', '-74.0'),
  ]);
  assert.equal(dia.puntos.length, 1);
  assert.equal(dia.sin_ubicacion, 2);
  assert.equal(dia.turnos, 3);
});

test('armarRutaDelDia: junta los puntos repetidos consecutivos pero no los separados', () => {
  const dia = armarRutaDelDia([
    turno(1, '09:00:00', 10, '-24.18', '-65.30'),
    turno(2, '10:00:00', 10, '-24.18', '-65.30'),
    turno(3, '11:00:00', 11, '-24.25', '-65.25'),
    turno(4, '12:00:00', 10, '-24.18', '-65.30'),
  ]);
  assert.equal(dia.puntos.length, 3);
});

test('armarRutaDelDia: entradas vacias o invalidas devuelven ceros', () => {
  for (const entrada of [[], null, undefined]) {
    assert.deepEqual(armarRutaDelDia(entrada), { turnos: 0, clientes: 0, puntos: [], sin_ubicacion: 0, sin_horario: 0 });
  }
});

// ---- calcularConsumoEstimado ------------------------------------------------

test('calcularConsumoEstimado: km x consumo / 100 redondeado a 2 decimales', () => {
  assert.equal(calcularConsumoEstimado({ km: 20, consumo100km: 10 }), 2);
  assert.equal(calcularConsumoEstimado({ km: 18.4, consumo100km: 9 }), 1.66);
});

test('calcularConsumoEstimado: datos invalidos devuelven null', () => {
  assert.equal(calcularConsumoEstimado({ km: -1, consumo100km: 10 }), null);
  assert.equal(calcularConsumoEstimado({ km: 10, consumo100km: 0 }), null);
  assert.equal(calcularConsumoEstimado({ km: 10, consumo100km: null }), null);
  assert.equal(calcularConsumoEstimado({ km: 'abc', consumo100km: 10 }), null);
});

// ---- distanciaRutaKm (varios puntos) ---------------------------------------

const P1 = { latitud: -24.1858, longitud: -65.2995 };
const P2 = { latitud: -24.2177, longitud: -65.2781 };
const P3 = { latitud: -24.25, longitud: -65.25 };

const respuestaJson = (cuerpo, ok = true, status = 200) => ({ ok, status, json: async () => cuerpo });
const respuestaRuta = (metros) => respuestaJson({ routes: [{ summary: { distance: metros } }] });

test('distanciaRutaKm: con menos de dos puntos no hay recorrido', async () => {
  const r = await distanciaRutaKm({ puntos: [P1] }, { apiKey: 'k', fetchFn: async () => assert.fail('no debe consultar') });
  assert.deepEqual(r, { km: 0, aproximado: false });
});

test('distanciaRutaKm: manda todos los puntos en una sola consulta y suma el total', async () => {
  reiniciarCacheRutas();
  let consultas = 0;
  let cuerpo;
  const r = await distanciaRutaKm(
    { puntos: [P1, P2, P3] },
    {
      apiKey: 'k',
      fetchFn: async (url, opciones) => {
        consultas += 1;
        cuerpo = JSON.parse(opciones.body);
        return respuestaRuta(21500);
      },
    }
  );
  assert.equal(consultas, 1);
  assert.equal(cuerpo.coordinates.length, 3);
  assert.deepEqual(cuerpo.coordinates[0], [P1.longitud, P1.latitud]);
  assert.equal(r.km, 21.5);
  assert.equal(r.aproximado, false);
});

test('distanciaRutaKm: cachea por la lista de puntos', async () => {
  reiniciarCacheRutas();
  let consultas = 0;
  const deps = { apiKey: 'k', fetchFn: async () => { consultas += 1; return respuestaRuta(5000); } };
  await distanciaRutaKm({ puntos: [P1, P2, P3] }, deps);
  await distanciaRutaKm({ puntos: [P1, P2, P3] }, deps);
  await distanciaRutaKm({ puntos: [P1, P3, P2] }, deps);
  assert.equal(consultas, 2);
});

test('distanciaRutaKm: sin clave o si falla suma las distancias aproximadas de cada tramo', async () => {
  reiniciarCacheRutas();
  const esperado = Math.round((kmAproximados(P1, P2) + kmAproximados(P2, P3)) * 100) / 100;
  const sinClave = await distanciaRutaKm({ puntos: [P1, P2, P3] }, { apiKey: '' });
  assert.equal(sinClave.aproximado, true);
  assert.equal(sinClave.km, esperado);
  const conFalla = await distanciaRutaKm(
    { puntos: [P1, P2, P3] },
    { apiKey: 'k', fetchFn: async () => { throw new Error('boom'); } }
  );
  assert.equal(conFalla.aproximado, true);
  assert.equal(conFalla.km, esperado);
});

test('distanciaRutaKm: con demasiados puntos usa la aproximacion sin consultar', async () => {
  reiniciarCacheRutas();
  const muchos = Array.from({ length: 60 }, (_, i) => ({ latitud: -24 - i * 0.001, longitud: -65 }));
  const r = await distanciaRutaKm({ puntos: muchos }, { apiKey: 'k', fetchFn: async () => assert.fail('no debe consultar') });
  assert.equal(r.aproximado, true);
});

test('distanciaRutaKm: con el respaldo apagado devuelve el motivo', async () => {
  reiniciarCacheRutas();
  const r = await distanciaRutaKm({ puntos: [P1, P2] }, { apiKey: '', respaldoAproximado: false });
  assert.equal(r.motivo, 'sin_ruteo');
});

// ---- obtenerLogisticaDia ----------------------------------------------------

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
      { empresa: 'YPF', producto: 'GNC', tipo: 'gnc', unidad: 'm3', precio: 750, precio_de_referencia: false },
    ],
  },
};

const TURNOS = [
  turno(1, '09:00:00', 10, '-24.2177', '-65.2781'),
  turno(2, '11:00:00', 11, '-24.2500', '-65.2500'),
  turno(3, '14:00:00', 11, '-24.2800', '-65.2200'),
];

const deps = (extra = {}) => ({
  leerTurnosDelDia: async () => ({ data: TURNOS }),
  leerConfigUsuario: async () => ({ data: CONFIG }),
  obtenerPrecios: async () => PRECIOS,
  distanciaRutaKm: async () => ({ km: 20, aproximado: false }),
  ...extra,
});

const pedir = (extra) => obtenerLogisticaDia({ idUsuario: 1, fecha: '2026-10-23' }, deps(extra));

test('obtenerLogisticaDia: arma ruta, consumo y costo del dia', async () => {
  const r = await pedir();
  assert.equal(r.error, undefined);
  assert.equal(r.data.fecha, '2026-10-23');
  assert.equal(r.data.turnos, 3);
  assert.equal(r.data.clientes_a_visitar, 2);
  assert.equal(r.data.ruta.incluido, true);
  assert.equal(r.data.ruta.km, 20);
  assert.equal(r.data.ruta.km_aproximados, false);
  assert.equal(r.data.ruta.paradas, 3);
  assert.equal(r.data.combustible.incluido, true);
  assert.equal(r.data.combustible.cantidad, 2);
  assert.equal(r.data.combustible.unidad, 'l');
  assert.equal(r.data.combustible.costo, 4218);
  assert.equal(r.data.combustible.combustible, 'YPF SUPER');
});

test('obtenerLogisticaDia: la ruta parte de la salida y sigue el orden de los turnos', async () => {
  let puntos;
  await pedir({ distanciaRutaKm: async (arg) => { puntos = arg.puntos; return { km: 5, aproximado: false }; } });
  assert.equal(puntos.length, 4);
  assert.equal(puntos[0].latitud, -24.1858);
  assert.equal(puntos[1].latitud, -24.2177);
  assert.equal(puntos[3].latitud, -24.28);
});

test('obtenerLogisticaDia: con GNC el consumo sale en m3', async () => {
  const r = await pedir({
    leerConfigUsuario: async () => ({
      data: { ...CONFIG, combustible_tipo: 'gnc', combustible_producto: 'GNC', consumo_100km: 9 },
    }),
  });
  assert.equal(r.data.combustible.unidad, 'm3');
  assert.equal(r.data.combustible.cantidad, 1.8);
  assert.equal(r.data.combustible.costo, 1350);
});

test('obtenerLogisticaDia: km aproximados se propagan', async () => {
  const r = await pedir({ distanciaRutaKm: async () => ({ km: 20, aproximado: true }) });
  assert.equal(r.data.ruta.km_aproximados, true);
});

test('obtenerLogisticaDia: sin turnos devuelve ceros y no consulta distancias', async () => {
  const r = await pedir({
    leerTurnosDelDia: async () => ({ data: [] }),
    distanciaRutaKm: async () => assert.fail('no debe consultar'),
  });
  assert.equal(r.data.turnos, 0);
  assert.equal(r.data.clientes_a_visitar, 0);
  assert.equal(r.data.ruta.incluido, false);
  assert.equal(r.data.ruta.motivo, 'sin_turnos');
});

test('obtenerLogisticaDia: sin punto de salida igual informa turnos y clientes', async () => {
  const r = await pedir({ leerConfigUsuario: async () => ({ data: { ...CONFIG, latitud_base: null } }) });
  assert.equal(r.data.turnos, 3);
  assert.equal(r.data.clientes_a_visitar, 2);
  assert.equal(r.data.ruta.incluido, false);
  assert.equal(r.data.ruta.motivo, 'sin_origen');
  assert.equal(r.data.combustible.incluido, false);
});

test('obtenerLogisticaDia: sin combustible configurado igual calcula la ruta', async () => {
  const r = await pedir({ leerConfigUsuario: async () => ({ data: { ...CONFIG, consumo_100km: null } }) });
  assert.equal(r.data.ruta.incluido, true);
  assert.equal(r.data.ruta.km, 20);
  assert.equal(r.data.combustible.incluido, false);
  assert.equal(r.data.combustible.motivo, 'sin_configuracion');
});

test('obtenerLogisticaDia: un combustible sin precio no tira la ruta', async () => {
  const r = await pedir({
    leerConfigUsuario: async () => ({ data: { ...CONFIG, combustible_producto: 'INFINIA' } }),
  });
  assert.equal(r.data.ruta.incluido, true);
  assert.equal(r.data.combustible.incluido, false);
  assert.equal(r.data.combustible.motivo, 'sin_precio');
});

test('obtenerLogisticaDia: informa los turnos sin ubicacion y sin horario', async () => {
  const r = await pedir({
    leerTurnosDelDia: async () => ({
      data: [turno(1, '09:00:00', 10, '-24.2177', '-65.2781'), turno(2, null, 11, null, null)],
    }),
  });
  assert.equal(r.data.turnos, 2);
  assert.equal(r.data.sin_ubicacion, 1);
  assert.equal(r.data.sin_horario, 1);
  assert.equal(r.data.ruta.paradas, 1);
});

test('obtenerLogisticaDia: si ningun turno tiene ubicacion no hay ruta', async () => {
  const r = await pedir({
    leerTurnosDelDia: async () => ({ data: [turno(1, '09:00:00', 10, null, null)] }),
  });
  assert.equal(r.data.ruta.incluido, false);
  assert.equal(r.data.ruta.motivo, 'sin_ubicacion');
});

test('obtenerLogisticaDia: propaga el motivo del ruteo', async () => {
  const r = await pedir({ distanciaRutaKm: async () => ({ motivo: 'ruta_no_disponible' }) });
  assert.equal(r.data.ruta.incluido, false);
  assert.equal(r.data.ruta.motivo, 'ruta_no_disponible');
  assert.equal(r.data.combustible.incluido, false);
});

test('obtenerLogisticaDia: un error de base al leer los turnos es un 500 sin detalle', async () => {
  const r = await pedir({ leerTurnosDelDia: async () => ({ dbError: new Error('columna xyz inexistente') }) });
  assert.equal(r.error.status, 500);
  assert.equal(r.error.message.includes('xyz'), false);
});

test('obtenerLogisticaDia: no expone coordenadas en la respuesta', async () => {
  const r = await pedir();
  const texto = JSON.stringify(r.data);
  assert.equal(texto.includes('latitud'), false);
  assert.equal(texto.includes('longitud'), false);
});

// ---- armarMensajeLogistica (para el bot) -----------------------------------

test('armarMensajeLogistica: resume turnos, clientes, ruta y combustible', async () => {
  const { data } = await pedir();
  const mensaje = armarMensajeLogistica(data);
  assert.match(mensaje, /3 turnos/);
  assert.match(mensaje, /2 clientes/);
  assert.match(mensaje, /20 km/);
  assert.match(mensaje, /2 L/);
  assert.match(mensaje, /\$4\.218/);
});

test('armarMensajeLogistica: con GNC usa m3 y avisa cuando los km son aproximados', async () => {
  const { data } = await pedir({
    leerConfigUsuario: async () => ({
      data: { ...CONFIG, combustible_tipo: 'gnc', combustible_producto: 'GNC', consumo_100km: 9 },
    }),
    distanciaRutaKm: async () => ({ km: 20, aproximado: true }),
  });
  const mensaje = armarMensajeLogistica(data);
  assert.match(mensaje, /m³/);
  assert.match(mensaje, /aproximad/i);
});

test('armarMensajeLogistica: sin turnos lo dice y no inventa numeros', async () => {
  const { data } = await pedir({ leerTurnosDelDia: async () => ({ data: [] }) });
  const mensaje = armarMensajeLogistica(data);
  assert.match(mensaje, /No hay turnos/i);
  assert.equal(/km/.test(mensaje), false);
});

test('armarMensajeLogistica: si no se puede calcular la ruta explica por que', async () => {
  const { data } = await pedir({ leerConfigUsuario: async () => ({ data: { ...CONFIG, latitud_base: null } }) });
  const mensaje = armarMensajeLogistica(data);
  assert.match(mensaje, /3 turnos/);
  assert.match(mensaje, /punto de salida/i);
});
