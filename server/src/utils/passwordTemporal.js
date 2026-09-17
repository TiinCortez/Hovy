// Contraseñas temporales para el alta de staff.
//
// Al staff lo crea un admin desde la web: en vez de que el admin elija la
// contraseña (y la conozca), se genera una aleatoria, se manda por email y el
// usuario está obligado a cambiarla en el primer login.

import crypto from 'crypto';

// Sin caracteres que se confunden al leerlos en un mail (0/O, 1/l/I).
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const LONGITUD = 12;
const TTL_HORAS = Number(process.env.PASSWORD_TEMPORAL_TTL_HORAS) || 72;

export const TTL_PASSWORD_TEMPORAL_HORAS = TTL_HORAS;

// crypto.randomInt y no Math.random: la contraseña no tiene que ser predecible.
export const generarPasswordTemporal = () =>
  Array.from({ length: LONGITUD }, () => ALFABETO[crypto.randomInt(ALFABETO.length)]).join('');

export const calcularExpiracionPasswordTemporal = () => new Date(Date.now() + TTL_HORAS * 3_600_000);
