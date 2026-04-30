export const SUPPORT_WHATSAPP_URL = 'https://wa.me/56991746361';

export const publicCatalogPayload = {
  ok: true,
  currency: 'CLP',
  generated_at: '2026-04-28T00:00:00.000Z',
  free_shipping_threshold_clp: 36000,
  catalog: [
    {
      product_code: 'downtime',
      product_name: 'Downtime',
      format_code: '250g',
      format_label: '250g',
      price_clp: 9900
    },
    {
      product_code: 'downtime',
      product_name: 'Downtime',
      format_code: '500g',
      format_label: '500g',
      price_clp: 18900
    },
    {
      product_code: 'downtime',
      product_name: 'Downtime',
      format_code: '1kg',
      format_label: '1kg',
      price_clp: 32900
    },
    {
      product_code: 'hiperfoco',
      product_name: 'Hiperfoco',
      format_code: '250g',
      format_label: '250g',
      price_clp: 9900
    },
    {
      product_code: 'hiperfoco',
      product_name: 'Hiperfoco',
      format_code: '500g',
      format_label: '500g',
      price_clp: 18900
    },
    {
      product_code: 'hiperfoco',
      product_name: 'Hiperfoco',
      format_code: '1kg',
      format_label: '1kg',
      price_clp: 32900
    }
  ]
};

export function collectCriticalConsole(page) {
  const messages = [];

  page.on('console', message => {
    if (message.type() === 'error') {
      messages.push(message.text());
    }
  });

  page.on('pageerror', error => {
    messages.push(error.message);
  });

  return messages;
}

function orderPayload(status = 'paid') {
  const flowUrl = '/__mock-flow/checkout?token=test-token';
  return {
    ok: true,
    order_id: 'ORD_TEST_001',
    items_label: 'Downtime 250g',
    total_clp: 13400,
    internal_status: status,
    flow_checkout_url: ['pending_payment', 'link_sent'].includes(status) ? flowUrl : '',
    support_email: 'contacto@caferoast.cl',
    support_whatsapp: `${SUPPORT_WHATSAPP_URL}?text=Hola%20Roast.%20Necesito%20ayuda%20con%20mi%20pedido%20ORD_TEST_001.`
  };
}

export async function installMockWorkerApi(page, options = {}) {
  const orderDraftRequests = [];
  const orderContactRequests = [];
  const paymentLinkRequests = [];

  await page.route('**/api/public-catalog', async route => {
    if (options.catalogHtmlError) {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><p>static fallback</p>'
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(publicCatalogPayload)
    });
  });

  await page.route('**/api/order-drafts', async route => {
    const request = route.request();
    const postData = request.postData();

    if (postData) {
      try {
        orderDraftRequests.push(JSON.parse(postData));
      } catch (error) {
        orderDraftRequests.push({ parseError: error.message, raw: postData });
      }
    }

    if (options.orderDraftHtmlError) {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><p>not the worker</p>'
      });
      return;
    }

    const manualReview = Boolean(options.manualReview);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        order_id: 'ORD_TEST_001',
        subtotal_clp: 9900,
        shipping_clp: manualReview ? 0 : 3500,
        total_clp: manualReview ? 9900 : 13400,
        internal_status: manualReview ? 'manual_review' : 'draft',
        manual_review_reason: manualReview ? 'commune_outside_coverage' : '',
        items_label: 'Downtime 250g',
        support_email: 'contacto@caferoast.cl',
        support_whatsapp: '+56991746361'
      })
    });
  });

  await page.route('**/api/payment-links', async route => {
    const request = route.request();
    const postData = request.postData();

    if (postData) {
      try {
        paymentLinkRequests.push(JSON.parse(postData));
      } catch (error) {
        paymentLinkRequests.push({ parseError: error.message, raw: postData });
      }
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        checkout_url: '/__mock-flow/checkout?token=test-token',
        flow_order: 'FLOW_TEST_001',
        internal_status: 'link_sent'
      })
    });
  });

  await page.route('**/api/order-contact-requests', async route => {
    const request = route.request();
    const postData = request.postData();

    if (postData) {
      try {
        orderContactRequests.push(JSON.parse(postData));
      } catch (error) {
        orderContactRequests.push({ parseError: error.message, raw: postData });
      }
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        internal_status: 'contact_requested',
        whatsapp_url: `${SUPPORT_WHATSAPP_URL}?text=Hola%20Roast.%20Quiero%20cerrar%20mi%20pedido%20ORD_TEST_001.`
      })
    });
  });

  await page.route('https://wa.me/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Mock WhatsApp</title><h1>Mock WhatsApp redirect</h1>'
    });
  });

  await page.route('**/api/orders/*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(orderPayload(options.orderStatus || 'paid'))
    });
  });

  await page.route('**/__mock-flow/checkout?token=test-token', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Mock Flow</title><h1>Mock Flow checkout</h1>'
    });
  });

  return {
    orderDraftRequests,
    orderContactRequests,
    paymentLinkRequests,
    publicCatalogPayload
  };
}

export async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth
  }));
  const maxScrollWidth = Math.max(metrics.scrollWidth, metrics.bodyScrollWidth);

  if (maxScrollWidth > metrics.clientWidth + 1) {
    throw new Error(`Horizontal overflow: clientWidth=${metrics.clientWidth}, scrollWidth=${maxScrollWidth}`);
  }
}
