import crypto from 'crypto';

// AES-256-GCM helpers for seller tokens at rest.
// Stored format: base64( iv(12) | authTag(16) | ciphertext ).

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

const readKey = () => {
  const hex = process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    const err = new Error('MERCADOPAGO_TOKEN_ENCRYPTION_KEY invalid or missing');
    err.code = 'MP_CONFIG';
    throw err;
  }
  return Buffer.from(hex, 'hex');
};

export const encryptToken = (plain, key = readKey()) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
};

export const decryptToken = (payload, key = readKey()) => {
  const raw = Buffer.from(String(payload), 'base64');
  if (raw.length <= IV_LENGTH + TAG_LENGTH) {
    throw new Error('Invalid encrypted payload');
  }
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const data = raw.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
};
