import {
  hmacSha256Hex,
  normalizeText,
  timingSafeEqual
} from './utils.js';

const ACTION_VERSION = 'r1';
const ACTION_TTL_SECONDS = 7 * 24 * 60 * 60;
const SIGNATURE_HEX_LENGTH = 16;
const TELEGRAM_CALLBACK_DATA_MAX_BYTES = 64;
const STATUS_TO_CODE = new Map([
  ['paid', 'p'],
  ['expired', 'x'],
  ['delivering', 's'],
  ['delivered', 'v']
]);
const CODE_TO_STATUS = new Map(Array.from(STATUS_TO_CODE.entries()).map(([status, code]) => [code, status]));

function nowSeconds(now = Date.now()) {
  return Math.floor(Number(now) / 1000);
}

export function normalizeTelegramId(value) {
  return String(value ?? '').trim();
}

export async function buildTelegramActionId(secret, orderId, status, now = Date.now()) {
  const normalizedOrderId = normalizeText(orderId);
  const normalizedStatus = normalizeText(status);
  const statusCode = STATUS_TO_CODE.get(normalizedStatus);

  if (!secret || !normalizedOrderId || !statusCode) return '';

  const expiresAt = nowSeconds(now) + ACTION_TTL_SECONDS;
  const expiresBase36 = expiresAt.toString(36);
  const body = `${ACTION_VERSION}:${normalizedOrderId}:${statusCode}:${expiresBase36}`;
  const signature = (await hmacSha256Hex(secret, body)).slice(0, SIGNATURE_HEX_LENGTH);
  const actionId = `${body}:${signature}`;

  if (new TextEncoder().encode(actionId).length > TELEGRAM_CALLBACK_DATA_MAX_BYTES) {
    return '';
  }

  return actionId;
}

export async function verifyTelegramActionId(secret, actionId, now = Date.now()) {
  if (!secret) {
    return { ok: false, reason: 'telegram_action_secret_not_configured' };
  }

  const parts = String(actionId || '').split(':');
  if (parts.length !== 5 || parts[0] !== ACTION_VERSION) {
    return { ok: false, reason: 'invalid_action_id_format' };
  }

  const [version, orderId, statusCode, expiresBase36, signature] = parts;
  const status = CODE_TO_STATUS.get(statusCode);
  const expiresAt = Number.parseInt(expiresBase36, 36);

  if (!orderId || !status || !Number.isFinite(expiresAt) || !signature) {
    return { ok: false, reason: 'invalid_action_payload' };
  }

  const body = `${version}:${orderId}:${statusCode}:${expiresBase36}`;
  const expected = (await hmacSha256Hex(secret, body)).slice(0, SIGNATURE_HEX_LENGTH);

  if (!timingSafeEqual(signature, expected)) {
    return { ok: false, reason: 'invalid_action_signature' };
  }

  if (expiresAt < nowSeconds(now)) {
    return { ok: false, reason: 'expired_action_id' };
  }

  return {
    ok: true,
    orderId: normalizeText(orderId),
    status,
    expiresAt
  };
}

export function getAllowedTelegramOperatorIds(env) {
  return new Set(String(env.TELEGRAM_OPERATOR_IDS || '')
    .split(',')
    .map(normalizeTelegramId)
    .filter(Boolean));
}

export function isAllowedTelegramOperator(env, operatorId) {
  const normalized = normalizeTelegramId(operatorId);
  return Boolean(normalized && getAllowedTelegramOperatorIds(env).has(normalized));
}

export function isAllowedTelegramChat(env, chatId) {
  const configuredChatId = normalizeTelegramId(env.TELEGRAM_CHAT_ID);
  const normalizedChatId = normalizeTelegramId(chatId);
  return Boolean(configuredChatId && normalizedChatId && configuredChatId === normalizedChatId);
}

export function verifyTelegramWebhookSecret(env, secretHeader) {
  const configuredSecret = normalizeText(env.TELEGRAM_WEBHOOK_SECRET);
  const receivedSecret = normalizeText(secretHeader);
  return Boolean(configuredSecret && receivedSecret && timingSafeEqual(receivedSecret, configuredSecret));
}

export function extractTelegramActionMessages(env, payload) {
  const callbackQuery = payload?.callback_query;
  const actionId = normalizeText(callbackQuery?.data);

  if (!callbackQuery || !actionId) return [];

  const chatId = normalizeTelegramId(callbackQuery.message?.chat?.id);
  const configuredChatId = normalizeTelegramId(env.TELEGRAM_CHAT_ID);

  if (configuredChatId && !chatId) {
    return [{
      rejected: true,
      reason: 'missing_telegram_chat_id'
    }];
  }

  if (configuredChatId && chatId !== configuredChatId) {
    return [{
      rejected: true,
      reason: 'unexpected_telegram_chat_id',
      chatId
    }];
  }

  return [{
    callbackQueryId: normalizeText(callbackQuery.id),
    messageId: normalizeTelegramId(callbackQuery.message?.message_id),
    chatId,
    fromId: normalizeTelegramId(callbackQuery.from?.id),
    actionId
  }];
}

export async function answerTelegramCallbackQuery(env, callbackQueryId, text = '') {
  if (!env.TELEGRAM_BOT_TOKEN || !callbackQueryId) {
    return {
      ok: true,
      provider: 'telegram',
      skipped: true,
      reason: 'telegram_callback_ack_not_configured'
    };
  }

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: normalizeText(text).slice(0, 200)
    })
  });
  const payload = await response.json().catch(() => null);

  return {
    ok: response.ok && !(payload && payload.ok === false),
    provider: 'telegram',
    status: response.status
  };
}
