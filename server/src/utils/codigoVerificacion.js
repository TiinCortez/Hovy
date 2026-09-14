// Generación de códigos de un solo uso para verificación de email y
// recuperación de contraseña.

import crypto from 'crypto';

const LONGITUD_CODIGO = 6;
const TTL_MIN = Number(process.env.CODIGO_VERIFICACION_TTL_MIN) || 15;

// Código numérico de 6 dígitos (con ceros a la izquierda si hace falta),
// generado con crypto.randomInt para que no sea predecible.
export const generarCodigo = () =>
  String(crypto.randomInt(0, 10 ** LONGITUD_CODIGO)).padStart(LONGITUD_CODIGO, '0');

export const calcularExpiracion = () => new Date(Date.now() + TTL_MIN * 60_000);
