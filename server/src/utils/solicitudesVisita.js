// Helpers shared by the bot staff controllers (botStaffController.js and
// botPresupuestoStaffController.js) and presupuestoService.js.

export const ERROR_ID_SOLICITUD_INVALIDO =
  'El id de la solicitud tiene que ser un número entero positivo.';

export const parsearIdSolicitud = (valor) => {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) return null;
  return numero;
};

export const estaVacio = (valor) =>
  valor === undefined || valor === null || String(valor).trim() === '';

// Typed error result of the services: { error: { status, message } }.
export const falla = (status, message) => ({ error: { status, message } });

// Services return { error: { status, message } } instead of touching req/res;
// this turns that result into the usual { ok: false, error } response.
export const responderErrorServicio = (res, error) =>
  res.status(error.status).json({ ok: false, error: error.message });
