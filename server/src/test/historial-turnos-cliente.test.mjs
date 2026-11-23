import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://historial-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'historial-tests-sin-conexion';

const { obtenerHistorialTurnosCliente } = await import('../services/historialTurnosClienteService.js');
const { getHistorialTurnosCliente } = await import('../controllers/historialTurnosClienteController.js');

function crearClienteMock(handlers = {}) {
  const consultas = [];
  const cliente = {
    from(tabla) {
      const registro = { tabla, select: null, filtros: [], ordenes: [] };
      consultas.push(registro);
      const query = {
        select(campos) { registro.select = campos; return this; },
        eq(...args) { registro.filtros.push(['eq', ...args]); return this; },
        in(...args) { registro.filtros.push(['in', ...args]); return this; },
        order(...args) { registro.ordenes.push(args); return this; },
        then(resolve, reject) {
          const handler = handlers[tabla];
          const salida = typeof handler === 'function' ? handler(registro) : { data: [], error: null };
          return Promise.resolve(salida).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return { cliente, consultas };
}

test('rechaza idCliente inválido sin consultar la base', async () => {
  const { cliente, consultas } = crearClienteMock();

  for (const invalido of ['abc', '0', '-5', '12.5', '', null, true]) {
    const res = await obtenerHistorialTurnosCliente({ idCliente: invalido, cliente });
    assert.equal(res.error?.status, 400);
  }
  assert.equal(consultas.length, 0);
});

test('devuelve arreglo vacío cuando el cliente no tiene turnos sin hacer consultas extra', async () => {
  const { cliente, consultas } = crearClienteMock({
    turnos: () => ({ data: [], error: null }),
  });

  const res = await obtenerHistorialTurnosCliente({ idCliente: 12, cliente });
  assert.deepEqual(res, { data: [] });
  assert.equal(consultas.length, 1);
  assert.equal(consultas[0].tabla, 'turnos');
});

test('filtra por inmueble.id_cliente, ordena descendente y enriquece servicios, presupuesto y pagos', async () => {
  const { cliente, consultas } = crearClienteMock({
    turnos: () => ({
      data: [
        {
          id_turno: 35,
          id_presupuesto: 7,
          id_inmueble: 51,
          fecha_programada: '2026-10-15',
          inicio_desde: '08:00:00',
          hasta: '10:00:00',
          prioridad: 'P3_Casual',
          estado: 'Realizado',
          motivo_cancelacion: null,
          cobrado: false,
          inmueble: {
            id_inmueble: 51,
            id_cliente: 12,
            direccion: 'Av. Belgrano 120',
            barrio: 'Centro',
            provincia: 'Jujuy',
            manzana: null,
            lote: null,
            tipo_inmueble: 'Casa Habitada',
            superficie_mantenible: 180,
            superficie_total: 250,
          },
        },
        {
          id_turno: 33,
          id_presupuesto: 5,
          id_inmueble: 49,
          fecha_programada: '2026-10-11',
          inicio_desde: '08:30:00',
          hasta: '11:00:00',
          prioridad: 'P1_Reasignado',
          estado: 'En ejecución',
          motivo_cancelacion: null,
          cobrado: false,
          inmueble: {
            id_inmueble: 49,
            id_cliente: 12,
            direccion: 'Los Álamos 45',
            barrio: 'Los Perales',
            provincia: 'Jujuy',
            manzana: 'B',
            lote: '4',
            tipo_inmueble: 'Lote Vacio',
            superficie_mantenible: 300,
            superficie_total: 300,
          },
        },
      ],
      error: null,
    }),
    detalle_presupuesto: () => ({
      data: [
        { id_presupuesto: 7, id_servicio: 1, servicio: { nombre: 'Corte de césped' } },
        { id_presupuesto: 7, id_servicio: 2, servicio: { nombre: 'Desmalezado' } },
        { id_presupuesto: 5, id_servicio: 1, servicio: { nombre: 'Corte de césped' } },
      ],
      error: null,
    }),
    presupuestos: () => ({
      data: [
        {
          id_presupuesto: 7,
          monto_estimado: 25000,
          monto_subtotal: 25000,
          monto_total: 28500.5,
          estado: 'Aceptado',
          monto_traslado: 3500.5,
          traslado_km: 8.2,
        },
      ],
      error: null,
    }),
    trabajos_ejecutados: () => ({
      data: [{ id_trabajo: 90, id_turno: 35 }],
      error: null,
    }),
    pagos: () => ({
      data: [
        { id_pago: 1, id_trabajo: 90, medio_pago: 'Efectivo', monto: 10000.1, estado: 'Aprobado', fecha_pago: '2026-10-15' },
        { id_pago: 2, id_trabajo: 90, medio_pago: 'Transferencia', monto: 5000.2, estado: 'Aprobado', fecha_pago: '2026-10-16' },
      ],
      error: null,
    }),
  });

  const res = await obtenerHistorialTurnosCliente({ idCliente: '12', cliente });
  assert.equal(res.error, undefined);
  assert.equal(res.data.length, 2);

  const qTurnos = consultas.find((c) => c.tabla === 'turnos');
  assert.match(qTurnos.select, /inmueble:inmuebles!inner/);
  assert.deepEqual(qTurnos.filtros, [['eq', 'inmueble.id_cliente', 12]]);
  assert.deepEqual(qTurnos.ordenes, [
    ['fecha_programada', { ascending: false }],
    ['inicio_desde', { ascending: false }],
    ['id_turno', { ascending: false }],
  ]);

  const qTrabajos = consultas.find((c) => c.tabla === 'trabajos_ejecutados');
  assert.deepEqual(qTrabajos.filtros, [['in', 'id_turno', [35]]]);

  const qPagos = consultas.find((c) => c.tabla === 'pagos');
  assert.equal(qPagos.select.includes('referencia_comprobante'), false);

  const realizado = res.data[0];
  assert.equal(realizado.id_turno, 35);
  assert.equal(realizado.estado, 'REALIZADO');
  assert.equal(realizado.prioridad, 'P3_CASUAL');
  assert.deepEqual(realizado.servicios, ['Corte de césped', 'Desmalezado']);
  assert.equal(realizado.servicio_descripcion, 'Corte de césped, Desmalezado');
  assert.equal(realizado.presupuesto.monto_total, 28500.5);
  assert.equal(realizado.cobro.total_pagado, 15000.3);
  assert.equal(realizado.cobro.pagos.length, 2);

  const enEjecucion = res.data[1];
  assert.equal(enEjecucion.estado, 'EN_EJECUCION');
  assert.equal(enEjecucion.prioridad, 'P1_REASIGNADO');
  assert.equal(enEjecucion.cobro.total_pagado, 0);
});

test('degrada de forma segura si fallan consultas secundarias de presupuestos o pagos', async (t) => {
  t.mock.method(console, 'error', () => {});

  const { cliente } = crearClienteMock({
    turnos: () => ({
      data: [
        {
          id_turno: 10,
          id_presupuesto: 3,
          id_inmueble: 1,
          fecha_programada: '2026-09-01',
          inicio_desde: '09:00:00',
          hasta: '10:00:00',
          prioridad: 'P2_Fijo',
          estado: 'Realizado',
          motivo_cancelacion: null,
          cobrado: true,
          inmueble: { id_inmueble: 1, id_cliente: 5, direccion: 'Calle 1' },
        },
      ],
      error: null,
    }),
    detalle_presupuesto: () => ({ data: null, error: { message: 'fallo detalles' } }),
    presupuestos: () => ({ data: null, error: { message: 'fallo presupuestos' } }),
    trabajos_ejecutados: () => ({ data: null, error: { message: 'fallo trabajos' } }),
  });

  const res = await obtenerHistorialTurnosCliente({ idCliente: 5, cliente });
  assert.equal(res.error, undefined);
  assert.equal(res.data.length, 1);
  assert.equal(res.data[0].presupuesto, null);
  assert.deepEqual(res.data[0].servicios, []);
  assert.deepEqual(res.data[0].cobro, { cobrado: true, total_pagado: 0, pagos: [] });
});

test('el controlador responde 400 cuando idCliente es inválido', async () => {
  const res = {
    codigo: 200,
    body: null,
    status(codigo) { this.codigo = codigo; return this; },
    json(payload) { this.body = payload; return this; },
  };

  await getHistorialTurnosCliente({ params: { idCliente: 'no-valido' } }, res);
  assert.equal(res.codigo, 400);
  assert.equal(res.body.ok, false);
});
