import test from 'node:test';
import assert from 'node:assert/strict';
import { obtenerFranjasTurnos, compararHorarioTurnos, formatearHorarioTurno, tieneHorarioTurno } from '../../../client/src/components/turnos/agendaTurnos.js';

const turno = (id, inicio, fin, estado = 'COORDINADO') => ({
  idTurno: id, fechaAsignada: '2026-10-08', estado,
  franjaHoraria: { horaInicio: inicio, horaFin: fin }
});

test('editar conserva exactamente una franja personalizada y su duración al reprogramar', () => {
  for (const [inicio, fin] of [['13:00:00', '15:00:00'], ['14:00:00', '16:00:00']]) {
    const actual = turno(7, inicio, fin);
    for (const fecha of ['2026-10-08', '2026-10-09']) {
      const franjas = obtenerFranjasTurnos({ fecha, turnos: [actual], turnoActual: actual });
      const opcion = franjas.find((slot) => slot.horaInicio === inicio);
      assert.equal(opcion.horaFin, fin);
      assert.equal(opcion.turnoSolapado, undefined);
      assert.equal(franjas.filter((slot) => slot.horaInicio.slice(0, 5) === inicio.slice(0, 5)).length, 1);
    }
  }
});

test('las franjas ignoran turnos sin horario, cancelados y el turno actual, pero detectan cruces reales', () => {
  const sinHorario = turno(1, null, null);
  const cancelado = turno(2, '08:00', '19:00', 'CANCELADO');
  const actual = turno(3, '14:00:00', '16:00:00');
  const ocupado = turno(4, '10:00:00', '11:30:00');
  const franjas = obtenerFranjasTurnos({ fecha: actual.fechaAsignada, turnos: [sinHorario, cancelado, actual, ocupado], turnoActual: actual });
  assert.equal(franjas.find((slot) => slot.horaInicio === '08:30').turnoSolapado, ocupado);
  assert.equal(franjas.find((slot) => slot.horaInicio === '11:30').turnoSolapado, undefined);
  assert.equal(franjas.find((slot) => slot.horaInicio === actual.franjaHoraria.horaInicio).turnoSolapado, undefined);
});

test('los turnos sin horario se muestran y se ordenan después de los horarios asignados', () => {
  const sinHorario = turno(1, null, null);
  const tarde = turno(2, '14:00:00', '16:00:00');
  const temprano = turno(3, '08:30', '11:00');
  assert.deepEqual([sinHorario, tarde, temprano].sort(compararHorarioTurnos), [temprano, tarde, sinHorario]);
  assert.equal(formatearHorarioTurno(sinHorario), 'Sin horario');
  assert.equal(tieneHorarioTurno(sinHorario), false);
  assert.equal(tieneHorarioTurno({ franjaHoraria: null }), false);
  assert.equal(tieneHorarioTurno(turno(4, '16:00', '14:00')), false);
});
