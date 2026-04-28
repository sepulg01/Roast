import { expect, test } from '@playwright/test';
import {
  SUPPORT_WHATSAPP_URL,
  installMockWorkerApi
} from './helpers/mockWorkerApi.js';

const quizScenarios = [
  {
    name: 'Downtime',
    cups: '1_taza',
    method: 'prensa_francesa',
    product: 'downtime',
    expected: /Downtime/i
  },
  {
    name: 'Hiperfoco',
    cups: '2_tazas',
    method: 'espresso',
    product: 'hiperfoco',
    expected: /Hiperfoco/i
  },
  {
    name: 'combo ambos',
    cups: '3_o_mas',
    method: 'no_se',
    product: 'ambos_250',
    expected: /Downtime.*Hiperfoco|Hiperfoco.*Downtime/i
  }
];

test.describe('home catalog, media, and quiz', () => {
  test('hydrates catalog prices from /api/public-catalog', async ({ page }) => {
    await installMockWorkerApi(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#downtime-price')).toContainText('$17.777');
    await expect(page.locator('[data-free-shipping-threshold]').first()).toContainText('$36.000');
  });

  test('marks product prices as referential when catalog API returns static HTML', async ({ page }) => {
    await installMockWorkerApi(page, { catalogHtmlError: true });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#downtime-price')).toHaveAttribute(
      'title',
      'Precio referencial; se confirma en checkout.'
    );
  });

  test('product media sliders initialize with exactly one active slide', async ({ page }) => {
    await installMockWorkerApi(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const sliders = page.locator('[data-product-slider]');
    await expect(sliders.first()).toHaveAttribute('data-slider-ready', 'true');

    const sliderCount = await sliders.count();
    expect(sliderCount).toBeGreaterThan(0);

    for (let index = 0; index < sliderCount; index += 1) {
      const slider = sliders.nth(index);
      await expect(slider.locator('[data-product-slider-slide].is-active')).toHaveCount(1);
      await expect(slider.locator('[data-product-slider-slide][aria-hidden="false"]')).toHaveCount(1);
    }
  });

  for (const scenario of quizScenarios) {
    test(`quiz path: ${scenario.name}`, async ({ page }) => {
      await installMockWorkerApi(page);
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      await page.locator(`[data-cups="${scenario.cups}"]`).click();
      await page.locator(`[data-method="${scenario.method}"]`).click();
      await page.locator(`[data-product-choice="${scenario.product}"]`).click();

      await expect(page.locator('#quizStep4')).toHaveClass(/active/);
      await expect(page.locator('#quizResultRec')).toContainText(scenario.expected);
      await expect(page.locator('#quizResultPrice')).toContainText('CLP');
      await expect(page.locator('#quizResultCta')).toHaveAttribute('href', /\/pedido\/.*draft=/);
      await expect(page.locator('#quizResultSupport')).toHaveAttribute('href', new RegExp(`^${SUPPORT_WHATSAPP_URL}`));
    });
  }
});
