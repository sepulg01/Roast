export const SUPPORT_WHATSAPP_URL = 'https://wa.me/56991746361';

export const publicCatalogPayload = {
  ok: true,
  currency: 'CLP',
  generated_at: '2026-04-28T00:00:00.000Z',
  shipping_fee_clp: 3500,
  free_shipping_threshold_clp: 36000,
  communes: [
    { commune: 'Santiago', sector: 'Centro', dispatchable: true, free_shipping_eligible: true },
    { commune: 'Providencia', sector: 'Oriente', dispatchable: true, free_shipping_eligible: true },
    { commune: 'Las Condes', sector: 'Oriente', dispatchable: true, free_shipping_eligible: true },
    { commune: 'Peñalolén', sector: 'Oriente', dispatchable: true, free_shipping_eligible: true },
    { commune: 'Quilicura', sector: 'Norte', dispatchable: true, free_shipping_eligible: false },
    { commune: 'La Florida', sector: 'Sur', dispatchable: true, free_shipping_eligible: false },
    { commune: 'Pudahuel', sector: 'Poniente', dispatchable: true, free_shipping_eligible: false }
  ],
  catalog: [
    {
      product_code: 'downtime',
      product_name: 'Downtime',
      format_code: '250g',
      format_label: '250g',
      price_clp: 11900
    },
    {
      product_code: 'downtime',
      product_name: 'Downtime',
      format_code: '500g',
      format_label: '500g',
      price_clp: 19900
    },
    {
      product_code: 'downtime',
      product_name: 'Downtime',
      format_code: '1kg',
      format_label: '1kg',
      price_clp: 34900
    },
    {
      product_code: 'hiperfoco',
      product_name: 'Hiperfoco',
      format_code: '250g',
      format_label: '250g',
      price_clp: 11900
    },
    {
      product_code: 'hiperfoco',
      product_name: 'Hiperfoco',
      format_code: '500g',
      format_label: '500g',
      price_clp: 19900
    },
    {
      product_code: 'hiperfoco',
      product_name: 'Hiperfoco',
      format_code: '1kg',
      format_label: '1kg',
      price_clp: 34900
    }
  ]
};

function buildPublicCatalogPayload(options = {}) {
  return {
    ...publicCatalogPayload,
    free_shipping_threshold_clp: options.freeShippingThresholdClp || publicCatalogPayload.free_shipping_threshold_clp,
    communes: publicCatalogPayload.communes.map(commune => ({ ...commune })),
    catalog: publicCatalogPayload.catalog.map(item => ({ ...item }))
  };
}

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
    total_clp: 15400,
    internal_status: status,
    flow_checkout_url: ['pending_payment', 'link_sent'].includes(status) ? flowUrl : '',
    support_email: 'contacto@caferoast.cl',
    support_whatsapp: `${SUPPORT_WHATSAPP_URL}?text=Hola%20Roast.%20Necesito%20ayuda%20con%20mi%20pedido%20ORD_TEST_001.`
  };
}

export async function installMockWorkerApi(page, options = {}) {
  const catalogPayload = buildPublicCatalogPayload(options);
  const orderDraftRequests = [];
  const orderContactRequests = [];
  const checkoutOrderRequests = [];
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
      body: JSON.stringify(catalogPayload)
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
        subtotal_clp: 11900,
        shipping_clp: manualReview ? 0 : 3500,
        total_clp: manualReview ? 11900 : 15400,
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

  await page.route('**/api/checkout-orders', async route => {
    const request = route.request();
    const postData = request.postData();
    let checkoutOrderRequest = {};

    if (postData) {
      try {
        checkoutOrderRequest = JSON.parse(postData);
        checkoutOrderRequests.push(checkoutOrderRequest);
      } catch (error) {
        checkoutOrderRequests.push({ parseError: error.message, raw: postData });
      }
    }

    if (options.checkoutOrderHtmlError) {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><p>not the checkout worker</p>'
      });
      return;
    }

    if (options.checkoutOrderJsonNotFound) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: 'Not found'
        })
      });
      return;
    }

    if (options.checkoutOrderRequiresAcceptTotal && checkoutOrderRequest.accept_total !== true) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: 'accept_total and accept_terms are required'
        })
      });
      return;
    }

    const requestItems = Array.isArray(checkoutOrderRequest.items) ? checkoutOrderRequest.items : [];
    const subtotalClp = requestItems.reduce((sum, item) => {
      const catalogItem = catalogPayload.catalog.find(entry => (
        entry.product_code === item.product_code && entry.format_code === item.format_code
      ));
      return sum + ((catalogItem ? catalogItem.price_clp : 0) * Number(item.quantity || 1));
    }, 0);
    const normalizedCommune = String(checkoutOrderRequest.commune || '').trim().toLowerCase();
    const selectedCommune = catalogPayload.communes.find(entry => (
      String(entry.commune || '').trim().toLowerCase() === normalizedCommune
    ));
    const covered = Boolean(selectedCommune && selectedCommune.dispatchable);
    const qualifiesForFreeShipping = covered && subtotalClp >= catalogPayload.free_shipping_threshold_clp;
    const shippingClp = qualifiesForFreeShipping ? 0 : 3500;

    const confirmationNumber = options.checkoutOrderRawConfirmationNumber ? 'roast_0205789_live' : '0205789';
    const orderId = options.checkoutOrderLegacyRawOrderId ? 'roast_20260502_161221_qd5qs' : 'ORD_TEST_001';

    await route.fulfill({
      status: covered ? 200 : 422,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: covered,
        order_id: orderId,
        order_number: options.checkoutOrderLegacyRawOrderId ? '' : confirmationNumber,
        confirmation_number: options.checkoutOrderLegacyRawOrderId ? '' : confirmationNumber,
        subtotal_clp: subtotalClp,
        shipping_clp: shippingClp,
        total_clp: subtotalClp + shippingClp,
        iva_included_rate: 0.19,
        internal_status: 'pending_transfer',
        payment_method: 'transfer',
        transfer_expires_at: '2026-05-01T14:00:00.000Z',
        items_label: requestItems.length === 2 ? 'Downtime 1kg x2' : 'Downtime 1kg',
        error: covered ? '' : 'commune_outside_coverage',
        message: covered ? '' : 'No tenemos cobertura para esa comuna.',
        bank_transfer: {
          bank: 'BCI',
          account_type: 'Cuenta Corriente',
          account_number: '61947059',
          rut: '17515638-0',
          email: 'contacto@caferoast.cl'
        },
        support_email: 'contacto@caferoast.cl',
        support_whatsapp: '+56991746361'
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
    checkoutOrderRequests,
    orderDraftRequests,
    orderContactRequests,
    paymentLinkRequests,
    publicCatalogPayload: catalogPayload
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
