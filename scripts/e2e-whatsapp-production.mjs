#!/usr/bin/env node

import { createHmac } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const DEFAULT_BASE_URL = 'https://caferoast.cl';
const DEFAULT_FLOW_PAYMENT_WAIT_SECONDS = 15 * 60;
const ORDER_NUMBER_PATTERN = /^\d{7}$/;
const NOTE_PREFIX = 'NO PREPARAR - TEST WHATSAPP';
const CUSTOMER_EMAIL = 'gosepulvedah@gmail.com';
const CUSTOMER_PHONE = '+56991746361';
const CUSTOMER_COMMUNE = 'Penalolen';
const CUSTOMER_ADDRESS = 'Avenida Consistorial 2320, Casa 1';
const ACTION_VERSION = 1;
const ACTION_TTL_SECONDS = 7 * 24 * 60 * 60;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeBaseUrl(value) {
  return new URL(value || DEFAULT_BASE_URL).origin;
}

function normalizePhone(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

function parseBoolean(value, flagName) {
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'si', 'sí'].includes(normalized)) return true;
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

function base64UrlEncodeString(value) {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function hmacSha256Hex(secret, value) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export async function buildWhatsAppActionId(secret, orderId, status, expiresAt = nowSeconds() + ACTION_TTL_SECONDS) {
  assert(secret, 'WHATSAPP_ACTION_SECRET is required');
  assert(orderId, 'orderId is required');
  assert(status, 'status is required');

  const encoded = base64UrlEncodeString(JSON.stringify({
    v: ACTION_VERSION,
    o: String(orderId),
    s: String(status),
    e: Number(expiresAt)
  }));
  const signature = hmacSha256Hex(secret, encoded).slice(0, 32);

  return `${encoded}.${signature}`;
}

export async function signMetaBody(appSecret, rawBody) {
  assert(appSecret, 'WHATSAPP_APP_SECRET is required');
  return `sha256=${hmacSha256Hex(appSecret, rawBody)}`;
}

export function buildMetaWebhookPayload({
  from,
  phoneNumberId,
  actionId,
  messageId = `wamid.roast-e2e-${Date.now()}`
}) {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            phone_number_id: String(phoneNumberId || '')
          },
          messages: [{
            from: normalizePhone(from),
            id: messageId,
            timestamp: String(nowSeconds()),
            type: 'interactive',
            interactive: {
              type: 'button_reply',
              button_reply: {
                id: actionId,
                title: 'Roast E2E'
              }
            }
          }]
        }
      }]
    }]
  };
}

function buildUrl(baseUrl, pathname) {
  return new URL(pathname, baseUrl);
}

async function requestText(baseUrl, pathname, options = {}) {
  const response = await fetch(buildUrl(baseUrl, pathname), options);
  const text = await response.text();
  return { response, text };
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
  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`${options.label || pathname} returned non-JSON: ${text.slice(0, 180)}`);
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
    env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    env.WHATSAPP_APP_SECRET,
    env.WHATSAPP_ACTION_SECRET,
    env.WHATSAPP_CLOUD_TOKEN
  ].filter(value => String(value || '').trim());
}

export function assertNoSecretLeak(value, secrets) {
  const serialized = JSON.stringify(value);

  for (const secret of secrets) {
    const normalized = String(secret || '').trim();
    if (normalized && serialized.includes(normalized)) {
      throw new Error('Secret value leaked into WhatsApp E2E output');
    }
  }
}

function requireEnv(env, names) {
  const missing = names.filter(name => !String(env[name] || '').trim());
  if (missing.length) {
    throw new Error(`Missing required production secrets: ${missing.join(', ')}`);
  }
}

function getAllowedPhones(env) {
  const phones = String(env.WHATSAPP_OPERATOR_PHONES || '')
    .split(',')
    .map(normalizePhone)
    .filter(Boolean);
  const notifyTo = normalizePhone(env.WHATSAPP_NOTIFY_TO);

  if (notifyTo) phones.push(notifyTo);

  return [...new Set(phones)];
}

function pickAuthorizedPhone(env) {
  const phone = getAllowedPhones(env)[0];
  if (!phone) {
    throw new Error('WHATSAPP_OPERATOR_PHONES or WHATSAPP_NOTIFY_TO is required for authorized webhook tests');
  }
  return phone;
}

export function pickUnauthorizedPhone(env) {
  const allowed = new Set(getAllowedPhones(env));

  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = `569000000${String(suffix).padStart(2, '0')}`;
    if (!allowed.has(candidate)) {
      return candidate;
    }
  }

  throw new Error('Unable to derive an unauthorized WhatsApp test phone');
}

async function checkHealth(baseUrl) {
  const result = await requestJson(baseUrl, '/api/health', {
    label: 'GET /api/health'
  });
  const payload = assertOkJson(result, 'GET /api/health');
  const configuration = payload.configuration || {};

  assert(configuration.google_sheets === true, 'GET /api/health expected google_sheets=true');
  assert(configuration.resend === true, 'GET /api/health expected resend=true');
  assert(configuration.admin_actions === true, 'GET /api/health expected admin_actions=true');
  assert(configuration.whatsapp === true, 'GET /api/health expected whatsapp=true');
  assert(configuration.whatsapp_actions === true, 'GET /api/health expected whatsapp_actions=true');

  return configuration;
}

async function checkWebhookVerification(baseUrl, env, secrets) {
  const challenge = `roast-whatsapp-e2e-${Date.now()}`;
  const successPath = `/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(env.WHATSAPP_WEBHOOK_VERIFY_TOKEN)}&hub.challenge=${encodeURIComponent(challenge)}`;
  const success = await requestText(baseUrl, successPath);

  assert(success.response.status === 200, `webhook verification expected HTTP 200, got ${success.response.status}`);
  assert(success.text === challenge, 'webhook verification must echo the challenge exactly');

  const rejected = await requestJson(
    baseUrl,
    `/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=bad-token&hub.challenge=${encodeURIComponent(challenge)}`,
    { label: 'GET /api/whatsapp/webhook rejected challenge' }
  );

  assert(rejected.response.status === 403, `bad webhook token expected HTTP 403, got ${rejected.response.status}`);
  assertNoSecretLeak(rejected.payload, secrets);

  return { ok: true };
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
    channel: 'github_actions_whatsapp_e2e',
    origin: 'whatsapp_e2e_production',
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
    channel: 'github_actions_whatsapp_e2e',
    origin: 'whatsapp_e2e_flow_production',
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
  const [encoded, signature] = String(actionId).split('.');
  const last = signature.slice(-1) === '0' ? '1' : '0';
  return `${encoded}.${signature.slice(0, -1)}${last}`;
}

async function postWebhookAction(baseUrl, env, {
  orderId,
  status,
  from,
  expectedHttp = 200,
  expectedStatus = status,
  expiresAt,
  actionId,
  signatureOverride,
  secrets,
  messageId
}) {
  const resolvedActionId = actionId || await buildWhatsAppActionId(env.WHATSAPP_ACTION_SECRET, orderId, status, expiresAt);
  const body = JSON.stringify(buildMetaWebhookPayload({
    from,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    actionId: resolvedActionId,
    messageId
  }));
  const signature = signatureOverride === undefined
    ? await signMetaBody(env.WHATSAPP_APP_SECRET, body)
    : signatureOverride;
  const result = await requestJson(baseUrl, '/api/whatsapp/webhook', {
    label: `POST /api/whatsapp/webhook ${status}`,
    method: 'POST',
    headers: {
      'x-hub-signature-256': signature
    },
    body
  });

  assert(
    result.response.status === expectedHttp,
    `POST /api/whatsapp/webhook ${status} expected HTTP ${expectedHttp}, got ${result.response.status}: ${result.text}`
  );
  assertNoSecretLeak(result.payload, secrets || []);

  if (expectedHttp < 400) {
    assert(result.payload.ok === true, `POST /api/whatsapp/webhook ${status} expected ok=true`);
    assert(
      result.payload.results?.[0]?.internal_status === expectedStatus,
      `POST /api/whatsapp/webhook ${status} expected result status ${expectedStatus}`
    );
  }

  return result.payload;
}

async function runSecurityChecks(baseUrl, env, order, authorizedPhone, unauthorizedPhone, secrets) {
  const checks = [];

  await fetchOrder(baseUrl, order.order_id, 'pending_transfer');

  await postWebhookAction(baseUrl, env, {
    orderId: order.order_id,
    status: 'paid',
    from: authorizedPhone,
    signatureOverride: 'sha256=bad',
    expectedHttp: 403,
    secrets,
    messageId: `wamid.security.bad-signature.${Date.now()}`
  });
  await fetchOrder(baseUrl, order.order_id, 'pending_transfer');
  checks.push('invalid_signature_rejected');

  await postWebhookAction(baseUrl, env, {
    orderId: order.order_id,
    status: 'paid',
    from: unauthorizedPhone,
    expectedHttp: 403,
    secrets,
    messageId: `wamid.security.unauthorized.${Date.now()}`
  });
  await fetchOrder(baseUrl, order.order_id, 'pending_transfer');
  checks.push('unauthorized_phone_rejected');

  await postWebhookAction(baseUrl, env, {
    orderId: order.order_id,
    status: 'paid',
    from: authorizedPhone,
    expectedHttp: 403,
    expiresAt: nowSeconds() - 60,
    secrets,
    messageId: `wamid.security.expired.${Date.now()}`
  });
  await fetchOrder(baseUrl, order.order_id, 'pending_transfer');
  checks.push('expired_action_rejected');

  const validActionId = await buildWhatsAppActionId(env.WHATSAPP_ACTION_SECRET, order.order_id, 'paid');
  await postWebhookAction(baseUrl, env, {
    orderId: order.order_id,
    status: 'paid',
    from: authorizedPhone,
    expectedHttp: 403,
    actionId: tamperActionId(validActionId),
    secrets,
    messageId: `wamid.security.tampered.${Date.now()}`
  });
  await fetchOrder(baseUrl, order.order_id, 'pending_transfer');
  checks.push('tampered_action_rejected');

  return checks;
}

async function runTransferScenario(baseUrl, env, secrets) {
  const authorizedPhone = pickAuthorizedPhone(env);
  const unauthorizedPhone = pickUnauthorizedPhone(env);
  const created = await createTransferOrder(baseUrl, 'TRANSFER');
  const statuses = ['pending_transfer'];
  const securityChecks = await runSecurityChecks(baseUrl, env, created, authorizedPhone, unauthorizedPhone, secrets);

  const paidActionId = await buildWhatsAppActionId(env.WHATSAPP_ACTION_SECRET, created.order_id, 'paid');
  await postWebhookAction(baseUrl, env, {
    orderId: created.order_id,
    status: 'paid',
    from: authorizedPhone,
    actionId: paidActionId,
    expectedStatus: 'paid',
    secrets,
    messageId: `wamid.transfer.paid.${Date.now()}`
  });
  await fetchOrder(baseUrl, created.order_id, 'paid');
  statuses.push('paid');

  const duplicate = await postWebhookAction(baseUrl, env, {
    orderId: created.order_id,
    status: 'paid',
    from: authorizedPhone,
    actionId: paidActionId,
    expectedStatus: 'paid',
    secrets,
    messageId: `wamid.transfer.duplicate-paid.${Date.now()}`
  });
  assert(duplicate.results?.[0]?.already_status === true, 'duplicate paid action should report already_status=true');
  securityChecks.push('duplicate_action_idempotent');

  await postWebhookAction(baseUrl, env, {
    orderId: created.order_id,
    status: 'expired',
    from: authorizedPhone,
    expectedHttp: 409,
    secrets,
    messageId: `wamid.transfer.invalid-expired.${Date.now()}`
  });
  await fetchOrder(baseUrl, created.order_id, 'paid');
  securityChecks.push('invalid_transition_rejected');

  await postWebhookAction(baseUrl, env, {
    orderId: created.order_id,
    status: 'delivering',
    from: authorizedPhone,
    expectedStatus: 'delivering',
    secrets,
    messageId: `wamid.transfer.delivering.${Date.now()}`
  });
  await fetchOrder(baseUrl, created.order_id, 'delivering');
  statuses.push('delivering');

  await postWebhookAction(baseUrl, env, {
    orderId: created.order_id,
    status: 'delivered',
    from: authorizedPhone,
    expectedStatus: 'delivered',
    secrets,
    messageId: `wamid.transfer.delivered.${Date.now()}`
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
      'Initial WhatsApp pending_transfer with Confirmar pago and Expirar buttons',
      'Paid WhatsApp with En despacho button',
      'Delivering WhatsApp with Entregado button'
    ]
  };
}

async function runExpiredScenario(baseUrl, env, secrets) {
  const authorizedPhone = pickAuthorizedPhone(env);
  const created = await createTransferOrder(baseUrl, 'EXPIRED');

  await postWebhookAction(baseUrl, env, {
    orderId: created.order_id,
    status: 'expired',
    from: authorizedPhone,
    expectedStatus: 'expired',
    secrets,
    messageId: `wamid.expired.${Date.now()}`
  });
  await fetchOrder(baseUrl, created.order_id, 'expired');

  return {
    name: 'transfer_expired',
    order_id: created.order_id,
    order_number: created.confirmation_number,
    final_status: 'expired',
    statuses: ['pending_transfer', 'expired'],
    manual_expectations: [
      'Initial WhatsApp pending_transfer with Expirar button'
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
  const authorizedPhone = pickAuthorizedPhone(env);
  const draft = await createFlowDraft(baseUrl, 'FLOW');
  const link = await createFlowPaymentLink(baseUrl, draft.order_id);

  console.log(`::notice title=Flow payment URL::${link.checkout_url}`);
  console.log('::warning title=Flow cleanup::Restore Config.settings flow_enabled=false after this run and handle any real payment reversal manually if needed.');

  await waitForOrderStatus(baseUrl, draft.order_id, 'paid', flowPaymentWaitMs);

  await postWebhookAction(baseUrl, env, {
    orderId: draft.order_id,
    status: 'delivering',
    from: authorizedPhone,
    expectedStatus: 'delivering',
    secrets,
    messageId: `wamid.flow.delivering.${Date.now()}`
  });
  await fetchOrder(baseUrl, draft.order_id, 'delivering');

  await postWebhookAction(baseUrl, env, {
    orderId: draft.order_id,
    status: 'delivered',
    from: authorizedPhone,
    expectedStatus: 'delivered',
    secrets,
    messageId: `wamid.flow.delivered.${Date.now()}`
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
      'Paid WhatsApp arrives with En despacho button',
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

export async function runProductionWhatsAppE2E(argv = process.argv.slice(2), env = process.env) {
  if (env.GITHUB_ACTIONS !== 'true') {
    throw new Error('WhatsApp production E2E must run only from GitHub Actions production environment.');
  }

  const args = parseArgs(argv, env);
  assert(args.runTransfer || args.runExpired || args.runFlowReal, 'Enable at least one scenario');

  requireEnv(env, [
    'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
    'WHATSAPP_APP_SECRET',
    'WHATSAPP_ACTION_SECRET',
    'WHATSAPP_NOTIFY_TO',
    'WHATSAPP_PHONE_NUMBER_ID'
  ]);

  const secrets = getSecretValues(env);
  const startedAt = new Date().toISOString();
  const scenarios = [];
  const manualChecks = [
    'Confirm WhatsApp messages arrived on the Roast operational phone within 2 minutes',
    'Confirm Eventos.notification_results_json records meta_whatsapp results',
    'Confirm Sheets rows for Ventas, Pagos_Flow, Clientes and Eventos match scenario statuses'
  ];

  await checkHealth(args.baseUrl);
  await checkWebhookVerification(args.baseUrl, env, secrets);

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
  runProductionWhatsAppE2E().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
