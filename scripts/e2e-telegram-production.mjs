#!/usr/bin/env node

import { createHmac } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const DEFAULT_BASE_URL = 'https://caferoast.cl';
const DEFAULT_FLOW_PAYMENT_WAIT_SECONDS = 15 * 60;
const ORDER_NUMBER_PATTERN = /^\d{7}$/;
const NOTE_PREFIX = 'NO PREPARAR - TEST TELEGRAM';
const CUSTOMER_EMAIL = 'gosepulvedah@gmail.com';
const CUSTOMER_PHONE = '+56991746361';
const CUSTOMER_COMMUNE = 'Penalolen';
const CUSTOMER_ADDRESS = 'Avenida Consistorial 2320, Casa 1';
const ACTION_TTL_SECONDS = 7 * 24 * 60 * 60;
const STATUS_TO_CODE = new Map([
  ['paid', 'p'],
  ['expired', 'x'],
  ['delivering', 's'],
  ['delivered', 'v']
]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeBaseUrl(value) {
  return new URL(value || DEFAULT_BASE_URL).origin;
}

function parseBoolean(value, flagName) {
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'si', 'sÃ­'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false;
  throw new Error(`${flagName} must be true or false`);
}

function parsePositiveInteger(value, flagName) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${flagName} must be a positive integer`);
  }
  return parsed;
}

export function parseArgs(argv, env = process.env) {
  const args = {
    baseUrl: normalizeBaseUrl(env.PUBLIC_BASE_URL || DEFAULT_BASE_URL),
    runTransfer: true,
    runExpired: false,
    runFlowReal: false,
    flowPaymentWaitMs: parsePositiveInteger(
      env.FLOW_PAYMENT_WAIT_SECONDS || DEFAULT_FLOW_PAYMENT_WAIT_SECONDS,
      'FLOW_PAYMENT_WAIT_SECONDS'
    ) * 1000
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--base-url') {
      args.baseUrl = normalizeBaseUrl(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith('--base-url=')) {
      args.baseUrl = normalizeBaseUrl(arg.slice('--base-url='.length));
      continue;
    }

    if (arg === '--run-transfer') {
      args.runTransfer = true;
      continue;
    }

    if (arg === '--skip-transfer') {
      args.runTransfer = false;
      continue;
    }

    if (arg.startsWith('--run-transfer=')) {
      args.runTransfer = parseBoolean(arg.slice('--run-transfer='.length), '--run-transfer');
      continue;
    }

    if (arg === '--run-expired') {
      args.runExpired = true;
      continue;
    }

    if (arg.startsWith('--run-expired=')) {
      args.runExpired = parseBoolean(arg.slice('--run-expired='.length), '--run-expired');
      continue;
    }

    if (arg === '--run-flow-real') {
      args.runFlowReal = true;
      continue;
    }

    if (arg.startsWith('--run-flow-real=')) {
      args.runFlowReal = parseBoolean(arg.slice('--run-flow-real='.length), '--run-flow-real');
      continue;
    }

    if (arg === '--flow-payment-wait-seconds') {
      args.flowPaymentWaitMs = parsePositiveInteger(argv[index + 1], '--flow-payment-wait-seconds') * 1000;
      index += 1;
      continue;
    }

    if (arg.startsWith('--flow-payment-wait-seconds=')) {
      args.flowPaymentWaitMs = parsePositiveInteger(
        arg.slice('--flow-payment-wait-seconds='.length),
        '--flow-payment-wait-seconds'
      ) * 1000;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function hmacSha256Hex(secret, value) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export async function buildTelegramActionId(secret, orderId, status, expiresAt = nowSeconds() + ACTION_TTL_SECONDS) {
  assert(secret, 'TELEGRAM_ACTION_SECRET is required');
  assert(orderId, 'orderId is required');
  assert(status, 'status is required');

  const statusCode = STATUS_TO_CODE.get(String(status));
  assert(statusCode, `Unsupported Telegram action status: ${status}`);

  const expiresBase36 = Number(expiresAt).toString(36);
  const body = `r1:${String(orderId)}:${statusCode}:${expiresBase36}`;
  const signature = hmacSha256Hex(secret, body).slice(0, 16);
  const actionId = `${body}:${signature}`;
  assert(Buffer.byteLength(actionId, 'utf8') <= 64, 'Telegram callback_data exceeds 64 bytes');
  return actionId;
}

export function buildTelegramWebhookPayload({
  chatId,
  operatorId,
  actionId,
  callbackQueryId = `cbq.roast-e2e-${Date.now()}`
}) {
  return {
    update_id: Date.now(),
    callback_query: {
      id: callbackQueryId,
      from: {
        id: Number(operatorId)
      },
      message: {
        message_id: Date.now() % 100000,
        chat: {
          id: Number(chatId),
          type: 'supergroup',
          title: 'Roast Ops'
        }
      },
      data: actionId
    }
  };
}

function buildUrl(baseUrl, pathname) {
  return new URL(pathname, baseUrl);
}

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(buildUrl(baseUrl, pathname), {
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const text = await response.text();

  if (contentType.includes('text/html') || /^\s*</.test(text)) {
    throw new Error(`${options.label || pathname} returned HTML instead of Worker JSON. Check Cloudflare Worker routes for ${new URL(baseUrl).origin}/api/*. Snippet: ${text.slice(0, 180)}`);
  }

  let payload = null;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`${options.label || pathname} returned non-JSON response: ${text.slice(0, 180)}`);
  }

  return { response, payload, text };
}

function assertOkJson(result, label) {
  assert(
    result.response.ok && result.payload?.ok !== false,
    `${label} failed HTTP ${result.response.status}: ${result.payload?.error || result.text || 'unknown error'}`
  );
  return result.payload;
}

function getSecretValues(env) {
  return [
    env.TELEGRAM_WEBHOOK_SECRET,
    env.TELEGRAM_ACTION_SECRET,
    env.TELEGRAM_BOT_TOKEN
  ].filter(value => String(value || '').trim());
}

export function assertNoSecretLeak(value, secrets) {
  const serialized = JSON.stringify(value);

  for (const secret of secrets) {
    const normalized = String(secret || '').trim();
    if (normalized && serialized.includes(normalized)) {
      throw new Error('Secret value leaked into Telegram E2E output');
    }
  }
}

function requireEnv(env, names) {
  const missing = names.filter(name => !String(env[name] || '').trim());
  if (missing.length) {
    throw new Error(`Missing required production secrets: ${missing.join(', ')}`);
  }
}

function getAllowedOperatorIds(env) {
  return String(env.TELEGRAM_OPERATOR_IDS || '')
    .split(',')
    .map(value => String(value || '').trim())
    .filter(Boolean);
}

function pickAuthorizedOperatorId(env) {
  const operatorId = getAllowedOperatorIds(env)[0];
  if (!operatorId) {
    throw new Error('TELEGRAM_OPERATOR_IDS is required for authorized webhook tests');
  }
  return operatorId;
}

export function pickUnauthorizedOperatorId(env) {
  const allowed = new Set(getAllowedOperatorIds(env));

  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = String(100000000 + suffix);
    if (!allowed.has(candidate)) {
      return candidate;
    }
  }

  throw new Error('Unable to derive an unauthorized Telegram operator id');
}

async function checkHealth(baseUrl) {
  const payload = assertOkJson(
    await requestJson(baseUrl, '/api/health', { label: 'GET /api/health' }),
    'GET /api/health'
  );
  const configuration = payload.configuration || {};

  assert(configuration.google_sheets === true, 'GET /api/health expected google_sheets=true');
  assert(configuration.resend === true, 'GET /api/health expected resend=true');
  assert(configuration.admin_actions === true, 'GET /api/health expected admin_actions=true');
  assert(configuration.telegram_actions === true, 'GET /api/health expected telegram_actions=true');

  return configuration;
}

function buildCheckoutPayload(label) {
  return {
    first_name: 'Smoke',
    last_name: 'Roast',
    email: CUSTOMER_EMAIL,
    phone: CUSTOMER_PHONE,
    commune: CUSTOMER_COMMUNE,
    address: CUSTOMER_ADDRESS,
    address_ref: '',
    notes: `${NOTE_PREFIX} ${label}`,
    payment_method: 'transfer',
    accept_terms: true,
    channel: 'github_actions_telegram_e2e',
    origin: 'telegram_e2e_production',
    items: [{
      product_code: 'downtime',
      format_code: '250g',
      grind: 'grano entero',
      quantity: 1
    }]
  };
}

function buildOrderDraftPayload(label) {
  return {
    customer_name: 'Smoke Roast',
    email: CUSTOMER_EMAIL,
    phone: CUSTOMER_PHONE,
    commune: CUSTOMER_COMMUNE,
    address: CUSTOMER_ADDRESS,
    address_ref: '',
    notes: `${NOTE_PREFIX} ${label}`,
    channel: 'github_actions_telegram_e2e',
    origin: 'telegram_e2e_flow_production',
    items: [{
      product_code: 'downtime',
      format_code: '250g',
      grind: 'grano entero',
      quantity: 1
    }]
  };
}

async function createTransferOrder(baseUrl, label) {
  const payload = assertOkJson(
    await requestJson(baseUrl, '/api/checkout-orders', {
      label: `POST /api/checkout-orders ${label}`,
      method: 'POST',
      body: JSON.stringify(buildCheckoutPayload(label))
    }),
    `POST /api/checkout-orders ${label}`
  );

  assert(payload.internal_status === 'pending_transfer', `${label} expected pending_transfer, got ${payload.internal_status}`);
  assert(ORDER_NUMBER_PATTERN.test(payload.confirmation_number || ''), `${label} expected DDMMRRR confirmation number`);
  return payload;
}

async function createFlowDraft(baseUrl, label) {
  const draft = assertOkJson(
    await requestJson(baseUrl, '/api/order-drafts', {
      label: `POST /api/order-drafts ${label}`,
      method: 'POST',
      body: JSON.stringify(buildOrderDraftPayload(label))
    }),
    `POST /api/order-drafts ${label}`
  );

  assert(draft.internal_status === 'draft', `${label} expected draft, got ${draft.internal_status}`);
  assert(ORDER_NUMBER_PATTERN.test(draft.confirmation_number || ''), `${label} expected DDMMRRR confirmation number`);
  return draft;
}

async function createFlowPaymentLink(baseUrl, orderId) {
  const result = await requestJson(baseUrl, '/api/payment-links', {
    label: 'POST /api/payment-links',
    method: 'POST',
    body: JSON.stringify({
      order_id: orderId,
      accept_terms: true
    })
  });

  if (!result.response.ok || result.payload?.ok === false) {
    const detail = result.payload?.error || result.text || 'unknown error';
    throw new Error(`POST /api/payment-links failed. Confirm Config.settings.flow_enabled=true before running Flow real. Detail: ${detail}`);
  }

  assert(result.payload.checkout_url, 'POST /api/payment-links expected checkout_url');
  assert(result.payload.internal_status === 'link_sent', `Flow link expected link_sent, got ${result.payload.internal_status}`);
  return result.payload;
}

async function fetchOrder(baseUrl, orderId, expectedStatus = '') {
  const payload = assertOkJson(
    await requestJson(baseUrl, `/api/orders/${encodeURIComponent(orderId)}`, {
      label: `GET /api/orders/${orderId}`
    }),
    `GET /api/orders/${orderId}`
  );

  if (expectedStatus) {
    assert(payload.internal_status === expectedStatus, `expected ${orderId} status ${expectedStatus}, got ${payload.internal_status}`);
  }

  return payload;
}

function tamperActionId(actionId) {
  const last = actionId.slice(-1) === '0' ? '1' : '0';
  return `${actionId.slice(0, -1)}${last}`;
}

async function postWebhookAction(baseUrl, env, {
  orderId,
  status,
  operatorId,
  expectedHttp = 200,
  expectedStatus = status,
  expiresAt,
  actionId,
  webhookSecret,
  secrets,
  callbackQueryId
}) {
  const resolvedActionId = actionId || await buildTelegramActionId(env.TELEGRAM_ACTION_SECRET, orderId, status, expiresAt);
  const result = await requestJson(baseUrl, '/api/telegram/webhook', {
    label: `POST /api/telegram/webhook ${status}`,
    method: 'POST',
    headers: {
      'x-telegram-bot-api-secret-token': webhookSecret === undefined ? env.TELEGRAM_WEBHOOK_SECRET : webhookSecret
    },
    body: JSON.stringify(buildTelegramWebhookPayload({
      chatId: env.TELEGRAM_CHAT_ID,
      operatorId,
      actionId: resolvedActionId,
      callbackQueryId
    }))
  });

  assert(
    result.response.status === expectedHttp,
    `POST /api/telegram/webhook ${status} expected HTTP ${expectedHttp}, got ${result.response.status}: ${result.text}`
  );
  assertNoSecretLeak(result.payload, secrets || []);

  if (expectedHttp < 400) {
    assert(result.payload.ok === true, `POST /api/telegram/webhook ${status} expected ok=true`);
    assert(
      result.payload.results?.[0]?.internal_status === expectedStatus,
      `POST /api/telegram/webhook ${status} expected result status ${expectedStatus}`
    );
  }

  return result.payload;
}

async function runSecurityChecks(baseUrl, env, order, authorizedOperatorId, unauthorizedOperatorId, secrets) {
  const checks = [];

  await fetchOrder(baseUrl, order.order_id, 'pending_transfer');

  await postWebhookAction(baseUrl, env, {
    orderId: order.order_id,
    status: 'paid',
    operatorId: authorizedOperatorId,
    webhookSecret: 'bad-secret',
    expectedHttp: 403,
    secrets,
    callbackQueryId: `cbq.security.bad-secret.${Date.now()}`
  });
  await fetchOrder(baseUrl, order.order_id, 'pending_transfer');
  checks.push('invalid_webhook_secret_rejected');

  await postWebhookAction(baseUrl, env, {
    orderId: order.order_id,
    status: 'paid',
    operatorId: unauthorizedOperatorId,
    expectedHttp: 403,
    secrets,
    callbackQueryId: `cbq.security.unauthorized.${Date.now()}`
  });
  await fetchOrder(baseUrl, order.order_id, 'pending_transfer');
  checks.push('unauthorized_operator_rejected');

  await postWebhookAction(baseUrl, env, {
    orderId: order.order_id,
    status: 'paid',
    operatorId: authorizedOperatorId,
    expectedHttp: 403,
    expiresAt: nowSeconds() - 60,
    secrets,
    callbackQueryId: `cbq.security.expired.${Date.now()}`
  });
  await fetchOrder(baseUrl, order.order_id, 'pending_transfer');
  checks.push('expired_action_rejected');

  const validActionId = await buildTelegramActionId(env.TELEGRAM_ACTION_SECRET, order.order_id, 'paid');
  await postWebhookAction(baseUrl, env, {
    orderId: order.order_id,
    status: 'paid',
    operatorId: authorizedOperatorId,
    expectedHttp: 403,
    actionId: tamperActionId(validActionId),
    secrets,
    callbackQueryId: `cbq.security.tampered.${Date.now()}`
  });
  await fetchOrder(baseUrl, order.order_id, 'pending_transfer');
  checks.push('tampered_action_rejected');

  return checks;
}

async function runTransferScenario(baseUrl, env, secrets) {
  const authorizedOperatorId = pickAuthorizedOperatorId(env);
  const unauthorizedOperatorId = pickUnauthorizedOperatorId(env);
  const created = await createTransferOrder(baseUrl, 'TRANSFER');
  const statuses = ['pending_transfer'];
  const securityChecks = await runSecurityChecks(baseUrl, env, created, authorizedOperatorId, unauthorizedOperatorId, secrets);

  const paidActionId = await buildTelegramActionId(env.TELEGRAM_ACTION_SECRET, created.order_id, 'paid');
  await postWebhookAction(baseUrl, env, {
    orderId: created.order_id,
    status: 'paid',
    operatorId: authorizedOperatorId,
    actionId: paidActionId,
    expectedStatus: 'paid',
    secrets,
    callbackQueryId: `cbq.transfer.paid.${Date.now()}`
  });
  await fetchOrder(baseUrl, created.order_id, 'paid');
  statuses.push('paid');

  const duplicate = await postWebhookAction(baseUrl, env, {
    orderId: created.order_id,
    status: 'paid',
    operatorId: authorizedOperatorId,
    actionId: paidActionId,
    expectedStatus: 'paid',
    secrets,
    callbackQueryId: `cbq.transfer.duplicate-paid.${Date.now()}`
  });
  assert(duplicate.results?.[0]?.already_status === true, 'duplicate paid action should report already_status=true');
  securityChecks.push('duplicate_action_idempotent');

  await postWebhookAction(baseUrl, env, {
    orderId: created.order_id,
    status: 'expired',
    operatorId: authorizedOperatorId,
    expectedHttp: 409,
    secrets,
    callbackQueryId: `cbq.transfer.invalid-expired.${Date.now()}`
  });
  await fetchOrder(baseUrl, created.order_id, 'paid');
  securityChecks.push('invalid_transition_rejected');

  await postWebhookAction(baseUrl, env, {
    orderId: created.order_id,
    status: 'delivering',
    operatorId: authorizedOperatorId,
    expectedStatus: 'delivering',
    secrets,
    callbackQueryId: `cbq.transfer.delivering.${Date.now()}`
  });
  await fetchOrder(baseUrl, created.order_id, 'delivering');
  statuses.push('delivering');

  await postWebhookAction(baseUrl, env, {
    orderId: created.order_id,
    status: 'delivered',
    operatorId: authorizedOperatorId,
    expectedStatus: 'delivered',
    secrets,
    callbackQueryId: `cbq.transfer.delivered.${Date.now()}`
  });
  await fetchOrder(baseUrl, created.order_id, 'delivered');
  statuses.push('delivered');

  return {
    name: 'transfer_complete',
    order_id: created.order_id,
    order_number: created.confirmation_number,
    final_status: 'delivered',
    statuses,
    security_checks: securityChecks,
    manual_expectations: [
      'Initial Telegram pending_transfer with Confirmar pago and Expirar buttons',
      'Paid Telegram with En despacho button',
      'Delivering Telegram with Entregado button'
    ]
  };
}

async function runExpiredScenario(baseUrl, env, secrets) {
  const authorizedOperatorId = pickAuthorizedOperatorId(env);
  const created = await createTransferOrder(baseUrl, 'EXPIRED');

  await postWebhookAction(baseUrl, env, {
    orderId: created.order_id,
    status: 'expired',
    operatorId: authorizedOperatorId,
    expectedStatus: 'expired',
    secrets,
    callbackQueryId: `cbq.expired.${Date.now()}`
  });
  await fetchOrder(baseUrl, created.order_id, 'expired');

  return {
    name: 'transfer_expired',
    order_id: created.order_id,
    order_number: created.confirmation_number,
    final_status: 'expired',
    statuses: ['pending_transfer', 'expired'],
    manual_expectations: [
      'Initial Telegram pending_transfer with Expirar button'
    ]
  };
}

async function waitForOrderStatus(baseUrl, orderId, expectedStatus, timeoutMs) {
  const started = Date.now();
  let lastOrder = null;

  while (Date.now() - started <= timeoutMs) {
    lastOrder = await fetchOrder(baseUrl, orderId);

    if (lastOrder.internal_status === expectedStatus) {
      return lastOrder;
    }

    await new Promise(resolve => setTimeout(resolve, 15000));
  }

  throw new Error(`Timed out waiting for ${orderId} to reach ${expectedStatus}; last status was ${lastOrder?.internal_status || 'unknown'}`);
}

async function runFlowRealScenario(baseUrl, env, secrets, flowPaymentWaitMs) {
  const authorizedOperatorId = pickAuthorizedOperatorId(env);
  const draft = await createFlowDraft(baseUrl, 'FLOW');
  const link = await createFlowPaymentLink(baseUrl, draft.order_id);

  console.log(`::notice title=Flow payment URL::${link.checkout_url}`);
  console.log('::warning title=Flow cleanup::Restore Config.settings flow_enabled=false after this run and handle any real payment reversal manually if needed.');

  await waitForOrderStatus(baseUrl, draft.order_id, 'paid', flowPaymentWaitMs);

  await postWebhookAction(baseUrl, env, {
    orderId: draft.order_id,
    status: 'delivering',
    operatorId: authorizedOperatorId,
    expectedStatus: 'delivering',
    secrets,
    callbackQueryId: `cbq.flow.delivering.${Date.now()}`
  });
  await fetchOrder(baseUrl, draft.order_id, 'delivering');

  await postWebhookAction(baseUrl, env, {
    orderId: draft.order_id,
    status: 'delivered',
    operatorId: authorizedOperatorId,
    expectedStatus: 'delivered',
    secrets,
    callbackQueryId: `cbq.flow.delivered.${Date.now()}`
  });
  await fetchOrder(baseUrl, draft.order_id, 'delivered');

  return {
    name: 'flow_real',
    order_id: draft.order_id,
    order_number: draft.confirmation_number,
    final_status: 'delivered',
    statuses: ['draft', 'link_sent', 'paid', 'delivering', 'delivered'],
    manual_expectations: [
      'Flow payment is completed by a human during the workflow wait window',
      'Paid Telegram arrives with En despacho button',
      'Flow must be restored to flow_enabled=false in Sheets after the run'
    ]
  };
}

export function buildProductionReport({
  baseUrl,
  startedAt,
  completedAt,
  scenarios,
  manualChecks
}) {
  const allowedScenarioKeys = [
    'name',
    'order_id',
    'order_number',
    'final_status',
    'statuses',
    'security_checks',
    'manual_expectations'
  ];

  return {
    ok: true,
    base_url: normalizeBaseUrl(baseUrl),
    started_at: startedAt,
    completed_at: completedAt,
    scenarios: (scenarios || []).map(scenario => Object.fromEntries(
      allowedScenarioKeys
        .filter(key => scenario[key] !== undefined)
        .map(key => [key, scenario[key]])
    )),
    manual_checks: manualChecks || []
  };
}

export async function runProductionTelegramE2E(argv = process.argv.slice(2), env = process.env) {
  if (env.GITHUB_ACTIONS !== 'true') {
    throw new Error('Telegram production E2E must run only from GitHub Actions production environment.');
  }

  const args = parseArgs(argv, env);
  assert(args.runTransfer || args.runExpired || args.runFlowReal, 'Enable at least one scenario');

  requireEnv(env, [
    'TELEGRAM_WEBHOOK_SECRET',
    'TELEGRAM_ACTION_SECRET',
    'TELEGRAM_CHAT_ID',
    'TELEGRAM_OPERATOR_IDS'
  ]);

  const secrets = getSecretValues(env);
  const startedAt = new Date().toISOString();
  const scenarios = [];
  const manualChecks = [
    'Confirm Telegram messages arrived in the Roast operations group within 2 minutes',
    'Confirm Eventos.notification_results_json records telegram results',
    'Confirm Sheets rows for Ventas, Pagos_Flow, Clientes and Eventos match scenario statuses'
  ];

  await checkHealth(args.baseUrl);

  if (args.runTransfer) {
    scenarios.push(await runTransferScenario(args.baseUrl, env, secrets));
  }

  if (args.runExpired) {
    scenarios.push(await runExpiredScenario(args.baseUrl, env, secrets));
  }

  if (args.runFlowReal) {
    console.log('::warning title=Flow prerequisite::Before this run, Config.settings flow_enabled must be true in Sheets.');
    scenarios.push(await runFlowRealScenario(args.baseUrl, env, secrets, args.flowPaymentWaitMs));
  }

  const report = buildProductionReport({
    baseUrl: args.baseUrl,
    startedAt,
    completedAt: new Date().toISOString(),
    scenarios,
    manualChecks
  });
  assertNoSecretLeak(report, secrets);

  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runProductionTelegramE2E().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
