import { supabaseAdmin } from "../config/supabase.js";
import { normalizarTelefono, ERROR_TELEFONO_INVALIDO } from "../utils/telefono.js";

const TIPOS_CLIENTE_VALIDOS = ['Fijo', 'Casual', 'Empresa'];

// GET /api/clientes
export const getClientes = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('clientes')
      .select('*');

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    res.status(200).json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
// POST /api/clientes [Creacion y Validacion de cliente]
export const createCliente = async (req, res) => {
  const {
    nombre,
    apellido,
    telefono,
    tipo_cliente,
    email,
    domicilio_fiscal,
    cuit_cuil,
    razon_social,
  } = req.body ?? {};

  const camposFaltantes = [];
  if (!nombre) camposFaltantes.push('nombre');
  if (!apellido) camposFaltantes.push('apellido');
  if (!telefono) camposFaltantes.push('telefono');
  if (!tipo_cliente) camposFaltantes.push('tipo_cliente');

  if (camposFaltantes.length > 0) {
    return res.status(400).json({
      ok: false,
      error: `Faltan campos obligatorios: ${camposFaltantes.join(', ')}`,
    });
  }

  if (!TIPOS_CLIENTE_VALIDOS.includes(tipo_cliente)) {
    return res.status(400).json({
      ok: false,
      error: `tipo_cliente inválido: "${tipo_cliente}". Valores permitidos: ${TIPOS_CLIENTE_VALIDOS.join(', ')}`,
    });
  }

  // El teléfono se guarda siempre en formato canónico: es la clave natural y es
  // UNIQUE, así que dos formatos del mismo número serían dos clientes.
  const telefonoNormalizado = normalizarTelefono(telefono);
  if (!telefonoNormalizado) {
    return res.status(400).json({ ok: false, error: ERROR_TELEFONO_INVALIDO });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('clientes')
      .insert({
        nombre,
        apellido,
        telefono: telefonoNormalizado,
        tipo_cliente,
        email: email ?? null,
        domicilio_fiscal: domicilio_fiscal ?? null,
        cuit_cuil: cuit_cuil ?? null,
        razon_social: razon_social ?? null,
        calificacion_promedio: 0,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          ok: false,
          error: 'Ya existe un cliente registrado con ese teléfono.',
        });
      }
      if (error.code === '23502') {
        return res.status(400).json({
          ok: false,
          error: `Falta un campo obligatorio: ${error.message}`,
        });
      }
      console.error('Error al crear cliente:', error);
      return res.status(500).json({
        ok: false,
        error: 'No se pudo registrar el cliente. Intentá de nuevo más tarde.',
      });
    }

    return res.status(201).json({ ok: true, data });
  } catch (err) {
    console.error('Error inesperado al crear cliente:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al registrar el cliente.',
    });
  }
};

// PUT /api/clientes/:telefono [Actualizacion de cliente]
export const updateCliente = async (req, res) => {
  const { telefono: telefonoParam } = req.params;

  if (!telefonoParam) {
    return res.status(400).json({
      ok: false,
      error: 'El teléfono del cliente a actualizar es obligatorio.',
    });
  }

  // Normalizamos el identificador antes de buscarlo: si el caller manda
  // "3514330429" tiene que encontrar al cliente guardado como "5493514330429".
  const telefonoActual = normalizarTelefono(telefonoParam);
  if (!telefonoActual) {
    return res.status(400).json({ ok: false, error: ERROR_TELEFONO_INVALIDO });
  }

  const {
    nombre,
    apellido,
    telefono,
    tipo_cliente,
    email,
    domicilio_fiscal,
    cuit_cuil,
    razon_social,
  } = req.body ?? {};

  const camposInvalidos = [];
  if (nombre !== undefined && !nombre) camposInvalidos.push('nombre');
  if (apellido !== undefined && !apellido) camposInvalidos.push('apellido');
  if (telefono !== undefined && !telefono) camposInvalidos.push('telefono');
  if (tipo_cliente !== undefined && !tipo_cliente) camposInvalidos.push('tipo_cliente');

  if (camposInvalidos.length > 0) {
    return res.status(400).json({
      ok: false,
      error: `Los siguientes campos no pueden quedar vacíos: ${camposInvalidos.join(', ')}`,
    });
  }

  if (tipo_cliente !== undefined && !TIPOS_CLIENTE_VALIDOS.includes(tipo_cliente)) {
    return res.status(400).json({
      ok: false,
      error: `tipo_cliente inválido: "${tipo_cliente}". Valores permitidos: ${TIPOS_CLIENTE_VALIDOS.join(', ')}`,
    });
  }

  // El teléfono nuevo (cambio de número) también va normalizado, por el mismo
  // motivo que en createCliente.
  let telefonoNuevo;
  if (telefono !== undefined) {
    telefonoNuevo = normalizarTelefono(telefono);
    if (!telefonoNuevo) {
      return res.status(400).json({ ok: false, error: ERROR_TELEFONO_INVALIDO });
    }
  }

  const camposParaActualizar = {};
  if (nombre !== undefined) camposParaActualizar.nombre = nombre;
  if (apellido !== undefined) camposParaActualizar.apellido = apellido;
  if (telefono !== undefined) camposParaActualizar.telefono = telefonoNuevo;
  if (tipo_cliente !== undefined) camposParaActualizar.tipo_cliente = tipo_cliente;
  if (email !== undefined) camposParaActualizar.email = email;
  if (domicilio_fiscal !== undefined) camposParaActualizar.domicilio_fiscal = domicilio_fiscal;
  if (cuit_cuil !== undefined) camposParaActualizar.cuit_cuil = cuit_cuil;
  if (razon_social !== undefined) camposParaActualizar.razon_social = razon_social;

  if (Object.keys(camposParaActualizar).length === 0) {
    return res.status(400).json({
      ok: false,
      error: 'No se envió ningún campo para actualizar.',
    });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('clientes')
      .update(camposParaActualizar)
      .eq('telefono', telefonoActual)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          ok: false,
          error: 'Ya existe un cliente registrado con ese teléfono.',
        });
      }
      if (error.code === '23502') {
        return res.status(400).json({
          ok: false,
          error: `Falta un campo obligatorio: ${error.message}`,
        });
      }
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          ok: false,
          error: `No existe un cliente con el teléfono ${telefonoActual}.`,
        });
      }
      console.error('Error al actualizar cliente:', error);
      return res.status(500).json({
        ok: false,
        error: 'No se pudo actualizar el cliente. Intentá de nuevo más tarde.',
      });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error('Error inesperado al actualizar cliente:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al actualizar el cliente.',
    });
  }
};