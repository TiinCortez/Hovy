import crypto from 'crypto';

// Pure x-signature verification for Mercado Pago webhooks (no I/O).
// Header: "ts=<timestamp>,v1=<hex hmac>".
// Manifest: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" signed with
// HMAC-SHA256 using the application's webhook secret.

const TOLERANCIA_MS = 5 * 60 * 1000;

const invalida = (motivo) => ({ valida: false, motivo });

const parseHeader = (header) => {
  const partes = {};
  for (const trozo of String(header).split(',')) {
    const idx = trozo.indexOf('=');
    if (idx > 0) partes[trozo.slice(0, idx).trim()] = trozo.slice(idx + 1).trim();
  }
  return partes;
};

export const verificarFirmaWebhook = ({
  xSignature,
  xRequestId,
  dataId,
  secret,
  now = Date.now(),
  toleranciaMs = TOLERANCIA_MS,
}) => {
  if (!secret) return invalida('sin_secreto');
  if (!xSignature || !xRequestId || dataId === undefined || dataId === null || dataId === '') {
    return invalida('faltan_datos');
  }

  const { ts, v1 } = parseHeader(xSignature);
  if (!ts || !v1 || !/^\d+$/.test(ts) || !/^[0-9a-fA-F]+$/.test(v1)) {
    return invalida('cabecera_malformada');
  }

  // ts is epoch milliseconds; tolerate seconds too.
  const tsNum = Number(ts);
  const tsMs = tsNum < 1e12 ? tsNum * 1000 : tsNum;
  if (Math.abs(now - tsMs) > toleranciaMs) return invalida('ts_fuera_de_ventana');

  // Alphanumeric ids are lowercased in the manifest (documented by Mercado Pago);
  // numeric payment ids are unaffected.
  const id = String(dataId).toLowerCase();
  const manifest = `id:${id};request-id:${xRequestId};ts:${ts};`;
  const esperado = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  const a = Buffer.from(esperado, 'utf8');
  const b = Buffer.from(v1.toLowerCase(), 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return invalida('firma_invalida');
  return { valida: true };
};
