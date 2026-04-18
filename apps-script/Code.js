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
  const fields = [
    ['Pedido', payload.order_id || 'Sin order_id'],
    ['Evento', payload.event_type || 'Sin tipo'],
    ['Origen', payload.origin || payload.source || 'Sin origen'],
    ['Canal', payload.channel || 'Sin canal'],
    ['Total', payload.total_clp ? `$${payload.total_clp} CLP` : 'Sin total'],
    ['Comuna', payload.commune || 'Sin comuna'],
    ['Items', payload.items_label || 'Sin items'],
    ['Estado destino', payload.to_status || payload.internal_status || 'Sin estado']
  ];
  const rows = fields
    .map(([label, value]) => `<tr><td style="padding:8px 12px;border:1px solid #e7ddd0;font-weight:700;">${label}</td><td style="padding:8px 12px;border:1px solid #e7ddd0;">${value}</td></tr>`)
    .join('');

  return `
    <div style="font-family:Arial,sans-serif;background:#0d0d0d;color:#f5f0e8;padding:24px;">
      <h1 style="font-size:24px;margin:0 0 16px;">Roast · Evento operativo</h1>
      <p style="margin:0 0 20px;color:#d9d0c5;">Se registró un evento relevante en el flujo web de pedido.</p>
      <table style="border-collapse:collapse;background:#1a1a1a;border-radius:12px;overflow:hidden;">
        ${rows}
      </table>
      <pre style="margin-top:20px;padding:16px;background:#111;border-radius:10px;color:#f5f0e8;white-space:pre-wrap;">${JSON.stringify(payload, null, 2)}</pre>
    </div>
  `;
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
