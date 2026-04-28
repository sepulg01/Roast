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
    ['Arquitectura', 'Flow', 'Proveedor de pago', 'El Worker crea links y sincroniza estados'],
    ['Arquitectura', 'Apps Script', 'Webhook de email', 'Solo envia notificaciones operativas por correo; no escribe la planilla'],
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
    ['Config.settings', 'free_shipping_threshold_clp', 'Umbral de despacho gratis', 'Default: 36000'],
    ['Config.settings', 'flow_timeout_sec', 'Expiracion del link Flow', 'Default: 86400'],
    ['Config.settings', 'coverage_mode', 'Modo de cobertura', 'Default: covered_communes_only'],
    ['Config.communes', 'commune + covered', 'Comunas cubiertas', 'covered acepta true/1/si/sí/yes/y/activo'],
    ['Config.catalog', 'product_code + format_code + price_clp', 'Catalogo publico y calculo backend', 'unit_cost_clp y format_bucket son opcionales para operacion'],
    ['Config.status_map', 'key/value', 'Parseado por el Worker', 'Actualmente no promete comportamiento productivo'],
    ['', '', '', ''],
    ['Worker endpoints', 'GET /api/public-catalog', 'Catalogo publico y umbral de despacho gratis', 'Cache-Control public max-age=60 stale-while-revalidate=300'],
    ['Worker endpoints', 'POST /api/order-drafts', 'Crea borrador, cliente, lineas y evento', 'No es idempotente; un retry puede duplicar borradores'],
    ['Worker endpoints', 'POST /api/payment-links', 'Crea o reutiliza link Flow', 'Idempotente solo si el pedido ya esta link_sent o pending_payment'],
    ['Worker endpoints', 'POST /api/flow/confirmation', 'Callback server-to-server de Flow', 'Responde ok y sincroniza con waitUntil'],
    ['Worker endpoints', 'POST /pago/retorno', 'Retorno navegador desde Flow', 'Redirige a /pago/resultado/?order_id=...'],
    ['Worker endpoints', 'GET /api/orders/:order_id', 'Estado publico por ID de pedido', 'Expone estado, total, items y link Flow si corresponde'],
    ['', '', '', ''],
    ['Variables y secretos', 'FLOW_API_KEY', 'Worker secret', 'Requerido para Flow real'],
    ['Variables y secretos', 'FLOW_SECRET_KEY', 'Worker secret', 'Requerido para Flow real'],
    ['Variables y secretos', 'FLOW_BASE_URL', 'Worker variable opcional', 'Default: https://www.flow.cl/api'],
    ['Variables y secretos', 'GOOGLE_SERVICE_ACCOUNT_JSON', 'Worker secret y script local', 'JSON completo de service account; no pegar valores en esta hoja'],
    ['Variables y secretos', 'GOOGLE_SHEET_ID', 'Worker variable/secret y script local', 'ID de esta planilla operativa'],
    ['Variables y secretos', 'PUBLIC_BASE_URL', 'Worker variable', 'Default productivo esperado: https://caferoast.cl'],
    ['Variables y secretos', 'APPS_SCRIPT_WEBHOOK_URL', 'Worker secret opcional', 'Activa email operativo si existe junto al shared secret'],
    ['Variables y secretos', 'APPS_SCRIPT_SHARED_SECRET', 'Worker secret y Script Property', 'Debe coincidir entre Worker y Apps Script'],
    ['', '', '', ''],
    ['Estados operativos', 'draft', 'Pedido creado y listo para link de pago', 'Estado inicial cuando la comuna esta cubierta'],
    ['Estados operativos', 'manual_review', 'Pedido requiere revision humana', 'Usado para comunas fuera de cobertura automatica'],
    ['Estados operativos', 'link_sent', 'Link Flow generado', 'Puede reusarse mientras siga activo'],
    ['Estados operativos', 'pending_payment', 'Flow aun no confirma pago final', 'Medios asincronos pueden quedar aqui temporalmente'],
    ['Estados operativos', 'paid', 'Pago confirmado', 'Actualiza estadisticas del cliente'],
    ['Estados operativos', 'payment_failed', 'Intento fallido', 'Mostrar soporte y permitir reactivacion manual'],
    ['Estados operativos', 'canceled / expired', 'Pago cancelado o vencido', 'Soporte puede recrear flujo si corresponde'],
    ['', '', '', ''],
    ['Checklist de prueba', '1', 'Abrir /api/public-catalog', 'Debe devolver ok true y catalogo activo'],
    ['Checklist de prueba', '2', 'Crear pedido desde /pedido/', 'Debe escribir Clientes, Ventas, Lineas_Pedido y Eventos'],
    ['Checklist de prueba', '3', 'Generar link Flow', 'Debe escribir Pagos_Flow y actualizar Ventas'],
    ['Checklist de prueba', '4', 'Volver desde Flow', 'Debe redirigir a /pago/resultado/ con order_id'],
    ['Checklist de prueba', '5', 'Confirmar soporte', 'WhatsApp debe apuntar a https://wa.me/56991746361 y correo a contacto@caferoast.cl']
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
