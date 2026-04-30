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

async function getActiveProductMediaState(slider) {
  return slider.locator('[data-product-slider-slide].is-active').evaluate((slide) => {
    const children = Array.from(slide.children).map((element) => {
      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);

      return {
        className: String(element.className),
        display: styles.display,
        hidden: element.hidden,
        height: rect.height,
        visibility: styles.visibility,
        width: rect.width
      };
    });

    const renderedChildren = children.filter((child) => (
      child.display !== 'none'
      && child.visibility !== 'hidden'
      && child.width > 0
      && child.height > 0
    ));

    return { children, renderedChildren };
  });
}

function findMediaChild(state, className) {
  return state.children.find((child) => child.className.includes(className));
}

async function expectSingleRenderedMediaChild(slider) {
  const state = await getActiveProductMediaState(slider);
  expect(state.renderedChildren).toHaveLength(1);
  return state;
}

test.describe('home catalog, media, and quiz', () => {
  test('hydrates catalog prices from /api/public-catalog', async ({ page }) => {
    await installMockWorkerApi(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#downtime-price')).toContainText('$18.900');
    await expect(page.locator('[data-free-shipping-threshold]').first()).toContainText('$36.000');
  });

  test('marks product prices as referential when catalog API returns static HTML', async ({ page }) => {
    await installMockWorkerApi(page, { catalogHtmlError: true });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#downtime-price')).toContainText('$18.900');
    await expect(page.locator('#hiperfoco-price')).toContainText('$18.900');
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

      const state = await expectSingleRenderedMediaChild(slider);
      const asset = findMediaChild(state, 'product-media-asset');
      const placeholder = findMediaChild(state, 'product-media-placeholder');

      expect(asset?.hidden).toBe(false);
      expect(asset?.display).not.toBe('none');
      expect(placeholder?.hidden).toBe(true);
      expect(placeholder?.display).toBe('none');
    }
  });

  test('product media sliders initialize in the planned storytelling order', async ({ page }) => {
    await installMockWorkerApi(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    for (const productId of ['downtime', 'hiperfoco']) {
      const slider = page.locator(`[data-product-card][data-product-id="${productId}"] [data-product-slider]`);
      await expect(slider).toHaveAttribute('data-slider-ready', 'true');

      const slideKinds = await slider.locator('[data-product-slider-slide]').evaluateAll(slides =>
        slides.map(slide => slide.getAttribute('data-slide-kind'))
      );

      expect(slideKinds).toEqual(['hold', 'video', 'etiqueta', 'mockup']);
    }
  });

  test('final home CTA opens an empty checkout draft that blocks continuation until an item is added', async ({ page }) => {
    await installMockWorkerApi(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.locator('#final-cta [data-checkout-link]').click();
    await page.waitForURL('**/pedido/**');

    await expect(page.locator('.checkout-item-card')).toHaveCount(1);
    await expect(page.locator('#checkoutSummaryItems li')).toHaveCount(0);

    await page.getByRole('button', { name: 'Continuar con datos' }).click();

    await expect(page.locator('[data-checkout-step="1"]')).toHaveClass(/checkout-step-active/);
    await expect(page.locator('#checkoutStatus')).toContainText(/agrega|item|producto/i);
  });

  test('product card draft pre-fills exactly one live summary item in checkout', async ({ page }) => {
    await installMockWorkerApi(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.locator('[data-product-card][data-product-id="hiperfoco"] [data-product-link]').click();
    await page.waitForURL(/\/pedido\/\?(.+&)?draft=/);

    await expect(page.locator('#checkoutSummaryItems li')).toHaveCount(1);
    await expect(page.locator('#checkoutSummaryItems')).toContainText(/Hiperfoco.*500g.*espresso/i);
  });

  test('product media fallback shows only the placeholder when the active image fails', async ({ page }) => {
    await installMockWorkerApi(page);
    await page.route('**/assets/products/Downtime/downtime_mockup_hold.png', async (route) => {
      await route.fulfill({
        body: '',
        contentType: 'image/png',
        status: 404
      });
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const slider = page.locator('[data-product-card][data-product-id="downtime"] [data-product-slider]');
    await expect(slider).toHaveAttribute('data-slider-ready', 'true');
    await expect(slider.locator('[data-product-slider-slide].is-active')).toHaveAttribute('data-media-fallback', 'true');

    const state = await expectSingleRenderedMediaChild(slider);
    const asset = findMediaChild(state, 'product-media-asset');
    const placeholder = findMediaChild(state, 'product-media-placeholder');

    expect(asset?.hidden).toBe(true);
    expect(asset?.display).toBe('none');
    expect(placeholder?.hidden).toBe(false);
    expect(placeholder?.display).not.toBe('none');
  });

  test('product media navigation changes one closed slide at a time', async ({ page }) => {
    await installMockWorkerApi(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const slider = page.locator('[data-product-card][data-product-id="downtime"] [data-product-slider]');
    const previous = slider.locator('[data-product-slider-prev]');
    const next = slider.locator('[data-product-slider-next]');

    await expect(slider).toHaveAttribute('data-current-index', '0');
    await expect(previous).toBeDisabled();
    await expect(next).toBeEnabled();
    await expectSingleRenderedMediaChild(slider);

    await next.click();
    await expect(slider).toHaveAttribute('data-current-index', '1');
    await expect(slider.locator('[data-product-slider-slide].is-active')).toHaveAttribute('data-slide-index', '1');
    await expect(slider.locator('[data-product-slider-slide][aria-hidden="false"]')).toHaveCount(1);
    await expect(previous).toBeEnabled();
    await expect(next).toBeEnabled();
    await expectSingleRenderedMediaChild(slider);

    await previous.click();
    await expect(slider).toHaveAttribute('data-current-index', '0');
    await expect(previous).toBeDisabled();
    await expect(next).toBeEnabled();
    await expectSingleRenderedMediaChild(slider);

    await next.click();
    await next.click();
    await next.click();
    await expect(slider).toHaveAttribute('data-current-index', '3');
    await expect(slider.locator('[data-product-slider-slide].is-active')).toHaveAttribute('data-slide-index', '3');
    await expect(next).toBeDisabled();
    await expect(previous).toBeEnabled();
    await expectSingleRenderedMediaChild(slider);
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
