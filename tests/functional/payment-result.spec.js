import { expect, test } from '@playwright/test';
import { SUPPORT_WHATSAPP_URL, installMockWorkerApi } from './helpers/mockWorkerApi.js';

test.describe('payment result page', () => {
  test('paid order renders confirmation', async ({ page }) => {
    await installMockWorkerApi(page, { orderStatus: 'paid' });
    await page.goto('/pago/resultado/?order_id=ORD_TEST_001', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#paymentResultTitle')).toContainText('Pago recibido');
    await expect(page.locator('#paymentResultTotal')).toContainText('$15.400');
    await expect(page.locator('#paymentResultItems')).toContainText('Downtime 250g');
    await expect(page.locator('[data-checkout-support-link]').first()).toHaveAttribute(
      'href',
      /wa\.me\/56991746361.*ORD_TEST_001/
    );
  });

  test('pending payment exposes resume payment action', async ({ page }) => {
    await installMockWorkerApi(page, { orderStatus: 'pending_payment' });
    await page.goto('/pago/resultado/?order_id=ORD_TEST_001', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#paymentResultTitle')).toContainText('Pago pendiente');
    await expect(page.locator('#paymentResumeLink')).toBeVisible();
    await expect(page.locator('#paymentResumeLink')).toHaveAttribute('href', /__mock-flow\/checkout/);
  });

  test('link sent exposes resume payment action', async ({ page }) => {
    await installMockWorkerApi(page, { orderStatus: 'link_sent' });
    await page.goto('/pago/resultado/?order_id=ORD_TEST_001', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#paymentResultTitle')).toContainText('Link generado');
    await expect(page.locator('#paymentResumeLink')).toBeVisible();
    await expect(page.locator('#paymentResumeLink')).toHaveAttribute('href', /__mock-flow\/checkout/);
  });

  test('failed payment renders support-oriented error state', async ({ page }) => {
    await installMockWorkerApi(page, { orderStatus: 'payment_failed' });
    await page.goto('/pago/resultado/?order_id=ORD_TEST_001', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#paymentResultTitle')).toContainText('Pago no completado');
    await expect(page.locator('#paymentResultPill')).toHaveClass(/result-pill-error/);
    await expect(page.locator('[data-support-whatsapp-link]').first()).toHaveAttribute('href', new RegExp(`^${SUPPORT_WHATSAPP_URL}`));
  });

  for (const scenario of [
    ['canceled', 'Pago cancelado'],
    ['expired', 'Link expirado']
  ]) {
    const [status, title] = scenario;

    test(`${status} renders support-oriented error state`, async ({ page }) => {
      await installMockWorkerApi(page, { orderStatus: status });
      await page.goto('/pago/resultado/?order_id=ORD_TEST_001', { waitUntil: 'domcontentloaded' });

      await expect(page.locator('#paymentResultTitle')).toContainText(title);
      await expect(page.locator('#paymentResultPill')).toHaveClass(/result-pill-error/);
      await expect(page.locator('[data-support-whatsapp-link]').first()).toHaveAttribute('href', new RegExp(`^${SUPPORT_WHATSAPP_URL}`));
    });
  }

  for (const scenario of [
    ['pending_transfer', 'Estado del pedido'],
    ['manual_review', 'Pedido en revisión manual'],
    ['delivering', 'Estado del pedido'],
    ['delivered', 'Estado del pedido'],
    ['contact_requested', 'Estado del pedido'],
    ['unknown_status', 'Estado del pedido']
  ]) {
    const [status, title] = scenario;

    test(`${status} renders stable informational state`, async ({ page }) => {
      await installMockWorkerApi(page, { orderStatus: status });
      await page.goto('/pago/resultado/?order_id=ORD_TEST_001', { waitUntil: 'domcontentloaded' });

      await expect(page.locator('#paymentResultTitle')).toContainText(title);
      await expect(page.locator('#paymentResultOrder')).toContainText('0205789');
      await expect(page.locator('#paymentResultPill')).toHaveText(status);
      await expect(page.locator('#paymentResultPill')).toHaveClass(/result-pill-info/);
      await expect(page.locator('#paymentResumeLink')).toBeHidden();
    });
  }

  test('missing order_id renders recoverable empty state', async ({ page }) => {
    await installMockWorkerApi(page);
    await page.goto('/pago/resultado/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#paymentResultTitle')).toContainText('No encontramos el pedido');
    await expect(page.locator('#paymentResultCopy')).toContainText('order_id');
  });

  test('order status API 404 renders recoverable error state', async ({ page }) => {
    await installMockWorkerApi(page, {
      orderApiResponse: {
        status: 404,
        body: { ok: false, error: 'Order not found' }
      }
    });
    await page.goto('/pago/resultado/?order_id=ORD_TEST_404', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#paymentResultTitle')).toContainText('No pudimos cargar el resultado');
    await expect(page.locator('#paymentResultCopy')).toContainText('Order not found');
  });

  test('malformed order status API response renders recoverable error state', async ({ page }) => {
    await installMockWorkerApi(page, { orderApiMalformedJson: true });
    await page.goto('/pago/resultado/?order_id=ORD_TEST_BAD_JSON', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#paymentResultTitle')).toContainText('No pudimos cargar el resultado');
    await expect(page.locator('#paymentResultCopy')).toContainText('La API del checkout respondió con JSON inválido.');
  });
});
