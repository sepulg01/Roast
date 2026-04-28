import { expect, test } from '@playwright/test';
import {
  SUPPORT_WHATSAPP_URL,
  collectCriticalConsole,
  expectNoHorizontalOverflow,
  installMockWorkerApi
} from './helpers/mockWorkerApi.js';

const routes = [
  { path: '/', heading: /desayuno merece/i },
  { path: '/cafe-molido/', heading: /café molido/i },
  { path: '/cafe-en-grano/', heading: /café en grano/i },
  { path: '/cafe-de-especialidad/', heading: /café de especialidad/i },
  { path: '/cafe-a-domicilio/', heading: /café a domicilio/i },
  { path: '/pedido/', heading: /arma tu pedido/i },
  { path: '/pago/resultado/?order_id=ORD_TEST_001', heading: /revisando tu pedido|pago recibido/i }
];

const overflowWidths = [390, 540, 768, 1024, 1280];

test.describe('static routes', () => {
  for (const route of routes) {
    test(`${route.path} responds, hydrates, and keeps support links current`, async ({ page }) => {
      const consoleMessages = collectCriticalConsole(page);
      await installMockWorkerApi(page, { orderStatus: 'paid' });

      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      expect(response?.ok()).toBeTruthy();
      await expect(page.getByRole('heading', { name: route.heading }).first()).toBeVisible();

      const supportLinks = page.locator('[data-support-whatsapp-link]');
      const supportCount = await supportLinks.count();

      for (let index = 0; index < supportCount; index += 1) {
        await expect(supportLinks.nth(index)).toHaveAttribute('href', new RegExp(`^${SUPPORT_WHATSAPP_URL}`));
      }

      expect(consoleMessages).toEqual([]);
    });
  }

  test('static WhatsApp fallbacks work without JavaScript', async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      javaScriptEnabled: false
    });
    const page = await context.newPage();

    try {
      for (const route of routes) {
        await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        const hrefs = await page.locator('[data-support-whatsapp-link]').evaluateAll(links =>
          links.map(link => link.getAttribute('href') || '')
        );

        for (const href of hrefs) {
          expect(href).toContain(SUPPORT_WHATSAPP_URL);
        }
      }
    } finally {
      await context.close();
    }
  });

  for (const width of overflowWidths) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await installMockWorkerApi(page, { orderStatus: 'paid' });
      await page.setViewportSize({ width, height: 900 });

      for (const route of routes) {
        await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        await expectNoHorizontalOverflow(page);
      }
    });
  }
});
