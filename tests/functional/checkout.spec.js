import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, installMockWorkerApi } from './helpers/mockWorkerApi.js';

const GRIND_OPTION_LABELS = [
  'Molienda Fina (Espresso, Cafetera italiana "Moka")',
  'Molienda Media (Goteo, Aeropress)',
  'Molienda Gruesa (Prensa Francesa, Cold Brew)',
  'Grano Entero'
];

async function openCheckoutWithItems(page, { quantity = 1, format = '250g' } = {}) {
  await page.goto('/pedido/', { waitUntil: 'domcontentloaded' });

  await page.locator('[data-current-item-field="format_code"]').selectOption(format);

  for (let index = 0; index < quantity; index += 1) {
    await page.getByRole('button', { name: 'Agregar al carrito' }).click();
  }
}

async function reachDataStep(page, options = {}) {
  await openCheckoutWithItems(page, options);
  await page.getByRole('button', { name: 'Finalizar Pedido' }).click();
}

async function fillCustomerData(page, { commune = 'Providencia' } = {}) {
  await page.locator('#first_name').fill('Camila');
  await page.locator('#last_name').fill('Roast');
  await page.locator('#email').fill('cliente@example.com');
  await page.locator('#phone').fill('+56991746361');
  await page.locator('#commune').selectOption(commune);
  await page.locator('#address').fill('Av. Siempre Viva 123');
  await page.locator('#address_ref').fill('Depto 42');
  await page.locator('#notes').fill('Moler justo antes de despacho.');
}

async function choosePaymentMethod(page, name) {
  if (String(name).toLowerCase() === 'flow' || String(name).includes('Flow')) {
    await page.locator('input[name="payment_method"][value="flow"]').check();
    return;
  }

  await page.locator('input[name="payment_method"][value="transfer"]').check();
}

async function finishTransferCheckout(page, mockApi, { commune = 'Providencia' } = {}) {
  await reachDataStep(page, { quantity: 2, format: '1kg' });
  await fillCustomerData(page, { commune });
  await choosePaymentMethod(page, /transferencia/i);
  await page.locator('#accept_terms').check();
  await page.getByRole('button', { name: 'Pagar ahora' }).click();
  await expect.poll(() => mockApi.checkoutOrderRequests.length).toBe(1);
}

test.describe('checkout 2-step order and transfer flow', () => {
  test('shows only Pedido and Datos steps without Pago or Paso 3 indicators', async ({ page }) => {
    await installMockWorkerApi(page);
    await page.goto('/pedido/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/Paso 1 de 2/i)).toBeVisible();
    await expect(page.locator('[data-step-indicator]')).toHaveText(['Pedido', 'Datos']);
    await expect(page.getByText(/^Pago$/i)).toHaveCount(0);
    await expect(page.getByText(/Paso 3/i)).toHaveCount(0);
  });

  test('sidebar is Tu carrito Roast with subtotal, pending shipping, total and included VAT', async ({ page }) => {
    await installMockWorkerApi(page);
    await openCheckoutWithItems(page);

    const sidebar = page.getByRole('complementary');
    await expect(sidebar.locator('.checkout-summary-kicker')).toHaveText('Resumen de tus productos');
    await expect(sidebar.getByRole('heading', { name: 'Tu carrito Roast' })).toBeVisible();
    await expect(sidebar).toContainText(/Subtotal/i);
    await expect(sidebar).toContainText(/Env[ií]o/i);
    await expect(page.locator('#summaryShipping')).toContainText(/Pendiente/i);
    await expect(sidebar).toContainText(/Total/i);
    await expect(sidebar).toContainText(/IVA incluido 19%/i);
  });

  test('checkout starts with an empty cart message and only commune names in the dropdown', async ({ page }) => {
    await installMockWorkerApi(page);
    await page.goto('/pedido/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Arma tu pedido, confirma el total y lo cerramos contigo.' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Agregar al carrito' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Finalizar Pedido' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar con datos' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Agregar al resumen' })).toHaveCount(0);
    await expect(page.locator('#checkoutSummaryItems .checkout-summary-empty')).toHaveText('Aún no hay productos en tu carrito');

    const communeLabels = await page.locator('#commune option').evaluateAll(options =>
      options.map(option => option.textContent.trim())
    );
    expect(communeLabels).toContain('Providencia');
    expect(communeLabels).toContain('Quilicura');
    expect(communeLabels).toContain('Pudahuel');
    expect(communeLabels).not.toContain('Providencia - Oriente');
    expect(communeLabels.every(label => !label.includes(' - '))).toBe(true);
  });

  test('loads checkout logic through a cache-busted URL', async ({ page }) => {
    await installMockWorkerApi(page);
    await page.goto('/pedido/', { waitUntil: 'domcontentloaded' });

    const checkoutScriptSrc = await page.locator('script[src*="/assets/checkout.js"]').getAttribute('src');

    expect(checkoutScriptSrc).toMatch(/^\/assets\/checkout\.js\?v=\d{8}/);
  });

  test('checkout selector exposes the four approved grind choices with whole bean as default', async ({ page }) => {
    await installMockWorkerApi(page);
    await page.goto('/pedido/', { waitUntil: 'domcontentloaded' });

    const grindSelect = page.locator('[data-current-item-field="grind"]');
    const labels = await grindSelect.locator('option').evaluateAll(options =>
      options.map(option => option.textContent.trim())
    );

    expect(labels).toEqual(GRIND_OPTION_LABELS);
    await expect(grindSelect).toHaveValue('grano entero');

    await page.getByRole('button', { name: 'Agregar al carrito' }).click();
    await expect(page.locator('#checkoutSummaryItems')).toContainText(/Downtime.*250g.*Grano Entero/i);
  });

  test('captures first and last name separately before choosing payment', async ({ page }) => {
    await installMockWorkerApi(page);
    await reachDataStep(page);

    await expect(page.locator('#customer_name')).toHaveCount(0);
    await fillCustomerData(page);
    await expect(page.locator('#first_name')).toHaveValue('Camila');
    await expect(page.locator('#last_name')).toHaveValue('Roast');
  });

  test('Flow payment label is customer-facing and wraps without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await installMockWorkerApi(page);
    await reachDataStep(page);

    const flowOption = page.locator('[data-payment-option="flow"]');
    await expect(flowOption.locator('.checkout-payment-title')).toHaveText('Flow (Tarjetas de débito, crédito y billeteras digitales)');
    await expectNoHorizontalOverflow(page);
  });

  test('Flow payment is disabled and does not create orders or payment links', async ({ page }) => {
    const mockApi = await installMockWorkerApi(page);
    await reachDataStep(page);
    await fillCustomerData(page);

    await choosePaymentMethod(page, /^Flow$/i);

    await expect(page.locator('#checkoutStatus')).toContainText('La integración con Flow se encuentra deshabilitada momentáneamente');
    await expect(page.getByRole('button', { name: 'Pagar ahora' })).toBeDisabled();
    expect(mockApi.checkoutOrderRequests).toHaveLength(0);
    expect(mockApi.paymentLinkRequests).toHaveLength(0);
  });

  test('transfer payment creates checkout order and confirms on the same page', async ({ page }) => {
    const mockApi = await installMockWorkerApi(page);
    await reachDataStep(page, { quantity: 2, format: '1kg' });
    await fillCustomerData(page);

    await choosePaymentMethod(page, /transferencia/i);
    await expect(page.getByText('Tendrás 2 horas para transferir antes que se cierre tu carro de venta.')).toBeVisible();
    await expect(page.locator('#accept_total')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pagar ahora' })).toBeDisabled();
    await page.locator('#accept_terms').check();
    await expect(page.getByRole('button', { name: 'Pagar ahora' })).toBeEnabled();
    await page.getByRole('button', { name: 'Pagar ahora' }).click();

    await expect.poll(() => mockApi.checkoutOrderRequests.length).toBe(1);
    expect(mockApi.checkoutOrderRequests[0]).toEqual(expect.objectContaining({
      payment_method: 'transfer',
      first_name: 'Camila',
      last_name: 'Roast',
      commune: 'Providencia',
      items: [
        expect.objectContaining({
          product_code: 'downtime',
          format_code: '1kg',
          grind: 'grano entero',
          quantity: 1
        }),
        expect.objectContaining({
          product_code: 'downtime',
          format_code: '1kg',
          grind: 'grano entero',
          quantity: 1
        })
      ]
    }));
    expect(mockApi.checkoutOrderRequests[0]).not.toHaveProperty('accept_total');
    expect(mockApi.checkoutOrderRequests[0]).toHaveProperty('accept_terms', true);
    expect(mockApi.paymentLinkRequests).toHaveLength(0);

    await expect(page.getByRole('heading', { name: 'Confirmación N° 0205789' })).toBeVisible();
    await expect(page.getByText(/BCI/i)).toBeVisible();
    await expect(page.getByText(/Cuenta Corriente\s+61947059/i)).toBeVisible();
    await expect(page.getByText(/^RUT$/i)).toBeVisible();
    await expect(page.locator('dd').filter({ hasText: /^17515638-0$/ })).toBeVisible();
    await expect(page.locator('dd').filter({ hasText: /^contacto@caferoast\.cl$/i })).toBeVisible();
    await expect(page.getByText(/Downtime.*1kg.*x2/i)).toBeVisible();

    const confirmationPanel = page.locator('.checkout-confirmation-panel');
    await expect(confirmationPanel.getByRole('link', { name: /WhatsApp de soporte/i })).toHaveCount(0);
    await expect(confirmationPanel.locator('a[href^="mailto:"]')).toHaveCount(0);
  });

  test('retries once with legacy accept_total when deployed worker still requires it', async ({ page }) => {
    const mockApi = await installMockWorkerApi(page, { checkoutOrderRequiresAcceptTotal: true });
    await reachDataStep(page, { quantity: 1, format: '250g' });
    await fillCustomerData(page, { commune: 'Peñalolén' });
    await choosePaymentMethod(page, /transferencia/i);
    await page.locator('#accept_terms').check();
    await page.getByRole('button', { name: 'Pagar ahora' }).click();

    await expect.poll(() => mockApi.checkoutOrderRequests.length).toBe(2);
    expect(mockApi.checkoutOrderRequests[0]).not.toHaveProperty('accept_total');
    expect(mockApi.checkoutOrderRequests[1]).toHaveProperty('accept_total', true);
    expect(mockApi.checkoutOrderRequests[1]).toHaveProperty('accept_terms', true);
    await expect(page.getByRole('heading', { name: 'Confirmación N° 0205789' })).toBeVisible();
  });

  test('confirmation number is displayed as customer-safe digits when worker sends a raw roast id', async ({ page }) => {
    await installMockWorkerApi(page, { checkoutOrderRawConfirmationNumber: true });
    await reachDataStep(page, { quantity: 1, format: '250g' });
    await fillCustomerData(page, { commune: 'Peñalolén' });
    await choosePaymentMethod(page, /transferencia/i);
    await page.locator('#accept_terms').check();
    await page.getByRole('button', { name: 'Pagar ahora' }).click();

    await expect(page.getByRole('heading', { name: 'Confirmación N° 0205789' })).toBeVisible();
    await expect(page.locator('.checkout-confirmation-panel')).not.toContainText('roast_0205789_live');
  });

  test('confirmation fallback avoids rendering a legacy raw roast order id', async ({ page }) => {
    await installMockWorkerApi(page, { checkoutOrderLegacyRawOrderId: true });
    await reachDataStep(page, { quantity: 1, format: '250g' });
    await fillCustomerData(page, { commune: 'Peñalolén' });
    await choosePaymentMethod(page, /transferencia/i);
    await page.locator('#accept_terms').check();
    await page.getByRole('button', { name: 'Pagar ahora' }).click();

    await expect(page.getByRole('heading', { name: 'Confirmación N° 20260502' })).toBeVisible();
    await expect(page.locator('.checkout-confirmation-panel')).not.toContainText('roast_20260502_161221_qd5qs');
  });

  test('cart sidebar does not show support email or WhatsApp links', async ({ page }) => {
    await installMockWorkerApi(page);
    await openCheckoutWithItems(page);

    const sidebar = page.getByRole('complementary');
    await expect(sidebar.getByRole('link', { name: /WhatsApp de soporte/i })).toHaveCount(0);
    await expect(sidebar).not.toContainText('contacto@caferoast.cl');
  });

  for (const commune of ['Providencia', 'Quilicura', 'La Florida', 'Pudahuel']) {
    test(`${commune} qualifies for free shipping over threshold`, async ({ page }) => {
      const mockApi = await installMockWorkerApi(page);

      await finishTransferCheckout(page, mockApi, { commune });
      expect(mockApi.checkoutOrderRequests[0]).toEqual(expect.objectContaining({
        commune
      }));
      await expect(page.locator('.checkout-review-row').filter({ hasText: 'Envío' })).toContainText('Gratis');
    });
  }

  test('listed commune below threshold keeps paid shipping', async ({ page }) => {
    await installMockWorkerApi(page);
    await reachDataStep(page, { quantity: 1, format: '250g' });
    await fillCustomerData(page, { commune: 'Providencia' });

    await expect(page.locator('#summaryShipping')).toContainText(/\$3\.500|\$ 3\.500|CLP/);
  });

  test('listed commune at exact threshold gets free shipping', async ({ page }) => {
    await installMockWorkerApi(page, { freeShippingThresholdClp: 34900 });
    await reachDataStep(page, { quantity: 1, format: '1kg' });
    await fillCustomerData(page, { commune: 'Quilicura' });

    await expect(page.locator('#summaryShipping')).toHaveText('Gratis');
  });

  test('Poniente fallback commune remains selectable and covered', async ({ page }) => {
    const mockApi = await installMockWorkerApi(page, { catalogHtmlError: true });
    await reachDataStep(page, { quantity: 2, format: '1kg' });
    await fillCustomerData(page, { commune: 'Pudahuel' });
    await choosePaymentMethod(page, /transferencia/i);
    await page.locator('#accept_terms').check();
    await expect(page.locator('[data-error-for="commune"]')).toHaveText('');
    await expect(page.locator('#summaryShipping')).toHaveText('Gratis');
    await expect(page.getByRole('button', { name: 'Pagar ahora' })).toBeEnabled();
    await page.getByRole('button', { name: 'Pagar ahora' }).click();

    await expect.poll(() => mockApi.checkoutOrderRequests.length).toBe(1);
    expect(mockApi.checkoutOrderRequests[0]).toEqual(expect.objectContaining({
      commune: 'Pudahuel'
    }));
  });

  test('HTML API response explains checkout-orders backend route misconfiguration', async ({ page }) => {
    await installMockWorkerApi(page, { checkoutOrderHtmlError: true });
    await reachDataStep(page, { quantity: 2, format: '1kg' });
    await fillCustomerData(page);
    await choosePaymentMethod(page, /transferencia/i);
    await page.locator('#accept_terms').check();
    await page.getByRole('button', { name: 'Pagar ahora' }).click();

    await expect(page.locator('#checkoutStatus')).toContainText('El backend del checkout no está respondiendo');
  });

  test('JSON Not found API response explains checkout-orders backend route misconfiguration', async ({ page }) => {
    await installMockWorkerApi(page, { checkoutOrderJsonNotFound: true });
    await reachDataStep(page, { quantity: 2, format: '1kg' });
    await fillCustomerData(page);
    await choosePaymentMethod(page, /transferencia/i);
    await page.locator('#accept_terms').check();
    await page.getByRole('button', { name: 'Pagar ahora' }).click();

    await expect(page.locator('#checkoutStatus')).toContainText('El backend del checkout no está respondiendo correctamente');
    await expect(page.locator('#checkoutStatus')).toContainText('/api/checkout-orders');
  });
});
