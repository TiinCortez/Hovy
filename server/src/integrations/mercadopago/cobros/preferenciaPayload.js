// Pure builder of the Checkout Pro preference body (no I/O, easy to reason about).

export const WEBHOOK_PATH = '/api/mercadopago/webhook';
// A payment link stops working this long after it was created.
export const EXPIRACION_MS = 24 * 60 * 60 * 1000;

export const esUrlPublicaHttps = (valor) => {
  try {
    const u = new URL(valor);
    const host = u.hostname.toLowerCase();
    return u.protocol === 'https:'
      && host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]'
      && !host.endsWith('.localhost') && !host.endsWith('.test');
  } catch {
    return false;
  }
};

export const construirPreferencia = ({
  titulo,
  monto,
  externalReference,
  publicBaseUrl,
  returnUrl,
  ahora = Date.now(),
}) => {
  const preferencia = {
    items: [{ title: titulo, quantity: 1, unit_price: monto, currency_id: 'ARS' }],
    external_reference: externalReference,
    notification_url: `${publicBaseUrl.replace(/\/+$/, '')}${WEBHOOK_PATH}`,
    expires: true,
    expiration_date_from: new Date(ahora).toISOString(),
    expiration_date_to: new Date(ahora + EXPIRACION_MS).toISOString(),
    // NOTE: no marketplace_fee on purpose. The platform commission is out of scope for now.
  };

  if (returnUrl) {
    preferencia.back_urls = { success: returnUrl, pending: returnUrl, failure: returnUrl };
    // Mercado Pago rejects auto_return with localhost/http back URLs.
    if (esUrlPublicaHttps(returnUrl)) preferencia.auto_return = 'approved';
  }
  return preferencia;
};
