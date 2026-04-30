import {
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
        return handleOrderDraft(request, env);
      }

      if (request.method === 'POST' && url.pathname === '/api/payment-links') {
        return handlePaymentLink(request, env, publicBaseUrl);
      }

      if (request.method === 'POST' && url.pathname === '/api/order-contact-requests') {
        return handleOrderContactRequest(request, env);
      }

      if (request.method === 'GET' && url.pathname === '/api/public-catalog') {
        return handlePublicCatalog(env);
      }

      if (request.method === 'POST' && url.pathname === '/api/flow/confirmation') {
        return handleFlowConfirmation(request, env, ctx);
      }

      if (request.method === 'POST' && url.pathname === '/pago/retorno') {
        return handleFlowReturn(request, env, publicBaseUrl);
      }

      if (request.method === 'GET' && extractOrderId(url.pathname)) {
        return handlePublicOrder(extractOrderId(url.pathname), env);
      }

      return errorResponse('Not found', { status: 404 });
    } catch (error) {
      return errorResponse(error.message || 'Unexpected error', { status: 500 });
    }
  }
};
