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

// Case-, accent- and whitespace-insensitive key used to match service names.
const normalizarNombre = (texto) =>
  String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// Finds a catalog type by normalized name. The catalog is small, so all names
// are fetched and compared in memory.
const buscarTipoPorNombre = async (nombre) => {
  const { data, error } = await supabaseAdmin
    .from('servicios_catalogo')
    .select('id_servicio, nombre');
  if (error) return { error };
  const clave = normalizarNombre(nombre);
  const tipo = (data || []).find((s) => normalizarNombre(s.nombre) === clave);
  return { tipo: tipo || null };
};

// POST /api/servicios/catalogo
// "Find or create by name": the service type is looked up in the shared
// catalog (ignoring case/accents/extra spaces) and reused if it exists; it is
// created otherwise. Shared fields of an existing type are never modified.
// The link in usuario_servicio always belongs to the JWT user. If the user
// already had that service deactivated (soft delete), it is reactivated here
// (server-side) instead of the client having to PUT activo=true.
export const createServicio = async (req, res) => {
  try {
    const idUsuario = idUsuarioDelToken(req);
    const { nombre, descripcion, variable_cotizacion, precio_base, limite_operativo } = req.body || {};

    if (typeof nombre !== 'string' || nombre.trim() === '' || precio_base === undefined) {
      return res.status(400).json({
        ok: false,
        error: "nombre y precio_base son campos obligatorios"
      });
    }
    const nombreLimpio = nombre.trim().replace(/\s+/g, ' ');
    if (nombreLimpio.length < 2 || nombreLimpio.length > 100) {
      return res.status(400).json({ ok: false, error: "nombre debe tener entre 2 y 100 caracteres" });
    }
    if (!esNumeroNoNegativo(precio_base)) {
      return res.status(400).json({ ok: false, error: "precio_base debe ser un número mayor o igual a 0" });
    }
    const hayLimite = limite_operativo !== undefined && limite_operativo !== null;
    if (hayLimite && !esNumeroNoNegativo(limite_operativo)) {
      return res.status(400).json({ ok: false, error: "limite_operativo debe ser un número mayor o igual a 0" });
    }
    for (const [campo, valor] of [['descripcion', descripcion], ['variable_cotizacion', variable_cotizacion]]) {
      if (valor !== undefined && valor !== null && typeof valor !== 'string') {
        return res.status(400).json({ ok: false, error: `${campo} debe ser texto` });
      }
    }
    const textoOpcional = (valor) => {
      const limpio = typeof valor === 'string' ? valor.trim() : '';
      return limpio === '' ? null : limpio;
    };

    // 1) Find the type by normalized name, or create it.
    const busqueda = await buscarTipoPorNombre(nombreLimpio);
    if (busqueda.error) return errorInterno(res, busqueda.error, 'createServicio/buscar');
    let idServicio = busqueda.tipo?.id_servicio;

    if (!idServicio) {
      const { data: creado, error: errorCrear } = await supabaseAdmin
        .from('servicios_catalogo')
        .insert([{
          nombre: nombreLimpio,
          descripcion: textoOpcional(descripcion),
          variable_cotizacion: textoOpcional(variable_cotizacion)
        }])
        .select('id_servicio')
        .single();

      if (errorCrear) {
        // 23505 = unique_violation: another request created it first; reuse it.
        if (errorCrear.code !== '23505') return errorInterno(res, errorCrear, 'createServicio/crearTipo');
        const reintento = await buscarTipoPorNombre(nombreLimpio);
        if (reintento.error) return errorInterno(res, reintento.error, 'createServicio/reintento');
        if (!reintento.tipo) return errorInterno(res, errorCrear, 'createServicio/reintento-vacio');
        idServicio = reintento.tipo.id_servicio;
      } else {
        idServicio = creado.id_servicio;
      }
    }

    // 2) Link to the user (or reactivate an existing inactive link).
    const { data: vinculo, error: errorVinculo } = await supabaseAdmin
      .from('usuario_servicio')
      .select('id_usuario_servicio, activo')
      .eq('id_usuario', idUsuario)
      .eq('id_servicio', idServicio)
      .maybeSingle();

    if (errorVinculo) return errorInterno(res, errorVinculo, 'createServicio/vinculo');

    const valores = {
      precio_base: Number(precio_base),
      limite_operativo: hayLimite ? Number(limite_operativo) : null
    };

    if (vinculo) {
      if (vinculo.activo) {
        return res.status(409).json({ ok: false, error: "Ya tenés este servicio en tu catálogo" });
      }
      const { data, error } = await supabaseAdmin
        .from('usuario_servicio')
        .update({ ...valores, activo: true })
        .eq('id_usuario_servicio', vinculo.id_usuario_servicio)
        .eq('id_usuario', idUsuario)
        .select(SELECT_MIO)
        .single();
      if (error) return errorInterno(res, error, 'createServicio/reactivar');
      return res.status(200).json({ ok: true, data });
    }

    const { data, error } = await supabaseAdmin
      .from('usuario_servicio')
      .insert([{ id_usuario: idUsuario, id_servicio: idServicio, ...valores }])
      .select(SELECT_MIO)
      .single();

    if (error) {
      // 23505 = unique_violation (id_usuario, id_servicio): concurrent duplicate
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
