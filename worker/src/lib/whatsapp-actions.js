import {
  base64UrlEncodeString,
  decodeBase64Json,
  hmacSha256Hex,
  normalizeText,
  timingSafeEqual
} from './utils.js';

const ACTION_VERSION = 1;
const ACTION_TTL_SECONDS = 7 * 24 * 60 * 60;

export function normalizeWhatsAppPhone(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

function nowSeconds(now = Date.now()) {
  return Math.floor(Number(now) / 1000);
}

export async function buildWhatsAppActionId(secret, orderId, status, now = Date.now()) {
  if (!secret || !orderId || !status) return '';

  const encoded = base64UrlEncodeString(JSON.stringify({
    v: ACTION_VERSION,
    o: normalizeText(orderId),
    s: normalizeText(status),
    e: nowSeconds(now) + ACTION_TTL_SECONDS
  }));
  const signature = (await hmacSha256Hex(secret, encoded)).slice(0, 32);

  return `${encoded}.${signature}`;
}

export async function verifyWhatsAppActionId(secret, actionId, now = Date.now()) {
  if (!secret) {
    return { ok: false, reason: 'whatsapp_action_secret_not_configured' };
  }

  const [encoded, signature, extra] = String(actionId || '').split('.');
  if (!encoded || !signature || extra !== undefined) {
    return { ok: false, reason: 'invalid_action_id_format' };
  }

  const expected = (await hmacSha256Hex(secret, encoded)).slice(0, 32);
  if (!timingSafeEqual(signature, expected)) {
    return { ok: false, reason: 'invalid_action_signature' };
  }

  let payload;
  try {
    payload = decodeBase64Json(encoded);
  } catch (error) {
    return { ok: false, reason: 'invalid_action_payload' };
  }

  if (payload.v !== ACTION_VERSION || !payload.o || !payload.s || !payload.e) {
    return { ok: false, reason: 'invalid_action_payload' };
  }

  if (Number(payload.e) < nowSeconds(now)) {
    return { ok: false, reason: 'expired_action_id' };
  }

  return {
    ok: true,
    orderId: normalizeText(payload.o),
    status: normalizeText(payload.s),
    expiresAt: Number(payload.e)
  };
}

export async function verifyWhatsAppWebhookSignature(env, rawBody, signatureHeader) {
  if (!env.WHATSAPP_APP_SECRET) return false;

  const signature = String(signatureHeader || '');
  if (!signature.startsWith('sha256=')) return false;

  const expected = `sha256=${await hmacSha256Hex(env.WHATSAPP_APP_SECRET, rawBody)}`;
  return timingSafeEqual(signature, expected);
}

export function getAllowedWhatsAppOperators(env) {
  const configured = String(env.WHATSAPP_OPERATOR_PHONES || '')
    .split(',')
    .map(normalizeWhatsAppPhone)
    .filter(Boolean);
  const notifyTo = normalizeWhatsAppPhone(env.WHATSAPP_NOTIFY_TO);
  const allowed = new Set(configured);

  if (notifyTo) {
    allowed.add(notifyTo);
  }

  return allowed;
}

export function isAllowedWhatsAppOperator(env, phone) {
  const normalized = normalizeWhatsAppPhone(phone);
  return Boolean(normalized && getAllowedWhatsAppOperators(env).has(normalized));
}

function extractActionId(message) {
  if (message && message.type === 'interactive') {
    return normalizeText(message.interactive?.button_reply?.id);
  }

  if (message && message.type === 'button') {
    return normalizeText(message.button?.payload);
  }

  return '';
}

export function extractWhatsAppActionMessages(env, payload) {
  const result = [];
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  const configuredPhoneNumberId = normalizeText(env.WHATSAPP_PHONE_NUMBER_ID);

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    for (const change of changes) {
      const value = change?.value || {};
      const phoneNumberId = normalizeText(value.metadata?.phone_number_id);

      if (configuredPhoneNumberId && phoneNumberId && phoneNumberId !== configuredPhoneNumberId) {
        result.push({
          rejected: true,
          reason: 'unexpected_whatsapp_phone_number_id',
          phoneNumberId
        });
        continue;
      }

      const messages = Array.isArray(value.messages) ? value.messages : [];

      for (const message of messages) {
        const actionId = extractActionId(message);
        if (!actionId) continue;

        result.push({
          from: normalizeWhatsAppPhone(message.from),
          messageId: normalizeText(message.id),
          actionId,
          phoneNumberId
        });
      }
    }
  }

  return result;
}
