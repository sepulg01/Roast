#!/usr/bin/env node

import { createSign } from 'node:crypto';

const SHEET_TITLE = 'README';
const GOOGLE_OAUTH_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SHEETS_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

function requiredEnv(name) {
  const value = process.env[name];

  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function signJwt(privateKey, signingInput) {
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  return signer.sign(privateKey, 'base64url');
}

function parseServiceAccount() {
  const raw = requiredEnv('GOOGLE_SERVICE_ACCOUNT_JSON');

  try {
    const serviceAccount = JSON.parse(raw);

    if (!serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error('service account JSON must include client_email and private_key');
    }

    return serviceAccount;
  } catch (error) {
    throw new Error(`Invalid GOOGLE_SERVICE_ACCOUNT_JSON: ${error.message}`);
  }
}

async function getGoogleAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: GOOGLE_OAUTH_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now
  }));
  const signingInput = `${header}.${payload}`;
  const assertion = `${signingInput}.${signJwt(serviceAccount.private_key, signingInput)}`;
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Google token request failed: ${body.error || response.status}`);
  }

  return body.access_token;
}

function buildReadmeRows() {
  return [
    ['Roast Operaciones', 'README', 'Documentacion humana de la planilla operativa', 'No contiene secretos ni formulas requeridas por la app'],
    ['Ultima sincronizacion', new Date().toISOString(), 'Script', 'scripts/sync-sheet-readme.mjs'],
    ['', '', '', ''],
    ['Arquitectura', 'Website', 'Sitio estatico caferoast.cl', 'HTML publico + assets/site.js + assets/checkout.js'],
    ['Arquitectura', 'Cloudflare Worker', 'API transaccional', 'Rutas /api/* y /pago/retorno'],
    ['Arquitectura', 'Google Sheets', 'Base operativa', 'El Worker lee Config y escribe clientes, ventas, lineas, pagos y eventos'],
    ['Arquitectura', 'Checkout', '2 pasos Pedido/Datos', 'El Worker calcula total y valida datos antes de crear el pedido'],
    ['Arquitectura', 'Cierre activo', 'Transferencia Bancaria', 'POST /api/checkout-orders deja el pedido en pending_transfer'],
    ['Arquitectura', 'Flow', 'Proveedor de pago legado/desactivado', 'El codigo queda disponible, pero flow_enabled=false lo mantiene apagado por defecto'],
    ['Arquitectura', 'Resend', 'Email transaccional desde Worker', 'Envia emails con productos, totales, datos BCI y link de validacion manual'],
    ['Arquitectura', 'WhatsApp Cloud API', 'Notificacion operativa best-effort', 'Envia alertas para pending_transfer y paid si los secretos Meta estan configurados'],
    ['Arquitectura', 'Apps Script', 'Fallback legado de email', 'Solo se usa si RESEND_API_KEY no esta configurado; no escribe la planilla'],
    ['', '', '', ''],
    ['Hojas requeridas', 'Config', 'Configuracion seccionada en A:Z', 'Secciones: settings, communes, catalog, status_map'],
    ['Hojas requeridas', 'Clientes', 'Registro de clientes', 'Headers definidos por CLIENT_HEADERS en worker/src/lib/orders.js'],
    ['Hojas requeridas', 'Ventas', 'Registro principal de pedidos', 'Headers definidos por SALES_HEADERS'],
    ['Hojas requeridas', 'Lineas_Pedido', 'Items por pedido', 'Headers definidos por LINE_HEADERS'],
    ['Hojas requeridas', 'Pagos_Flow', 'Estado de pagos Flow', 'Headers definidos por PAYMENT_HEADERS'],
    ['Hojas requeridas', 'Eventos', 'Bitacora operativa', 'Headers definidos por EVENT_HEADERS'],
    ['', '', '', ''],
    ['Config.settings', 'contact_email', 'Correo de soporte', 'Default: contacto@caferoast.cl'],
    ['Config.settings', 'shipping_fee_clp', 'Costo de despacho', 'Default: 3500'],
    ['Config.settings', 'free_shipping_threshold_clp', 'Umbral de despacho gratis', 'Default: 36000; aplica a toda comuna listada y cubierta'],
    ['Config.settings', 'flow_enabled', 'Compuerta Flow', 'Default: false; mantener Flow legado/desactivado salvo decision explicita'],
    ['Config.settings', 'flow_timeout_sec', 'Expiracion del link Flow', 'Default: 86400'],
    ['Config.settings', 'coverage_mode', 'Modo de cobertura', 'Default: covered_communes_only'],
    ['Config.communes', 'commune + covered', 'Comunas cubiertas', 'covered acepta true/1/si/sí/yes/y/activo; free_shipping_eligible queda historico/deprecado'],
    ['Ventas', 'order_number', 'Numero visible de pedido', 'Formato DDMMRRR como texto; order_id sigue siendo la llave interna'],
    ['Eventos', 'notification_results_json', 'Resultado de canales de notificacion', 'JSON con email/WhatsApp; agregar header en la hoja si falta'],
    ['Config.catalog', 'product_code + format_code + price_clp', 'Catalogo publico y calculo backend', 'unit_cost_clp y format_bucket son opcionales para operacion'],
    ['Config.status_map', 'key/value', 'Parseado por el Worker', 'Actualmente no promete comportamiento productivo'],
    ['', '', '', ''],
    ['Worker endpoints', 'GET /api/public-catalog', 'Catalogo publico, shipping_fee_clp y communes', 'Cache-Control public max-age=60 stale-while-revalidate=300'],
    ['Worker endpoints', 'POST /api/checkout-orders', 'Checkout 2 pasos y transferencia bancaria', 'Crea pedido pending_transfer, devuelve confirmation_number y datos BCI'],
    ['Worker endpoints', 'POST /api/order-drafts', 'Crea borrador, cliente, lineas y evento', 'No es idempotente; un retry puede duplicar borradores'],
    ['Worker endpoints', 'POST /api/order-contact-requests', 'Ruta previa de contacto manual', 'No es el cierre activo mientras transferencia bancaria este vigente'],
    ['Worker endpoints', 'POST /api/admin/orders/:order_id/confirm-transfer', 'Validacion manual de transferencia', 'Requiere token HMAC y marca pending_transfer como paid'],
    ['Worker endpoints', 'POST /api/payment-links', 'Codigo legado Flow', 'No usar como cierre activo mientras flow_enabled=false'],
    ['Worker endpoints', 'POST /api/flow/confirmation', 'Callback server-to-server de Flow', 'Responde ok y sincroniza con waitUntil'],
    ['Worker endpoints', 'POST /pago/retorno', 'Retorno navegador desde Flow', 'Redirige a /pago/resultado/?order_id=...'],
    ['Worker endpoints', 'GET /api/orders/:order_id', 'Estado publico por ID de pedido', 'Expone estado, total, items y link Flow si corresponde'],
    ['Worker endpoints', 'GET /api/health', 'Healthcheck productivo', 'Expone flags y booleans de configuracion para Google, Resend, admin actions y WhatsApp sin filtrar secretos'],
    ['', '', '', ''],
    ['Variables y secretos', 'FLOW_API_KEY', 'Worker secret', 'Requerido para Flow real'],
    ['Variables y secretos', 'FLOW_SECRET_KEY', 'Worker secret', 'Requerido para Flow real'],
    ['Variables y secretos', 'FLOW_BASE_URL', 'Worker variable opcional', 'Default: https://www.flow.cl/api'],
    ['Variables y secretos', 'GOOGLE_SERVICE_ACCOUNT_JSON', 'Worker secret y script local', 'JSON completo de service account; no pegar valores en esta hoja'],
    ['Variables y secretos', 'GOOGLE_SHEET_ID', 'Worker variable/secret y script local', 'ID de esta planilla operativa'],
    ['Variables y secretos', 'GOOGLE_MAPS_API_KEY', 'Worker secret', 'Requerido para validacion backend de direcciones con Google Geocoding'],
    ['Variables y secretos', 'PUBLIC_BASE_URL', 'Worker variable', 'Default productivo esperado: https://caferoast.cl'],
    ['Variables y secretos', 'RESEND_API_KEY', 'Worker secret requerido', 'Activa emails productivos por Resend'],
    ['Variables y secretos', 'RESEND_FROM', 'Worker secret requerido', 'Recomendado: Cafe Roast <contacto@caferoast.cl>'],
    ['Variables y secretos', 'RESEND_REPLY_TO', 'Worker secret requerido', 'Recomendado: contacto@caferoast.cl'],
    ['Variables y secretos', 'ADMIN_ACTION_SECRET', 'Worker secret', 'Firma links seguros de validacion manual de transferencia'],
    ['Variables y secretos', 'WHATSAPP_CLOUD_TOKEN', 'Worker secret opcional', 'Token Meta WhatsApp Cloud API para alertas operativas'],
    ['Variables y secretos', 'WHATSAPP_PHONE_NUMBER_ID', 'Worker secret opcional', 'Phone Number ID emisor en Meta WhatsApp Cloud API'],
    ['Variables y secretos', 'WHATSAPP_NOTIFY_TO', 'Worker secret opcional', 'Numero operativo receptor de alertas'],
    ['Variables y secretos', 'WHATSAPP_TEMPLATE_ORDER_EVENT', 'Worker secret opcional', 'Template Meta para pending_transfer'],
    ['Variables y secretos', 'WHATSAPP_TEMPLATE_PAID_EVENT', 'Worker secret opcional', 'Template Meta para paid'],
    ['Variables y secretos', 'WHATSAPP_TEMPLATE_LANGUAGE', 'Worker variable opcional', 'Default recomendado es_CL'],
    ['Variables y secretos', 'APPS_SCRIPT_WEBHOOK_URL', 'Worker secret legado opcional', 'Fallback si Resend no esta configurado'],
    ['Variables y secretos', 'APPS_SCRIPT_SHARED_SECRET', 'Worker secret y Script Property legado opcional', 'Debe coincidir entre Worker y Apps Script si el fallback se usa'],
    ['', '', '', ''],
    ['Estados operativos', 'draft', 'Pedido creado antes del cierre final', 'Estado inicial cuando la comuna esta cubierta'],
    ['Estados operativos', 'manual_review', 'Pedido requiere revision humana', 'Usado para comunas fuera de cobertura automatica'],
    ['Estados operativos', 'contact_requested', 'Pedido enviado a contacto manual', 'Estado historico del cierre Email + WhatsApp'],
    ['Estados operativos', 'pending_transfer', 'Pedido esperando transferencia bancaria', 'Estado activo despues de POST /api/checkout-orders'],
    ['Estados operativos', 'link_sent', 'Link Flow generado', 'Puede reusarse mientras siga activo'],
    ['Estados operativos', 'pending_payment', 'Flow aun no confirma pago final', 'Medios asincronos pueden quedar aqui temporalmente'],
    ['Estados operativos', 'paid', 'Pago confirmado', 'Actualiza estadisticas del cliente'],
    ['Estados operativos', 'payment_failed', 'Intento fallido', 'Mostrar soporte y permitir reactivacion manual'],
    ['Estados operativos', 'canceled / expired', 'Pago cancelado o vencido', 'Soporte puede recrear flujo si corresponde'],
    ['', '', '', ''],
    ['Datos transferencia', 'Banco', 'BCI', 'Cuenta Corriente 61947059'],
    ['Datos transferencia', 'Titular', 'Gonzalo Sepúlveda Hermosilla', 'RUT 17515638-0'],
    ['Datos transferencia', 'Email', 'contacto@caferoast.cl', 'Usar como correo de comprobante/soporte'],
    ['', '', '', ''],
    ['Checklist de prueba', '1', 'Abrir /api/public-catalog', 'Debe devolver ok true, catalogo activo, shipping_fee_clp y communes'],
    ['Checklist de prueba', '2', 'Completar checkout 2 pasos desde /pedido/', 'Debe validar Pedido/Datos y llamar POST /api/checkout-orders'],
    ['Checklist de prueba', '3', 'Confirmar transferencia', 'Debe escribir Clientes, Ventas, Lineas_Pedido y Eventos con estado pending_transfer y numero visible DDMMRRR'],
    ['Checklist de prueba', '4', 'Validar transferencia manual', 'Link operativo debe cambiar pending_transfer a paid sin duplicar pagos si se reintenta'],
    ['Checklist de prueba', '5', 'Validar direccion', 'Debe usar GOOGLE_MAPS_API_KEY/Google Geocoding cuando corresponda'],
    ['Checklist de prueba', '6', 'Confirmar Flow apagado', 'flow_enabled=false debe mantener Flow como legado/desactivado por defecto']
  ];
}

async function sheetsFetch(sheetId, token, path, options = {}) {
  const response = await fetch(`${GOOGLE_SHEETS_BASE_URL}/${sheetId}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Sheets request failed (${response.status}): ${text}`);
  }

  return response;
}

async function getSpreadsheet(sheetId, token) {
  const response = await sheetsFetch(
    sheetId,
    token,
    '?fields=sheets(properties(sheetId,title,index))'
  );
  return response.json();
}

async function ensureReadmeSheet(sheetId, token) {
  const spreadsheet = await getSpreadsheet(sheetId, token);
  const existing = spreadsheet.sheets.find(sheet => sheet.properties.title === SHEET_TITLE);

  if (existing) {
    return existing.properties.sheetId;
  }

  const response = await sheetsFetch(sheetId, token, ':batchUpdate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title: SHEET_TITLE,
              index: 0,
              gridProperties: {
                frozenRowCount: 1
              }
            }
          }
        }
      ]
    })
  });
  const payload = await response.json();
  return payload.replies[0].addSheet.properties.sheetId;
}

async function syncReadmeValues(sheetId, token, readmeSheetId) {
  const values = buildReadmeRows();

  await sheetsFetch(sheetId, token, `/values/${encodeURIComponent(`${SHEET_TITLE}!A:Z`)}:clear`, {
    method: 'POST'
  });

  await sheetsFetch(
    sheetId,
    token,
    `/values/${encodeURIComponent(`${SHEET_TITLE}!A1:D${values.length}`)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    }
  );

  await sheetsFetch(sheetId, token, ':batchUpdate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: readmeSheetId,
              startRowIndex: 0,
              endRowIndex: 1
            },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 1, green: 0.4196, blue: 0.2078 }
              }
            },
            fields: 'userEnteredFormat(textFormat,backgroundColor)'
          }
        },
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId: readmeSheetId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: 4
            }
          }
        }
      ]
    })
  });
}

async function main() {
  const sheetId = requiredEnv('GOOGLE_SHEET_ID');
  const serviceAccount = parseServiceAccount();
  const token = await getGoogleAccessToken(serviceAccount);
  const readmeSheetId = await ensureReadmeSheet(sheetId, token);
  await syncReadmeValues(sheetId, token, readmeSheetId);
  console.log(`Synced ${SHEET_TITLE} sheet in ${sheetId}`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
