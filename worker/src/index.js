import {
  createCheckoutOrder,
  createOrderContactRequest,
  createOrderDraft,
  createPaymentLink,
  getPublicCatalog,
  getPublicOrder,
  syncPaymentStatus
} from './lib/orders.js';
import {
  errorResponse,
  getPublicBaseUrl,
  jsonResponse,
  parseRequestBody,
  redirectResponse,
  textResponse
} from './lib/utils.js';

function extractOrderId(pathname) {
  const match = pathname.match(/^\/api\/orders\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function handleOrderDraft(request, env) {
  const payload = await parseRequestBody(request);
  const result = await createOrderDraft(env, payload);
  return jsonResponse(result);
}

async function handlePaymentLink(request, env, publicBaseUrl) {
  const payload = await parseRequestBody(request);
  const result = await createPaymentLink(env, payload, publicBaseUrl);
  return jsonResponse(result);
}

async function handleOrderContactRequest(request, env) {
  const payload = await parseRequestBody(request);
  const result = await createOrderContactRequest(env, payload);
  return jsonResponse(result);
}

async function handleCheckoutOrder(request, env) {
  const payload = await parseRequestBody(request);
  const result = await createCheckoutOrder(env, payload);
  return jsonResponse(result);
}

function hasEnvValue(env, name) {
  return Boolean(String(env && env[name] || '').trim());
}

async function handleHealth(env) {
  const googleSheetsConfigured = hasEnvValue(env, 'GOOGLE_SERVICE_ACCOUNT_JSON') && hasEnvValue(env, 'GOOGLE_SHEET_ID');
  const googleMapsConfigured = hasEnvValue(env, 'GOOGLE_MAPS_API_KEY');
  const resendConfigured = hasEnvValue(env, 'RESEND_API_KEY');
  const appsScriptFallbackConfigured = hasEnvValue(env, 'APPS_SCRIPT_WEBHOOK_URL') && hasEnvValue(env, 'APPS_SCRIPT_SHARED_SECRET');

  return jsonResponse({
    ok: true,
    service: 'roast-worker',
    features: {
      confirmation_number: true,
      terms_only_checkout: true,
      resend_notifications: true
    },
    configuration: {
      google_sheets: googleSheetsConfigured,
      google_maps: googleMapsConfigured,
      resend: resendConfigured,
      apps_script_fallback: appsScriptFallbackConfigured,
      notifications: resendConfigured || appsScriptFallbackConfigured
    }
  });
}

async function handleFlowConfirmation(request, env, ctx) {
  const payload = await parseRequestBody(request);
  const token = payload.token || new URL(request.url).searchParams.get('token');

  if (!token) {
    return textResponse('missing token', { status: 400 });
  }

  ctx.waitUntil(syncPaymentStatus(env, token, 'api/flow/confirmation'));
  return textResponse('ok');
}

async function handleFlowReturn(request, env, publicBaseUrl) {
  const payload = await parseRequestBody(request);
  const token = payload.token || new URL(request.url).searchParams.get('token');

  if (!token) {
    return redirectResponse(`${publicBaseUrl}/pago/resultado/?status=failed`, 303, {
      'X-Robots-Tag': 'noindex, nofollow'
    });
  }

  const result = await syncPaymentStatus(env, token, 'pago/retorno');
  return redirectResponse(`${publicBaseUrl}/pago/resultado/?order_id=${encodeURIComponent(result.order_id)}`, 303, {
    'X-Robots-Tag': 'noindex, nofollow'
  });
}

async function handlePublicOrder(orderId, env) {
  const result = await getPublicOrder(env, orderId);
  return jsonResponse(result);
}

async function handlePublicCatalog(env) {
  const result = await getPublicCatalog(env);
  return jsonResponse(result, {
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const publicBaseUrl = getPublicBaseUrl(env, request);

    if (request.method === 'OPTIONS') {
      return textResponse('ok');
    }

    try {
      if (request.method === 'POST' && url.pathname === '/api/order-drafts') {
        return await handleOrderDraft(request, env);
      }

      if (request.method === 'POST' && url.pathname === '/api/payment-links') {
        return await handlePaymentLink(request, env, publicBaseUrl);
      }

      if (request.method === 'POST' && url.pathname === '/api/order-contact-requests') {
        return await handleOrderContactRequest(request, env);
      }

      if (request.method === 'POST' && url.pathname === '/api/checkout-orders') {
        return await handleCheckoutOrder(request, env);
      }

      if (request.method === 'GET' && url.pathname === '/api/health') {
        return await handleHealth(env);
      }

      if (request.method === 'GET' && url.pathname === '/api/public-catalog') {
        return await handlePublicCatalog(env);
      }

      if (request.method === 'POST' && url.pathname === '/api/flow/confirmation') {
        return await handleFlowConfirmation(request, env, ctx);
      }

      if (request.method === 'POST' && url.pathname === '/pago/retorno') {
        return await handleFlowReturn(request, env, publicBaseUrl);
      }

      if (request.method === 'GET' && extractOrderId(url.pathname)) {
        return await handlePublicOrder(extractOrderId(url.pathname), env);
      }

      return errorResponse('Not found', { status: 404 });
    } catch (error) {
      return errorResponse(error.message || 'Unexpected error', {
        status: error.status || 500,
        details: error.details
      });
    }
  }
};
