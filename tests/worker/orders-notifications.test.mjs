import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import worker from '../../worker/src/index.js';
import {
  CLIENT_HEADERS,
  EVENT_HEADERS,
  LINE_HEADERS,
  PAYMENT_HEADERS,
  SALES_HEADERS,
  buildPendingTransferNotificationPayload
} from '../../worker/src/lib/orders.js';
import { notifyOperationalEvent, notifyOperationalEventWithResults } from '../../worker/src/lib/notifications.js';
import { hmacSha256Hex } from '../../worker/src/lib/utils.js';

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

function configRows() {
  return [
    ['settings'],
    ['key', 'value'],
    ['shipping_fee_clp', '3500'],
    ['free_shipping_threshold_clp', '36000'],
    ['flow_enabled', 'false'],
    ['catalog'],
    ['product_code', 'product_name', 'format_code', 'format_label', 'price_clp', 'unit_cost_clp', 'format_bucket', 'active'],
    ['downtime', 'Downtime', '1kg', '1 kg', '36000', '12000', '1kg', 'TRUE']
  ];
}

function sheetNameFromAppendUrl(url) {
  const match = url.match(/\/values\/([^/!]+)!A%3AAZ:append/);
  return match ? decodeURIComponent(match[1]) : '';
}

function objectFromRow(headers, row) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index]]));
}

function loadAppsScriptRuntime(sentMessages) {
  const source = readFileSync(new URL('../../apps-script/Code.js', import.meta.url), 'utf8');

  return vm.runInNewContext(
    `${source}\n({ doPost, buildCustomerConfirmationEmail, buildOperationalEmail });`,
    {
      console,
      ContentService: {
        MimeType: {
          JSON: 'application/json'
        },
        createTextOutput(content) {
          return {
            content,
            mimeType: '',
            setMimeType(mimeType) {
              this.mimeType = mimeType;
              return this;
            }
          };
        }
      },
      GmailApp: {
        getAliases() {
          return [];
        }
      },
      MailApp: {
        sendEmail(message) {
          sentMessages.push(message);
        }
      },
      PropertiesService: {
        getScriptProperties() {
          return {
            getProperty(name) {
              return name === 'APPS_SCRIPT_SHARED_SECRET' ? 'test-secret' : '';
            }
          };
        }
      },
      Utilities: {
        computeHmacSha256Signature() {
          return [1, 2, 3];
        }
      }
    }
  );
}

test('buildOrderNumber returns DDMM plus three random digits as a string', async () => {
  const utils = await import('../../worker/src/lib/utils.js');

  assert.equal(typeof utils.buildOrderNumber, 'function');
  if (typeof utils.buildOrderNumber !== 'function') return;

  const orderNumber = utils.buildOrderNumber(new Date('2026-05-02T15:00:00.000Z'), {
    getRandomValues(values) {
      values[0] = 789;
      return values;
    }
  });

  assert.equal(orderNumber, '0205789');
  assert.match(orderNumber, /^\d{7}$/);
});

test('pending transfer payload carries customer-facing confirmation number without replacing order_id', () => {
  const payload = buildPendingTransferNotificationPayload({
    env: { PUBLIC_BASE_URL: 'https://caferoast.cl/' },
    orderId: 'roast_internal_001',
    orderNumber: '0205789',
    customer: {
      customer_name: 'Camila Roast',
      first_name: 'Camila',
      email: 'cliente@example.com',
      phone: '+56991746361',
      commune: 'Providencia',
      address: 'Av. Siempre Viva 123'
    },
    salesRow: {
      origin: 'checkout_2_steps',
      channel: 'site_checkout'
    },
    communeCoverage: {
      sector: 'Oriente'
    },
    delivery: {
      formatted_address: 'Av. Siempre Viva 123, Providencia, Chile'
    },
    orderMetrics: {
      subtotal_clp: 36000,
      shipping_clp: 0,
      total_clp: 36000
    },
    responseItems: [],
    transferExpiresAt: '2026-05-02T15:00:00.000Z'
  });

  assert.equal(payload.order_id, 'roast_internal_001');
  assert.equal(payload.order_number, '0205789');
  assert.equal(payload.confirmation_number, '0205789');
});

test('notifyOperationalEvent treats HTTP 200 with ok:false JSON as a failed notification', async t => {
  installFetchMock(t, async () => jsonResponse({ ok: false, error: 'MailApp failed' }));

  const result = await notifyOperationalEvent(
    {
      APPS_SCRIPT_WEBHOOK_URL: 'https://script.google.com/macros/s/test/exec',
      APPS_SCRIPT_SHARED_SECRET: 'test-secret'
    },
    {
      event_type: 'pending_transfer',
      order_id: 'roast_internal_001'
    }
  );

  assert.equal(result, false);
});

test('notifyOperationalEvent sends pending transfer operational and customer emails through Resend', async t => {
  const requests = [];
  installFetchMock(t, async (url, init = {}) => {
    requests.push({
      url,
      headers: init.headers,
      body: JSON.parse(init.body)
    });
    return jsonResponse({ id: `email_${requests.length}` }, 202);
  });

  const result = await notifyOperationalEvent(
    {
      RESEND_API_KEY: 'resend_test_key',
      RESEND_FROM: 'Roast <orders@caferoast.cl>',
      RESEND_REPLY_TO: 'soporte@caferoast.cl'
    },
    {
      event_type: 'pending_transfer',
      order_id: 'roast_internal_001',
      recipient: 'operaciones@caferoast.cl',
      support_email: 'contacto@caferoast.cl',
      payload: {
        order_id: 'roast_internal_001',
        order_number: '0205789',
        confirmation_number: '0205789',
        first_name: 'Camila',
        customer_name: 'Camila Roast',
        email: 'cliente@example.com',
        phone: '+56991746361',
        commune: 'Providencia',
        address: 'Av. Siempre Viva 123',
        items: [
          {
            product_name: 'Downtime',
            format_label: '1 kg',
            grind: 'Grano entero',
            quantity: 1,
            line_subtotal_clp: 36000
          }
        ],
        subtotal_clp: 36000,
        shipping_clp: 0,
        tax_included_clp: 5748,
        total_clp: 36000,
        logo_url: 'https://caferoast.cl/assets/logos/logo_black.png',
        transfer_expires_at: '2026-05-02T15:00:00.000Z',
        bank_transfer: {
          bank: 'BCI',
          account_type: 'Cuenta Corriente',
          account_number: '61947059',
          holder: 'Gonzalo Sepúlveda Hermosilla',
          rut: '17515638-0',
          email: 'contacto@caferoast.cl'
        },
        admin_transfer_url: 'https://caferoast.cl/operaciones/transferencia/?order_id=roast_internal_001&token=test-token'
      }
    }
  );

  assert.equal(result, true);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests.map(request => request.url), [
    'https://api.resend.com/emails',
    'https://api.resend.com/emails'
  ]);
  assert.equal(requests[0].headers.Authorization, 'Bearer resend_test_key');
  assert.equal(requests[0].headers['Content-Type'], 'application/json');
  assert.equal(requests[0].headers['Idempotency-Key'], 'roast:roast_internal_001:operational');
  assert.equal(requests[1].headers['Idempotency-Key'], 'roast:roast_internal_001:customer');
  assert.equal(requests[0].body.from, 'Roast <orders@caferoast.cl>');
  assert.equal(requests[0].body.reply_to, 'soporte@caferoast.cl');
  assert.deepEqual(requests[0].body.to, ['operaciones@caferoast.cl']);
  assert.match(requests[0].body.subject, /0205789/);
  assert.match(requests[0].body.html, /0205789/);
  assert.match(requests[0].body.html, /logo_black\.png/);
  assert.match(requests[0].body.html, /Downtime/);
  assert.match(requests[0].body.html, /\$36\.000 CLP/);
  assert.match(requests[0].body.html, /Validar transferencia/);
  assert.deepEqual(requests[1].body.to, ['cliente@example.com']);
  assert.match(requests[1].body.subject, /0205789/);
  assert.match(requests[1].body.html, /0205789/);
  assert.match(requests[1].body.html, /logo_black\.png/);
  assert.match(requests[1].body.html, /Downtime/);
  assert.match(requests[1].body.html, /BCI/);
  assert.match(requests[1].body.html, /61947059/);
  assert.match(requests[1].body.html, /17515638-0/);
  assert.match(requests[1].body.html, /transferencia vence/i);
  assert.doesNotMatch(requests[1].body.html, /roast_internal_001/);
});

test('notifyOperationalEventWithResults sends WhatsApp order notifications without blocking successful email', async t => {
  const requests = [];
  installFetchMock(t, async (url, init = {}) => {
    requests.push({
      url,
      headers: init.headers,
      body: JSON.parse(init.body)
    });

    if (url === 'https://api.resend.com/emails') {
      return jsonResponse({ id: `email_${requests.length}` }, 202);
    }

    if (url === 'https://graph.facebook.com/v20.0/phone_123/messages') {
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
      WHATSAPP_TEMPLATE_ORDER_EVENT: 'roast_order_event'
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

  assert.equal(result.ok, true);
  assert.equal(result.channels.email.ok, true);
  assert.equal(result.channels.whatsapp.ok, true);

  const whatsappRequest = requests.find(request => request.url.includes('graph.facebook.com'));
  assert.equal(whatsappRequest.headers.Authorization, 'Bearer whatsapp_test_token');
  assert.equal(whatsappRequest.body.messaging_product, 'whatsapp');
  assert.equal(whatsappRequest.body.to, '56911112222');
  assert.equal(whatsappRequest.body.template.name, 'roast_order_event');
  assert.deepEqual(
    whatsappRequest.body.template.components[0].parameters.map(parameter => parameter.text),
    ['0205789', 'pending_transfer', 'Camila Roast', '$36.000 CLP', 'pending_transfer']
  );
});

test('notifyOperationalEventWithResults treats WhatsApp failure as best-effort when email succeeds', async t => {
  installFetchMock(t, async (url) => {
    if (url === 'https://api.resend.com/emails') {
      return jsonResponse({ id: 'email_test' }, 202);
    }

    if (url === 'https://graph.facebook.com/v20.0/phone_123/messages') {
      return jsonResponse({ error: { message: 'Template missing' } }, 400);
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  const result = await notifyOperationalEventWithResults(
    {
      RESEND_API_KEY: 'resend_test_key',
      WHATSAPP_CLOUD_TOKEN: 'whatsapp_test_token',
      WHATSAPP_PHONE_NUMBER_ID: 'phone_123',
      WHATSAPP_NOTIFY_TO: '+56911112222',
      WHATSAPP_TEMPLATE_ORDER_EVENT: 'roast_order_event'
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

  assert.equal(result.ok, true);
  assert.equal(result.channels.email.ok, true);
  assert.equal(result.channels.whatsapp.ok, false);
});

test('notifyOperationalEvent returns false when any required Resend pending transfer email fails', async t => {
  const requests = [];
  installFetchMock(t, async (url, init = {}) => {
    requests.push({ url, body: JSON.parse(init.body) });
    if (requests.length === 2) {
      return jsonResponse({ error: 'Invalid recipient' }, 422);
    }
    return jsonResponse({ id: 'email_operational' }, 202);
  });

  const result = await notifyOperationalEvent(
    {
      RESEND_API_KEY: 'resend_test_key'
    },
    {
      event_type: 'pending_transfer',
      order_id: 'roast_internal_001',
      recipient: 'operaciones@caferoast.cl',
      payload: {
        order_id: 'roast_internal_001',
        order_number: '0205789',
        confirmation_number: '0205789',
        email: 'cliente@example.com'
      }
    }
  );

  assert.equal(result, false);
  assert.equal(requests.length, 2);
});

test('notifyOperationalEvent does not expose a raw roast order id in Resend customer email fallback', async t => {
  const requests = [];
  installFetchMock(t, async (url, init = {}) => {
    requests.push({
      url,
      body: JSON.parse(init.body)
    });
    return jsonResponse({ id: `email_${requests.length}` }, 202);
  });

  const result = await notifyOperationalEvent(
    {
      RESEND_API_KEY: 'resend_test_key'
    },
    {
      event_type: 'pending_transfer',
      order_id: 'roast_20260502_161221_qd5qs',
      recipient: 'operaciones@caferoast.cl',
      payload: {
        order_id: 'roast_20260502_161221_qd5qs',
        email: 'cliente@example.com'
      }
    }
  );

  assert.equal(result, true);
  assert.equal(requests.length, 2);
  assert.match(requests[1].body.html, /20260502/);
  assert.doesNotMatch(requests[1].body.html, /roast_20260502_161221_qd5qs/);
});

test('checkout order accepts terms without accept_total, returns order number, and keeps order_id for sheet relations', async t => {
  const appended = {
    Clientes: [],
    Ventas: [],
    Lineas_Pedido: [],
    Pagos_Flow: [],
    Eventos: []
  };
  const webhookRequests = [];

  installFetchMock(t, async (url, init = {}) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      return jsonResponse({ access_token: 'test-access-token', expires_in: 3600 });
    }

    if (url.startsWith('https://maps.googleapis.com/maps/api/geocode/json')) {
      return jsonResponse({
        status: 'OK',
        results: [
          {
            formatted_address: 'Av. Siempre Viva 123, Maipu, Region Metropolitana, Chile',
            place_id: 'place_maipu',
            geometry: {
              location: {
                lat: -33.51,
                lng: -70.76
              }
            },
            address_components: [
              {
                long_name: 'Maipu',
                short_name: 'Maipu'
              }
            ]
          }
        ]
      });
    }

    if (url === 'https://script.google.com/macros/s/test/exec') {
      webhookRequests.push(JSON.parse(init.body));
      return jsonResponse({ ok: true, emails: { operational: { ok: true }, customer: { ok: true } } });
    }

    const sheetName = sheetNameFromAppendUrl(url);
    if (sheetName) {
      const body = JSON.parse(init.body);
      appended[sheetName].push(body.values[0]);
      return jsonResponse({ updates: { updatedRows: 1 } });
    }

    if (url.includes('/values/Config!A%3AZ')) {
      return jsonResponse({ values: configRows() });
    }

    if (url.includes('/values/Clientes!A%3AAZ')) {
      return jsonResponse({ values: rowsFromObjects(CLIENT_HEADERS, []) });
    }

    if (url.includes('/values/Pagos_Flow!A%3AAZ')) {
      return jsonResponse({ values: rowsFromObjects(PAYMENT_HEADERS, []) });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  const response = await worker.fetch(
    new Request('https://caferoast.cl/api/checkout-orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        first_name: 'Camila',
        last_name: 'Roast',
        email: 'cliente@example.com',
        phone: '+56991746361',
        commune: 'Maipu',
        address: 'Av. Siempre Viva 123',
        accept_terms: true,
        payment_method: 'transfer',
        items: [
          {
            product_code: 'downtime',
            format_code: '1kg',
            grind: 'grano entero',
            quantity: 1
          }
        ]
      })
    }),
    {
      GOOGLE_SHEET_ID: 'test-sheet',
      GOOGLE_SERVICE_ACCOUNT_JSON: getServiceAccountJson(),
      GOOGLE_MAPS_API_KEY: 'test-maps-key',
      APPS_SCRIPT_WEBHOOK_URL: 'https://script.google.com/macros/s/test/exec',
      APPS_SCRIPT_SHARED_SECRET: 'test-secret',
      PUBLIC_BASE_URL: 'https://caferoast.cl'
    },
    createContext()
  );
  const payload = await response.json();

  assert.equal(response.status, 200, payload.error);
  assert.equal(payload.ok, true);
  assert.match(payload.order_id, /^roast_/);
  assert.match(payload.order_number, /^\d{7}$/);
  assert.equal(payload.confirmation_number, payload.order_number);
  assert.notEqual(payload.confirmation_number, payload.order_id);
  assert.equal(payload.shipping_clp, 0);
  assert.equal(payload.total_clp, 36000);

  assert.equal(SALES_HEADERS.includes('order_number'), true);
  const salesRow = objectFromRow(SALES_HEADERS, appended.Ventas[0]);
  assert.equal(salesRow.order_id, payload.order_id);
  assert.equal(salesRow.order_number, payload.order_number);

  const paymentRow = objectFromRow(PAYMENT_HEADERS, appended.Pagos_Flow[0]);
  assert.equal(paymentRow.order_id, payload.order_id);

  const lineRow = objectFromRow(LINE_HEADERS, appended.Lineas_Pedido[0]);
  assert.equal(lineRow.order_id, payload.order_id);

  const eventRow = objectFromRow(EVENT_HEADERS, appended.Eventos[0]);
  assert.equal(eventRow.order_id, payload.order_id);
  assert.equal(EVENT_HEADERS.includes('notification_results_json'), true);
  const eventPayload = JSON.parse(eventRow.payload_json);
  const notificationResult = JSON.parse(eventRow.notification_results_json);
  assert.equal(eventPayload.order_id, payload.order_id);
  assert.equal(eventPayload.order_number, payload.order_number);
  assert.equal(eventPayload.confirmation_number, payload.order_number);
  assert.equal(notificationResult.channels.email.provider, 'apps_script');
  assert.equal(notificationResult.channels.email.ok, true);

  assert.equal(webhookRequests.length, 1);
  assert.equal(webhookRequests[0].payload.order_id, payload.order_id);
  assert.equal(webhookRequests[0].payload.payload.order_number, payload.order_number);
});

test('public order lookup returns confirmation number while still looking up by internal order_id', async t => {
  installFetchMock(t, async (url) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      return jsonResponse({ access_token: 'test-access-token', expires_in: 3600 });
    }

    if (url.includes('/values/Ventas!A%3AAZ')) {
      return jsonResponse({
        values: rowsFromObjects(SALES_HEADERS, [
          {
            order_id: 'roast_internal_001',
            order_number: '0205789',
            items_label: 'Downtime 1 kg',
            total_clp: '36000',
            internal_status: 'pending_transfer',
            flow_checkout_url: ''
          }
        ])
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  const response = await worker.fetch(
    new Request('https://caferoast.cl/api/orders/roast_internal_001'),
    {
      GOOGLE_SHEET_ID: 'test-sheet',
      GOOGLE_SERVICE_ACCOUNT_JSON: getServiceAccountJson()
    },
    createContext()
  );
  const payload = await response.json();

  assert.equal(response.status, 200, payload.error);
  assert.equal(payload.ok, true);
  assert.equal(payload.order_id, 'roast_internal_001');
  assert.equal(payload.order_number, '0205789');
  assert.equal(payload.confirmation_number, '0205789');
});

test('public order lookup can recover confirmation number from event payload when sales header is not present', async t => {
  const legacySalesHeaders = SALES_HEADERS.filter(header => header !== 'order_number');

  installFetchMock(t, async (url) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      return jsonResponse({ access_token: 'test-access-token', expires_in: 3600 });
    }

    if (url.includes('/values/Ventas!A%3AAZ')) {
      return jsonResponse({
        values: rowsFromObjects(legacySalesHeaders, [
          {
            order_id: 'roast_internal_001',
            items_label: 'Downtime 1 kg',
            total_clp: '36000',
            internal_status: 'pending_transfer',
            flow_checkout_url: ''
          }
        ])
      });
    }

    if (url.includes('/values/Eventos!A%3AAZ')) {
      return jsonResponse({
        values: rowsFromObjects(EVENT_HEADERS, [
          {
            order_id: 'roast_internal_001',
            event_type: 'pending_transfer',
            payload_json: JSON.stringify({
              order_id: 'roast_internal_001',
              order_number: '0205789',
              confirmation_number: '0205789'
            })
          }
        ])
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  const response = await worker.fetch(
    new Request('https://caferoast.cl/api/orders/roast_internal_001'),
    {
      GOOGLE_SHEET_ID: 'test-sheet',
      GOOGLE_SERVICE_ACCOUNT_JSON: getServiceAccountJson()
    },
    createContext()
  );
  const payload = await response.json();

  assert.equal(response.status, 200, payload.error);
  assert.equal(payload.ok, true);
  assert.equal(payload.order_id, 'roast_internal_001');
  assert.equal(payload.order_number, '0205789');
  assert.equal(payload.confirmation_number, '0205789');
});

test('admin transfer confirmation rejects invalid token before touching Sheets', async () => {
  const response = await worker.fetch(
    new Request('https://caferoast.cl/api/admin/orders/roast_internal_001/confirm-transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: 'bad-token'
      })
    }),
    {
      ADMIN_ACTION_SECRET: 'admin-secret'
    },
    createContext()
  );
  const payload = await response.json();

  assert.equal(response.status, 403);
  assert.equal(payload.ok, false);
  assert.match(payload.error, /Invalid admin action token/);
});

test('admin transfer confirmation marks pending transfer orders as paid and is idempotent', async t => {
  const appended = {
    Eventos: []
  };
  const updates = [];
  const paidAtPattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

  installFetchMock(t, async (url, init = {}) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      return jsonResponse({ access_token: 'test-access-token', expires_in: 3600 });
    }

    const sheetName = sheetNameFromAppendUrl(url);
    if (sheetName) {
      const body = JSON.parse(init.body);
      appended[sheetName].push(body.values[0]);
      return jsonResponse({ updates: { updatedRows: 1 } });
    }

    if (init.method === 'PUT' && url.includes('/values/Ventas!')) {
      const row = objectFromRow(SALES_HEADERS, JSON.parse(init.body).values[0]);
      updates.push({ sheet: 'Ventas', row });
      return jsonResponse({ updatedRows: 1 });
    }

    if (init.method === 'PUT' && url.includes('/values/Pagos_Flow!')) {
      const row = objectFromRow(PAYMENT_HEADERS, JSON.parse(init.body).values[0]);
      updates.push({ sheet: 'Pagos_Flow', row });
      return jsonResponse({ updatedRows: 1 });
    }

    if (init.method === 'PUT' && url.includes('/values/Clientes!')) {
      const row = objectFromRow(CLIENT_HEADERS, JSON.parse(init.body).values[0]);
      updates.push({ sheet: 'Clientes', row });
      return jsonResponse({ updatedRows: 1 });
    }

    if (url.includes('/values/Ventas!A%3AAZ')) {
      return jsonResponse({
        values: rowsFromObjects(SALES_HEADERS, [
          {
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
            internal_status: 'pending_transfer'
          }
        ])
      });
    }

    if (url.includes('/values/Pagos_Flow!A%3AAZ')) {
      return jsonResponse({
        values: rowsFromObjects(PAYMENT_HEADERS, [
          {
            payment_id: 'pay_001',
            order_id: 'roast_internal_001',
            internal_status: 'pending_transfer',
            amount_clp: '36000',
            payer_email: 'cliente@example.com',
            payment_method: 'transfer'
          }
        ])
      });
    }

    if (url.includes('/values/Clientes!A%3AAZ')) {
      return jsonResponse({
        values: rowsFromObjects(CLIENT_HEADERS, [
          {
            customer_id: 'cus_001',
            full_name: 'Camila Roast',
            email: 'cliente@example.com',
            order_count: '1',
            total_paid_clp: '0'
          }
        ])
      });
    }

    if (url.includes('/values/Lineas_Pedido!A%3AAZ')) {
      return jsonResponse({
        values: rowsFromObjects(LINE_HEADERS, [
          {
            order_id: 'roast_internal_001',
            product_name: 'Downtime',
            format_label: '1 kg',
            grind: 'grano entero',
            quantity: '1',
            unit_price_clp: '36000',
            line_subtotal_clp: '36000'
          }
        ])
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  const token = await hmacSha256Hex('admin-secret', 'confirm-transfer:roast_internal_001');
  const request = new Request('https://caferoast.cl/api/admin/orders/roast_internal_001/confirm-transfer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token })
  });
  const env = {
    GOOGLE_SHEET_ID: 'test-sheet',
    GOOGLE_SERVICE_ACCOUNT_JSON: getServiceAccountJson(),
    ADMIN_ACTION_SECRET: 'admin-secret'
  };

  const response = await worker.fetch(request, env, createContext());
  const payload = await response.json();

  assert.equal(response.status, 200, payload.error);
  assert.equal(payload.ok, true);
  assert.equal(payload.internal_status, 'paid');

  const salesUpdate = updates.find(update => update.sheet === 'Ventas').row;
  assert.equal(salesUpdate.internal_status, 'paid');
  assert.match(salesUpdate.paid_at, paidAtPattern);

  const paymentUpdate = updates.find(update => update.sheet === 'Pagos_Flow').row;
  assert.equal(paymentUpdate.internal_status, 'paid');
  assert.equal(paymentUpdate.confirmed_at, salesUpdate.paid_at);

  const customerUpdate = updates.find(update => update.sheet === 'Clientes').row;
  assert.equal(customerUpdate.total_paid_clp, '36000');
  assert.equal(customerUpdate.last_paid_at, salesUpdate.paid_at);

  assert.equal(appended.Eventos.length, 1);
  const eventRow = objectFromRow(EVENT_HEADERS, appended.Eventos[0]);
  assert.equal(eventRow.event_type, 'paid');
  assert.equal(eventRow.from_status, 'pending_transfer');
  assert.equal(eventRow.to_status, 'paid');
  assert.equal(JSON.parse(eventRow.payload_json).confirmation_number, '0205789');
});

test('admin transfer confirmation is idempotent for already paid orders', async t => {
  const updates = [];
  const appended = {
    Eventos: []
  };

  installFetchMock(t, async (url, init = {}) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      return jsonResponse({ access_token: 'test-access-token', expires_in: 3600 });
    }

    const sheetName = sheetNameFromAppendUrl(url);
    if (sheetName) {
      const body = JSON.parse(init.body);
      appended[sheetName].push(body.values[0]);
      return jsonResponse({ updates: { updatedRows: 1 } });
    }

    if (init.method === 'PUT') {
      updates.push({ url, row: JSON.parse(init.body).values[0] });
      return jsonResponse({ updatedRows: 1 });
    }

    if (url.includes('/values/Ventas!A%3AAZ')) {
      return jsonResponse({
        values: rowsFromObjects(SALES_HEADERS, [
          {
            order_id: 'roast_internal_001',
            order_number: '0205789',
            customer_id: 'cus_001',
            customer_name: 'Camila Roast',
            email: 'cliente@example.com',
            items_label: 'Downtime 1 kg',
            total_clp: '36000',
            internal_status: 'paid',
            paid_at: '2026-05-04 15:30:00'
          }
        ])
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  const token = await hmacSha256Hex('admin-secret', 'confirm-transfer:roast_internal_001');
  const response = await worker.fetch(
    new Request('https://caferoast.cl/api/admin/orders/roast_internal_001/confirm-transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    }),
    {
      GOOGLE_SHEET_ID: 'test-sheet',
      GOOGLE_SERVICE_ACCOUNT_JSON: getServiceAccountJson(),
      ADMIN_ACTION_SECRET: 'admin-secret'
    },
    createContext()
  );
  const payload = await response.json();

  assert.equal(response.status, 200, payload.error);
  assert.equal(payload.ok, true);
  assert.equal(payload.internal_status, 'paid');
  assert.equal(payload.already_paid, true);
  assert.equal(updates.length, 0);
  assert.equal(appended.Eventos.length, 0);
});

test('Apps Script doPost sends operational and customer pending transfer emails with confirmation number', () => {
  const sentMessages = [];
  const { doPost } = loadAppsScriptRuntime(sentMessages);
  const payload = {
    event_type: 'pending_transfer',
    order_id: 'roast_internal_001',
    payload: {
      order_id: 'roast_internal_001',
      order_number: '0205789',
      confirmation_number: '0205789',
      first_name: 'Camila',
      customer_name: 'Camila Roast',
      email: 'cliente@example.com',
      items: [
        {
          product_name: 'Downtime',
          format_label: '1 kg',
          grind: 'Grano entero',
          quantity: 1,
          line_subtotal_clp: 36000
        }
      ],
      subtotal_clp: 36000,
      shipping_clp: 0,
      tax_included_clp: 5748,
      total_clp: 36000
    }
  };

  const response = doPost({
    postData: {
      contents: JSON.stringify({
        payload,
        signature: '010203'
      })
    }
  });
  const result = JSON.parse(response.content);

  assert.equal(result.ok, true);
  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[0].subject, /0205789/);
  assert.match(sentMessages[0].body, /0205789/);
  assert.equal(sentMessages[1].to, 'cliente@example.com');
  assert.match(sentMessages[1].body, /0205789/);
  assert.match(sentMessages[1].htmlBody, /0205789/);
});
