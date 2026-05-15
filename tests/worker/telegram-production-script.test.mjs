import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertNoSecretLeak,
  buildProductionReport,
  buildTelegramActionId,
  buildTelegramWebhookPayload,
  parseArgs,
  pickUnauthorizedOperatorId,
  runProductionTelegramE2E
} from '../../scripts/e2e-telegram-production.mjs';

test('parseArgs maps Telegram workflow booleans and keeps safe defaults', () => {
  const args = parseArgs([
    '--base-url',
    'https://caferoast.cl/path',
    '--run-transfer=false',
    '--run-expired=true',
    '--run-flow-real=true',
    '--flow-payment-wait-seconds=30'
  ]);

  assert.equal(args.baseUrl, 'https://caferoast.cl');
  assert.equal(args.runTransfer, false);
  assert.equal(args.runExpired, true);
  assert.equal(args.runFlowReal, true);
  assert.equal(args.flowPaymentWaitMs, 30000);
});

test('buildTelegramActionId creates compact signed action payloads', async () => {
  const actionId = await buildTelegramActionId(
    'telegram-action-secret',
    'roast_20260515_123456_abcde',
    'paid',
    1778760300
  );

  assert.ok(Buffer.byteLength(actionId, 'utf8') <= 64);
  assert.match(actionId, /^r1:/);
  assert.match(actionId, /:p:/);
});

test('buildTelegramWebhookPayload emits callback_query data for a chat and operator', () => {
  const payload = buildTelegramWebhookPayload({
    chatId: '-1001234567890',
    operatorId: '111222333',
    actionId: 'signed-action',
    callbackQueryId: 'cbq.test'
  });

  assert.equal(payload.callback_query.id, 'cbq.test');
  assert.equal(payload.callback_query.from.id, 111222333);
  assert.equal(payload.callback_query.message.chat.id, -1001234567890);
  assert.equal(payload.callback_query.data, 'signed-action');
});

test('pickUnauthorizedOperatorId avoids configured operator ids', () => {
  assert.equal(
    pickUnauthorizedOperatorId({
      TELEGRAM_OPERATOR_IDS: '111, 222, 333'
    }),
    '100000000'
  );

  assert.equal(
    pickUnauthorizedOperatorId({
      TELEGRAM_OPERATOR_IDS: '100000000, 100000001'
    }),
    '100000002'
  );
});

test('buildProductionReport excludes secrets and payment links', () => {
  const report = buildProductionReport({
    baseUrl: 'https://caferoast.cl',
    startedAt: '2026-05-15T12:00:00.000Z',
    completedAt: '2026-05-15T12:01:00.000Z',
    scenarios: [{
      name: 'flow_real',
      order_id: 'order_123',
      order_number: '1505123',
      checkout_url: 'https://flow.cl/pay?token=secret-token',
      action_id: 'secret-action-id',
      statuses: ['draft', 'link_sent', 'paid']
    }],
    manualChecks: ['Confirm Telegram messages in Roast operations group']
  });

  assert.equal(report.base_url, 'https://caferoast.cl');
  assert.deepEqual(report.scenarios[0], {
    name: 'flow_real',
    order_id: 'order_123',
    order_number: '1505123',
    statuses: ['draft', 'link_sent', 'paid']
  });
  assertNoSecretLeak(report, ['secret-token', 'secret-action-id']);
});

test('runProductionTelegramE2E refuses to run outside GitHub Actions', async () => {
  await assert.rejects(
    runProductionTelegramE2E([], { GITHUB_ACTIONS: 'false' }),
    /must run only from GitHub Actions/
  );
});

test('runProductionTelegramE2E requires at least one enabled scenario', async () => {
  await assert.rejects(
    runProductionTelegramE2E([
      '--run-transfer=false',
      '--run-expired=false',
      '--run-flow-real=false'
    ], {
      GITHUB_ACTIONS: 'true'
    }),
    /Enable at least one scenario/
  );
});
