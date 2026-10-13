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

export const obtenerPago = (accessToken, paymentId) =>
  llamar(
    `${PAYMENTS_URL}/${encodeURIComponent(String(paymentId))}`,
    { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } },
    'v1/payments'
  );
