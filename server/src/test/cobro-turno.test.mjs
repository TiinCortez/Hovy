import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularPendienteTrabajo, planificarCobroTurno } from '../integrations/mercadopago/cobros/cobroTurno.js';
import { requiereRegistroDePago } from '../integrations/mercadopago/cobros/estadoPago.js';

const AHORA = Date.parse('2026-10-23T12:00:00Z');
const HORA_MS = 60 * 60 * 1000;
const haceHoras = (horas) => new Date(AHORA - horas * HORA_MS).toISOString();

const turno = (extra = {}) => ({ id_turno: 12, estado: 'Realizado', cobrado: false, ...extra });
const presupuesto = (extra = {}) => ({ monto_total: 60000, estado: 'Aceptado', ...extra });
const cobro = (extra = {}) => ({
  id: 7,
  id_turno: 12,
  monto: 60000,
  estado: 'Pendiente',
  init_point: 'https://mp/pagar',
  created_at: haceHoras(1),
  ...extra,
});

const planificar = (extra = {}) =>
  planificarCobroTurno({
    turno: turno(),
    movimientos: [],
    presupuesto: presupuesto(),
    cobrosActivos: [],
    ahora: AHORA,
    ...extra,
  });

// ---- calcularPendienteTrabajo ----------------------------------------------

test('calcularPendienteTrabajo: sin movimientos no hay dato', () => {
  assert.equal(calcularPendienteTrabajo([]), null);
  assert.equal(calcularPendienteTrabajo(null), null);
});

test('calcularPendienteTrabajo: el debito suma y el credito resta', () => {
  assert.equal(calcularPendienteTrabajo([{ tipo: 'Debito', monto: 60000 }]), 60000);
  assert.equal(
    calcularPendienteTrabajo([{ tipo: 'Debito', monto: 60000 }, { tipo: 'Credito', monto: 25000 }]),
    35000
  );
});

test('calcularPendienteTrabajo: los ajustes siguen el mismo signo que su tipo', () => {
  assert.equal(
    calcularPendienteTrabajo([
      { tipo: 'Debito', monto: 60000 },
      { tipo: 'Ajuste_Debito', monto: 5000 },
      { tipo: 'Ajuste_Credito', monto: 2000 },
      { tipo: 'Credito', monto: 10000 },
    ]),
    53000
  );
});

test('calcularPendienteTrabajo: no acumula errores de punto flotante', () => {
  assert.equal(
    calcularPendienteTrabajo([{ tipo: 'Debito', monto: '0.3' }, { tipo: 'Credito', monto: '0.1' }]),
    0.2
  );
});

test('calcularPendienteTrabajo: un tipo desconocido se ignora', () => {
  assert.equal(calcularPendienteTrabajo([{ tipo: 'Debito', monto: 100 }, { tipo: 'Otro', monto: 999 }]), 100);
});

// ---- planificarCobroTurno ---------------------------------------------------

test('planificarCobroTurno: turno inexistente es un 404', () => {
  assert.equal(planificar({ turno: null }).error.status, 404);
});

test('planificarCobroTurno: solo se cobra un turno Realizado', () => {
  for (const estado of ['Coordinado', 'Confirmado', 'En ejecución', 'Cancelado']) {
    const r = planificar({ turno: turno({ estado }) });
    assert.equal(r.error.status, 409, estado);
    assert.match(r.error.message, new RegExp(estado));
  }
});

test('planificarCobroTurno: un turno ya cobrado no se vuelve a cobrar', () => {
  assert.equal(planificar({ turno: turno({ cobrado: true }) }).error.status, 409);
  assert.equal(planificar({ cobrosActivos: [cobro({ estado: 'Aprobado' })] }).error.status, 409);
});

test('planificarCobroTurno: cobra lo que falta segun el libro de movimientos', () => {
  const r = planificar({
    movimientos: [{ tipo: 'Debito', monto: 60000 }, { tipo: 'Credito', monto: 25000 }],
  });
  assert.equal(r.accion, 'crear');
  assert.equal(r.monto, 35000);
  assert.equal(r.descripcion, 'Turno #12');
});

test('planificarCobroTurno: sin movimientos usa el total del presupuesto aceptado', () => {
  const r = planificar({ movimientos: [] });
  assert.equal(r.accion, 'crear');
  assert.equal(r.monto, 60000);
});

test('planificarCobroTurno: sin movimientos ni presupuesto aceptado no hay con que cobrar', () => {
  assert.equal(planificar({ presupuesto: null }).error.status, 409);
  assert.equal(planificar({ presupuesto: presupuesto({ estado: 'Borrador' }) }).error.status, 409);
});

test('planificarCobroTurno: sin saldo pendiente no hay cobro', () => {
  const r = planificar({ movimientos: [{ tipo: 'Debito', monto: 60000 }, { tipo: 'Credito', monto: 60000 }] });
  assert.equal(r.error.status, 409);
  assert.match(r.error.message, /saldo pendiente/i);
});

test('planificarCobroTurno: un total de presupuesto con mas de 2 decimales es invalido', () => {
  assert.equal(planificar({ presupuesto: presupuesto({ monto_total: 100.005 }) }).error.status, 409);
});

test('planificarCobroTurno: reutiliza el cobro pendiente si el monto sigue siendo el mismo', () => {
  const existente = cobro();
  const r = planificar({ movimientos: [{ tipo: 'Debito', monto: 60000 }], cobrosActivos: [existente] });
  assert.equal(r.accion, 'reutilizar');
  assert.equal(r.cobro, existente);
});

test('planificarCobroTurno: si el monto cambio cancela el pendiente viejo y crea uno nuevo', () => {
  const r = planificar({
    movimientos: [{ tipo: 'Debito', monto: 60000 }, { tipo: 'Ajuste_Debito', monto: 5000 }],
    cobrosActivos: [cobro({ id: 7 }), cobro({ id: 8 })],
  });
  assert.equal(r.accion, 'crear');
  assert.equal(r.monto, 65000);
  assert.deepEqual(r.cancelar, [7, 8]);
});

test('planificarCobroTurno: un link que ya vencio no se reutiliza, se cancela y se crea otro', () => {
  // The Mercado Pago preference expires 24 h after it was created.
  const r = planificar({
    movimientos: [{ tipo: 'Debito', monto: 60000 }],
    cobrosActivos: [cobro({ id: 7, created_at: haceHoras(25) })],
  });
  assert.equal(r.accion, 'crear');
  assert.deepEqual(r.cancelar, [7]);
});

test('planificarCobroTurno: un link a punto de vencer tampoco se reutiliza', () => {
  const r = planificar({
    movimientos: [{ tipo: 'Debito', monto: 60000 }],
    cobrosActivos: [cobro({ created_at: haceHoras(23.75) })],
  });
  assert.equal(r.accion, 'crear');
});

test('planificarCobroTurno: un link dentro de su vigencia se reutiliza', () => {
  const r = planificar({
    movimientos: [{ tipo: 'Debito', monto: 60000 }],
    cobrosActivos: [cobro({ created_at: haceHoras(22) })],
  });
  assert.equal(r.accion, 'reutilizar');
});

test('planificarCobroTurno: un pendiente sin fecha de creacion no se reutiliza', () => {
  const r = planificar({
    movimientos: [{ tipo: 'Debito', monto: 60000 }],
    cobrosActivos: [cobro({ created_at: undefined })],
  });
  assert.equal(r.accion, 'crear');
});

test('planificarCobroTurno: un pendiente sin link no se reutiliza', () => {
  const r = planificar({
    movimientos: [{ tipo: 'Debito', monto: 60000 }],
    cobrosActivos: [cobro({ init_point: null })],
  });
  assert.equal(r.accion, 'crear');
  assert.deepEqual(r.cancelar, [7]);
});

test('planificarCobroTurno: la descripcion incluye el servicio y respeta el limite de 120', () => {
  const corta = planificar({ servicio: 'Corte de césped' });
  assert.equal(corta.descripcion, 'Turno #12 - Corte de césped');
  const larga = planificar({ servicio: 'x'.repeat(300) });
  assert.equal(larga.descripcion.length, 120);
});

// ---- requiereRegistroDePago -------------------------------------------------

test('requiereRegistroDePago: un cobro de turno aprobado sin pago registrado lo requiere', () => {
  assert.equal(requiereRegistroDePago(cobro({ estado: 'Aprobado' }), { status: 'approved' }), true);
});

test('requiereRegistroDePago: no lo requiere si ya se registro, no es de un turno o no esta aprobado', () => {
  assert.equal(requiereRegistroDePago(cobro({ estado: 'Aprobado', id_pago: 3 }), { status: 'approved' }), false);
  assert.equal(requiereRegistroDePago(cobro({ estado: 'Aprobado', id_turno: null }), { status: 'approved' }), false);
  assert.equal(requiereRegistroDePago(cobro({ estado: 'Pendiente' }), { status: 'approved' }), false);
  assert.equal(requiereRegistroDePago(null, { status: 'approved' }), false);
});

test('requiereRegistroDePago: un pago devuelto o en proceso no se registra aunque el cobro figure aprobado', () => {
  assert.equal(requiereRegistroDePago(cobro({ estado: 'Aprobado' }), { status: 'refunded' }), false);
  assert.equal(requiereRegistroDePago(cobro({ estado: 'Aprobado' }), { status: 'in_process' }), false);
});
