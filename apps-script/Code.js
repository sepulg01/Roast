const DEFAULT_SUPPORT_EMAIL = 'contacto@caferoast.cl';

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

    const recipient = payload.recipient || DEFAULT_SUPPORT_EMAIL;
    const subject = `[Roast] ${payload.event_type || 'evento'} · ${payload.order_id || 'sin pedido'}`;
    const htmlBody = buildEmailBody(payload);

    MailApp.sendEmail({
      to: recipient,
      subject,
      htmlBody,
      name: 'Roast Operaciones'
    });

    return jsonOutput({ ok: true });
  } catch (error) {
    return jsonOutput({ ok: false, error: error.message || 'Unexpected error' }, 500);
  }
}

function buildEmailBody(payload) {
  const details = payload.payload || {};
  const fields = [
    ['Pedido', firstValue(details.order_id, payload.order_id, 'Sin order_id')],
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
