import { falla } from './solicitudesVisita.js';
import { validarMonto } from '../integrations/mercadopago/cobros/estadoPago.js';

// Pure validation of a payment that is registered by hand (cash or bank transfer).
// Mercado Pago payments do not come through here: they are recorded by the webhook
// or the active check (see aplicarPagoACobro).

export const MEDIOS_MANUALES = ['Efectivo', 'Transferencia'];

// pagos.referencia_comprobante holds up to 100 characters.
const MAX_REFERENCIA = 100;

// Resolves { valores: { medio, monto, referencia } } or { error } (400) joining every
// problem in one message, like the rest of the API. `referencia` is optional: the
// operation number of a transfer, or a note for cash.
export const validarPagoManual = (body) => {
  const errores = [];

  const medioTexto = typeof body?.medio === 'string' ? body.medio.trim().toLowerCase() : '';
  const medio = MEDIOS_MANUALES.find((candidato) => candidato.toLowerCase() === medioTexto);
  if (!medio) errores.push(`El medio de pago tiene que ser uno de: ${MEDIOS_MANUALES.join(', ')}.`);

  const montoCrudo = body?.monto;
  const hayMonto = typeof montoCrudo === 'number' || (typeof montoCrudo === 'string' && montoCrudo.trim() !== '');
  const monto = hayMonto ? validarMonto(Number(montoCrudo)) : null;
  if (monto === null) errores.push('El monto tiene que ser un número mayor a 0 con hasta 2 decimales.');

  let referencia = null;
  const referenciaCruda = body?.referencia;
  if (referenciaCruda !== undefined && referenciaCruda !== null) {
    if (typeof referenciaCruda !== 'string' && typeof referenciaCruda !== 'number') {
      errores.push('La referencia tiene que ser texto.');
    } else {
      const texto = String(referenciaCruda).trim();
      if (texto.length > MAX_REFERENCIA) {
        errores.push(`La referencia puede tener hasta ${MAX_REFERENCIA} caracteres.`);
      } else {
        referencia = texto === '' ? null : texto;
      }
    }
  }

  if (errores.length > 0) return falla(400, errores.join(' '));
  return { valores: { medio, monto, referencia } };
};
