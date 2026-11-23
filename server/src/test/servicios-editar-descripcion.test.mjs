import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://servicios-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'servicios-tests-sin-conexion';
const { supabaseAdmin } = await import('../config/supabase.js');
const { updateServicio } = await import('../controllers/serviciosController.js');

function preparar(t, { existente = { id_usuario_servicio: 12, id_servicio: 4 } } = {}) {
  const operaciones = [];
  t.mock.method(globalThis, 'fetch', () => {
    throw new Error('La prueba no permite conexiones de red.');
  });

  let descripcionActual = 'Descripción vieja';
  let precioActual = 1000;

  t.mock.method(supabaseAdmin, 'from', (tabla) => {
    const op = { tabla, filtros: [] };
    operaciones.push(op);

    const query = {
      select(campos) { op.select = campos; return this; },
      update(payload) {
        op.update = payload;
        if (tabla === 'servicios_catalogo' && 'descripcion' in payload) {
          descripcionActual = payload.descripcion;
        }
        if (tabla === 'usuario_servicio' && 'precio_base' in payload) {
          precioActual = payload.precio_base;
        }
        return this;
      },
      eq(...args) { op.filtros.push(['eq', ...args]); return this; },
      maybeSingle() {
        if (!existente) return Promise.resolve({ data: null, error: null });
        if (op.select === 'id_usuario_servicio, id_servicio') {
          return Promise.resolve({ data: existente, error: null });
        }
        return Promise.resolve({
          data: {
            id_usuario_servicio: existente.id_usuario_servicio,
            id_servicio: existente.id_servicio,
            precio_base: precioActual,
            limite_operativo: null,
            activo: true,
            servicio: {
              nombre: 'Corte de césped',
              descripcion: descripcionActual,
              variable_cotizacion: null,
            },
          },
          error: null,
        });
      },
      then(resolve, reject) {
        return Promise.resolve({ data: null, error: null }).then(resolve, reject);
      },
    };
    return query;
  });

  const res = {
    codigo: 200,
    status(c) { this.codigo = c; return this; },
    json(b) { this.body = b; return this; },
  };
  return { operaciones, res };
}

test('permite editar precio y descripción en el mismo PUT', async (t) => {
  const { operaciones, res } = preparar(t);
  await updateServicio(
    { params: { id: '12' }, body: { precio_base: 1500, descripcion: '  Corte y bordeado  ' }, user: { sub: 7 } },
    res,
  );

  assert.equal(res.codigo, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.data.precio_base, 1500);
  assert.equal(res.body.data.servicio.descripcion, 'Corte y bordeado');

  const updateCatalogo = operaciones.find((op) => op.tabla === 'servicios_catalogo' && op.update);
  assert.deepEqual(updateCatalogo?.update, { descripcion: 'Corte y bordeado' });
  assert.deepEqual(updateCatalogo?.filtros, [['eq', 'id_servicio', 4]]);
});

test('permite editar o vaciar solo la descripción sin enviar precio_base', async (t) => {
  const { operaciones, res } = preparar(t);
  await updateServicio(
    { params: { id: '12' }, body: { descripcion: '   ' }, user: { sub: 7 } },
    res,
  );

  assert.equal(res.codigo, 200);
  assert.equal(res.body.data.servicio.descripcion, null);
  assert.equal(operaciones.some((op) => op.tabla === 'usuario_servicio' && op.update), false);
});

test('rechaza descripción que no sea texto sin escribir en la base', async (t) => {
  const { operaciones, res } = preparar(t);
  await updateServicio(
    { params: { id: '12' }, body: { descripcion: 1234 }, user: { sub: 7 } },
    res,
  );

  assert.equal(res.codigo, 400);
  assert.equal(operaciones.length, 0);
});

test('si el servicio no pertenece al usuario devuelve 404 y no modifica servicios_catalogo', async (t) => {
  const { operaciones, res } = preparar(t, { existente: null });
  await updateServicio(
    { params: { id: '12' }, body: { descripcion: 'Intento ajeno' }, user: { sub: 99 } },
    res,
  );

  assert.equal(res.codigo, 404);
  assert.equal(operaciones.some((op) => op.tabla === 'servicios_catalogo'), false);
});
