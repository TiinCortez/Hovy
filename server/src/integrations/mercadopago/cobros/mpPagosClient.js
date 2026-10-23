// Thin Mercado Pago HTTP client for payment links (Checkout Pro) using the
// SELLER's OAuth access token. Never logs bodies or tokens; callers get
// the parsed body or null.

const PREFERENCES_URL = 'https://api.mercadopago.com/checkout/preferences';
const PAYMENTS_URL = 'https://api.mercadopago.com/v1/payments';
const TIMEOUT_MS = 15_000;

const llamar = async (url, opciones, etiqueta) => {
  try {
    const response = await fetch(url, { ...opciones, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) {
      console.error(`[mercadopago] ${etiqueta} respondió ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (e) {
    console.error(`[mercadopago] fallo de red en ${etiqueta} (${e?.name || 'error'})`);
    return null;
  }
};

export const crearPreferencia = (accessToken, payload, idempotencyKey) =>
  llamar(
    PREFERENCES_URL,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    },
    'checkout/preferences'
  );

// Payments of one cobro, newest first (GET /v1/payments/search). Used by the active
// check, when the webhook did not arrive. Resolves { paging, results } or null.
export const buscarPagosPorReferencia = (accessToken, externalReference) => {
  const url = new URL(`${PAYMENTS_URL}/search`);
  url.searchParams.set('external_reference', externalReference);
  url.searchParams.set('sort', 'date_created');
  url.searchParams.set('criteria', 'desc');
  url.searchParams.set('limit', '10');
  return llamar(
    url.toString(),
    { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } },
    'v1/payments/search'
  );
};

export const obtenerPago = (accessToken, paymentId) =>
  llamar(
    `${PAYMENTS_URL}/${encodeURIComponent(String(paymentId))}`,
    { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } },
    'v1/payments'
  );
