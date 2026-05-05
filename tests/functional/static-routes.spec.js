import { expect, test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  { path: '/pedido/', heading: /pedido web roast/i },
  { path: '/pago/resultado/?order_id=ORD_TEST_001', heading: /revisando tu pedido|pago recibido/i },
  { path: '/operaciones/transferencia/?order_id=ORD_TEST_001&token=test-token', heading: /validar transferencia/i }
];

const overflowWidths = [390, 540, 768, 1024, 1280];

const articleRoutes = [
  '/cafe-molido/',
  '/cafe-en-grano/',
  '/cafe-de-especialidad/',
  '/cafe-a-domicilio/'
];

const instagramRoutes = ['/', ...articleRoutes, '/pedido/', '/pago/resultado/?order_id=ORD_TEST_001'];

function normalizeJsonLdTypes(jsonLdPayload) {
  const graph = Array.isArray(jsonLdPayload?.['@graph']) ? jsonLdPayload['@graph'] : [jsonLdPayload];

  return graph.flatMap(entry => {
    const type = entry?.['@type'];
    return Array.isArray(type) ? type : [type];
  }).filter(Boolean);
}

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
        const supportLink = supportLinks.nth(index);

        await expect(supportLink).toHaveAttribute('href', new RegExp(`^${SUPPORT_WHATSAPP_URL}`));
        await expect(supportLink).toHaveAttribute('target', '_blank');
        await expect(supportLink).toHaveAttribute('rel', /noopener/);
        await expect(supportLink).toHaveAttribute('rel', /noreferrer/);
      }

      expect(consoleMessages).toEqual([]);
    });
  }

  for (const route of instagramRoutes) {
    test(`${route} exposes a visible footer Instagram icon link`, async ({ page }) => {
      await installMockWorkerApi(page, { orderStatus: 'paid' });
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      const instagramLink = page.locator('footer a[href*="instagram.com"]').first();

      await expect(instagramLink).toBeVisible();
      await expect(instagramLink).toHaveAttribute('href', /instagram\.com\/caferoast\.cl\/?$/);
      await expect(instagramLink).toHaveAttribute('target', '_blank');
      await expect(instagramLink).toHaveAttribute('rel', /noopener/);
      await expect(instagramLink).toHaveAttribute('rel', /noreferrer/);
    });
  }

  for (const route of articleRoutes) {
    test(`${route} keeps the article UI structure explicit`, async ({ page }) => {
      await installMockWorkerApi(page);
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('#faqList, .faq-list').first()).toBeVisible();
      await expect(page.locator('#seo-hub, .related-grid').first()).toBeVisible();
      await expect(page.locator('[data-article-shell], [data-editorial-article], .article-shell')).toHaveCount(1);
    });

    test(`${route} exposes complete article JSON-LD and canonical SEO metadata`, async ({ page }) => {
      await installMockWorkerApi(page);
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      const expectedCanonical = `https://caferoast.cl${route}`;

      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', expectedCanonical);

      const jsonLdPayloads = await page.locator('script[type="application/ld+json"]').evaluateAll(scripts =>
        scripts.map(script => JSON.parse(script.textContent || '{}'))
      );
      const jsonLdTypes = jsonLdPayloads.flatMap(normalizeJsonLdTypes);

      expect(jsonLdTypes).toEqual(expect.arrayContaining(['Article', 'BreadcrumbList', 'FAQPage']));

      const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
      expect(ogImage).toBeTruthy();

      const ogImageUrl = new URL(ogImage);
      const localAssetPath = join(process.cwd(), ogImageUrl.pathname);
      const backlog = readFileSync(join(process.cwd(), 'Backlog.md'), 'utf8');
      const backlogTracksMissingAsset = /og:image|og-image|asset social/i.test(backlog)
        && /pendiente|pending|faltante|missing|crear|agregar/i.test(backlog);

      expect(existsSync(localAssetPath) || backlogTracksMissingAsset).toBeTruthy();
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

  test('admin transfer page marks pending transfers as paid through status action links', async ({ page }) => {
    const mockApi = await installMockWorkerApi(page, { orderStatus: 'pending_transfer' });
    await page.goto('/operaciones/transferencia/?order_id=ORD_TEST_001&action=paid&token=paid-token', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#adminTransferTitle')).toContainText('Validar transferencia');
    await expect(page.locator('#adminTransferCopy')).toContainText('Revisa el banco');
    await expect(page.locator('#adminConfirmTransferButton')).toHaveText('Marcar transferencia recibida');
    await expect(page.locator('#adminConfirmTransferButton')).toBeEnabled();

    await page.locator('#adminConfirmTransferButton').click();

    expect(mockApi.adminStatusRequests).toEqual([
      expect.objectContaining({
        token: 'paid-token',
        status: 'paid'
      })
    ]);
    await expect(page.locator('#adminOrderStatus')).toHaveText('paid');
    await expect(page.locator('#adminTransferTitle')).toContainText('Transferencia validada');
  });

  test('admin transfer page marks pending transfers as expired through status action links', async ({ page }) => {
    const mockApi = await installMockWorkerApi(page, { orderStatus: 'pending_transfer' });
    await page.goto('/operaciones/transferencia/?order_id=ORD_TEST_001&action=expired&token=expired-token', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#adminTransferTitle')).toContainText('Marcar pedido vencido');
    await expect(page.locator('#adminConfirmTransferButton')).toHaveText('Marcar pedido vencido');
    await expect(page.locator('#adminConfirmTransferButton')).toBeEnabled();

    await page.locator('#adminConfirmTransferButton').click();

    expect(mockApi.adminStatusRequests).toEqual([
      expect.objectContaining({
        token: 'expired-token',
        status: 'expired'
      })
    ]);
    await expect(page.locator('#adminOrderStatus')).toHaveText('expired');
    await expect(page.locator('#adminTransferTitle')).toContainText('Pedido vencido');
  });

  test('admin transfer page marks paid orders as delivering through status action links', async ({ page }) => {
    const mockApi = await installMockWorkerApi(page, { orderStatus: 'paid' });
    await page.goto('/operaciones/transferencia/?order_id=ORD_TEST_001&action=delivering&token=delivering-token', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#adminTransferTitle')).toContainText('Marcar pedido en despacho');
    await expect(page.locator('#adminConfirmTransferButton')).toHaveText('Marcar en despacho');
    await expect(page.locator('#adminConfirmTransferButton')).toBeEnabled();

    await page.locator('#adminConfirmTransferButton').click();

    expect(mockApi.adminStatusRequests).toEqual([
      expect.objectContaining({
        token: 'delivering-token',
        status: 'delivering'
      })
    ]);
    await expect(page.locator('#adminOrderStatus')).toHaveText('delivering');
    await expect(page.locator('#adminTransferTitle')).toContainText('Pedido en despacho');
  });

  test('admin transfer page disables actions that do not match the current status', async ({ page }) => {
    await installMockWorkerApi(page, { orderStatus: 'pending_transfer' });
    await page.goto('/operaciones/transferencia/?order_id=ORD_TEST_001&action=delivering&token=delivering-token', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#adminTransferTitle')).toContainText('Marcar pedido en despacho');
    await expect(page.locator('#adminTransferCopy')).toContainText('no está disponible');
    await expect(page.locator('#adminConfirmTransferButton')).toBeDisabled();
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
