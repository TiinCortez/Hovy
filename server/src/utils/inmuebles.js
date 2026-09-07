// Validaciones y constantes de inmuebles.
//
// Se escribe sin nada específico del bot para que el controller web lo pueda
// adoptar después sin tocarlo (hoy valida por su cuenta y no filtra el body).
//
// tipo_inmueble SÍ tiene un CHECK en Postgres. Esta lista es una copia literal
// de esa constraint, y existe para devolver un 400 explicando los valores
// permitidos en vez del 23514 crudo de la base:
//
//   inmuebles_tipo_inmueble_check
//   CHECK (tipo_inmueble = ANY (ARRAY['Lote Vacio', 'Casa Habitada']))
//
// Si se agrega un valor al CHECK hay que agregarlo acá también, o el server va
// a rechazar algo que la base acepta. Ojo con "Lote Vacio": va sin tilde,
// porque así está escrito en la constraint.
export const TIPOS_INMUEBLE_VALIDOS = [
  'Lote Vacio',
  'Casa Habitada',
];

// estado_vegetacion, a diferencia de tipo_inmueble, NO tiene CHECK en Postgres:
// la columna acepta cualquier texto y esta lista es la única validación.
//
// Los valores salen de los datos que ya están cargados, no de una escala
// inventada: hoy la base tiene 'Medio' en 8 de 9 filas (la restante en null).
// Importa que coincidan porque el formulario web escribe en la misma columna;
// una lista distinta acá rechazaría valores que la web viene guardando hace
// tiempo, y rompería el canal web el día que adopte este módulo.
//
// null es válido y no cae en esta validación: la columna es nullable y por
// WhatsApp el estado del césped puede quedar sin preguntar.
export const ESTADOS_VEGETACION_VALIDOS = [
  'Bajo',
  'Medio',
  'Alto',
];

// Columnas que un caller puede escribir. Es una lista blanca, no negra: lo que
// no está acá no se toca ni en el alta ni en la modificación.
//
// Quedan afuera a propósito:
//   id_inmueble -> es la PK, se identifica por la URL.
//   id_cliente  -> el dueño sale del teléfono de WhatsApp, nunca del body.
//                  Si viniera acá, n8n podría mover un inmueble a otro cliente.
//   activo      -> solo lo cambia el endpoint de baja.
export const CAMPOS_EDITABLES_INMUEBLE = [
  'provincia',
  'barrio',
  'manzana',
  'lote',
  'direccion',
  'tipo_inmueble',
  'superficie_total',
  'superficie_construida',
  'superficie_mantenible',
  'estado_vegetacion',
  'altura_cesped_cm',
  'tiempo_promedio_min',
  'latitud',
  'longitud',
];

// Los tres primeros son NOT NULL sin default en la tabla: sin ellos el INSERT
// no entra.
//
// provincia es el caso especial: también es NOT NULL, pero tiene DEFAULT
// 'Córdoba'. Se sigue exigiendo igual, a propósito. Dejarla afuera ahorraría
// una pregunta en la conversación de WhatsApp, pero a cambio un inmueble de
// otra provincia se guardaría como Córdoba sin que nadie se entere. Cuando el
// cliente comparte el pin, /api/bot/ubicacion/reversa ya devuelve la provincia,
// así que el bot no tiene que preguntarla igual.
//
// barrio queda afuera: la columna es nullable y por WhatsApp pedirlo es un paso
// más que muchas veces no hace falta (con el pin ya sabemos dónde queda).
const CAMPOS_OBLIGATORIOS_INMUEBLE = [
  'direccion',
  'tipo_inmueble',
  'provincia',
  'superficie_total',
];

// latitud y longitud no están acá: las valida normalizarCoordenadas, que además
// de que sean números chequea que el punto caiga en Argentina.
const CAMPOS_NUMERICOS = [
  { campo: 'superficie_total', mayorACero: true },
  { campo: 'superficie_construida', mayorACero: false },
  { campo: 'superficie_mantenible', mayorACero: false },
  { campo: 'altura_cesped_cm', mayorACero: false },
  { campo: 'tiempo_promedio_min', mayorACero: true },
];

const estaVacio = (valor) =>
  valor === undefined || valor === null || String(valor).trim() === '';

// Copia del body solo las columnas escribibles. Todo lo demás se descarta en
// silencio: mandar "id_cliente" o "activo" no es un error del caller, es algo
// que el server simplemente no acepta.
export const tomarCamposEditables = (body) => {
  const datos = {};

  for (const campo of CAMPOS_EDITABLES_INMUEBLE) {
    if (body?.[campo] !== undefined) {
      datos[campo] = body[campo];
    }
  }

  return datos;
};

// Devuelve un array de errores (vacío si está todo bien), para que el caller
// arme un único mensaje en vez de cortar en el primer problema: por WhatsApp,
// que el bot tenga que repreguntar de a un campo por vez es una conversación
// eterna.
//
// `parcial` es la diferencia entre el alta y la modificación: en un update,
// que un campo no venga significa "no lo toques", y solo es error mandarlo
// explícitamente vacío.
export const validarDatosInmueble = (datos, { parcial = false } = {}) => {
  const errores = [];
  const camposFaltantes = [];

  for (const campo of CAMPOS_OBLIGATORIOS_INMUEBLE) {
    if (parcial) {
      if (campo in datos && estaVacio(datos[campo])) camposFaltantes.push(campo);
    } else if (estaVacio(datos[campo])) {
      camposFaltantes.push(campo);
    }
  }

  if (camposFaltantes.length > 0) {
    errores.push(
      parcial
        ? `Los siguientes campos no pueden quedar vacíos: ${camposFaltantes.join(', ')}`
        : `Faltan campos obligatorios: ${camposFaltantes.join(', ')}`
    );
  }

  if (!estaVacio(datos.tipo_inmueble) && !TIPOS_INMUEBLE_VALIDOS.includes(datos.tipo_inmueble)) {
    errores.push(
      `tipo_inmueble inválido: "${datos.tipo_inmueble}". Valores permitidos: ${TIPOS_INMUEBLE_VALIDOS.join(', ')}`
    );
  }

  if (!estaVacio(datos.estado_vegetacion) && !ESTADOS_VEGETACION_VALIDOS.includes(datos.estado_vegetacion)) {
    errores.push(
      `estado_vegetacion inválido: "${datos.estado_vegetacion}". Valores permitidos: ${ESTADOS_VEGETACION_VALIDOS.join(', ')}`
    );
  }

  for (const { campo, mayorACero } of CAMPOS_NUMERICOS) {
    if (estaVacio(datos[campo])) continue;

    const numero = Number(datos[campo]);

    if (!Number.isFinite(numero)) {
      errores.push(`${campo} tiene que ser un número. Se recibió: "${datos[campo]}"`);
      continue;
    }

    if (mayorACero && numero <= 0) {
      errores.push(`${campo} tiene que ser mayor a 0.`);
    } else if (!mayorACero && numero < 0) {
      errores.push(`${campo} no puede ser negativo.`);
    }
  }

  // Solo se compara si los dos valores están y son números: en una
  // modificación el caller tiene que mergear con la fila actual antes de
  // llamar, si no una superficie que no vino se leería como "sin dato".
  const total = Number(datos.superficie_total);
  const construida = Number(datos.superficie_construida);

  if (Number.isFinite(total) && Number.isFinite(construida) && construida > total) {
    errores.push('La superficie construida no puede ser mayor a la superficie total.');
  }

  return errores;
};

// Traduce un error de Postgres/PostgREST a status + mensaje, para no filtrarle
// al cliente el texto crudo de la base (nombres de columnas y constraints) ni
// devolver un 500 por algo que en realidad es un pedido mal armado.
//
// `accion` es un infinitivo que se usa en el log y en el mensaje genérico:
// "registrar", "actualizar", "dar de baja".
export const mapearErrorInmueble = (error, accion) => {
  if (error.code === '23503') {
    return { status: 400, mensaje: 'El cliente indicado no existe.' };
  }
  if (error.code === '23505') {
    return { status: 409, mensaje: 'Ya existe un inmueble registrado con esos datos.' };
  }
  if (error.code === '23502') {
    return { status: 400, mensaje: `Falta un campo obligatorio: ${error.message}` };
  }
  if (error.code === '23514') {
    return { status: 400, mensaje: 'Alguno de los datos del inmueble no cumple las restricciones de la base.' };
  }
  if (error.code === '22P02') {
    return { status: 400, mensaje: 'Alguno de los datos del inmueble tiene un formato inválido.' };
  }
  if (error.code === 'PGRST116') {
    return { status: 404, mensaje: 'No existe el inmueble indicado.' };
  }

  console.error(`Error al ${accion} el inmueble:`, error);
  return { status: 500, mensaje: `No se pudo ${accion} el inmueble. Intentá de nuevo más tarde.` };
};
