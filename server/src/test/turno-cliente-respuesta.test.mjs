import test from 'node:test';
import assert from 'node:assert/strict';

// Cliente aislado: nunca usa credenciales ni base reales.
process.env.SUPABASE_URL = 'https://turno-cliente-respuesta-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'turno-cliente-respuesta-tests-sin-conexion';

const { confirmarTurnoDelCliente, cancelarTurnoDelCliente } = await import('../services/turnosClienteService.js');

const AHORA = new Date('2026-11-23T15:00:00Z'); // 23/11/2026 12:00 en Argentina

const TURNO = {
  id_turno: 12,
  estado: 'Coordinado',
  fecha_programada: '2026-11-26',
  inicio_desde: '08:00:00',
  hasta: '10:00:00',
  inmueble: { id_cliente: 5, direccion: 'San Lorenzo 287' },
};

// Cliente de base falso: registra cada consulta y responde por "operacion".
const baseFalsa = ({ lectura = { data: TURNO, error: null }, escritura } = {}) => {
  const consultas = [];
  let lecturasHechas = 0;
  const cliente = {
    from(tabla) {
      const consulta = { tabla, ops: [] };
      consultas.push(consulta);
      const builder = {};
      for (const op of ['select', 'eq', 'in', 'neq', 'gte', 'update', 'delete']) {
        builder[op] = (...args) => { consulta.ops.push([op, ...args]); return builder; };
      }
      builder.maybeSingle = () => {
        const esEscritura = consulta.ops.some(([o]) => o === 'update' || o === 'delete');
        if (!esEscritura) {
          lecturasHechas += 1;
          return Promise.resolve(typeof lectura === 'function' ? lectura(lecturasHechas) : lectura);
        }
        const valor = escritura === undefined
          ? { data: { ...TURNO, ...consulta.ops.find(([o]) => o === 'update')[1] }, error: null }
          : escritura;
        return Promise.resolve(typeof valor === 'function' ? valor(consulta) : valor);
      };
      return builder;
    },
  };
  return { cliente, consultas };
};

const escrituras = (consultas) => consultas.filter((c) => c.ops.some(([o]) => o === 'update' || o === 'delete'));
const valoresUpdate = (consulta) => consulta.ops.find(([o]) => o === 'update')[1];

const confirmar = (cliente, extra = {}) => confirmarTurnoDelCliente({ idCliente: 5, idTurno: 12, ahora: AHORA, cliente, ...extra });
const cancelar = (cliente, extra = {}) => cancelarTurnoDelCliente({ idCliente: 5, idTurno: 12, ahora: AHORA, cliente, ...extra });

// ---- confirmar ---------------------------------------------------------------

test('confirmar: un turno Coordinado del cliente pasa a Confirmado', async () => {
  const { cliente, consultas } = baseFalsa();
  const r = await confirmar(cliente);

  assert.equal(r.error, undefined);
  assert.equal(r.data.estado, 'Confirmado');
  assert.equal(r.data.ya_aplicado, false);
  assert.equal(r.data.id_turno, 12);
  const [escritura] = escrituras(consultas);
  assert.deepEqual(valoresUpdate(escritura), { estado: 'Confirmado' });
  // La condición va en el mismo UPDATE: dos toques a la vez no pisan otro cambio.
  assert.ok(escritura.ops.some(([o, c, v]) => o === 'eq' && c === 'estado' && v === 'Coordinado'));
  assert.ok(escritura.ops.some(([o, c, v]) => o === 'eq' && c === 'id_turno' && v === 12));
});

test('confirmar: la lectura solo trae turnos del cliente que escribe (no se puede operar sobre turnos ajenos)', async () => {
  const { cliente, consultas } = baseFalsa();
  await confirmar(cliente);
  const lectura = consultas[0];
  assert.ok(lectura.ops.some(([o, c, v]) => o === 'eq' && c === 'inmueble.id_cliente' && v === 5));
});

test('confirmar: turno inexistente o de otro cliente da 404 y no escribe nada', async () => {
  const { cliente, consultas } = baseFalsa({ lectura: { data: null, error: null } });
  const r = await confirmar(cliente);
  assert.equal(r.error.status, 404);
  assert.equal(escrituras(consultas).length, 0);
});

test('confirmar: es idempotente (un segundo toque no rompe ni escribe)', async () => {
  const { cliente, consultas } = baseFalsa({ lectura: { data: { ...TURNO, estado: 'Confirmado' }, error: null } });
  const r = await confirmar(cliente);
  assert.equal(r.error, undefined);
  assert.equal(r.data.estado, 'Confirmado');
  assert.equal(r.data.ya_aplicado, true);
  assert.equal(escrituras(consultas).length, 0);
});

test('confirmar: un turno cancelado, en ejecución o realizado da 409 y no escribe', async () => {
  for (const estado of ['Cancelado', 'En ejecución', 'Realizado']) {
    const { cliente, consultas } = baseFalsa({ lectura: { data: { ...TURNO, estado }, error: null } });
    const r = await confirmar(cliente);
    assert.equal(r.error.status, 409, estado);
    assert.equal(escrituras(consultas).length, 0, estado);
  }
});

test('confirmar: un turno que ya pasó da 409', async () => {
  const { cliente, consultas } = baseFalsa({ lectura: { data: { ...TURNO, fecha_programada: '2026-11-20' }, error: null } });
  const r = await confirmar(cliente);
  assert.equal(r.error.status, 409);
  assert.equal(escrituras(consultas).length, 0);
});

test('confirmar: si el turno cambió de estado justo antes del UPDATE devuelve 409', async () => {
  const { cliente } = baseFalsa({ escritura: { data: null, error: null } });
  const r = await confirmar(cliente);
  assert.equal(r.error.status, 409);
});

test('confirmar: id inválido da 400 sin consultar', async () => {
  for (const idTurno of ['abc', '0', '-3', '1.5', '', null, undefined]) {
    const { cliente, consultas } = baseFalsa();
    const r = await confirmar(cliente, { idTurno });
    assert.equal(r.error.status, 400, String(idTurno));
    assert.equal(consultas.length, 0);
  }
});

// ---- cancelar ----------------------------------------------------------------

test('cancelar: marca el turno como Cancelado con el motivo (no lo borra)', async () => {
  const { cliente, consultas } = baseFalsa();
  const r = await cancelar(cliente);

  assert.equal(r.error, undefined);
  assert.equal(r.data.estado, 'Cancelado');
  assert.equal(r.data.ya_aplicado, false);
  const [escritura] = escrituras(consultas);
  assert.equal(escritura.ops.some(([o]) => o === 'delete'), false, 'cancelar nunca borra la fila');
  assert.deepEqual(valoresUpdate(escritura), { estado: 'Cancelado', motivo_cancelacion: 'Cancelado por el cliente (WhatsApp)' });
  assert.ok(escritura.ops.some(([o, c, v]) => o === 'in' && c === 'estado' && v.join() === 'Coordinado,Confirmado'));
});

test('cancelar: también se puede cancelar un turno ya Confirmado', async () => {
  const { cliente } = baseFalsa({ lectura: { data: { ...TURNO, estado: 'Confirmado' }, error: null } });
  const r = await cancelar(cliente);
  assert.equal(r.error, undefined);
  assert.equal(r.data.estado, 'Cancelado');
});

test('cancelar: turno ajeno o inexistente da 404 y no escribe', async () => {
  const { cliente, consultas } = baseFalsa({ lectura: { data: null, error: null } });
  const r = await cancelar(cliente);
  assert.equal(r.error.status, 404);
  assert.equal(escrituras(consultas).length, 0);
  assert.ok(consultas[0].ops.some(([o, c, v]) => o === 'eq' && c === 'inmueble.id_cliente' && v === 5));
});

test('cancelar: es idempotente si ya estaba cancelado', async () => {
  const { cliente, consultas } = baseFalsa({ lectura: { data: { ...TURNO, estado: 'Cancelado' }, error: null } });
  const r = await cancelar(cliente);
  assert.equal(r.error, undefined);
  assert.equal(r.data.ya_aplicado, true);
  assert.equal(escrituras(consultas).length, 0);
});

test('cancelar: un turno en ejecución o realizado, o que ya pasó, da 409', async () => {
  for (const turno of [{ ...TURNO, estado: 'En ejecución' }, { ...TURNO, estado: 'Realizado' }, { ...TURNO, fecha_programada: '2026-11-20' }]) {
    const { cliente, consultas } = baseFalsa({ lectura: { data: turno, error: null } });
    const r = await cancelar(cliente);
    assert.equal(r.error.status, 409);
    assert.equal(escrituras(consultas).length, 0);
  }
});

test('cancelar: si la base lo impide (ya tiene un trabajo registrado) devuelve 409 con el motivo', async () => {
  const { cliente } = baseFalsa({ escritura: { data: null, error: { code: 'P0001', message: 'El turno ya tiene un trabajo registrado.' } } });
  const r = await cancelar(cliente);
  assert.equal(r.error.status, 409);
  assert.match(r.error.message, /trabajo registrado/);
});

test('cancelar: un error inesperado de la base devuelve 500 sin filtrar el detalle', async () => {
  const { cliente } = baseFalsa({ escritura: { data: null, error: { code: 'XX000', message: 'detalle interno secreto' } } });
  const r = await cancelar(cliente);
  assert.equal(r.error.status, 500);
  assert.doesNotMatch(r.error.message, /secreto/);
});

test('cancelar: id inválido da 400 sin consultar', async () => {
  const { cliente, consultas } = baseFalsa();
  const r = await cancelar(cliente, { idTurno: 'xx' });
  assert.equal(r.error.status, 400);
  assert.equal(consultas.length, 0);
});

// ---- Toques duplicados que se pisan (dos entregas del mismo botón a la vez) ------------------

const sinFila = { data: null, error: null };
// Primera lectura: el turno como estaba al tocar; segunda lectura (después del UPDATE sin fila): el estado actual.
const lecturas = (primera, segunda) => (n) => ({ data: n === 1 ? primera : segunda, error: null });

test('confirmar: si el UPDATE no encuentra fila porque otro toque ya lo confirmó, responde éxito (idempotente)', async () => {
  const { cliente, consultas } = baseFalsa({ lectura: lecturas(TURNO, { ...TURNO, estado: 'Confirmado' }), escritura: sinFila });
  const r = await confirmar(cliente);
  assert.equal(r.error, undefined);
  assert.equal(r.data.estado, 'Confirmado');
  assert.equal(r.data.ya_aplicado, true);
  assert.equal(escrituras(consultas).length, 1, 'no reintenta la escritura');
});

test('confirmar: si el UPDATE no encuentra fila y el turno quedó en otro estado (cancelado), sigue siendo 409', async () => {
  const { cliente } = baseFalsa({ lectura: lecturas(TURNO, { ...TURNO, estado: 'Cancelado' }), escritura: sinFila });
  const r = await confirmar(cliente);
  assert.equal(r.error.status, 409);
});

test('cancelar: si el UPDATE no encuentra fila porque otro toque ya lo canceló, responde éxito (idempotente)', async () => {
  const { cliente, consultas } = baseFalsa({ lectura: lecturas(TURNO, { ...TURNO, estado: 'Cancelado' }), escritura: sinFila });
  const r = await cancelar(cliente);
  assert.equal(r.error, undefined);
  assert.equal(r.data.estado, 'Cancelado');
  assert.equal(r.data.ya_aplicado, true);
  assert.equal(escrituras(consultas).length, 1);
});

test('cancelar: si el UPDATE no encuentra fila y el turno pasó a otro estado (en ejecución), sigue siendo 409', async () => {
  const { cliente } = baseFalsa({ lectura: lecturas(TURNO, { ...TURNO, estado: 'En ejecución' }), escritura: sinFila });
  const r = await cancelar(cliente);
  assert.equal(r.error.status, 409);
});

test('si la relectura falla o el turno desapareció, se conserva el 409 original (no se inventa un éxito)', async () => {
  const sinTurno = baseFalsa({ lectura: (n) => (n === 1 ? { data: TURNO, error: null } : { data: null, error: null }), escritura: sinFila });
  assert.equal((await cancelar(sinTurno.cliente)).error.status, 409);
  const conError = baseFalsa({ lectura: (n) => (n === 1 ? { data: TURNO, error: null } : { data: null, error: { code: 'XX000' } }), escritura: sinFila });
  assert.equal((await confirmar(conError.cliente)).error.status, 409);
});
