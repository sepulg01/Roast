import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertNoSecretLeak,
  buildMetaWebhookPayload,
  buildProductionReport,
  buildWhatsAppActionId,
  parseArgs,
  pickUnauthorizedPhone,
  runProductionWhatsAppE2E,
  signMetaBody
} from '../../scripts/e2e-whatsapp-production.mjs';
import { decodeBase64Json, hmacSha256Hex } from '../../worker/src/lib/utils.js';

test('parseArgs maps workflow booleans and keeps safe defaults', () => {
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

test('buildWhatsAppActionId creates Worker-compatible signed action payloads', async () => {
  const actionId = await buildWhatsAppActionId('whatsapp-action-secret', 'order_123', 'paid', 1778760300);
  const [encoded, signature] = actionId.split('.');

  assert.ok(encoded);
  assert.equal(signature, (await hmacSha256Hex('whatsapp-action-secret', encoded)).slice(0, 32));

  const payload = decodeBase64Json(encoded);
  assert.deepEqual(payload, {
    v: 1,
    o: 'order_123',
    s: 'paid',
    e: 1778760300
  });
});

test('signMetaBody signs exact raw JSON body with sha256 header', async () => {
  const rawBody = JSON.stringify({ hello: 'roast', spaced: true });
  const signature = await signMetaBody('meta-app-secret', rawBody);

  assert.equal(signature, `sha256=${await hmacSha256Hex('meta-app-secret', rawBody)}`);
});

test('buildMetaWebhookPayload emits an interactive button reply for the configured phone number id', () => {
  const payload = buildMetaWebhookPayload({
    from: '+56 9 1111 2222',
    phoneNumberId: 'phone_123',
    actionId: 'signed.action',
    messageId: 'wamid.test'
  });

  const message = payload.entry[0].changes[0].value.messages[0];
  assert.equal(payload.object, 'whatsapp_business_account');
  assert.equal(payload.entry[0].changes[0].value.metadata.phone_number_id, 'phone_123');
  assert.equal(message.from, '56911112222');
  assert.equal(message.type, 'interactive');
  assert.equal(message.interactive.button_reply.id, 'signed.action');
  assert.equal(message.id, 'wamid.test');
});

test('pickUnauthorizedPhone avoids notify and operator allowlist phones', () => {
  assert.equal(
    pickUnauthorizedPhone({
      WHATSAPP_NOTIFY_TO: '+56 9 0000 0001',
      WHATSAPP_OPERATOR_PHONES: '+56 9 0000 0002, +56 9 0000 0003'
    }),
    '56900000000'
  );

  assert.equal(
    pickUnauthorizedPhone({
      WHATSAPP_NOTIFY_TO: '+56 9 0000 0000',
      WHATSAPP_OPERATOR_PHONES: '+56 9 0000 0001, +56 9 0000 0002'
    }),
    '56900000003'
  );
});

test('buildProductionReport excludes secrets and payment links', () => {
  const report = buildProductionReport({
    baseUrl: 'https://caferoast.cl',
    startedAt: '2026-05-14T12:00:00.000Z',
    completedAt: '2026-05-14T12:01:00.000Z',
    scenarios: [{
      name: 'flow_real',
      order_id: 'order_123',
      order_number: '1405123',
      checkout_url: 'https://flow.cl/pay?token=secret-token',
      action_id: 'secret-action-id',
      statuses: ['draft', 'link_sent', 'paid']
    }],
    manualChecks: ['Confirm WhatsApp messages in Roast phone']
  });

  assert.equal(report.base_url, 'https://caferoast.cl');
  assert.deepEqual(report.scenarios[0], {
    name: 'flow_real',
    order_id: 'order_123',
    order_number: '1405123',
    statuses: ['draft', 'link_sent', 'paid']
  });
  assertNoSecretLeak(report, ['secret-token', 'secret-action-id']);
});

test('runProductionWhatsAppE2E refuses to run outside GitHub Actions', async () => {
  await assert.rejects(
    runProductionWhatsAppE2E([], { GITHUB_ACTIONS: 'false' }),
    /must run only from GitHub Actions/
  );
});

test('runProductionWhatsAppE2E requires at least one enabled scenario', async () => {
  await assert.rejects(
    runProductionWhatsAppE2E([
      '--run-transfer=false',
      '--run-expired=false',
      '--run-flow-real=false'
    ], {
      GITHUB_ACTIONS: 'true'
    }),
    /Enable at least one scenario/
  );
});
