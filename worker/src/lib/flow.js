import { hmacSha256Hex, normalizeText } from './utils.js';

function getFlowBaseUrl(env) {
  const baseUrl = normalizeText(env.FLOW_BASE_URL || 'https://www.flow.cl/api').replace(/\/+$/, '');
  return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
}

async function signFlowParams(secretKey, params) {
  const filteredEntries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '');
  const sortedEntries = filteredEntries.sort(([left], [right]) => left.localeCompare(right));
  const stringToSign = sortedEntries.map(([key, value]) => `${key}${value}`).join('');
  return hmacSha256Hex(secretKey, stringToSign);
}

async function flowPost(env, path, params) {
  if (!env.FLOW_API_KEY || !env.FLOW_SECRET_KEY) {
    throw new Error('Missing Flow credentials');
  }

  const payload = {
    ...params,
    apiKey: env.FLOW_API_KEY
  };
  const signature = await signFlowParams(env.FLOW_SECRET_KEY, payload);
  const body = new URLSearchParams();

  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      body.set(key, String(value));
    }
  });

  body.set('s', signature);

  const response = await fetch(`${getFlowBaseUrl(env)}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const payloadJson = await response.json();

  if (!response.ok) {
    throw new Error(payloadJson.message || payloadJson.error || `Flow POST ${path} failed`);
  }

  return payloadJson;
}

async function flowGet(env, path, params) {
  if (!env.FLOW_API_KEY || !env.FLOW_SECRET_KEY) {
    throw new Error('Missing Flow credentials');
  }

  const payload = {
    ...params,
    apiKey: env.FLOW_API_KEY
  };
  const signature = await signFlowParams(env.FLOW_SECRET_KEY, payload);
  const query = new URLSearchParams();

  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });

  query.set('s', signature);

  const response = await fetch(`${getFlowBaseUrl(env)}${path}?${query.toString()}`);
  const payloadJson = await response.json();

  if (!response.ok) {
    throw new Error(payloadJson.message || payloadJson.error || `Flow GET ${path} failed`);
  }

  return payloadJson;
}

export async function createFlowPayment(env, request) {
  const payload = {
    commerceOrder: request.commerceOrder,
    subject: request.subject,
    amount: request.amount,
    currency: request.currency || 'CLP',
    email: request.email,
    paymentMethod: request.paymentMethod || 9,
    urlConfirmation: request.urlConfirmation,
    urlReturn: request.urlReturn,
    optional: request.optional ? JSON.stringify(request.optional) : undefined,
    timeout: request.timeout || undefined
  };

  return flowPost(env, '/payment/create', payload);
}

export async function getFlowPaymentStatus(env, token) {
  return flowGet(env, '/payment/getStatus', { token });
}

export function mapFlowStatus(flowStatus) {
  const normalized = Number(flowStatus);

  switch (normalized) {
    case 1:
      return 'pending_payment';
    case 2:
      return 'paid';
    case 3:
      return 'payment_failed';
    case 4:
      return 'canceled';
    default:
      return 'pending_payment';
  }
}
