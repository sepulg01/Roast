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
import { buildTelegramActionId, verifyTelegramActionId } from '../../worker/src/lib/telegram-actions.js';

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

function telegramCallbackPayload({ chatId = '-1001234567890', fromId = '111222333', actionId, callbackQueryId = 'cbq_001' }) {
  return {
    update_id: 1001,
    callback_query: {
      id: callbackQueryId,
      from: {
        id: Number(fromId),
        first_name: 'Gonzalo'
      },
      message: {
        message_id: 77,
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

function installOrderSheetsMock(t, { status = 'pending_transfer', telegramRequests = [] } = {}) {
  const appended = {
    Eventos: []
  };
  const updates = [];

  installFetchMock(t, async (url, init = {}) => {
    if (url === 'https://api.resend.com/emails') {
      return jsonResponse({ id: 'email_test' }, 202);
    }

    if (url === 'https://api.telegram.org/botbot-token/sendMessage') {
      telegramRequests.push({ method: 'sendMessage', body: JSON.parse(init.body) });
      return jsonResponse({ ok: true, result: { message_id: telegramRequests.length } }, 200);
    }

    if (url === 'https://api.telegram.org/botbot-token/answerCallbackQuery') {
      telegramRequests.push({ method: 'answerCallbackQuery', body: JSON.parse(init.body) });
      return jsonResponse({ ok: true, result: true }, 200);
    }

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

  return { appended, updates, telegramRequests };
}

test('buildTelegramActionId creates compact signed callback data compatible with Telegram limits', async () => {
  const actionId = await buildTelegramActionId(
    'telegram-action-secret',
    'roast_20260515_123456_abcde',
    'paid',
    1778760000000
  );

  assert.ok(Buffer.byteLength(actionId, 'utf8') <= 64);

  const verified = await verifyTelegramActionId('telegram-action-secret', actionId, 1778760000000);
  assert.equal(verified.ok, true);
  assert.equal(verified.orderId, 'roast_20260515_123456_abcde');
  assert.equal(verified.status, 'paid');
  assert.ok(verified.expiresAt > 1778760000);
});

test('notifyOperationalEventWithResults sends pending transfer Telegram message with order detail and buttons', async t => {
  const requests = [];

  installFetchMock(t, async (url, init = {}) => {
    if (url === 'https://api.resend.com/emails') {
      return jsonResponse({ id: 'email_operational' }, 202);
    }

    if (url === 'https://api.telegram.org/botbot-token/sendMessage') {
      requests.push(JSON.parse(init.body));
      return jsonResponse({ ok: true, result: { message_id: 10 } }, 200);
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  const result = await notifyOperationalEventWithResults(
    {
      RESEND_API_KEY: 'resend_test_key',
      TELEGRAM_BOT_TOKEN: 'bot-token',
      TELEGRAM_CHAT_ID: '-1001234567890',
      TELEGRAM_ACTION_SECRET: 'telegram-action-secret'
    },
    {
      event_type: 'pending_transfer',
      order_id: 'roast_internal_001',
      payload: {
        order_id: 'roast_internal_001',
        order_number: '0205789',
        confirmation_number: '0205789',
        customer_name: 'Camila Roast',
        email: 'cliente@example.com',
        total_clp: 36000,
        items: [{
          product_name: 'Downtime',
          format_label: '1 kg',
          grind: 'grano entero',
          quantity: 1,
          line_subtotal_clp: 36000
        }]
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.channels.email.ok, true);
  assert.equal(result.channels.telegram.ok, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].chat_id, '-1001234567890');
  assert.match(requests[0].text, /0205789/);
  assert.match(requests[0].text, /Camila Roast/);
  assert.match(requests[0].text, /Downtime/);
  assert.match(requests[0].text, /\$36\.000 CLP/);

  const buttons = requests[0].reply_markup.inline_keyboard.flat();
  assert.deepEqual(buttons.map(button => button.text), ['Confirmar pago', 'Expirar']);

  const paid = await verifyTelegramActionId('telegram-action-secret', buttons[0].callback_data);
  const expired = await verifyTelegramActionId('telegram-action-secret', buttons[1].callback_data);
  assert.equal(paid.status, 'paid');
  assert.equal(expired.status, 'expired');
  assert.ok(Buffer.byteLength(buttons[0].callback_data, 'utf8') <= 64);
  assert.ok(Buffer.byteLength(buttons[1].callback_data, 'utf8') <= 64);
});

test('POST /api/telegram/webhook confirms transfer from an authorized callback query', async t => {
  const { appended, updates, telegramRequests } = installOrderSheetsMock(t, { status: 'pending_transfer' });
  const actionId = await buildTelegramActionId('telegram-action-secret', 'roast_internal_001', 'paid');
  const response = await worker.fetch(
    new Request('https://caferoast.cl/api/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': 'webhook-secret'
      },
      body: JSON.stringify(telegramCallbackPayload({ actionId }))
    }),
    {
      GOOGLE_SHEET_ID: 'test-sheet',
      GOOGLE_SERVICE_ACCOUNT_JSON: getServiceAccountJson(),
      RESEND_API_KEY: 'resend_test_key',
      TELEGRAM_BOT_TOKEN: 'bot-token',
      TELEGRAM_CHAT_ID: '-1001234567890',
      TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
      TELEGRAM_ACTION_SECRET: 'telegram-action-secret',
      TELEGRAM_OPERATOR_IDS: '111222333'
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
  assert.equal(eventRow.source, 'api/telegram/webhook');
  assert.equal(eventRow.event_type, 'paid');
  assert.equal(JSON.parse(eventRow.notification_results_json).channels.telegram.ok, true);
  assert.equal(telegramRequests.some(request => request.method === 'answerCallbackQuery'), true);
  assert.equal(
    telegramRequests.find(request => request.method === 'sendMessage').body.reply_markup.inline_keyboard[0][0].text,
    'En despacho'
  );
});

test('POST /api/telegram/webhook rejects invalid webhook secret before touching Sheets', async t => {
  installFetchMock(t, async url => {
    throw new Error(`Unexpected fetch: ${url}`);
  });

  const response = await worker.fetch(
    new Request('https://caferoast.cl/api/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': 'bad-secret'
      },
      body: JSON.stringify(telegramCallbackPayload({ actionId: 'bad-action' }))
    }),
    {
      TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
      TELEGRAM_ACTION_SECRET: 'telegram-action-secret',
      TELEGRAM_CHAT_ID: '-1001234567890',
      TELEGRAM_OPERATOR_IDS: '111222333'
    },
    createContext()
  );
  const payload = await response.json();

  assert.equal(response.status, 403);
  assert.equal(payload.ok, false);
  assert.match(payload.error, /Invalid Telegram webhook secret/);
  assert.doesNotMatch(JSON.stringify(payload), /webhook-secret|telegram-action-secret/);
});

test('POST /api/telegram/webhook rejects callbacks from unauthorized operators before touching Sheets', async t => {
  installFetchMock(t, async url => {
    throw new Error(`Unexpected fetch: ${url}`);
  });

  const actionId = await buildTelegramActionId('telegram-action-secret', 'roast_internal_001', 'paid');
  const response = await worker.fetch(
    new Request('https://caferoast.cl/api/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': 'webhook-secret'
      },
      body: JSON.stringify(telegramCallbackPayload({ fromId: '999888777', actionId }))
    }),
    {
      TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
      TELEGRAM_ACTION_SECRET: 'telegram-action-secret',
      TELEGRAM_CHAT_ID: '-1001234567890',
      TELEGRAM_OPERATOR_IDS: '111222333'
    },
    createContext()
  );
  const payload = await response.json();

  assert.equal(response.status, 403);
  assert.equal(payload.ok, false);
  assert.match(payload.error, /not authorized/);
});

test('syncPaymentStatus sends paid Telegram notification with En despacho button', async t => {
  const appended = {
    Eventos: []
  };
  const updates = [];
  const telegramRequests = [];

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

    if (url === 'https://api.telegram.org/botbot-token/sendMessage') {
      telegramRequests.push(JSON.parse(init.body));
      return jsonResponse({ ok: true, result: { message_id: telegramRequests.length } }, 200);
    }

    if (url === 'https://api.resend.com/emails') {
      return jsonResponse({ id: 'email_test' }, 202);
    }

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
      RESEND_API_KEY: 'resend_test_key',
      FLOW_API_KEY: 'flow-key',
      FLOW_SECRET_KEY: 'flow-secret',
      TELEGRAM_BOT_TOKEN: 'bot-token',
      TELEGRAM_CHAT_ID: '-1001234567890',
      TELEGRAM_ACTION_SECRET: 'telegram-action-secret'
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
  assert.equal(eventPayload.payment_method, 'flow');
  assert.equal(telegramRequests.length, 1);
  assert.match(telegramRequests[0].text, /0205789/);
  assert.match(telegramRequests[0].text, /Camila Roast/);
  assert.equal(telegramRequests[0].reply_markup.inline_keyboard[0][0].text, 'En despacho');
});
