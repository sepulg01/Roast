import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import worker from '../../worker/src/index.js';
import { buildPendingTransferNotificationPayload } from '../../worker/src/lib/orders.js';

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

test('pending transfer notification payload includes customer email data and totals', () => {
  const payload = buildPendingTransferNotificationPayload({
    env: { PUBLIC_BASE_URL: 'https://caferoast.cl/' },
    orderId: 'ORD_TEST_001',
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
  assert.match(email.htmlBody, /ORD_TEST_001/);
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
