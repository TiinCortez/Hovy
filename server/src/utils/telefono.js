// Normalización de teléfonos argentinos.
//
// El campo `telefono` es la clave natural de la API (va en el path de varios
// endpoints) y es UNIQUE en Postgres. Como "único" para Postgres significa
// "string distinto", guardar el mismo número en dos formatos crea dos clientes.
// Por eso todo teléfono se normaliza antes de tocar la base.
//
// Formato canónico: 549 + 10 dígitos nacionales -> 5493514330429
// Es E.164 sin el "+". El 9 marca celular en Argentina: sin él no se puede
// mandar un WhatsApp al número.
//
//   "3514330429"           -> "5493514330429"
//   "5493514330429"        -> "5493514330429"
//   "543514330429"         -> "5493514330429"   (así suele llegar el wa_id)
//   "+54 9 351 433-0429"   -> "5493514330429"
//   "03514330429"          -> "5493514330429"
//   "0351 15 4330429"      -> null              (ver nota sobre el 15)

const DIGITOS_NACIONALES = 10;

export const normalizarTelefono = (valor) => {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null;

  // Nos quedamos solo con dígitos: descarta +, espacios, guiones y paréntesis.
  let digitos = String(valor).replace(/\D/g, '');
  if (!digitos) return null;

  // Prefijo internacional marcado a la vieja usanza (00 54 ...).
  if (digitos.startsWith('00')) digitos = digitos.slice(2);

  // Código de país. Si después del 54 viene un 9, es el marcador de celular:
  // no existe código de área argentino que empiece con 9, así que sacarlo no
  // es ambiguo.
  if (digitos.startsWith('54')) {
    digitos = digitos.slice(2);
    if (digitos.startsWith('9')) digitos = digitos.slice(1);
  }

  // Prefijo nacional de larga distancia (0351...).
  if (digitos.startsWith('0')) digitos = digitos.slice(1);

  // Lo que queda tiene que ser código de área + abonado, ni más ni menos.
  //
  // Acá cae el viejo prefijo 15 ("0351 15 4330429" deja 12 dígitos). No se
  // intenta resolver: los códigos de área argentinos tienen 2, 3 o 4 dígitos,
  // así que no hay forma confiable de saber dónde termina el área y empieza el
  // 15, y adivinar mal guardaría un teléfono corrupto. Preferimos rechazarlo y
  // que el caller devuelva un 400 explicando el formato esperado. Desde
  // WhatsApp nunca llega con 15; el riesgo está solo en la carga manual.
  if (digitos.length !== DIGITOS_NACIONALES) return null;

  return `549${digitos}`;
};

// Mensaje único para los 400 de teléfono inválido, así todos los endpoints
// explican lo mismo.
export const ERROR_TELEFONO_INVALIDO =
  'Teléfono inválido. Se espera un celular argentino con código de área y sin el prefijo 15 (ej: 3514330429 o 5493514330429).';
