import { hmacSha256Hex } from './utils.js';

const DEFAULT_SUPPORT_EMAIL = 'contacto@caferoast.cl';
const DEFAULT_RESEND_FROM = `Cafe Roast <${DEFAULT_SUPPORT_EMAIL}>`;
const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const WHATSAPP_GRAPH_VERSION = 'v20.0';

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
  const result = await notifyOperationalEventWithResults(env, payload);
  return result.ok;
}

export async function notifyOperationalEventWithResults(env, payload) {
  const channels = {};

  if (env.RESEND_API_KEY) {
    channels.email = await notifyResendEvent(env, payload);
  } else if (env.APPS_SCRIPT_WEBHOOK_URL && env.APPS_SCRIPT_SHARED_SECRET) {
    channels.email = await notifyAppsScriptEvent(env, payload);
  } else {
    channels.email = {
      ok: false,
      provider: 'none',
      skipped: true,
      reason: 'email_not_configured'
    };
  }

  channels.whatsapp = await notifyWhatsAppEvent(env, payload);

  return {
    ok: Boolean(channels.email && channels.email.ok),
    channels
  };
}

async function notifyAppsScriptEvent(env, payload) {
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
    return {
      ok: false,
      provider: 'apps_script',
      status: response.status
    };
  }

  const responsePayload = await response.json().catch(() => null);
  const ok = !(responsePayload && responsePayload.ok === false);

  return {
    ok,
    provider: 'apps_script',
    status: response.status,
    response: summarizeProviderResponse(responsePayload)
  };
}

async function notifyResendEvent(env, payload) {
  const orderId = firstValue(payload.order_id, getDetails(payload).order_id, getDisplayOrderNumber(payload));
  const results = {};
  const messages = [{
    name: 'operational',
    idempotencyKey: `roast:${orderId}:operational`,
    email: buildOperationalResendEmail(env, payload)
  }];

  if (payload.event_type === 'pending_transfer') {
    const customerEmail = buildCustomerPendingTransferEmail(env, payload);
    if (!customerEmail) {
      return {
        ok: false,
        provider: 'resend',
        messages: {
          customer: {
            ok: false,
            skipped: true,
            reason: 'missing_customer_email'
          }
        }
      };
    }
    messages.push({
      name: 'customer',
      idempotencyKey: `roast:${orderId}:customer`,
      email: customerEmail
    });
  }

  for (const message of messages) {
    results[message.name] = await sendResendEmail(env, message.email, message.idempotencyKey);
  }

  return {
    ok: Object.values(results).every(result => result.ok),
    provider: 'resend',
    messages: results
  };
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
  const transfer = details.bank_transfer || {};
  const expiresAt = formatDateTime(details.transfer_expires_at);
  const itemsTable = buildItemsTable(details.items);
  const html = `
    <div style="font-family:Arial,sans-serif;background:#0d0d0d;color:#f5f0e8;padding:24px;">
      <div style="max-width:680px;margin:0 auto;background:#151515;border:1px solid #2a2a2a;border-radius:12px;padding:24px;">
        <p style="margin:0 0 8px;color:#b9afa3;text-transform:uppercase;font-size:12px;font-weight:700;">Pedido recibido</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;color:#f5f0e8;">${escapeHtml(orderNumber)}</h1>
        <p style="margin:0 0 12px;">Hola ${escapeHtml(firstName)}</p>
        <p style="margin:0 0 12px;">Gracias por tu preferencia. Recibimos tu pedido por transferencia bancaria.</p>
        <p style="margin:0 0 20px;color:#d9d0c5;">Para confirmarlo, transfiere <strong style="color:#f5f0e8;">${escapeHtml(total)}</strong> antes de ${escapeHtml(expiresAt || 'la hora indicada en pantalla')}.</p>
        <p style="margin:0 0 20px;color:#d9d0c5;">Tu transferencia vence el ${escapeHtml(expiresAt || 'horario indicado en pantalla')}.</p>
        ${itemsTable}
        ${buildTotalsTable(details)}
        ${buildBankTransferTable(transfer, total, expiresAt)}
        ${buildDeliveryBlock(details)}
        <p style="margin:20px 0 0;color:#d9d0c5;">Envia el comprobante a ${escapeHtml(firstValue(transfer.email, getResendReplyTo(env)))} e incluye el numero ${escapeHtml(orderNumber)}.</p>
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
    return {
      ok: false,
      status: response.status
    };
  }

  const responsePayload = await response.json().catch(() => null);
  return {
    ok: !(responsePayload && (responsePayload.ok === false || responsePayload.error)),
    status: response.status,
    id: responsePayload && responsePayload.id ? responsePayload.id : ''
  };
}

function buildOperationalHtml(payload) {
  const details = getDetails(payload);
  const orderNumber = getDisplayOrderNumber(payload);
  const itemsTable = buildItemsTable(details.items);
  const totalsTable = buildTotalsTable(details);
  const bankTable = details.bank_transfer ? buildBankTransferTable(details.bank_transfer, formatCurrency(details.total_clp), formatDateTime(details.transfer_expires_at)) : '';
  const adminLink = firstValue(details.admin_transfer_url, payload.admin_transfer_url);
  const fields = [
    ['Pedido', orderNumber],
    ['Evento', payload.event_type || 'Sin tipo'],
    ['Estado destino', firstValue(payload.to_status, details.internal_status, payload.internal_status, 'Sin estado')],
    ['Cliente', firstValue(details.customer_name, payload.customer_name, 'Sin cliente')],
    ['Email', firstValue(details.email, payload.email, 'Sin email')],
    ['Telefono', firstValue(details.phone, payload.phone, 'Sin telefono')],
    ['Comuna', firstValue(details.commune, payload.commune, 'Sin comuna')],
    ['Direccion', firstValue(details.address, payload.address, 'Sin direccion')],
    ['Notas', firstValue(details.notes, payload.notes, 'Sin notas')],
    ['Vencimiento transferencia', firstValue(formatDateTime(details.transfer_expires_at), 'Sin vencimiento')],
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
      ${itemsTable}
      ${totalsTable}
      ${bankTable}
      ${adminLink ? `<p style="margin:22px 0 0;"><a href="${escapeHtml(adminLink)}" style="display:inline-block;background:#ff5a1f;color:#160c07;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:8px;">Validar transferencia</a></p>` : ''}
    </div>
  `;
}

async function notifyWhatsAppEvent(env, payload) {
  const templateName = getWhatsAppTemplateName(env, payload.event_type);

  if (!templateName || !env.WHATSAPP_CLOUD_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_NOTIFY_TO) {
    return {
      ok: true,
      provider: 'meta_whatsapp',
      skipped: true,
      reason: 'whatsapp_not_configured'
    };
  }

  const details = getDetails(payload);
  const orderNumber = getDisplayOrderNumber(payload);
  const status = firstValue(payload.to_status, details.internal_status, payload.event_type, 'sin estado');
  const messagePayload = {
    messaging_product: 'whatsapp',
    to: normalizePhone(env.WHATSAPP_NOTIFY_TO),
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: firstValue(env.WHATSAPP_TEMPLATE_LANGUAGE, 'es_CL')
      },
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: orderNumber },
          { type: 'text', text: payload.event_type || status },
          { type: 'text', text: firstValue(details.customer_name, payload.customer_name, 'Sin cliente') },
          { type: 'text', text: formatCurrency(firstValue(details.total_clp, payload.total_clp)) },
          { type: 'text', text: status }
        ]
      }]
    }
  };
  try {
    const response = await fetch(`https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_CLOUD_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messagePayload)
    });
    const responsePayload = await response.json().catch(() => null);

    return {
      ok: response.ok && !(responsePayload && responsePayload.error),
      provider: 'meta_whatsapp',
      status: response.status,
      response: summarizeProviderResponse(responsePayload)
    };
  } catch (error) {
    return {
      ok: false,
      provider: 'meta_whatsapp',
      error: error.message || 'whatsapp_request_failed'
    };
  }
}

function getWhatsAppTemplateName(env, eventType) {
  if (eventType === 'paid') {
    return firstValue(env.WHATSAPP_TEMPLATE_PAID_EVENT, env.WHATSAPP_TEMPLATE_ORDER_EVENT);
  }

  if (eventType === 'pending_transfer') {
    return firstValue(env.WHATSAPP_TEMPLATE_ORDER_EVENT);
  }

  return '';
}

function normalizePhone(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

function buildItemsTable(items) {
  const list = Array.isArray(items) ? items : [];

  if (!list.length) return '';

  const rows = list.map(item => {
    const label = [
      firstValue(item.product_name, item.product_code, 'Producto'),
      firstValue(item.format_label, item.format_code),
      item.grind
    ].filter(Boolean).join(' · ');
    const quantity = Number(item.quantity || 1);
    const subtotal = formatCurrency(firstValue(item.line_subtotal_clp, Number(item.unit_price_clp || 0) * quantity));

    return `<tr><td style="padding:10px 12px;border:1px solid #2f2f2f;color:#d9d0c5;">${escapeHtml(label)} x${escapeHtml(quantity)}</td><td style="padding:10px 12px;border:1px solid #2f2f2f;color:#f5f0e8;text-align:right;font-weight:700;">${escapeHtml(subtotal)}</td></tr>`;
  }).join('');

  return `
    <h2 style="margin:22px 0 10px;font-size:16px;color:#f5f0e8;">Detalle del pedido</h2>
    <table style="width:100%;border-collapse:collapse;background:#101010;border-radius:10px;overflow:hidden;">${rows}</table>
  `;
}

function buildTotalsTable(details) {
  const rows = [
    ['Subtotal', formatCurrency(details.subtotal_clp)],
    ['Envio', Number(details.shipping_clp || 0) === 0 ? 'Gratis' : formatCurrency(details.shipping_clp)],
    ['Total', formatCurrency(details.total_clp)]
  ].map(([label, value]) => `<tr><td style="padding:10px 12px;border:1px solid #2f2f2f;color:#d9d0c5;">${escapeHtml(label)}</td><td style="padding:10px 12px;border:1px solid #2f2f2f;color:#f5f0e8;text-align:right;font-weight:700;">${escapeHtml(value)}</td></tr>`).join('');

  return `
    <h2 style="margin:22px 0 10px;font-size:16px;color:#f5f0e8;">Totales</h2>
    <table style="width:100%;border-collapse:collapse;background:#101010;border-radius:10px;overflow:hidden;">${rows}</table>
  `;
}

function buildBankTransferTable(transfer, total, expiresAt) {
  const rows = [
    ['Monto a transferir', total],
    ['Banco', transfer.bank],
    ['Tipo de cuenta', transfer.account_type],
    ['Numero', transfer.account_number],
    ['Titular', firstValue(transfer.holder, transfer.account_holder)],
    ['RUT', transfer.rut],
    ['Email comprobante', transfer.email],
    ['Valida hasta', expiresAt]
  ].filter(([, value]) => firstValue(value)).map(([label, value]) => `<tr><td style="padding:10px 12px;border:1px solid #2f2f2f;color:#d9d0c5;">${escapeHtml(label)}</td><td style="padding:10px 12px;border:1px solid #2f2f2f;color:#f5f0e8;text-align:right;font-weight:700;">${escapeHtml(value)}</td></tr>`).join('');

  if (!rows) return '';

  return `
    <h2 style="margin:22px 0 10px;font-size:16px;color:#f5f0e8;">Datos para transferencia</h2>
    <table style="width:100%;border-collapse:collapse;background:#101010;border-radius:10px;overflow:hidden;">${rows}</table>
  `;
}

function buildDeliveryBlock(details) {
  const address = [details.address, details.commune].filter(Boolean).join(', ');

  if (!address) return '';

  return `
    <h2 style="margin:22px 0 10px;font-size:16px;color:#f5f0e8;">Entrega</h2>
    <p style="margin:0;color:#d9d0c5;">${escapeHtml(address)}</p>
  `;
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Santiago'
  }).format(date);
}

function summarizeProviderResponse(payload) {
  if (!payload || typeof payload !== 'object') return payload || null;
  const result = {};

  for (const key of ['id', 'ok', 'error', 'message', 'messages']) {
    if (payload[key] !== undefined) {
      result[key] = payload[key];
    }
  }

  return result;
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
