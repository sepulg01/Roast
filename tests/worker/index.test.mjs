import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import worker from '../../worker/src/index.js';
import { buildPendingTransferNotificationPayload } from '../../worker/src/lib/orders.js';
import { notifyOperationalEvent } from '../../worker/src/lib/notifications.js';
import { buildOrderNumber } from '../../worker/src/lib/utils.js';

function createContext() {
  return {
    waitUntil() {}
  };
}

function loadAppsScriptHelpers() {
  const source = readFileSync(new URL('../../apps-script/Code.js', import.meta.url), 'utf8');
  return vm.runInNewContext(
    `${source}\n({ buildCustomerConfirmationEmail });`,
    {
      console
    }
  );
}

function loadAppsScriptRuntime(context = {}) {
  const source = readFileSync(new URL('../../apps-script/Code.js', import.meta.url), 'utf8');
  return vm.runInNewContext(
    `${source}\n({ doPost, buildCustomerConfirmationEmail });`,
    {
      console,
      ...context
    }
  );
}

test('GET /api/public-catalog returns a JSON error when an async handler throws', async () => {
  const response = await worker.fetch(
    new Request('https://caferoast.cl/api/public-catalog'),
    {},
    createContext()
  );
  const payload = await response.json();

  assert.equal(response.status, 500);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal(payload.ok, false);
  assert.equal(payload.error, 'Missing GOOGLE_SHEET_ID');
});

test('POST /api/checkout-orders returns a JSON error when request JSON is invalid', async () => {
  const response = await worker.fetch(
    new Request('https://caferoast.cl/api/checkout-orders', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: '{'
    }),
    {},
    createContext()
  );
  const payload = await response.json();

  assert.equal(response.status, 500);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal(payload.ok, false);
  assert.equal(payload.error, 'Invalid JSON body');
});

test('GET /api/health returns worker feature flags', async () => {
  const response = await worker.fetch(
    new Request('https://caferoast.cl/api/health'),
    {},
    createContext()
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.deepEqual(payload, {
    ok: true,
    service: 'roast-worker',
    features: {
      confirmation_number: true,
      terms_only_checkout: true,
      resend_notifications: true
    },
    configuration: {
      google_sheets: false,
      google_maps: false,
      resend: false,
      apps_script_fallback: false,
      notifications: false
    }
  });
});

test('GET /api/health reports configured notification and backend dependencies without exposing secret values', async () => {
  const response = await worker.fetch(
    new Request('https://caferoast.cl/api/health'),
    {
      GOOGLE_SERVICE_ACCOUNT_JSON: '{"client_email":"worker@example.com","private_key":"secret"}',
      GOOGLE_SHEET_ID: 'sheet_123',
      GOOGLE_MAPS_API_KEY: 'maps_secret',
      RESEND_API_KEY: 'resend_secret',
      APPS_SCRIPT_WEBHOOK_URL: 'https://script.google.test/macros/s/test/exec',
      APPS_SCRIPT_SHARED_SECRET: 'apps_secret'
    },
    createContext()
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.configuration, {
    google_sheets: true,
    google_maps: true,
    resend: true,
    apps_script_fallback: true,
    notifications: true
  });
  assert.doesNotMatch(JSON.stringify(payload), /secret|sheet_123/);
});

test('pending transfer notification payload includes customer email data and totals', () => {
  const payload = buildPendingTransferNotificationPayload({
    env: { PUBLIC_BASE_URL: 'https://caferoast.cl/' },
    orderId: 'ORD_TEST_001',
    orderNumber: '0205789',
    customer: {
      customer_name: 'Camila Roast',
      first_name: 'Camila',
      email: 'cliente@example.com',
      phone: '+56991746361',
      commune: 'Providencia',
      address: 'Av. Siempre Viva 123',
      address_ref: 'Depto 42',
      notes: 'Moler justo antes de despacho.'
    },
    salesRow: {
      origin: 'checkout_2_steps',
      channel: 'site_checkout'
    },
    communeCoverage: {
      sector: 'Oriente'
    },
    delivery: {
      formatted_address: 'Av. Siempre Viva 123, Providencia, Chile',
      place_id: 'place_test',
      location: { lat: -33.4, lng: -70.6 }
    },
    orderMetrics: {
      subtotal_clp: 11900,
      shipping_clp: 3500,
      total_clp: 15400
    },
    responseItems: [
      {
        product_code: 'downtime',
        product_name: 'Downtime',
        format_code: '250g',
        format_label: '250g',
        grind: 'grano entero',
        quantity: 1,
        unit_price_clp: 11900,
        line_subtotal_clp: 11900
      }
    ],
    transferExpiresAt: '2026-05-02T15:00:00.000Z',
    bankTransfer: {
      bank: 'BCI',
      account_type: 'Cuenta Corriente',
      account_number: '61947059',
      rut: '17515638-0',
      email: 'contacto@caferoast.cl'
    }
  });

  assert.equal(payload.order_id, 'ORD_TEST_001');
  assert.equal(payload.order_number, '0205789');
  assert.equal(payload.confirmation_number, '0205789');
  assert.equal(payload.customer_name, 'Camila Roast');
  assert.equal(payload.first_name, 'Camila');
  assert.equal(payload.email, 'cliente@example.com');
  assert.equal(payload.logo_url, 'https://caferoast.cl/assets/logos/logo_white.png');
  assert.equal(payload.subtotal_clp, 11900);
  assert.equal(payload.shipping_clp, 3500);
  assert.equal(payload.tax_included_clp, 2459);
  assert.equal(payload.total_clp, 15400);
  assert.equal(payload.support_email, 'contacto@caferoast.cl');
  assert.equal(payload.support_whatsapp, '+56991746361');
  assert.equal(payload.items[0].product_name, 'Downtime');
  assert.equal(payload.items[0].line_subtotal_clp, 11900);
  assert.equal(payload.bank_transfer.bank, 'BCI');
});

test('Apps Script builds the transfer customer confirmation email', () => {
  const { buildCustomerConfirmationEmail } = loadAppsScriptHelpers();
  const email = buildCustomerConfirmationEmail({
    event_type: 'pending_transfer',
    support_email: 'contacto@caferoast.cl',
    support_whatsapp: '+56991746361',
    payload: {
      order_id: 'ORD_TEST_001',
      order_number: '0205789',
      confirmation_number: '0205789',
      logo_url: 'https://caferoast.cl/assets/logos/logo_white.png',
      first_name: 'Camila',
      email: 'cliente@example.com',
      items: [
        {
          product_name: 'Downtime',
          format_label: '250g',
          grind: 'Grano Entero',
          quantity: 1,
          line_subtotal_clp: 11900
        }
      ],
      subtotal_clp: 11900,
      shipping_clp: 3500,
      tax_included_clp: 2459,
      total_clp: 15400
    }
  });

  assert.equal(email.to, 'cliente@example.com');
  assert.equal(email.subject, 'Hemos recibido tu pedido!');
  assert.equal(email.replyTo, 'contacto@caferoast.cl');
  assert.equal(email.name, 'contacto@caferoast.cl');
  assert.match(email.body, /Hola Camila/);
  assert.match(email.htmlBody, /logo_white\.png/);
  assert.match(email.htmlBody, /0205789/);
  assert.doesNotMatch(email.htmlBody, /ORD_TEST_001/);
  assert.match(email.htmlBody, /Gracias por su preferencia/);
  assert.match(email.htmlBody, /1 a 3 dias hábiles/);
  assert.match(email.htmlBody, /Downtime/);
  assert.match(email.htmlBody, /\$11\.900 CLP/);
  assert.match(email.htmlBody, /\$3\.500 CLP/);
  assert.match(email.htmlBody, /\$2\.459 CLP/);
  assert.match(email.htmlBody, /\$15\.400 CLP/);
  assert.match(email.htmlBody, /contacto@caferoast\.cl/);
  assert.match(email.htmlBody, /\+56 9 9174 6361/);
});

test('buildOrderNumber returns DDMM plus three random digits as text', () => {
  const orderNumber = buildOrderNumber(new Date('2026-05-02T12:00:00Z'), {
    getRandomValues(values) {
      values[0] = 789;
      return values;
    }
  });

  assert.equal(orderNumber, '0205789');
  assert.match(orderNumber, /^\d{7}$/);
});

test('notifyOperationalEvent treats Apps Script ok false body as failure', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, error: 'Invalid signature' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  try {
    const sent = await notifyOperationalEvent({
      APPS_SCRIPT_WEBHOOK_URL: 'https://script.google.test/macros/s/test/exec',
      APPS_SCRIPT_SHARED_SECRET: 'secret'
    }, {
      order_id: 'ORD_TEST_001',
      event_type: 'pending_transfer'
    });

    assert.equal(sent, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Apps Script doPost sends operational and customer emails for pending transfer', () => {
  const sentMessages = [];
  const { doPost } = loadAppsScriptRuntime({
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty() {
            return 'secret';
          }
        };
      }
    },
    Utilities: {
      computeHmacSha256Signature() {
        return [1, 2, 3];
      }
    },
    ContentService: {
      MimeType: {
        JSON: 'application/json'
      },
      createTextOutput(text) {
        return {
          text,
          mimeType: '',
          setMimeType(mimeType) {
            this.mimeType = mimeType;
            return this;
          }
        };
      }
    },
    MailApp: {
      sendEmail(message) {
        sentMessages.push(message);
      }
    }
  });
  const payload = {
    order_id: 'ORD_TEST_001',
    event_type: 'pending_transfer',
    recipient: 'contacto@caferoast.cl',
    payload: {
      order_id: 'ORD_TEST_001',
      order_number: '0205789',
      confirmation_number: '0205789',
      first_name: 'Camila',
      email: 'cliente@example.com',
      items: [],
      subtotal_clp: 11900,
      shipping_clp: 3500,
      tax_included_clp: 2459,
      total_clp: 15400
    }
  };

  const result = doPost({
    postData: {
      contents: JSON.stringify({
        payload,
        signature: '010203'
      })
    }
  });
  const body = JSON.parse(result.text);

  assert.equal(body.ok, true);
  assert.equal(sentMessages.length, 2);
  assert.equal(sentMessages[0].to, 'contacto@caferoast.cl');
  assert.equal(sentMessages[1].to, 'cliente@example.com');
  assert.match(sentMessages[0].htmlBody, /0205789/);
  assert.match(sentMessages[1].htmlBody, /0205789/);
});
