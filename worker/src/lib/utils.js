const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const SUPPORT_EMAIL = 'contacto@caferoast.cl';
export const SUPPORT_WHATSAPP = '+56991746361';
export const SUPPORT_WHATSAPP_URL = 'https://wa.me/56991746361';
export const CHILE_TIMEZONE = 'America/Santiago';

export function buildCorsHeaders(extraHeaders = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    ...extraHeaders
  };
}

export function jsonResponse(payload, options = {}) {
  const status = options.status || 200;
  const headers = buildCorsHeaders({
    'Content-Type': 'application/json; charset=utf-8',
    ...(options.headers || {})
  });
  return new Response(JSON.stringify(payload), { status, headers });
}

export function textResponse(text, options = {}) {
  const status = options.status || 200;
  const headers = buildCorsHeaders({
    'Content-Type': 'text/plain; charset=utf-8',
    ...(options.headers || {})
  });
  return new Response(text, { status, headers });
}

export function redirectResponse(location, status = 303, headers = {}) {
  return new Response(null, {
    status,
    headers: buildCorsHeaders({
      Location: location,
      ...headers
    })
  });
}

export function errorResponse(message, options = {}) {
  return jsonResponse(
    {
      ok: false,
      error: message,
      ...(options.details ? { details: options.details } : {})
    },
    { status: options.status || 400 }
  );
}

export async function parseJsonBody(request) {
  const raw = await request.text();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error('Invalid JSON body');
  }
}

export async function parseFormBody(request) {
  const formData = await request.formData();
  const result = {};

  for (const [key, value] of formData.entries()) {
    result[key] = typeof value === 'string' ? value : value.name;
  }

  return result;
}

export async function parseRequestBody(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return parseJsonBody(request);
  }

  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    return parseFormBody(request);
  }

  if (request.method === 'GET') {
    return {};
  }

  return parseJsonBody(request);
}

export function getPublicBaseUrl(env, request) {
  const candidate = (env.PUBLIC_BASE_URL || new URL(request.url).origin || '').trim();
  return candidate.replace(/\/+$/, '');
}

export function normalizeText(value) {
  return String(value || '').trim();
}

export function normalizeKey(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

export function isTruthy(value) {
  const normalized = normalizeText(value).toLowerCase();
  return ['true', '1', 'si', 'sí', 'yes', 'y', 'activo'].includes(normalized);
}

export function safeJsonStringify(value) {
  if (value === undefined || value === null) return '';
  return JSON.stringify(value);
}

export function parseInteger(value, fallback = 0) {
  const normalized = Number.parseInt(String(value || '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(normalized) ? normalized : fallback;
}

export function toCurrencyNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = String(value || '').replace(/[^\d-]/g, '');
  return parseInteger(normalized, 0);
}

export function pad(number) {
  return String(number).padStart(2, '0');
}

export function getZonedDateParts(date = new Date(), timeZone = CHILE_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date).reduce((accumulator, item) => {
    if (item.type !== 'literal') {
      accumulator[item.type] = item.value;
    }
    return accumulator;
  }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

export function getLocalTimestamp(date = new Date(), timeZone = CHILE_TIMEZONE) {
  const parts = getZonedDateParts(date, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

export function getLocalDate(date = new Date(), timeZone = CHILE_TIMEZONE) {
  const parts = getZonedDateParts(date, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function getWeekKey(date = new Date(), timeZone = CHILE_TIMEZONE) {
  const parts = getZonedDateParts(date, timeZone);
  const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const dayOfWeek = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${pad(weekNumber)}`;
}

export function buildOrderId(date = new Date()) {
  const parts = getZonedDateParts(date, CHILE_TIMEZONE);
  const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 5);
  return `roast_${parts.year}${pad(parts.month)}${pad(parts.day)}_${pad(parts.hour)}${pad(parts.minute)}${pad(parts.second)}_${random}`;
}

export function buildEventId(date = new Date()) {
  return `evt_${buildOrderId(date)}`;
}

export function buildCustomerId(date = new Date()) {
  return `cus_${buildOrderId(date)}`;
}

export function buildPaymentId(date = new Date()) {
  return `pay_${buildOrderId(date)}`;
}

export async function hmacSha256Hex(secret, input) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(String(input)));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function base64UrlEncodeString(value) {
  return base64UrlEncodeBytes(encoder.encode(value));
}

export function base64UrlEncodeBytes(bytes) {
  let binary = '';

  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function pemToArrayBuffer(pem) {
  const cleaned = String(pem || '')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

export async function signJwt(privateKeyPem, signingInput) {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(signingInput)
  );

  return base64UrlEncodeBytes(new Uint8Array(signature));
}

export function decodeBase64Json(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLength);
  return JSON.parse(decoder.decode(Uint8Array.from(atob(padded), character => character.charCodeAt(0))));
}

export function buildSupportWhatsappMessage(orderId) {
  const prefix = orderId ? `Hola Roast. Necesito ayuda con mi pedido ${orderId}.` : 'Hola Roast. Necesito ayuda con mi pedido web.';
  return `${SUPPORT_WHATSAPP_URL}?text=${encodeURIComponent(prefix)}`;
}

export function asSheetValue(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
}
