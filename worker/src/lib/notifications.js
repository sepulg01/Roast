import { hmacSha256Hex } from './utils.js';

const DEFAULT_SUPPORT_EMAIL = 'contacto@caferoast.cl';
const DEFAULT_RESEND_FROM = `Cafe Roast <${DEFAULT_SUPPORT_EMAIL}>`;
const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

const NOTIFIABLE_EVENTS = new Set([
  'draft_created',
  'payment_link_created',
  'order_contact_requested',
  'pending_transfer',
  'paid',
  'payment_failed',
  'manual_review'
]);

export function shouldNotifyEvent(eventType) {
  return NOTIFIABLE_EVENTS.has(eventType);
}

export async function notifyOperationalEvent(env, payload) {
  if (env.RESEND_API_KEY) {
    return notifyResendEvent(env, payload);
  }

  if (!env.APPS_SCRIPT_WEBHOOK_URL || !env.APPS_SCRIPT_SHARED_SECRET) {
    return false;
  }

  const payloadString = JSON.stringify(payload);
  const signature = await hmacSha256Hex(env.APPS_SCRIPT_SHARED_SECRET, payloadString);
  const response = await fetch(env.APPS_SCRIPT_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      payload,
      signature
    })
  });

  if (!response.ok) {
    return false;
  }

  const responsePayload = await response.json().catch(() => null);
  return !(responsePayload && responsePayload.ok === false);
}

async function notifyResendEvent(env, payload) {
  const orderId = firstValue(payload.order_id, getDetails(payload).order_id, getDisplayOrderNumber(payload));
  const messages = [{
    idempotencyKey: `roast:${orderId}:operational`,
    email: buildOperationalResendEmail(env, payload)
  }];

  if (payload.event_type === 'pending_transfer') {
    const customerEmail = buildCustomerPendingTransferEmail(env, payload);
    if (!customerEmail) {
      return false;
    }
    messages.push({
      idempotencyKey: `roast:${orderId}:customer`,
      email: customerEmail
    });
  }

  for (const message of messages) {
    const sent = await sendResendEmail(env, message.email, message.idempotencyKey);
    if (!sent) {
      return false;
    }
  }

  return true;
}

function buildOperationalResendEmail(env, payload) {
  const details = getDetails(payload);
  const orderNumber = getDisplayOrderNumber(payload);
  const recipient = firstValue(payload.recipient, payload.support_email, details.support_email, DEFAULT_SUPPORT_EMAIL);
  const html = buildOperationalHtml(payload);

  return {
    from: getResendFrom(env),
    reply_to: getResendReplyTo(env),
    to: [recipient],
    subject: `[Roast] ${payload.event_type || 'evento'} - ${orderNumber}`,
    html,
    text: stripHtml(html)
  };
}

function buildCustomerPendingTransferEmail(env, payload) {
  const details = getDetails(payload);
  const recipient = firstValue(details.email, payload.email);

  if (!recipient) {
    return null;
  }

  const orderNumber = getDisplayOrderNumber(payload);
  const firstName = firstValue(details.first_name, details.customer_name, payload.customer_name, 'cliente');
  const total = formatCurrency(details.total_clp);
  const html = `
    <div style="font-family:Arial,sans-serif;background:#0d0d0d;color:#f5f0e8;padding:24px;">
      <div style="max-width:680px;margin:0 auto;background:#151515;border:1px solid #2a2a2a;border-radius:12px;padding:24px;">
        <p style="margin:0 0 8px;color:#b9afa3;text-transform:uppercase;font-size:12px;font-weight:700;">Pedido recibido</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;color:#f5f0e8;">${escapeHtml(orderNumber)}</h1>
        <p style="margin:0 0 12px;">Hola ${escapeHtml(firstName)}</p>
        <p style="margin:0 0 12px;">Gracias por su preferencia. Recibimos tu pedido por transferencia bancaria.</p>
        <p style="margin:0 0 20px;color:#d9d0c5;">Usa el numero ${escapeHtml(orderNumber)} si necesitas comunicarte con nosotros sobre este pedido.</p>
        <table style="width:100%;border-collapse:collapse;background:#101010;border-radius:10px;overflow:hidden;">
          <tr>
            <td style="padding:10px 12px;border:1px solid #2f2f2f;color:#d9d0c5;">Total</td>
            <td style="padding:10px 12px;border:1px solid #2f2f2f;color:#f5f0e8;text-align:right;font-weight:700;">${escapeHtml(total)}</td>
          </tr>
        </table>
        <p style="margin:20px 0 0;color:#d9d0c5;">Responderemos desde ${escapeHtml(getResendReplyTo(env))}.</p>
      </div>
    </div>
  `;

  return {
    from: getResendFrom(env),
    reply_to: getResendReplyTo(env),
    to: [recipient],
    subject: `Hemos recibido tu pedido ${orderNumber}`,
    html,
    text: stripHtml(html)
  };
}

async function sendResendEmail(env, message, idempotencyKey) {
  const response = await fetch(RESEND_EMAILS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(message)
  });

  if (!response.ok) {
    return false;
  }

  const responsePayload = await response.json().catch(() => null);
  return !(responsePayload && (responsePayload.ok === false || responsePayload.error));
}

function buildOperationalHtml(payload) {
  const details = getDetails(payload);
  const fields = [
    ['Pedido', getDisplayOrderNumber(payload)],
    ['Evento', payload.event_type || 'Sin tipo'],
    ['Estado destino', firstValue(payload.to_status, details.internal_status, payload.internal_status, 'Sin estado')],
    ['Cliente', firstValue(details.customer_name, payload.customer_name, 'Sin cliente')],
    ['Email', firstValue(details.email, payload.email, 'Sin email')],
    ['Comuna', firstValue(details.commune, payload.commune, 'Sin comuna')],
    ['Direccion', firstValue(details.address, payload.address, 'Sin direccion')],
    ['Total', formatCurrency(firstValue(details.total_clp, payload.total_clp))]
  ];
  const rows = fields
    .map(([label, value]) => `<tr><td style="padding:8px 12px;border:1px solid #e7ddd0;font-weight:700;">${escapeHtml(label)}</td><td style="padding:8px 12px;border:1px solid #e7ddd0;">${escapeHtml(value)}</td></tr>`)
    .join('');

  return `
    <div style="font-family:Arial,sans-serif;background:#0d0d0d;color:#f5f0e8;padding:24px;">
      <h1 style="font-size:24px;margin:0 0 16px;">Roast - Evento operativo</h1>
      <p style="margin:0 0 20px;color:#d9d0c5;">Se registro un evento relevante en el flujo web de pedido.</p>
      <table style="border-collapse:collapse;background:#1a1a1a;border-radius:10px;overflow:hidden;">${rows}</table>
    </div>
  `;
}

function getDetails(payload) {
  return payload && payload.payload && typeof payload.payload === 'object' ? payload.payload : {};
}

function getDisplayOrderNumber(payload) {
  const details = getDetails(payload);
  const candidates = [
    details.confirmation_number,
    details.order_number,
    payload.confirmation_number,
    payload.order_number,
    details.order_id,
    payload.order_id,
    'sin pedido'
  ];

  for (const candidate of candidates) {
    const displayNumber = normalizeDisplayNumber(candidate);
    if (displayNumber) return displayNumber;
  }

  return 'sin pedido';
}

function normalizeDisplayNumber(value) {
  const candidate = String(value || '').trim();
  const exactDigits = candidate.match(/^\d{7,8}$/);
  if (exactDigits) return exactDigits[0];

  const embeddedDigits = candidate.match(/\d{7,8}/);
  if (embeddedDigits) return embeddedDigits[0];

  return '';
}

function getResendFrom(env) {
  return firstValue(env.RESEND_FROM, DEFAULT_RESEND_FROM);
}

function getResendReplyTo(env) {
  return firstValue(env.RESEND_REPLY_TO, DEFAULT_SUPPORT_EMAIL);
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
}

function formatCurrency(value) {
  const number = Number(value || 0);
  return `$${Math.round(number).toLocaleString('es-CL')} CLP`;
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
