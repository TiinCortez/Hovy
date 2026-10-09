import test from 'node:test';
import assert from 'node:assert/strict';
import {
  obtenerAhoraTurnos, fechaAIso, fechaDesdeIso, sumarDiasTurnos,
  inicioSemanaTurnos, cambiarMesTurnos, horarioPasadoTurnos
} from '../../../client/src/components/turnos/agendaTurnos.js';
import { validarFechaAltaTurno } from '../utils/turnosFecha.js';
import { hoyEnArgentina, sumarDias, validarFechaNoPasada } from '../utils/fechaArgentina.js';

test('la agenda usa el día argentino cuando UTC ya cambió de fecha', () => {
  const ahora = obtenerAhoraTurnos(new Date('2026-10-07T01:30:00Z'));
  assert.deepEqual(ahora, { fecha: '2026-10-06', segundos: 22 * 3600 + 30 * 60 });
  assert.equal(validarFechaAltaTurno('2026-10-06', '23:00', '23:30', new Date('2026-10-07T01:30:00Z')), null);
});

test('a mediodía bloquea días anteriores y franjas ya comenzadas, aunque no terminaron', () => {
  const fechaActual = new Date('2026-10-06T15:00:00Z');
  const ahora = obtenerAhoraTurnos(fechaActual);
  for (const [fecha, inicio, fin] of [
    ['2026-10-05', '16:30', '18:30'],
    ['2026-10-06', '10:00', '11:00'],
    ['2026-10-06', '11:30', '13:30']
  ]) {
    assert.equal(horarioPasadoTurnos(fecha, inicio, ahora), true);
    assert.ok(validarFechaAltaTurno(fecha, inicio, fin, fechaActual));
  }
  for (const [fecha, inicio, fin] of [
    ['2026-10-06', '12:00', '13:00'],
    ['2026-10-06', '14:00', '16:30'],
    ['2026-10-07', '08:30', '11:00']
  ]) {
    assert.equal(horarioPasadoTurnos(fecha, inicio, ahora), false);
    assert.equal(validarFechaAltaTurno(fecha, inicio, fin, fechaActual), null);
  }
});

test('revalida franjas que vencieron mientras el formulario estaba abierto', () => {
  const ahora = new Date('2026-10-06T17:00:01Z');
  assert.equal(horarioPasadoTurnos('2026-10-06', '14:00', obtenerAhoraTurnos(ahora)), true);
  assert.ok(validarFechaAltaTurno('2026-10-06', '14:00:00', '16:30:00', ahora));
});

test('el alta rechaza fechas imposibles y franjas inválidas antes de escribir en la base', () => {
  const ahora = new Date('2026-01-01T15:00:00Z');
  for (const fecha of ['2026-02-30', '2026-13-01', '2026-1-10', 'fecha', null]) {
    assert.ok(validarFechaAltaTurno(fecha, '14:00', '16:30', ahora));
  }
  for (const [inicio, fin] of [['25:00', '26:00'], ['14:60', '16:00'], ['16:30', '16:30'], ['16:30', '14:00'], [null, '16:30']]) {
    assert.ok(validarFechaAltaTurno('2026-10-06', inicio, fin, ahora));
  }
  assert.equal(validarFechaAltaTurno('2028-02-29', '14:00:00', '16:30:00', ahora), null);
});

test('la semana va de lunes a domingo, incluso entre meses y años', () => {
  assert.equal(inicioSemanaTurnos('2026-10-06'), '2026-10-05');
  assert.equal(inicioSemanaTurnos('2026-10-11'), '2026-10-05');
  assert.equal(inicioSemanaTurnos('2027-01-03'), '2026-12-28');
  assert.equal(sumarDiasTurnos('2026-12-28', 6), '2027-01-03');
  assert.equal(sumarDiasTurnos('2026-12-28', 7), '2027-01-04');
});

test('la navegación mensual no salta febrero desde un día 31', () => {
  assert.equal(cambiarMesTurnos('2026-01-31', 1), '2026-02-01');
  assert.equal(cambiarMesTurnos('2026-03-31', -1), '2026-02-01');
  assert.equal(cambiarMesTurnos('2026-12-31', 1), '2027-01-01');
  assert.equal(sumarDiasTurnos('2028-02-28', 1), '2028-02-29');
});

test('las fechas calendario conservan el día sin depender de la zona del dispositivo', () => {
  const zonaPrevia = process.env.TZ;
  try {
    for (const zona of ['America/Argentina/Buenos_Aires', 'Pacific/Auckland', 'America/Los_Angeles']) {
      process.env.TZ = zona;
      assert.equal(fechaAIso(fechaDesdeIso('2026-10-06')), '2026-10-06');
      assert.equal(inicioSemanaTurnos('2026-10-11'), '2026-10-05');
      assert.equal(cambiarMesTurnos('2026-01-31', 1), '2026-02-01');
    }
  } finally {
    if (zonaPrevia === undefined) delete process.env.TZ;
    else process.env.TZ = zonaPrevia;
  }
});

test('las utilidades existentes mantienen su contrato para los otros consumidores', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-07T01:30:00Z').getTime() });
  assert.equal(hoyEnArgentina(), '2026-10-06');
  assert.equal(validarFechaNoPasada('2026-10-06'), null);
  assert.equal(validarFechaNoPasada('2026-10-07', 'fecha_preferida'), null);
  assert.equal(validarFechaNoPasada('2026-10-05', 'fecha_preferida'), 'fecha_preferida no puede ser anterior a hoy.');
  assert.equal(validarFechaNoPasada('2026-02-30'), 'fecha no es una fecha válida: "2026-02-30"');
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
  // El bot valida días, sin recibir la nueva restricción horaria del ABMC.
  assert.equal(validarFechaNoPasada('2026-10-06'), null);
  assert.ok(validarFechaAltaTurno('2026-10-06', '21:00', '22:00'));
});
