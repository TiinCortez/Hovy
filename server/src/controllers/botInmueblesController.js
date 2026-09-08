import { supabaseAdmin } from '../config/supabase.js';
import { geocodificarDireccion, geocodificarCoordenadas } from '../services/geocodingService.js';
import { normalizarCoordenadas, ERROR_COORDENADAS_INVALIDAS } from '../utils/coordenadas.js';
import {
  tomarCamposEditables,
  validarDatosInmueble,
  mapearErrorInmueble,
} from '../utils/inmuebles.js';

// Inmuebles del canal bot (n8n / WhatsApp).
//
// Existe aparte del controller web por una sola razón, pero que atraviesa todo
// el archivo: acá el dueño del inmueble NO se pide, se deduce. El middleware
// resolverClientePorTelefono ya dejó en req.cliente al dueño del número que
// mandó el mensaje, y todas las queries filtran por ese id_cliente. Un
// id_cliente en el body se ignora (tomarCamposEditables no lo copia), y toda
// operación sobre un inmueble ajeno responde 404, no 403: para este teléfono,
// ese inmueble directamente no existe.
//
// El :id de las rutas es el id_inmueble que genera Postgres (autoincremental).
// El cliente nunca lo tipea: el bot le lista sus inmuebles, el cliente elige
// "el segundo" y n8n traduce esa posición al id que vino en el listado.

const ERROR_ID_INMUEBLE_INVALIDO =
  'El id del inmueble tiene que ser un número entero positivo.';

const ERROR_COORDENADAS_INCOMPLETAS =
  'latitud y longitud tienen que venir juntas: con una sola no se puede ubicar el inmueble.';

// Filtra acá lo que si no llegaría a Postgres como un 22P02 ("invalid input
// syntax for type integer") y volvería como un 500.
const parsearIdInmueble = (valor) => {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) return null;
  return numero;
};

const vinoElDato = (valor) =>
  valor !== undefined && valor !== null && String(valor).trim() !== '';

// La propiedad se aplica en la query, no después: si el inmueble es de otro
// cliente, Postgres no devuelve la fila y nunca llegamos a compararla. Evita
// además filtrar por diferencia de respuestas qué ids existen.
const buscarInmuebleDelCliente = (idInmueble, idCliente) =>
  supabaseAdmin
    .from('inmuebles')
    .select('*')
    .eq('id_inmueble', idInmueble)
    .eq('id_cliente', idCliente)
    .maybeSingle();

// GET /api/bot/clientes/:telefono/inmuebles
//
// Segundo paso del flujo de n8n, después de identificar al cliente: saber si ya
// tiene inmuebles cargados o si hay que darle de alta el primero. Un cliente sin
// inmuebles devuelve 200 con data vacía, no 404: es una rama esperada de la
// conversación, no un error.
export const getInmueblesDelCliente = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('inmuebles')
      .select('*')
      .eq('id_cliente', req.cliente.id_cliente)
      .eq('activo', true) // Solo traer inmuebles activos
      .order('id_inmueble');

    if (error) {
      console.error('Error al listar los inmuebles del cliente:', error);
      return res.status(500).json({
        ok: false,
        error: 'No se pudieron consultar los inmuebles. Intentá de nuevo más tarde.',
      });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error('Error inesperado al listar los inmuebles del cliente:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al consultar los inmuebles.',
    });
  }
};

// GET /api/bot/clientes/:telefono/inmuebles/:id
export const getInmuebleDelCliente = async (req, res) => {
  const idInmueble = parsearIdInmueble(req.params.id);

  if (!idInmueble) {
    return res.status(400).json({ ok: false, error: ERROR_ID_INMUEBLE_INVALIDO });
  }

  try {
    const { data, error } = await buscarInmuebleDelCliente(idInmueble, req.cliente.id_cliente);

    if (error) {
      console.error('Error al buscar el inmueble del cliente:', error);
      return res.status(500).json({
        ok: false,
        error: 'No se pudo consultar el inmueble. Intentá de nuevo más tarde.',
      });
    }

    if (!data) {
      return res.status(404).json({
        ok: false,
        error: `No existe un inmueble con el id ${idInmueble} asociado a ese teléfono.`,
      });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error('Error inesperado al buscar el inmueble del cliente:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al consultar el inmueble.',
    });
  }
};

// POST /api/bot/clientes/:telefono/inmuebles
//
// Coordenadas: si el cliente está parado en el inmueble comparte el pin de
// WhatsApp y n8n reenvía esa latitud/longitud. Ese punto es mejor que cualquier
// cosa que devuelva Nominatim, así que cuando viene se guarda tal cual y ni se
// consulta la API. Si no viene (el cliente no estaba en el domicilio y escribió
// la dirección), se geocodifica como en la web.
export const createInmuebleBot = async (req, res) => {
  const datos = tomarCamposEditables(req.body ?? {});

  const errores = validarDatosInmueble(datos, { parcial: false });
  if (errores.length > 0) {
    return res.status(400).json({ ok: false, error: errores.join(' ') });
  }

  const vinoLatitud = vinoElDato(datos.latitud);
  const vinoLongitud = vinoElDato(datos.longitud);

  // Una sola de las dos es siempre un error del workflow armando el body, no
  // algo que el cliente pueda corregir contestando otra cosa. Se chequea la
  // presencia en el body y el valor por separado: mandar una en null y la otra
  // con un número dejaría media coordenada, que no ubica nada.
  if (('latitud' in datos) !== ('longitud' in datos) || vinoLatitud !== vinoLongitud) {
    return res.status(400).json({ ok: false, error: ERROR_COORDENADAS_INCOMPLETAS });
  }

  let origenCoordenadas = 'ninguna';

  if (vinoLatitud && vinoLongitud) {
    const coordenadas = normalizarCoordenadas(datos.latitud, datos.longitud);

    if (!coordenadas) {
      return res.status(400).json({ ok: false, error: ERROR_COORDENADAS_INVALIDAS });
    }

    datos.latitud = coordenadas.latitud;
    datos.longitud = coordenadas.longitud;
    origenCoordenadas = 'whatsapp';
  }

  try {
    if (origenCoordenadas === 'ninguna') {
      const coordenadas = await geocodificarDireccion({
        direccion: datos.direccion,
        provincia: datos.provincia,
        barrio: datos.barrio,
      });

      datos.latitud = coordenadas.latitud;
      datos.longitud = coordenadas.longitud;

      if (coordenadas.latitud !== null && coordenadas.longitud !== null) {
        origenCoordenadas = 'nominatim';
      }
    }

    const { data, error } = await supabaseAdmin
      .from('inmuebles')
      .insert({
        ...datos,
        // El dueño sale del teléfono, no del body.
        id_cliente: req.cliente.id_cliente,
        // superficie_mantenible la calcula el trigger
        // trg_calcular_superficie_mantenible, que corre BEFORE INSERT OR UPDATE
        // (total - construida). Se manda null explícito cuando el bot no la
        // preguntó, para que el trigger tenga algo que completar.
        superficie_mantenible: datos.superficie_mantenible ?? null,
      })
      .select()
      .single();

    if (error) {
      const { status, mensaje } = mapearErrorInmueble(error, 'registrar');
      return res.status(status).json({ ok: false, error: mensaje });
    }

    // El bot usa origen_coordenadas para saber qué contestar: con "whatsapp"
    // puede confirmar que guardó la ubicación exacta, con "ninguna" tiene que
    // avisar que después hay que ajustarla a mano.
    return res.status(201).json({ ok: true, data, origen_coordenadas: origenCoordenadas });
  } catch (err) {
    console.error('Error inesperado al crear inmueble:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al registrar el inmueble.',
    });
  }
};

// PUT /api/bot/clientes/:telefono/inmuebles/:id
export const updateInmuebleBot = async (req, res) => {
  const idInmueble = parsearIdInmueble(req.params.id);

  if (!idInmueble) {
    return res.status(400).json({ ok: false, error: ERROR_ID_INMUEBLE_INVALIDO });
  }

  const datos = tomarCamposEditables(req.body ?? {});

  if (Object.keys(datos).length === 0) {
    return res.status(400).json({
      ok: false,
      error: 'No se envió ningún campo para actualizar.',
    });
  }

  const vinoLatitud = vinoElDato(datos.latitud);
  const vinoLongitud = vinoElDato(datos.longitud);

  // Las dos o ninguna, igual que en el alta. Mandar las dos en null es válido:
  // es la forma de borrar una ubicación mal cargada.
  if (('latitud' in datos) !== ('longitud' in datos) || vinoLatitud !== vinoLongitud) {
    return res.status(400).json({ ok: false, error: ERROR_COORDENADAS_INCOMPLETAS });
  }

  let origenCoordenadas = 'sin_cambios';

  if (vinoLatitud && vinoLongitud) {
    const coordenadas = normalizarCoordenadas(datos.latitud, datos.longitud);

    if (!coordenadas) {
      return res.status(400).json({ ok: false, error: ERROR_COORDENADAS_INVALIDAS });
    }

    datos.latitud = coordenadas.latitud;
    datos.longitud = coordenadas.longitud;
    origenCoordenadas = 'whatsapp';
  }

  try {
    const { data: inmuebleActual, error: errorBusqueda } =
      await buscarInmuebleDelCliente(idInmueble, req.cliente.id_cliente);

    if (errorBusqueda) {
      console.error('Error al buscar el inmueble a actualizar:', errorBusqueda);
      return res.status(500).json({
        ok: false,
        error: 'No se pudo consultar el inmueble. Intentá de nuevo más tarde.',
      });
    }

    if (!inmuebleActual) {
      return res.status(404).json({
        ok: false,
        error: `No existe un inmueble con el id ${idInmueble} asociado a ese teléfono.`,
      });
    }

    // Para comparar superficies hace falta mergear con lo que ya está guardado:
    // si el body trae solo superficie_construida, la total sale de la fila. Se
    // mergean solo esas dos y no la fila entera, para no revalidar contra las
    // listas blancas datos viejos que el caller no está tocando.
    const errores = validarDatosInmueble(
      {
        superficie_total: inmuebleActual.superficie_total,
        superficie_construida: inmuebleActual.superficie_construida,
        ...datos,
      },
      { parcial: true }
    );

    if (errores.length > 0) {
      return res.status(400).json({ ok: false, error: errores.join(' ') });
    }

    // Si cambió algo de la dirección y no mandaron un pin, hay que volver a
    // geocodificar: las coordenadas viejas apuntan a otro lado.
    const cambioDireccion =
      (datos.direccion !== undefined && datos.direccion !== inmuebleActual.direccion) ||
      (datos.barrio !== undefined && datos.barrio !== inmuebleActual.barrio) ||
      (datos.provincia !== undefined && datos.provincia !== inmuebleActual.provincia);

    if (origenCoordenadas === 'sin_cambios' && cambioDireccion) {
      const coordenadas = await geocodificarDireccion({
        direccion: datos.direccion ?? inmuebleActual.direccion,
        provincia: datos.provincia ?? inmuebleActual.provincia,
        barrio: datos.barrio ?? inmuebleActual.barrio,
      });

      // Solo se pisan las coordenadas si Nominatim devolvió algo. Escribir los
      // null de una consulta fallida borraría una ubicación que ya era buena
      // (y que capaz venía del pin de WhatsApp).
      if (coordenadas.latitud !== null && coordenadas.longitud !== null) {
        datos.latitud = coordenadas.latitud;
        datos.longitud = coordenadas.longitud;
        origenCoordenadas = 'nominatim';
      }
    }

    // superficie_mantenible la recalcula el trigger de Postgres cuando queda en
    // null. Si mandaron un valor explícito mayor a 0 se respeta; si cambiaron
    // las superficies sin mandarla, se fuerza el recálculo.
    const cambiaronSuperficies =
      datos.superficie_total !== undefined || datos.superficie_construida !== undefined;

    if (datos.superficie_mantenible !== undefined) {
      datos.superficie_mantenible =
        Number(datos.superficie_mantenible) > 0 ? datos.superficie_mantenible : null;
    } else if (cambiaronSuperficies) {
      datos.superficie_mantenible = null;
    }

    // El filtro por id_cliente se repite en el UPDATE: la fila ya se verificó
    // arriba, pero dejarlo hace que sea imposible escribir un inmueble ajeno
    // aunque alguien cambie el orden de los pasos.
    const { data, error } = await supabaseAdmin
      .from('inmuebles')
      .update(datos)
      .eq('id_inmueble', idInmueble)
      .eq('id_cliente', req.cliente.id_cliente)
      .select()
      .single();

    if (error) {
      const { status, mensaje } = mapearErrorInmueble(error, 'actualizar');
      return res.status(status).json({ ok: false, error: mensaje });
    }

    return res.status(200).json({ ok: true, data, origen_coordenadas: origenCoordenadas });
  } catch (err) {
    console.error('Error inesperado al actualizar inmueble:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al actualizar el inmueble.',
    });
  }
};

// DELETE /api/bot/clientes/:telefono/inmuebles/:id/baja
//
// Baja lógica: el inmueble deja de aparecer en el listado pero la fila queda,
// porque de ella cuelga el historial de servicios.
export const darDeBajaInmuebleBot = async (req, res) => {
  const idInmueble = parsearIdInmueble(req.params.id);

  if (!idInmueble) {
    return res.status(400).json({ ok: false, error: ERROR_ID_INMUEBLE_INVALIDO });
  }

  try {
    // maybeSingle y no single: si el id no existe (o es de otro cliente) no
    // matchea ninguna fila, y eso tiene que ser un 404, no el PGRST116 que
    // single convertiría en un 500.
    const { data, error } = await supabaseAdmin
      .from('inmuebles')
      .update({ activo: false })
      .eq('id_inmueble', idInmueble)
      .eq('id_cliente', req.cliente.id_cliente)
      .select()
      .maybeSingle();

    if (error) {
      const { status, mensaje } = mapearErrorInmueble(error, 'dar de baja');
      return res.status(status).json({ ok: false, error: mensaje });
    }

    if (!data) {
      return res.status(404).json({
        ok: false,
        error: `No existe un inmueble con el id ${idInmueble} asociado a ese teléfono.`,
      });
    }

    return res.status(200).json({
      ok: true,
      data,
      mensaje: 'Inmueble dado de baja correctamente',
    });
  } catch (err) {
    console.error('Error inesperado al dar de baja el inmueble:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al dar de baja el inmueble.',
    });
  }
};

// POST /api/bot/ubicacion/reversa
//
// Auxiliar del alta, sin tocar la base. Recibe el pin que compartió el cliente
// y devuelve la dirección que Nominatim cree que le corresponde, para que el bot
// pregunte "¿es Av. Colón 1234?" en vez de pedir calle, barrio y provincia por
// separado. La sugerencia se confirma en la conversación: lo que se guarda es lo
// que el cliente contesta, no esto.
//
// Si Nominatim no responde, devuelve 200 con los campos en null: el bot sigue
// preguntando la dirección a mano, que es lo que haría igual.
export const sugerirUbicacion = async (req, res) => {
  const { latitud, longitud } = req.body ?? {};

  const coordenadas = normalizarCoordenadas(latitud, longitud);

  if (!coordenadas) {
    return res.status(400).json({ ok: false, error: ERROR_COORDENADAS_INVALIDAS });
  }

  try {
    const sugerencia = await geocodificarCoordenadas(coordenadas);

    return res.status(200).json({
      ok: true,
      data: { ...coordenadas, ...sugerencia },
    });
  } catch (err) {
    console.error('Error inesperado al sugerir la ubicación:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al consultar la ubicación.',
    });
  }
};
