import crypto from 'crypto';
import { encryptToken, decryptToken } from './tokenCrypto.js';
import * as repo from './conexionRepository.js';

const TOKEN_URL = 'https://api.mercadopago.com/oauth/token';
const DEFAULT_AUTH_BASE_URL = 'https://auth.mercadopago.com.ar';
const STATE_TTL_MS = 10 * 60 * 1000;
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

const err = (status, message) => ({ error: { status, message } });

const configError = () => err(503, 'La integración con Mercado Pago no está configurada en el servidor.');

// Reads required env vars at use time (never at import time). Never logs values.
const readConfig = (names) => {
  const cfg = {};
  for (const name of names) {
    const value = process.env[name];
    if (!value) return null;
    cfg[name] = value;
  }
  return cfg;
};

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const authBaseUrl = () =>
  (process.env.MERCADOPAGO_AUTH_BASE_URL || DEFAULT_AUTH_BASE_URL).replace(/\/+$/, '');

// POST /oauth/token with form encoding. Returns the parsed body or null on any failure.
// Provider bodies are never logged or forwarded: only the HTTP status is logged.
const postToken = async (params) => {
  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`[mercadopago] oauth/token respondió ${response.status}`);
      return null;
    }
    const body = await response.json();
    if (!body?.access_token || !body?.refresh_token || !body?.user_id || !Number.isFinite(Number(body.expires_in))) {
      console.error('[mercadopago] oauth/token devolvió una respuesta incompleta');
      return null;
    }
    return body;
  } catch (e) {
    console.error(`[mercadopago] fallo de red en oauth/token (${e?.name || 'error'})`);
    return null;
  }
};

export const iniciarAutorizacion = async (idUsuario) => {
  const cfg = readConfig([
    'MERCADOPAGO_APP_ID',
    'MERCADOPAGO_OAUTH_REDIRECT_URI',
    'MERCADOPAGO_TOKEN_ENCRYPTION_KEY',
  ]);
  if (!cfg) return configError();

  await repo.deleteExpiredStates();

  const state = crypto.randomBytes(32).toString('base64url');
  const { dbError } = await repo.insertState({
    stateHash: sha256(state),
    idUsuario,
    expiraEn: new Date(Date.now() + STATE_TTL_MS).toISOString(),
  });
  if (dbError) {
    console.error('[mercadopago] no se pudo guardar el state OAuth');
    return err(500, 'No se pudo iniciar la vinculación con Mercado Pago.');
  }

  const params = new URLSearchParams({
    client_id: cfg.MERCADOPAGO_APP_ID,
    response_type: 'code',
    platform_id: 'mp',
    state,
    redirect_uri: cfg.MERCADOPAGO_OAUTH_REDIRECT_URI,
  });
  return { data: { url: `${authBaseUrl()}/authorization?${params.toString()}` } };
};

// Resolves to { ok: true } or { motivo } where motivo is a short safe code for the redirect.
export const procesarCallback = async ({ code, state, error }) => {
  if (error) return { motivo: 'autorizacion_rechazada' };
  if (typeof code !== 'string' || typeof state !== 'string' || !code || !state
      || code.length > 512 || state.length > 128) {
    return { motivo: 'parametros_invalidos' };
  }

  const cfg = readConfig([
    'MERCADOPAGO_APP_ID',
    'MERCADOPAGO_CLIENT_SECRET',
    'MERCADOPAGO_OAUTH_REDIRECT_URI',
    'MERCADOPAGO_TOKEN_ENCRYPTION_KEY',
  ]);
  if (!cfg) return { motivo: 'configuracion' };

  // The acting user comes ONLY from the consumed state row.
  const consumed = await repo.consumeState(sha256(state));
  if (consumed.dbError) return { motivo: 'interno' };
  if (!consumed.data) return { motivo: 'state_invalido' };
  const idUsuario = consumed.data;

  const token = await postToken({
    grant_type: 'authorization_code',
    client_id: cfg.MERCADOPAGO_APP_ID,
    client_secret: cfg.MERCADOPAGO_CLIENT_SECRET,
    code,
    redirect_uri: cfg.MERCADOPAGO_OAUTH_REDIRECT_URI,
  });
  if (!token) return { motivo: 'intercambio_fallido' };

  let saved;
  try {
    saved = await repo.upsertConexion({
      id_usuario: idUsuario,
      mp_user_id: token.user_id,
      access_token_enc: encryptToken(token.access_token),
      refresh_token_enc: encryptToken(token.refresh_token),
      scope: typeof token.scope === 'string' ? token.scope : null,
      expira_en: new Date(Date.now() + Number(token.expires_in) * 1000).toISOString(),
      estado: 'Conectada',
    });
  } catch {
    return { motivo: 'configuracion' };
  }
  if (saved.dbError) {
    console.error('[mercadopago] no se pudo guardar la conexión');
    return { motivo: 'interno' };
  }
  return { ok: true };
};

export const obtenerConexion = async (idUsuario) => {
  const { data, dbError } = await repo.getConexion(idUsuario);
  if (dbError) return err(500, 'No se pudo consultar la conexión con Mercado Pago.');
  if (!data) return { data: { conectada: false, estado: null, mp_user_id: null, expira_en: null } };
  return {
    data: {
      conectada: data.estado === 'Conectada',
      estado: data.estado,
      mp_user_id: data.mp_user_id,
      expira_en: data.expira_en,
    },
  };
};

// Local unlink only. Remote revocation of the grant at Mercado Pago is out of scope
// (the seller can revoke it from their Mercado Pago account).
export const desconectar = async (idUsuario) => {
  const { dbError } = await repo.deleteConexion(idUsuario);
  if (dbError) return err(500, 'No se pudo desvincular la cuenta de Mercado Pago.');
  return { data: true };
};

// For the future QR/order unit (not exposed as an endpoint).
// Returns { data: { accessToken, mpUserId } } or { error: { status, message, code } }.
// Never falls back to any platform-level token.
export const obtenerAccessTokenVigente = async (idUsuario) => {
  const cfg = readConfig([
    'MERCADOPAGO_APP_ID',
    'MERCADOPAGO_CLIENT_SECRET',
    'MERCADOPAGO_TOKEN_ENCRYPTION_KEY',
  ]);
  if (!cfg) return { error: { ...configError().error, code: 'CONFIG' } };

  const { data: row, dbError } = await repo.getConexion(idUsuario);
  if (dbError) return { error: { status: 500, message: 'No se pudo consultar la conexión con Mercado Pago.', code: 'DB' } };
  if (!row) return { error: { status: 409, message: 'Mercado Pago no está vinculado.', code: 'NO_CONECTADA' } };
  if (row.estado !== 'Conectada') {
    return { error: { status: 409, message: 'Hay que volver a autorizar Mercado Pago.', code: 'REAUTORIZAR' } };
  }

  try {
    if (new Date(row.expira_en).getTime() - Date.now() > REFRESH_MARGIN_MS) {
      return { data: { accessToken: decryptToken(row.access_token_enc), mpUserId: row.mp_user_id } };
    }

    const refreshed = await postToken({
      grant_type: 'refresh_token',
      client_id: cfg.MERCADOPAGO_APP_ID,
      client_secret: cfg.MERCADOPAGO_CLIENT_SECRET,
      refresh_token: decryptToken(row.refresh_token_enc),
    });
    if (!refreshed) {
      await repo.updateConexion(idUsuario, { estado: 'Reautorizar' });
      return { error: { status: 409, message: 'Hay que volver a autorizar Mercado Pago.', code: 'REAUTORIZAR' } };
    }

    // Both tokens replaced in a single UPDATE (the refresh token may rotate).
    const upd = await repo.updateConexion(idUsuario, {
      access_token_enc: encryptToken(refreshed.access_token),
      refresh_token_enc: encryptToken(refreshed.refresh_token),
      scope: typeof refreshed.scope === 'string' ? refreshed.scope : row.scope,
      expira_en: new Date(Date.now() + Number(refreshed.expires_in) * 1000).toISOString(),
      estado: 'Conectada',
    });
    if (upd.dbError) {
      return { error: { status: 500, message: 'No se pudo actualizar la conexión con Mercado Pago.', code: 'DB' } };
    }
    return { data: { accessToken: refreshed.access_token, mpUserId: row.mp_user_id } };
  } catch {
    return { error: { status: 500, message: 'No se pudo leer la credencial de Mercado Pago.', code: 'CRYPTO' } };
  }
};
