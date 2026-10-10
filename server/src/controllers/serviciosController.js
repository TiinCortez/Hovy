import { supabaseAdmin } from "../config/supabase.js";

const SELECT_MIO = 'id_usuario_servicio, id_servicio, precio_base, limite_operativo, activo, servicio:servicios_catalogo(nombre, descripcion, variable_cotizacion)';

// Raw DB errors are logged, never returned to the client.
const errorInterno = (res, err, contexto) => {
  console.error(`Error en servicios (${contexto}):`, err?.message || err);
  return res.status(500).json({ ok: false, error: "Error interno del servidor" });
};

// Ownership always comes from the JWT (sub), never from the body.
const idUsuarioDelToken = (req) => Number(req.user?.sub);

const esEnteroPositivo = (valor) => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 && String(valor).trim() !== '';
};

const esNumeroNoNegativo = (valor) => {
  if (typeof valor === 'string' && valor.trim() === '') return false;
  if (typeof valor === 'boolean' || valor === null) return false;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0;
};

// GET /api/servicios
export const getCatalogo = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('servicios_catalogo')
      .select('id_servicio, nombre, descripcion, variable_cotizacion')
      .order('nombre', { ascending: true });

    if (error) return errorInterno(res, error, 'getCatalogo');

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return errorInterno(res, err, 'getCatalogo');
  }
};

// GET /api/servicios/catalogo
export const getServicios = async (req, res) => {
  try {
    const idUsuario = idUsuarioDelToken(req);

    const { data, error } = await supabaseAdmin
      .from('usuario_servicio')
      .select(SELECT_MIO)
      .eq('id_usuario', idUsuario)
      .order('id_usuario_servicio', { ascending: true });

    if (error) return errorInterno(res, error, 'getServicios');

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return errorInterno(res, err, 'getServicios');
  }
};

// POST /api/servicios/catalogo
export const createServicio = async (req, res) => {
  try {
    const idUsuario = idUsuarioDelToken(req);
    const { id_servicio, precio_base, limite_operativo } = req.body || {};

    if (id_servicio === undefined || precio_base === undefined) {
      return res.status(400).json({
        ok: false,
        error: "id_servicio y precio_base son campos obligatorios"
      });
    }
    if (!esEnteroPositivo(id_servicio)) {
      return res.status(400).json({ ok: false, error: "id_servicio debe ser un entero positivo" });
    }
    if (!esNumeroNoNegativo(precio_base)) {
      return res.status(400).json({ ok: false, error: "precio_base debe ser un número mayor o igual a 0" });
    }
    const hayLimite = limite_operativo !== undefined && limite_operativo !== null;
    if (hayLimite && !esNumeroNoNegativo(limite_operativo)) {
      return res.status(400).json({ ok: false, error: "limite_operativo debe ser un número mayor o igual a 0" });
    }

    // The service type must exist in the global catalog.
    const { data: servicio, error: errorServicio } = await supabaseAdmin
      .from('servicios_catalogo')
      .select('id_servicio')
      .eq('id_servicio', Number(id_servicio))
      .maybeSingle();

    if (errorServicio) return errorInterno(res, errorServicio, 'createServicio/catalogo');
    if (!servicio) {
      return res.status(404).json({ ok: false, error: "Servicio no encontrado en el catálogo" });
    }

    const { data, error } = await supabaseAdmin
      .from('usuario_servicio')
      .insert([{
        id_usuario: idUsuario,
        id_servicio: Number(id_servicio),
        precio_base: Number(precio_base),
        limite_operativo: hayLimite ? Number(limite_operativo) : null
      }])
      .select(SELECT_MIO)
      .single();

    if (error) {
      // 23505 = unique_violation (id_usuario, id_servicio)
      if (error.code === '23505') {
        return res.status(409).json({ ok: false, error: "Ya tenés este servicio en tu catálogo" });
      }
      return errorInterno(res, error, 'createServicio');
    }

    return res.status(201).json({ ok: true, data });
  } catch (err) {
    return errorInterno(res, err, 'createServicio');
  }
};

// PUT /api/servicios/catalogo/:id
export const updateServicio = async (req, res) => {
  try {
    const idUsuario = idUsuarioDelToken(req);
    const { id } = req.params;

    if (!esEnteroPositivo(id)) {
      return res.status(400).json({ ok: false, error: "id inválido" });
    }

    const { precio_base, limite_operativo, activo } = req.body || {};
    const cambios = {};

    if (precio_base !== undefined) {
      if (!esNumeroNoNegativo(precio_base)) {
        return res.status(400).json({ ok: false, error: "precio_base debe ser un número mayor o igual a 0" });
      }
      cambios.precio_base = Number(precio_base);
    }
    if (limite_operativo !== undefined) {
      if (limite_operativo === null) {
        cambios.limite_operativo = null;
      } else if (!esNumeroNoNegativo(limite_operativo)) {
        return res.status(400).json({ ok: false, error: "limite_operativo debe ser un número mayor o igual a 0" });
      } else {
        cambios.limite_operativo = Number(limite_operativo);
      }
    }
    if (activo !== undefined) {
      if (typeof activo !== 'boolean') {
        return res.status(400).json({ ok: false, error: "activo debe ser verdadero o falso" });
      }
      cambios.activo = activo;
    }

    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({ ok: false, error: "No hay campos para actualizar" });
    }

    // Filtering by id_usuario guarantees ownership; other users' rows yield 404.
    const { data, error } = await supabaseAdmin
      .from('usuario_servicio')
      .update(cambios)
      .eq('id_usuario_servicio', Number(id))
      .eq('id_usuario', idUsuario)
      .select(SELECT_MIO)
      .maybeSingle();

    if (error) return errorInterno(res, error, 'updateServicio');
    if (!data) {
      return res.status(404).json({ ok: false, error: "Servicio no encontrado" });
    }

    return res.status(200).json({
      ok: true,
      mensaje: "Servicio actualizado correctamente",
      data
    });
  } catch (err) {
    return errorInterno(res, err, 'updateServicio');
  }
};

// DELETE /api/servicios/catalogo/:id (soft delete)
export const deleteServicio = async (req, res) => {
  try {
    const idUsuario = idUsuarioDelToken(req);
    const { id } = req.params;

    if (!esEnteroPositivo(id)) {
      return res.status(400).json({ ok: false, error: "id inválido" });
    }

    const { data, error } = await supabaseAdmin
      .from('usuario_servicio')
      .update({ activo: false })
      .eq('id_usuario_servicio', Number(id))
      .eq('id_usuario', idUsuario)
      .select(SELECT_MIO)
      .maybeSingle();

    if (error) return errorInterno(res, error, 'deleteServicio');
    if (!data) {
      return res.status(404).json({ ok: false, error: "Servicio no encontrado" });
    }

    return res.status(200).json({
      ok: true,
      mensaje: "Servicio dado de baja correctamente",
      data
    });
  } catch (err) {
    return errorInterno(res, err, 'deleteServicio');
  }
};
