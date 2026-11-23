import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filtrarYOrdenarClientes,
  formatearTelefono,
  normalizarTipoCliente,
  obtenerClaveCliente,
  obtenerProximoTurnoCliente,
} from '../../../client/src/components/clientes/clientesUtils.js';

test('formatea celulares argentinos canónicos a lectura humana y conserva otros formatos', () => {
  assert.equal(formatearTelefono('5493834250189'), '+54 9 383 425-0189');
  assert.equal(formatearTelefono('5493518914549'), '+54 9 351 891-4549');
  assert.equal(formatearTelefono('5491145678901'), '+54 9 11 4567-8901');
  assert.equal(formatearTelefono('3514330429'), '3514330429');
  assert.equal(formatearTelefono(''), 'Sin teléfono');
});

test('normaliza variantes de tipo_cliente del backend', () => {
  assert.equal(normalizarTipoCliente('EMPRESA'), 'Empresa');
  assert.equal(normalizarTipoCliente('Empresa'), 'Empresa');
  assert.equal(normalizarTipoCliente('Fijo'), 'Fijo');
  assert.equal(normalizarTipoCliente('Particular'), 'Casual');
  assert.equal(normalizarTipoCliente('Casual'), 'Casual');
});

test('obtenerProximoTurnoCliente ignora cancelados, realizados y pasados; devuelve null si no tiene', () => {
  const cliente = { id_cliente: 1, telefono: '5493834250189' };
  const turnos = [
    { idTurno: 1, estado: 'CANCELADO', fechaAsignada: '2026-11-23', cliente: { id_cliente: 1 } },
    { idTurno: 2, estado: 'REALIZADO', fechaAsignada: '2026-11-23', cliente: { id_cliente: 1 } },
    { idTurno: 3, estado: 'CONFIRMADO', fechaAsignada: '2026-11-20', cliente: { id_cliente: 1 } },
    {
      idTurno: 4,
      estado: 'CONFIRMADO',
      fechaAsignada: '2026-11-25',
      franjaHoraria: { horaInicio: '14:00:00' },
      cliente: { id_cliente: 1 },
    },
    {
      idTurno: 5,
      estado: 'PENDIENTE',
      fechaAsignada: '2026-11-23',
      franjaHoraria: { horaInicio: '08:00:00' },
      cliente: { id_cliente: 1 },
    },
  ];

  const proximo = obtenerProximoTurnoCliente(cliente, turnos, '2026-11-22');
  assert.equal(proximo?.idTurno, 5);

  const sinServicios = obtenerProximoTurnoCliente({ id_cliente: 99, telefono: '5493510000000' }, turnos, '2026-11-22');
  assert.equal(sinServicios, null);
});

test('filtra por segmento, inactivos, búsqueda sin tildes y ordena por próximo servicio', () => {
  const clientes = [
    { id_cliente: 1, nombre: 'Luis', apellido: 'Rodríguez', tipo_cliente: 'Casual', estado: 'Activo', telefono: '5493518914549', fecha_alta: '2026-11-19' },
    { id_cliente: 2, nombre: 'Cristian', apellido: 'Leal', tipo_cliente: 'Casual', estado: 'Activo', telefono: '5493834250189', fecha_alta: '2026-11-18' },
    { id_cliente: 3, nombre: 'Sergio', apellido: 'Robert', tipo_cliente: 'Fijo', estado: 'Activo', telefono: '5493834250188', fecha_alta: '2026-11-17' },
    { id_cliente: 4, nombre: 'Roberto', apellido: 'Paz', tipo_cliente: 'Casual', estado: 'Inactivo', telefono: '5493514001122', fecha_alta: '2026-11-10' },
  ];

  const proximosPorClave = new Map([
    [obtenerClaveCliente(clientes[1]), { fechaAsignada: '2026-11-23', franjaHoraria: { horaInicio: '08:00:00' } }],
  ]);

  const activosOrdenProximo = filtrarYOrdenarClientes(clientes, {
    segmento: 'Todos',
    busqueda: '',
    orden: 'proximo',
    proximosPorClave,
  });
  assert.deepEqual(activosOrdenProximo.map((c) => c.id_cliente), [2, 1, 3]);

  const busquedaSinTilde = filtrarYOrdenarClientes(clientes, {
    segmento: 'Todos',
    busqueda: 'rodriguez',
    orden: 'recientes',
    proximosPorClave,
  });
  assert.deepEqual(busquedaSinTilde.map((c) => c.id_cliente), [1]);

  const soloFijos = filtrarYOrdenarClientes(clientes, {
    segmento: 'Fijo',
    busqueda: '',
    orden: 'recientes',
    proximosPorClave,
  });
  assert.deepEqual(soloFijos.map((c) => c.id_cliente), [3]);

  const soloInactivos = filtrarYOrdenarClientes(clientes, {
    segmento: 'Inactivos',
    busqueda: '',
    orden: 'recientes',
    proximosPorClave,
  });
  assert.deepEqual(soloInactivos.map((c) => c.id_cliente), [4]);
});
