#!/usr/bin/env node

import { createHmac } from 'node:crypto';

const DEFAULT_BASE_URL = 'https://caferoast.cl';
const CUSTOMER_EMAIL = 'gosepulvedah@gmail.com';
const CUSTOMER_ADDRESS = 'Avenida Consistorial 2320, Casa 1';
const CUSTOMER_COMMUNE = 'Peñalolén';
const NOTE_PREFIX = 'NO PREPARAR - TEST FUNCIONAL AUTOMATIZADO';
const ORDER_NUMBER_PATTERN = /^\d{7}$/;

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.PUBLIC_BASE_URL || DEFAULT_BASE_URL,
    includeExpired: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--base-url') {
      args.baseUrl = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--base-url=')) {
      args.baseUrl = arg.slice('--base-url='.length);
      continue;
    }

    if (arg === '--include-expired') {
      args.includeExpired = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeBaseUrl(value) {
  const url = new URL(value || DEFAULT_BASE_URL);
  return url.origin;
}

function buildUrl(baseUrl, pathname) {
  return new URL(pathname, baseUrl);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
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
    throw new Error(`${options.label || url.pathname} returned non-JSON: ${text.slice(0, 180)}`);
  }

  if (!response.ok || payload?.ok === false) {
    throw new Error(`${options.label || url.pathname} failed HTTP ${response.status}: ${payload?.error || text}`);
  }

  return payload;
}

function adminToken(secret, status, orderId) {
  return createHmac('sha256', secret)
    .update(`set-status:${status}:${orderId}`)
    .digest('hex');
}

async function checkHealth(baseUrl) {
  const payload = await fetchJson(buildUrl(baseUrl, '/api/health'), {
    label: 'GET /api/health'
  });
  assert(payload?.configuration?.google_sheets === true, 'Google Sheets must be configured in production health');
  assert(payload?.configuration?.google_maps === true, 'Google Maps must be configured in production health');
  assert(payload?.configuration?.resend === true, 'Resend must be configured in production health');
  assert(payload?.configuration?.admin_actions === true, 'Admin actions must be configured in production health');
}

function buildCheckoutPayload(label) {
  return {
    first_name: 'Smoke',
    last_name: 'Roast',
    email: CUSTOMER_EMAIL,
    phone: '+56991746361',
    commune: CUSTOMER_COMMUNE,
    address: CUSTOMER_ADDRESS,
    address_ref: '',
    notes: `${NOTE_PREFIX} - ${label}`,
    payment_method: 'transfer',
    accept_terms: true,
    channel: 'github_actions_e2e',
    origin: 'purchase_e2e_production',
    items: [
      {
        product_code: 'downtime',
        format_code: '250g',
        grind: 'grano entero',
        quantity: 1
      }
    ]
  };
}

async function createProductionOrder(baseUrl, label) {
  const payload = await fetchJson(buildUrl(baseUrl, '/api/checkout-orders'), {
    label: `POST /api/checkout-orders ${label}`,
    method: 'POST',
    body: JSON.stringify(buildCheckoutPayload(label))
  });

  assert(payload.internal_status === 'pending_transfer', `${label} expected pending_transfer, got ${payload.internal_status}`);
  assert(ORDER_NUMBER_PATTERN.test(payload.confirmation_number || ''), `${label} expected DDMMRRR confirmation number`);
  assert(payload.order_number === payload.confirmation_number, `${label} expected order_number and confirmation_number to match`);
  assert(payload.order_id, `${label} expected order_id`);

  return payload;
}

async function fetchOrder(baseUrl, orderId, expectedStatus, expectedNumber) {
  const payload = await fetchJson(buildUrl(baseUrl, `/api/orders/${encodeURIComponent(orderId)}`), {
    label: `GET /api/orders/${orderId}`
  });

  assert(payload.internal_status === expectedStatus, `expected ${orderId} status ${expectedStatus}, got ${payload.internal_status}`);
  assert(payload.confirmation_number === expectedNumber, `expected ${orderId} confirmation number to remain ${expectedNumber}`);
  assert(payload.items_label && /Downtime/i.test(payload.items_label), `expected ${orderId} items_label to include Downtime`);

  return payload;
}

async function setStatus(baseUrl, secret, orderId, status, expectedNumber) {
  const payload = await fetchJson(buildUrl(baseUrl, `/api/admin/orders/${encodeURIComponent(orderId)}/status`), {
    label: `POST admin status ${status}`,
    method: 'POST',
    body: JSON.stringify({
      token: adminToken(secret, status, orderId),
      status
    })
  });

  assert(payload.internal_status === status, `expected admin status response ${status}, got ${payload.internal_status}`);
  assert(payload.confirmation_number === expectedNumber, `expected admin status ${status} to keep ${expectedNumber}`);
  return payload;
}

async function runPaidDeliveringDelivered(baseUrl, secret) {
  const created = await createProductionOrder(baseUrl, 'paid-delivering-delivered');
  const orderId = created.order_id;
  const orderNumber = created.confirmation_number;

  await fetchOrder(baseUrl, orderId, 'pending_transfer', orderNumber);
  await setStatus(baseUrl, secret, orderId, 'paid', orderNumber);
  await fetchOrder(baseUrl, orderId, 'paid', orderNumber);
  await setStatus(baseUrl, secret, orderId, 'delivering', orderNumber);
  await fetchOrder(baseUrl, orderId, 'delivering', orderNumber);
  await setStatus(baseUrl, secret, orderId, 'delivered', orderNumber);
  await fetchOrder(baseUrl, orderId, 'delivered', orderNumber);

  return { orderId, orderNumber };
}

async function runExpired(baseUrl, secret) {
  const created = await createProductionOrder(baseUrl, 'expired');
  const orderId = created.order_id;
  const orderNumber = created.confirmation_number;

  await setStatus(baseUrl, secret, orderId, 'expired', orderNumber);
  await fetchOrder(baseUrl, orderId, 'expired', orderNumber);

  return { orderId, orderNumber };
}

async function main() {
  if (process.env.GITHUB_ACTIONS !== 'true') {
    throw new Error('Production purchase E2E must run only from GitHub Actions production environment.');
  }

  const secret = process.env.ADMIN_ACTION_SECRET || '';
  assert(secret, 'ADMIN_ACTION_SECRET is required in GitHub production secrets');

  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(args.baseUrl);

  await checkHealth(baseUrl);
  const mainOrder = await runPaidDeliveringDelivered(baseUrl, secret);
  console.log(`Production purchase E2E completed main order ${mainOrder.orderNumber} (${mainOrder.orderId})`);

  if (args.includeExpired) {
    const expiredOrder = await runExpired(baseUrl, secret);
    console.log(`Production purchase E2E completed expired order ${expiredOrder.orderNumber} (${expiredOrder.orderId})`);
  }

  console.log('Manual check: customer/operational emails should be visible in the configured mailboxes; every test order is marked NO PREPARAR.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
