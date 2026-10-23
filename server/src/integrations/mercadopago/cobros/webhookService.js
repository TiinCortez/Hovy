import { obtenerAccessTokenVigente } from '../mercadopagoOAuthService.js';
import * as repo from './cobrosRepository.js';
import { obtenerPago } from './mpPagosClient.js';
import { aplicarPagoACobro } from './aplicarPago.js';
import { verificarFirmaWebhook } from './webhookSignature.js';

// Returns { status } for the HTTP answer. 200 for handled and for valid-but-unknown
// notifications (so Mercado Pago does not retry forever); 5xx only for transient
// failures worth retrying. Logs only non-sensitive context.
export const procesarWebhook = async ({ headers, query, body }) => {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return { status: 503 };

  const dataId = query?.['data.id'] ?? body?.data?.id;
  const firma = verificarFirmaWebhook({
    xSignature: headers['x-signature'],
    xRequestId: headers['x-request-id'],
    dataId,
    secret,
  });
  if (!firma.valida) {
    console.warn(`[cobros] webhook rechazado (${firma.motivo})`);
    return { status: 401 };
  }

  const tipo = body?.type ?? query?.type ?? query?.topic;
  if (tipo !== 'payment') return { status: 200 };

  const mpUserId = Number(body?.user_id);
  if (!Number.isSafeInteger(mpUserId) || mpUserId <= 0) {
    console.warn('[cobros] webhook sin user_id válido; se ignora');
    return { status: 200 };
  }

  const { data: conexion, dbError } = await repo.obtenerUsuarioPorMpUserId(mpUserId);
  if (dbError) return { status: 500 };
  if (!conexion) return { status: 200 };

  const token = await obtenerAccessTokenVigente(conexion.id_usuario);
  if (token.error) {
    console.warn(`[cobros] sin token vigente del vendedor (${token.error.code})`);
    // Seller must relink: retrying will not help.
    return { status: token.error.code === 'DB' ? 500 : 200 };
  }

  // The payment is always re-read from Mercado Pago with the seller token.
  const pago = await obtenerPago(token.data.accessToken, dataId);
  if (!pago) return { status: 500 };

  const externalReference = typeof pago.external_reference === 'string' ? pago.external_reference : null;
  if (!externalReference) return { status: 200 };

  const { data: cobro, dbError: errCobro } = await repo.obtenerPorReferencia(externalReference, conexion.id_usuario);
  if (errCobro) return { status: 500 };
  if (!cobro) return { status: 200 };

  // Same logic as the active check (see aplicarPagoACobro). Answering 5xx when it
  // fails makes Mercado Pago retry the notification (every 15 minutes).
  const aplicado = await aplicarPagoACobro(cobro, pago);
  if (aplicado.dbError) return { status: 500 };

  return { status: 200 };
};
