import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';

import worker from '../../worker/src/index.js';
import {
  CLIENT_HEADERS,
  EVENT_HEADERS,
  LINE_HEADERS,
  PAYMENT_HEADERS,
  SALES_HEADERS,
  syncPaymentStatus
} from '../../worker/src/lib/orders.js';
import { notifyOperationalEventWithResults } from '../../worker/src/lib/notifications.js';
import { base64UrlEncodeString, decodeBase64Json, hmacSha256Hex } from '../../worker/src/lib/utils.js';

let serviceAccountJson;

function createContext() {
  return {
    waitUntil() {}
  };
}

function getServiceAccountJson() {
  if (!serviceAccountJson) {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      },
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      }
    });

    serviceAccountJson = JSON.stringify({
      client_email: 'worker-test@example.iam.gserviceaccount.com',
      private_key: privateKey
    });
  }

  return serviceAccountJson;
}

function installFetchMock(t, handler) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    return handler(url, init);
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

function rowsFromObjects(headers, rows) {
  return [
    headers,
    ...rows.map(row => headers.map(header => row[header] ?? ''))
  ];
}

function sheetNameFromAppendUrl(url) {
  const match = url.match(/\/values\/([^/!]+)!A%3AAZ:append/);
  return match ? decodeURIComponent(match[1]) : '';
}

function objectFromRow(headers, row) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index]]));
}

async function buildTestActionId(secret, orderId, status, expiresAt = Math.floor(Date.now() / 1000) + 3600) {
  const encoded = base64UrlEncodeString(JSON.stringify({
    v: 1,
    o: orderId,
    s: status,
    e: expiresAt
  }));
  const signature = (await hmacSha256Hex(secret, encoded)).slice(0, 32);
  return `${encoded}.${signature}`;
}

async function assertActionPayload(payload, secret, orderId, status) {
  const [encoded, signature] = String(payload || '').split('.');
  assert.ok(encoded, 'payload has encoded body');
  assert.ok(signature, 'payload has signature');
  assert.equal(signature, (await hmacSha256Hex(secret, encoded)).slice(0, 32));

  const decoded = decodeBase64Json(encoded);
  assert.equal(decoded.v, 1);
  assert.equal(decoded.o, orderId);
  assert.equal(decoded.s, status);
  assert.ok(decoded.e > Math.floor(Date.now() / 1000));
}

async function signedWebhookRequest(url, appSecret, body) {
  const rawBody = JSON.stringify(body);
  const signature = await hmacSha256Hex(appSecret, rawBody);

  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': `sha256=${signature}`
    },
    body: rawBody
  });
}

function whatsappButtonPayload(from, actionId) {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          metadata: {
            phone_number_id: 'phone_123'
          },
          messages: [{
            from,
            id: 'wamid.button',
            timestamp: '1778760000',
            type: 'interactive',
            interactive: {
              type: 'button_reply',
              button_reply: {
                id: actionId,
                title: 'Confirmar pago'
              }
            }
          }]
        }
      }]
    }]
  };
}

function installOrderSheetsMock(t, { status = 'pending_transfer', graphRequests = [] } = {}) {
  const appended = {
    Eventos: []
  };
  const updates = [];

  installFetchMock(t, async (url, init = {}) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      return jsonResponse({ access_token: 'test-access-token', expires_in: 3600 });
    }

    if (url === 'https://graph.facebook.com/v20.0/phone_123/messages') {
      graphRequests.push(JSON.parse(init.body));
      return jsonResponse({ messages: [{ id: `wamid.${graphRequests.length}` }] }, 200);
    }

    const sheetName = sheetNameFromAppendUrl(url);
    if (sheetName) {
      const body = JSON.parse(init.body);
      appended[sheetName].push(body.values[0]);
      return jsonResponse({ updates: { updatedRows: 1 } });
    }

    if (init.method === 'PUT' && url.includes('/values/Ventas!')) {
      updates.push({ sheet: 'Ventas', row: objectFromRow(SALES_HEADERS, JSON.parse(init.body).values[0]) });
      return jsonResponse({ updatedRows: 1 });
    }

    if (init.method === 'PUT' && url.includes('/values/Pagos_Flow!')) {
      updates.push({ sheet: 'Pagos_Flow', row: objectFromRow(PAYMENT_HEADERS, JSON.parse(init.body).values[0]) });
      return jsonResponse({ updatedRows: 1 });
    }

    if (init.method === 'PUT' && url.includes('/values/Clientes!')) {
      updates.push({ sheet: 'Clientes', row: objectFromRow(CLIENT_HEADERS, JSON.parse(init.body).values[0]) });
      return jsonResponse({ updatedRows: 1 });
    }

    if (url.includes('/values/Ventas!A%3AAZ')) {
      return jsonResponse({
        values: rowsFromObjects(SALES_HEADERS, [{
          order_id: 'roast_internal_001',
          order_number: '0205789',
          customer_id: 'cus_001',
          customer_name: 'Camila Roast',
          email: 'cliente@example.com',
          phone: '+56991746361',
          commune: 'Providencia',
          address: 'Av. Siempre Viva 123',
          items_label: 'Downtime 1 kg',
          subtotal_clp: '36000',
          shipping_clp: '0',
          total_clp: '36000',
          internal_status: status,
          flow_order: 'flow_001',
          flow_token: 'flow_token_001',
          flow_checkout_url: 'https://flow.test/pay?token=flow_token_001'
        }])
      });
    }

    if (url.includes('/values/Pagos_Flow!A%3AAZ')) {
      return jsonResponse({
        values: rowsFromObjects(PAYMENT_HEADERS, [{
          payment_id: 'pay_001',
          order_id: 'roast_internal_001',
          flow_order: 'flow_001',
          token: 'flow_token_001',
          payment_url: 'https://flow.test/pay?token=flow_token_001',
          internal_status: status,
          amount_clp: '36000',
          payer_email: 'cliente@example.com',
          payment_method: status === 'pending_transfer' ? 'transfer' : 'flow'
        }])
      });
    }

    if (url.includes('/values/Clientes!A%3AAZ')) {
      return jsonResponse({
        values: rowsFromObjects(CLIENT_HEADERS, [{
          customer_id: 'cus_001',
          full_name: 'Camila Roast',
          email: 'cliente@example.com',
          order_count: '1',
          total_paid_clp: '0'
        }])
      });
    }

    if (url.includes('/values/Lineas_Pedido!A%3AAZ')) {
      return jsonResponse({
        values: rowsFromObjects(LINE_HEADERS, [{
          order_id: 'roast_internal_001',
          product_name: 'Downtime',
          format_label: '1 kg',
          grind: 'grano entero',
          quantity: '1',
          unit_price_clp: '36000',
          line_subtotal_clp: '36000'
        }])
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  return { appended, updates, graphRequests };
}

test('notifyOperationalEventWithResults sends transfer WhatsApp template with direct quick reply action payloads', async t => {
  const requests = [];

  installFetchMock(t, async (url, init = {}) => {
    if (url === 'https://api.resend.com/emails') {
      return jsonResponse({ id: 'email_operational' }, 202);
    }

    if (url === 'https://graph.facebook.com/v20.0/phone_123/messages') {
      requests.push(JSON.parse(init.body));
      return jsonResponse({ messages: [{ id: 'wamid.test' }] }, 200);
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  const result = await notifyOperationalEventWithResults(
    {
      RESEND_API_KEY: 'resend_test_key',
      WHATSAPP_CLOUD_TOKEN: 'whatsapp_test_token',
      WHATSAPP_PHONE_NUMBER_ID: 'phone_123',
      WHATSAPP_NOTIFY_TO: '+56911112222',
      WHATSAPP_TEMPLATE_ORDER_EVENT: 'roast_order_event',
      WHATSAPP_TEMPLATE_TRANSFER_ACTIONS: 'roast_transfer_actions',
      WHATSAPP_ACTION_SECRET: 'whatsapp-action-secret',
      ADMIN_ACTION_SECRET: 'admin-secret'
    },
    {
      event_type: 'pending_transfer',
      order_id: 'roast_internal_001',
      payload: {
        order_number: '0205789',
        confirmation_number: '0205789',
        customer_name: 'Camila Roast',
        email: 'cliente@example.com',
        total_clp: 36000
      }
    }
  );

  assert.equal(result.channels.whatsapp.ok, true);
  assert.equal(requests.length, 1);

  const template = requests[0].template;
  assert.equal(template.name, 'roast_transfer_actions');
  assert.equal(template.components[0].type, 'body');
  assert.deepEqual(
    template.components[0].parameters.map(parameter => parameter.text),
    ['0205789', 'pending_transfer', 'Camila Roast', '$36.000 CLP', 'pending_transfer']
  );
  assert.equal(template.components[1].type, 'button');
  assert.equal(template.components[1].sub_type, 'quick_reply');
  assert.equal(template.components[1].index, '0');
  assert.equal(template.components[2].index, '1');
  await assertActionPayload(template.components[1].parameters[0].payload, 'whatsapp-action-secret', 'roast_internal_001', 'paid');
  await assertActionPayload(template.components[2].parameters[0].payload, 'whatsapp-action-secret', 'roast_internal_001', 'expired');
  assert.doesNotMatch(JSON.stringify(requests[0]), /admin-secret|confirm-transfer|set-status/);
});

test('POST /api/whatsapp/webhook confirms transfer from an authorized button reply', async t => {
  const { appended, updates, graphRequests } = installOrderSheetsMock(t, { status: 'pending_transfer' });
  const actionId = await buildTestActionId('whatsapp-action-secret', 'roast_internal_001', 'paid');
  const request = await signedWebhookRequest(
    'https://caferoast.cl/api/whatsapp/webhook',
    'meta-app-secret',
    whatsappButtonPayload('56911112222', actionId)
  );

  const response = await worker.fetch(
    request,
    {
      GOOGLE_SHEET_ID: 'test-sheet',
      GOOGLE_SERVICE_ACCOUNT_JSON: getServiceAccountJson(),
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'verify-token',
      WHATSAPP_APP_SECRET: 'meta-app-secret',
      WHATSAPP_ACTION_SECRET: 'whatsapp-action-secret',
      WHATSAPP_NOTIFY_TO: '+56911112222',
      WHATSAPP_OPERATOR_PHONES: '+56911112222',
      WHATSAPP_CLOUD_TOKEN: 'whatsapp-token',
      WHATSAPP_PHONE_NUMBER_ID: 'phone_123',
      WHATSAPP_TEMPLATE_PAID_ACTIONS: 'roast_paid_actions'
    },
    createContext()
  );
  const payload = await response.json();

  assert.equal(response.status, 200, payload.error);
  assert.equal(payload.ok, true);
  assert.equal(payload.results[0].internal_status, 'paid');
  assert.equal(updates.find(update => update.sheet === 'Ventas').row.internal_status, 'paid');
  assert.equal(updates.find(update => update.sheet === 'Pagos_Flow').row.internal_status, 'paid');
  assert.equal(updates.find(update => update.sheet === 'Clientes').row.total_paid_clp, '36000');
  const eventRow = objectFromRow(EVENT_HEADERS, appended.Eventos[0]);
  assert.equal(eventRow.source, 'api/whatsapp/webhook');
  assert.equal(eventRow.event_type, 'paid');
  assert.equal(JSON.parse(eventRow.payload_json).confirmation_number, '0205789');
  assert.equal(graphRequests[0].template.name, 'roast_paid_actions');
});

test('POST /api/whatsapp/webhook rejects an invalid Meta signature before touching Sheets', async t => {
  installFetchMock(t, async url => {
    throw new Error(`Unexpected fetch: ${url}`);
  });

  const response = await worker.fetch(
    new Request('https://caferoast.cl/api/whatsapp/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=bad'
      },
      body: JSON.stringify(whatsappButtonPayload('56911112222', 'bad-action'))
    }),
    {
      WHATSAPP_APP_SECRET: 'meta-app-secret',
      WHATSAPP_ACTION_SECRET: 'whatsapp-action-secret',
      WHATSAPP_NOTIFY_TO: '+56911112222'
    },
    createContext()
  );
  const payload = await response.json();

  assert.equal(response.status, 403);
  assert.equal(payload.ok, false);
  assert.match(payload.error, /Invalid WhatsApp webhook signature/);
});

test('POST /api/whatsapp/webhook rejects button replies from phones outside the operator allowlist', async t => {
  installFetchMock(t, async url => {
    throw new Error(`Unexpected fetch: ${url}`);
  });

  const actionId = await buildTestActionId('whatsapp-action-secret', 'roast_internal_001', 'paid');
  const request = await signedWebhookRequest(
    'https://caferoast.cl/api/whatsapp/webhook',
    'meta-app-secret',
    whatsappButtonPayload('56999999999', actionId)
  );

  const response = await worker.fetch(
    request,
    {
      WHATSAPP_APP_SECRET: 'meta-app-secret',
      WHATSAPP_ACTION_SECRET: 'whatsapp-action-secret',
      WHATSAPP_NOTIFY_TO: '+56911112222',
      WHATSAPP_OPERATOR_PHONES: '+56911112222'
    },
    createContext()
  );
  const payload = await response.json();

  assert.equal(response.status, 403);
  assert.equal(payload.ok, false);
  assert.match(payload.error, /not authorized/);
});

test('GET /api/whatsapp/webhook verifies the Meta challenge token without exposing secrets', async () => {
  const response = await worker.fetch(
    new Request('https://caferoast.cl/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=challenge-123'),
    {
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'verify-token'
    },
    createContext()
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'challenge-123');

  const rejected = await worker.fetch(
    new Request('https://caferoast.cl/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=bad-token&hub.challenge=challenge-123'),
    {
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'verify-token'
    },
    createContext()
  );
  const payload = await rejected.json();

  assert.equal(rejected.status, 403);
  assert.equal(payload.ok, false);
  assert.doesNotMatch(JSON.stringify(payload), /verify-token/);
});

test('syncPaymentStatus enriches Flow paid WhatsApp notification with customer data and next action', async t => {
  const appended = {
    Eventos: []
  };
  const updates = [];
  const graphRequests = [];

  installFetchMock(t, async (url, init = {}) => {
    if (url.startsWith('https://www.flow.cl/api/payment/getStatus')) {
      return jsonResponse({
        commerceOrder: 'roast_internal_001',
        flowOrder: 12345,
        status: 2,
        amount: 36000,
        payer: 'cliente@example.com',
        paymentData: {
          media: 'flow',
          date: '2026-05-14 10:30:00'
        }
      });
    }

    if (url === 'https://oauth2.googleapis.com/token') {
      return jsonResponse({ access_token: 'test-access-token', expires_in: 3600 });
    }

    if (url === 'https://graph.facebook.com/v20.0/phone_123/messages') {
      graphRequests.push(JSON.parse(init.body));
      return jsonResponse({ messages: [{ id: `wamid.${graphRequests.length}` }] }, 200);
    }

    const sheetName = sheetNameFromAppendUrl(url);
    if (sheetName) {
      const body = JSON.parse(init.body);
      appended[sheetName].push(body.values[0]);
      return jsonResponse({ updates: { updatedRows: 1 } });
    }

    if (init.method === 'PUT' && url.includes('/values/Ventas!')) {
      updates.push({ sheet: 'Ventas', row: objectFromRow(SALES_HEADERS, JSON.parse(init.body).values[0]) });
      return jsonResponse({ updatedRows: 1 });
    }

    if (init.method === 'PUT' && url.includes('/values/Pagos_Flow!')) {
      updates.push({ sheet: 'Pagos_Flow', row: objectFromRow(PAYMENT_HEADERS, JSON.parse(init.body).values[0]) });
      return jsonResponse({ updatedRows: 1 });
    }

    if (init.method === 'PUT' && url.includes('/values/Clientes!')) {
      updates.push({ sheet: 'Clientes', row: objectFromRow(CLIENT_HEADERS, JSON.parse(init.body).values[0]) });
      return jsonResponse({ updatedRows: 1 });
    }

    if (url.includes('/values/Ventas!A%3AAZ')) {
      return jsonResponse({
        values: rowsFromObjects(SALES_HEADERS, [{
          order_id: 'roast_internal_001',
          order_number: '0205789',
          customer_id: 'cus_001',
          customer_name: 'Camila Roast',
          email: 'cliente@example.com',
          phone: '+56991746361',
          commune: 'Providencia',
          address: 'Av. Siempre Viva 123',
          items_label: 'Downtime 1 kg',
          subtotal_clp: '36000',
          shipping_clp: '0',
          total_clp: '36000',
          internal_status: 'link_sent',
          flow_order: 'flow_001',
          flow_token: 'flow_token_001',
          flow_checkout_url: 'https://flow.test/pay?token=flow_token_001'
        }])
      });
    }

    if (url.includes('/values/Pagos_Flow!A%3AAZ')) {
      return jsonResponse({
        values: rowsFromObjects(PAYMENT_HEADERS, [{
          payment_id: 'pay_001',
          order_id: 'roast_internal_001',
          flow_order: 'flow_001',
          token: 'flow_token_001',
          payment_url: 'https://flow.test/pay?token=flow_token_001',
          internal_status: 'link_sent',
          amount_clp: '36000',
          payer_email: 'cliente@example.com',
          payment_method: 'flow'
        }])
      });
    }

    if (url.includes('/values/Clientes!A%3AAZ')) {
      return jsonResponse({
        values: rowsFromObjects(CLIENT_HEADERS, [{
          customer_id: 'cus_001',
          full_name: 'Camila Roast',
          email: 'cliente@example.com',
          order_count: '1',
          total_paid_clp: '0'
        }])
      });
    }

    if (url.includes('/values/Lineas_Pedido!A%3AAZ')) {
      return jsonResponse({
        values: rowsFromObjects(LINE_HEADERS, [{
          order_id: 'roast_internal_001',
          product_name: 'Downtime',
          format_label: '1 kg',
          grind: 'grano entero',
          quantity: '1',
          unit_price_clp: '36000',
          line_subtotal_clp: '36000'
        }])
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  const result = await syncPaymentStatus(
    {
      GOOGLE_SHEET_ID: 'test-sheet',
      GOOGLE_SERVICE_ACCOUNT_JSON: getServiceAccountJson(),
      FLOW_API_KEY: 'flow-key',
      FLOW_SECRET_KEY: 'flow-secret',
      WHATSAPP_CLOUD_TOKEN: 'whatsapp-token',
      WHATSAPP_PHONE_NUMBER_ID: 'phone_123',
      WHATSAPP_NOTIFY_TO: '+56911112222',
      WHATSAPP_TEMPLATE_PAID_ACTIONS: 'roast_paid_actions',
      WHATSAPP_ACTION_SECRET: 'whatsapp-action-secret'
    },
    'flow_token_001',
    'api/flow/confirmation'
  );

  assert.equal(result.internal_status, 'paid');
  assert.equal(updates.find(update => update.sheet === 'Ventas').row.internal_status, 'paid');
  assert.equal(updates.find(update => update.sheet === 'Clientes').row.total_paid_clp, '36000');

  const eventRow = objectFromRow(EVENT_HEADERS, appended.Eventos[0]);
  const eventPayload = JSON.parse(eventRow.payload_json);
  assert.equal(eventRow.event_type, 'paid');
  assert.equal(eventPayload.customer_name, 'Camila Roast');
  assert.equal(eventPayload.total_clp, 36000);
  assert.equal(eventPayload.payment_method, 'flow');
  assert.equal(graphRequests.length, 1);
  assert.equal(graphRequests[0].template.name, 'roast_paid_actions');
  assert.deepEqual(
    graphRequests[0].template.components[0].parameters.map(parameter => parameter.text),
    ['0205789', 'paid', 'Camila Roast', '$36.000 CLP', 'paid']
  );
  await assertActionPayload(
    graphRequests[0].template.components[1].parameters[0].payload,
    'whatsapp-action-secret',
    'roast_internal_001',
    'delivering'
  );
});
