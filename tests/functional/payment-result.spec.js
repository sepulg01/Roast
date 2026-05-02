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

  test('failed payment renders support-oriented error state', async ({ page }) => {
    await installMockWorkerApi(page, { orderStatus: 'payment_failed' });
    await page.goto('/pago/resultado/?order_id=ORD_TEST_001', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#paymentResultTitle')).toContainText('Pago no completado');
    await expect(page.locator('#paymentResultPill')).toHaveClass(/result-pill-error/);
    await expect(page.locator('[data-support-whatsapp-link]').first()).toHaveAttribute('href', new RegExp(`^${SUPPORT_WHATSAPP_URL}`));
  });

  test('missing order_id renders recoverable empty state', async ({ page }) => {
    await installMockWorkerApi(page);
    await page.goto('/pago/resultado/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#paymentResultTitle')).toContainText('No encontramos el pedido');
    await expect(page.locator('#paymentResultCopy')).toContainText('order_id');
  });
});
