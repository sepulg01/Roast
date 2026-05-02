const DEFAULT_SUPPORT_EMAIL = 'contacto@caferoast.cl';
const DEFAULT_SUPPORT_WHATSAPP = '+56991746361';
const DEFAULT_SUPPORT_WHATSAPP_DISPLAY = '+56 9 9174 6361';
const DEFAULT_LOGO_URL = 'https://caferoast.cl/assets/logos/logo_white.png';
const CUSTOMER_CONFIRMATION_SUBJECT = 'Hemos recibido tu pedido!';

function doPost(e) {
  try {
    const rawBody = e && e.postData ? e.postData.contents : '{}';
    const parsedBody = JSON.parse(rawBody);
    const payload = parsedBody.payload || {};
    const providedSignature = String(parsedBody.signature || '');
    const sharedSecret = PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SHARED_SECRET');

    if (!sharedSecret) {
      return jsonOutput({ ok: false, error: 'Missing APPS_SCRIPT_SHARED_SECRET' }, 500);
    }

    const payloadString = JSON.stringify(payload);
    const expectedSignature = toHexString(
      Utilities.computeHmacSha256Signature(payloadString, sharedSecret)
    );

    if (providedSignature !== expectedSignature) {
      return jsonOutput({ ok: false, error: 'Invalid signature' }, 401);
    }

    const operationalEmail = buildOperationalEmail(payload);
    const results = {
      operational: sendEmailMessage(operationalEmail),
      customer: null
    };

    if (shouldSendCustomerConfirmation(payload)) {
      results.customer = sendEmailMessage(buildCustomerConfirmationEmail(payload));
    }

    return jsonOutput({ ok: true, emails: results });
  } catch (error) {
    return jsonOutput({ ok: false, error: error.message || 'Unexpected error' }, 500);
  }
}

function buildOperationalEmail(payload) {
  const recipient = payload.recipient || DEFAULT_SUPPORT_EMAIL;
  const subject = `[Roast] ${payload.event_type || 'evento'} · ${getDisplayOrderNumber(payload)}`;
  const htmlBody = buildEmailBody(payload);

  return {
    to: recipient,
    subject,
    body: stripHtml(htmlBody),
    htmlBody,
    name: 'Roast Operaciones',
    replyTo: DEFAULT_SUPPORT_EMAIL
  };
}

function shouldSendCustomerConfirmation(payload) {
  const details = payload.payload || {};
  return payload.event_type === 'pending_transfer' && Boolean(firstValue(details.email, payload.email));
}

function getDisplayOrderNumber(payload) {
  const details = payload.payload || {};
  return firstValue(
    details.confirmation_number,
    details.order_number,
    payload.confirmation_number,
    payload.order_number,
    details.order_id,
    payload.order_id,
    'sin pedido'
  );
}

function buildCustomerConfirmationEmail(payload) {
  const details = payload.payload || {};
  const supportEmail = firstValue(details.support_email, payload.support_email, DEFAULT_SUPPORT_EMAIL);
  const supportWhatsapp = firstValue(details.support_whatsapp, payload.support_whatsapp, DEFAULT_SUPPORT_WHATSAPP);
  const supportWhatsappDisplay = supportWhatsapp === DEFAULT_SUPPORT_WHATSAPP ? DEFAULT_SUPPORT_WHATSAPP_DISPLAY : supportWhatsapp;
  const firstName = firstValue(details.first_name, details.customer_name, payload.customer_name, 'cliente');
  const orderId = getDisplayOrderNumber(payload);
  const logoUrl = firstValue(details.logo_url, DEFAULT_LOGO_URL);
  const items = Array.isArray(details.items) ? details.items : [];
  const itemRows = buildCustomerItemsRows(items);
  const subtotal = formatCurrency(details.subtotal_clp);
  const shipping = formatCurrency(details.shipping_clp);
  const tax = formatCurrency(details.tax_included_clp);
  const total = formatCurrency(details.total_clp);
  const body = [
    `Hola ${firstName}`,
    '',
    'Gracias por su preferencia',
    'Favor considerar los tiempos de despacho en Santiago son entre 1 a 3 dias hábiles, aunque con un poco de suerte llegamos hoy!',
    '',
    `Pedido: ${orderId}`,
    items.map(formatPlainTextItem).filter(Boolean).join('\n'),
    '',
    `Subtotal: ${subtotal}`,
    `Envío: ${shipping}`,
    `IVA incluido: ${tax}`,
    `Total: ${total}`,
    '',
    `Si necesita comunicarse con nosotros por este pedido, nuestros canales de atención están disponibles en: ${supportEmail}. o mediante whatsapp en ${supportWhatsappDisplay}`
  ].join('\n');

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;background:#0d0d0d;color:#f5f0e8;padding:24px;">
      <div style="max-width:680px;margin:0 auto;background:#151515;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;">
        <div style="padding:24px 24px 10px;">
          <img src="${escapeHtml(logoUrl)}" alt="Roast" style="display:block;max-width:150px;height:auto;margin:0 0 20px;" />
          <p style="margin:0 0 8px;color:#9a9a9a;text-transform:uppercase;letter-spacing:.08em;font-size:12px;font-weight:700;">Pedido recibido</p>
          <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;color:#f5f0e8;">${escapeHtml(orderId)}</h1>
          <p style="margin:0 0 12px;">Hola ${escapeHtml(firstName)}</p>
          <p style="margin:0 0 8px;">Gracias por su preferencia</p>
          <p style="margin:0 0 22px;color:#d9d0c5;">Favor considerar los tiempos de despacho en Santiago son entre 1 a 3 dias hábiles, aunque con un poco de suerte llegamos hoy!</p>
        </div>
        <div style="padding:0 24px 24px;">
          <h2 style="font-size:18px;margin:0 0 10px;color:#f5f0e8;">Resumen del pedido</h2>
          <table style="width:100%;border-collapse:collapse;background:#1a1a1a;border-radius:12px;overflow:hidden;margin-bottom:18px;">
            <thead>
              <tr>
                <th style="padding:10px 12px;border:1px solid #2f2f2f;text-align:left;color:#f5f0e8;">Producto</th>
                <th style="padding:10px 12px;border:1px solid #2f2f2f;text-align:left;color:#f5f0e8;">Detalle</th>
                <th style="padding:10px 12px;border:1px solid #2f2f2f;text-align:right;color:#f5f0e8;">Valor</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
          <table style="width:100%;border-collapse:collapse;background:#101010;border-radius:12px;overflow:hidden;">
            ${buildCustomerTotalsRow('Subtotal', subtotal)}
            ${buildCustomerTotalsRow('Envío', shipping)}
            ${buildCustomerTotalsRow('IVA incluido', tax)}
            ${buildCustomerTotalsRow('Total', total, true)}
          </table>
          <p style="margin:22px 0 0;color:#d9d0c5;">Si necesita comunicarse con nosotros por este pedido, nuestros canales de atención están disponibles en: <a href="mailto:${escapeHtml(supportEmail)}" style="color:#f5f0e8;">${escapeHtml(supportEmail)}</a>. o mediante whatsapp en ${escapeHtml(supportWhatsappDisplay)}</p>
        </div>
      </div>
    </div>
  `;

  return {
    to: firstValue(details.email, payload.email),
    subject: CUSTOMER_CONFIRMATION_SUBJECT,
    body,
    htmlBody,
    name: DEFAULT_SUPPORT_EMAIL,
    replyTo: supportEmail
  };
}

function sendEmailMessage(message) {
  const options = {
    htmlBody: message.htmlBody,
    name: message.name || 'Roast',
    replyTo: message.replyTo || DEFAULT_SUPPORT_EMAIL
  };

  try {
    if (typeof GmailApp !== 'undefined' && GmailApp.getAliases) {
      const aliases = GmailApp.getAliases();
      if (aliases.indexOf(DEFAULT_SUPPORT_EMAIL) !== -1) {
        GmailApp.sendEmail(message.to, message.subject, message.body || stripHtml(message.htmlBody), {
          ...options,
          from: DEFAULT_SUPPORT_EMAIL
        });
        return { ok: true, sender: DEFAULT_SUPPORT_EMAIL, service: 'GmailApp' };
      }
    }
  } catch (error) {
    // Fall back to MailApp so an alias issue does not block the operational notification path.
  }

  MailApp.sendEmail({
    to: message.to,
    subject: message.subject,
    body: message.body || stripHtml(message.htmlBody),
    htmlBody: message.htmlBody,
    name: options.name,
    replyTo: options.replyTo
  });

  return { ok: true, sender: options.replyTo, service: 'MailApp' };
}

function buildEmailBody(payload) {
  const details = payload.payload || {};
  const fields = [
    ['Pedido', getDisplayOrderNumber(payload)],
    ['Evento', payload.event_type || 'Sin tipo'],
    ['Estado destino', firstValue(payload.to_status, details.internal_status, payload.internal_status, 'Sin estado')],
    ['Cliente', firstValue(details.customer_name, payload.customer_name, 'Sin cliente')],
    ['Email', firstValue(details.email, payload.email, 'Sin email')],
    ['Telefono', firstValue(details.phone, payload.phone, 'Sin telefono')],
    ['Comuna', firstValue(details.commune, payload.commune, 'Sin comuna')],
    ['Direccion', firstValue(details.address, payload.address, 'Sin direccion')],
    ['Referencia', firstValue(details.address_ref, payload.address_ref, 'Sin referencia')],
    ['Notas', firstValue(details.notes, payload.notes, 'Sin notas')],
    ['Origen', firstValue(details.origin, payload.origin, payload.source, 'Sin origen')],
    ['Canal', firstValue(details.channel, payload.channel, 'Sin canal')],
    ['Items', firstValue(details.items_label, payload.items_label, 'Sin items')],
    ['Subtotal', formatCurrency(firstValue(details.subtotal_clp, payload.subtotal_clp))],
    ['Despacho', formatCurrency(firstValue(details.shipping_clp, payload.shipping_clp))],
    ['Total', formatCurrency(firstValue(details.total_clp, payload.total_clp))],
    ['Soporte email', firstValue(details.support_email, payload.support_email, DEFAULT_SUPPORT_EMAIL)],
    ['Soporte WhatsApp', firstValue(details.whatsapp_url, details.support_whatsapp, payload.support_whatsapp, 'Sin WhatsApp')]
  ];
  const rows = fields
    .map(([label, value]) => `<tr><td style="padding:8px 12px;border:1px solid #e7ddd0;font-weight:700;">${escapeHtml(label)}</td><td style="padding:8px 12px;border:1px solid #e7ddd0;">${escapeHtml(value)}</td></tr>`)
    .join('');
  const itemsTable = buildItemsTable(details.items || []);

  return `
    <div style="font-family:Arial,sans-serif;background:#0d0d0d;color:#f5f0e8;padding:24px;">
      <h1 style="font-size:24px;margin:0 0 16px;">Roast · Evento operativo</h1>
      <p style="margin:0 0 20px;color:#d9d0c5;">Se registró un evento relevante en el flujo web de pedido.</p>
      <table style="border-collapse:collapse;background:#1a1a1a;border-radius:12px;overflow:hidden;">
        ${rows}
      </table>
      ${itemsTable}
      <pre style="margin-top:20px;padding:16px;background:#111;border-radius:10px;color:#f5f0e8;white-space:pre-wrap;">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
    </div>
  `;
}

function buildCustomerItemsRows(items) {
  if (!items.length) {
    return '<tr><td colspan="3" style="padding:10px 12px;border:1px solid #2f2f2f;color:#d9d0c5;">Sin productos registrados</td></tr>';
  }

  return items.map(item => `
    <tr>
      <td style="padding:10px 12px;border:1px solid #2f2f2f;color:#f5f0e8;">${escapeHtml(item.product_name || item.product_code || '')}</td>
      <td style="padding:10px 12px;border:1px solid #2f2f2f;color:#d9d0c5;">${escapeHtml(formatItemDetail(item))}</td>
      <td style="padding:10px 12px;border:1px solid #2f2f2f;color:#f5f0e8;text-align:right;">${escapeHtml(formatCurrency(item.line_subtotal_clp))}</td>
    </tr>
  `).join('');
}

function buildCustomerTotalsRow(label, value, strong) {
  return `
    <tr>
      <td style="padding:10px 12px;border:1px solid #2f2f2f;color:${strong ? '#f5f0e8' : '#d9d0c5'};font-weight:${strong ? '700' : '400'};">${escapeHtml(label)}</td>
      <td style="padding:10px 12px;border:1px solid #2f2f2f;color:${strong ? '#f5f0e8' : '#d9d0c5'};font-weight:${strong ? '700' : '400'};text-align:right;">${escapeHtml(value)}</td>
    </tr>
  `;
}

function formatPlainTextItem(item) {
  if (!item) return '';
  return `- ${item.product_name || item.product_code || 'Producto'} · ${formatItemDetail(item)} · ${formatCurrency(item.line_subtotal_clp)}`;
}

function formatItemDetail(item) {
  const quantity = Number(item.quantity || 1);
  const parts = [
    item.format_label || item.format_code || '',
    item.grind || '',
    quantity > 1 ? `x${quantity}` : ''
  ].filter(Boolean);

  return parts.join(' · ');
}

function buildItemsTable(items) {
  if (!Array.isArray(items) || !items.length) {
    return '';
  }

  const rows = items
    .map(item => `
      <tr>
        <td style="padding:8px 12px;border:1px solid #e7ddd0;">${escapeHtml(item.product_name || item.product_code || '')}</td>
        <td style="padding:8px 12px;border:1px solid #e7ddd0;">${escapeHtml(item.format_label || item.format_code || '')}</td>
        <td style="padding:8px 12px;border:1px solid #e7ddd0;">${escapeHtml(item.grind || '')}</td>
        <td style="padding:8px 12px;border:1px solid #e7ddd0;">${escapeHtml(firstValue(item.quantity, ''))}</td>
        <td style="padding:8px 12px;border:1px solid #e7ddd0;">${escapeHtml(formatCurrency(item.line_subtotal_clp))}</td>
      </tr>
    `)
    .join('');

  return `
    <h2 style="font-size:18px;margin:24px 0 10px;">Lineas del pedido</h2>
    <table style="border-collapse:collapse;background:#1a1a1a;border-radius:12px;overflow:hidden;">
      <thead>
        <tr>
          <th style="padding:8px 12px;border:1px solid #e7ddd0;text-align:left;">Producto</th>
          <th style="padding:8px 12px;border:1px solid #e7ddd0;text-align:left;">Formato</th>
          <th style="padding:8px 12px;border:1px solid #e7ddd0;text-align:left;">Molienda</th>
          <th style="padding:8px 12px;border:1px solid #e7ddd0;text-align:left;">Cantidad</th>
          <th style="padding:8px 12px;border:1px solid #e7ddd0;text-align:left;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function firstValue() {
  for (let index = 0; index < arguments.length; index += 1) {
    const value = arguments[index];

    if (value !== undefined && value !== null && String(value) !== '') {
      return value;
    }
  }

  return '';
}

function formatCurrency(value) {
  if (value === undefined || value === null || String(value) === '') {
    return 'Sin monto';
  }

  const numeric = Number(String(value).replace(/[^\d-]/g, ''));

  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  return `$${numeric.toLocaleString('es-CL')} CLP`;
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function jsonOutput(payload, status) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function toHexString(bytes) {
  return bytes
    .map(function(byte) {
      const normalized = byte < 0 ? byte + 256 : byte;
      return normalized.toString(16).padStart(2, '0');
    })
    .join('');
}
