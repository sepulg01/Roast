import { expect, test } from '@playwright/test';
import { installMockWorkerApi } from './helpers/mockWorkerApi.js';

async function reachCustomerStep(page) {
  await page.goto('/pedido/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Continuar con datos' }).click();
}

async function fillCustomerData(page, commune = 'Providencia') {
  await page.locator('#customer_name').fill('Cliente Roast');
  await page.locator('#email').fill('cliente@example.com');
  await page.locator('#phone').fill('+56991746361');
  await page.locator('#commune').fill(commune);
  await page.locator('#address').fill('Av. Siempre Viva 123');
  await page.locator('#address_ref').fill('Depto 42');
  await page.locator('#notes').fill('Moler justo antes de despacho.');
}

test.describe('checkout flow', () => {
  test('happy path creates a draft, creates a payment link, and redirects to Flow', async ({ page }) => {
    await installMockWorkerApi(page);
    await reachCustomerStep(page);
    await fillCustomerData(page);
    await page.getByRole('button', { name: 'Continuar a revisión' }).click();

    await expect(page.locator('#reviewOrderId')).toContainText('ORD_TEST_001');
    await expect(page.locator('#reviewTotal')).toContainText('$15.845');
    await expect(page.locator('[data-checkout-support-link]').first()).toHaveAttribute(
      'href',
      /wa\.me\/56991746361.*ORD_TEST_001/
    );

    await page.locator('#accept_total').check();
    await page.locator('#accept_terms').check();
    await page.getByRole('button', { name: 'Generar link de pago' }).click();

    await page.waitForURL('**/__mock-flow/checkout?token=test-token');
    await expect(page.getByRole('heading', { name: 'Mock Flow checkout' })).toBeVisible();
  });

  test('manual review draft shows support path and disables payment', async ({ page }) => {
    await installMockWorkerApi(page, { manualReview: true });
    await reachCustomerStep(page);
    await fillCustomerData(page, 'Paine');
    await page.getByRole('button', { name: 'Continuar a revisión' }).click();

    await expect(page.locator('#manualReviewBox')).toBeVisible();
    await expect(page.locator('#checkoutStatus')).toContainText('revisión manual');
    await expect(page.locator('#checkoutPayButton')).toBeDisabled();
  });

  test('HTML API response explains backend route misconfiguration', async ({ page }) => {
    await installMockWorkerApi(page, { orderDraftHtmlError: true });
    await reachCustomerStep(page);
    await fillCustomerData(page);
    await page.getByRole('button', { name: 'Continuar a revisión' }).click();

    await expect(page.locator('#checkoutStatus')).toContainText('El backend del checkout no está respondiendo');
  });
});
