// Maps the short `motivo` codes sent by the backend callback redirect to Spanish messages.
const MOTIVOS = {
  autorizacion_rechazada: 'Cancelaste o rechazaste la autorización en Mercado Pago.',
  parametros_invalidos: 'La respuesta de Mercado Pago no es válida. Intentá vincular de nuevo.',
  configuracion: 'La integración con Mercado Pago no está configurada en el servidor.',
  state_invalido: 'El enlace de vinculación venció o ya fue usado. Iniciá la vinculación de nuevo.',
  intercambio_fallido: 'Mercado Pago no pudo confirmar la autorización. Intentá de nuevo.',
  interno: 'Ocurrió un error interno al guardar la vinculación. Intentá de nuevo.',
};

const GENERICO = 'No se pudo vincular Mercado Pago. Intentá de nuevo.';

export const mensajeMotivo = (motivo) =>
  (typeof motivo === 'string' && Object.hasOwn(MOTIVOS, motivo)) ? MOTIVOS[motivo] : GENERICO;

// Builds a { type, message } alert from the ?mercadopago= query params, or null.
export const alertaDesdeParams = (params) => {
  const resultado = params.get('mercadopago');
  if (resultado === 'conectado') {
    return { type: 'success', message: 'Tu cuenta de Mercado Pago quedó vinculada.' };
  }
  if (resultado === 'error') {
    return { type: 'danger', message: mensajeMotivo(params.get('motivo')) };
  }
  return null;
};
