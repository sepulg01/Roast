import {
  SUPPORT_EMAIL,
  SUPPORT_WHATSAPP,
  buildCustomerId,
  buildEventId,
  buildOrderId,
  buildPaymentId,
  buildSupportWhatsappMessage,
  getLocalDate,
  getLocalTimestamp,
  getWeekKey,
  normalizeKey,
  normalizeText,
  parseInteger,
  safeJsonStringify,
  toCurrencyNumber,
  isTruthy
} from './utils.js';
import {
  appendSheetObject,
  findSheetRowByField,
  getSheetValues,
  readSheetTable,
  updateSheetObjectRow
} from './google.js';
import { createFlowPayment, getFlowPaymentStatus, mapFlowStatus } from './flow.js';
import { notifyOperationalEvent, shouldNotifyEvent } from './notifications.js';

const CONTACT_REQUEST_ALLOWED_STATUSES = new Set(['draft', 'manual_review']);
const BANK_TRANSFER_DETAILS = {
  bank: 'BCI',
  account_type: 'Cuenta Corriente',
  account_number: '61947059',
  holder: 'Gonzalo Sepúlveda Hermosilla',
  account_holder: 'Gonzalo Sepúlveda Hermosilla',
  rut: '17515638-0',
  email: SUPPORT_EMAIL
};
const DEFAULT_COMMUNES = [
  ['Santiago', 'Centro', true, true],
  ['Estación Central', 'Centro', true, true],
  ['Independencia', 'Centro', true, true],
  ['Quinta Normal', 'Centro', true, true],
  ['Recoleta', 'Centro', true, true],
  ['Pedro Aguirre Cerda', 'Centro', true, true],
  ['San Joaquín', 'Centro', true, true],
  ['San Miguel', 'Centro', true, true],
  ['Providencia', 'Oriente', true, true],
  ['Las Condes', 'Oriente', true, true],
  ['Vitacura', 'Oriente', true, true],
  ['Lo Barnechea', 'Oriente', true, true],
  ['La Reina', 'Oriente', true, true],
  ['Ñuñoa', 'Oriente', true, true],
  ['Peñalolén', 'Oriente', true, true],
  ['Macul', 'Oriente', true, true],
  ['Conchalí', 'Norte', true, false],
  ['Huechuraba', 'Norte', true, false],
  ['Quilicura', 'Norte', true, false],
  ['Renca', 'Norte', true, false],
  ['Cerro Navia', 'Norte', true, false],
  ['La Cisterna', 'Sur', true, false],
  ['El Bosque', 'Sur', true, false],
  ['San Ramón', 'Sur', true, false],
  ['La Granja', 'Sur', true, false],
  ['La Pintana', 'Sur', true, false],
  ['Lo Espejo', 'Sur', true, false],
  ['La Florida', 'Sur', true, false],
  ['Puente Alto', 'Sur', true, false],
  ['San Bernardo', 'Sur', true, false],
  ['Maipú', 'Poniente', false, false],
  ['Cerrillos', 'Poniente', false, false],
  ['Pudahuel', 'Poniente', false, false],
  ['Lo Prado', 'Poniente', false, false]
].map(([commune, sector, dispatchable, freeShippingEligible]) => ({
  commune: normalizeCommune(commune),
  display_name: commune,
  sector,
  dispatchable,
  free_shipping_eligible: freeShippingEligible,
  covered: dispatchable
}));

export const CLIENT_HEADERS = [
  'customer_id',
  'created_at',
  'updated_at',
  'full_name',
  'email',
  'phone',
  'commune',
  'address',
  'address_ref',
  'notes',
  'order_count',
  'last_order_id',
  'last_paid_at',
  'total_paid_clp'
];

export const SALES_HEADERS = [
  'order_id',
  'created_at',
  'updated_at',
  'order_date_local',
  'week_key',
  'channel',
  'origin',
  'customer_id',
  'customer_name',
  'email',
  'phone',
  'commune',
  'address',
  'address_ref',
  'notes',
  'items_label',
  'units_total',
  'subtotal_clp',
  'shipping_clp',
  'total_clp',
  'free_shipping_applied',
  'accepted_total_at',
  'accepted_terms_at',
  'internal_status',
  'manual_review_reason',
  'flow_order',
  'flow_token',
  'flow_checkout_url',
  'flow_link_created_at',
  'paid_at',
  'preparing_at',
  'dispatched_at',
  'delivered_at',
  'canceled_at'
];

export const LINE_HEADERS = [
  'line_id',
  'order_id',
  'created_at',
  'product_code',
  'product_name',
  'format_code',
  'format_label',
  'grind',
  'quantity',
  'unit_price_clp',
  'line_subtotal_clp',
  'unit_cost_clp',
  'line_cost_clp',
  'format_bucket',
  'is_combo_component'
];

export const PAYMENT_HEADERS = [
  'payment_id',
  'order_id',
  'flow_order',
  'token',
  'payment_url',
  'flow_status',
  'internal_status',
  'amount_clp',
  'payer_email',
  'payment_method',
  'fee_clp',
  'balance_clp',
  'transfer_date',
  'expires_at',
  'confirmed_at',
  'last_checked_at',
  'raw_status_json'
];

export const EVENT_HEADERS = [
  'event_id',
  'created_at',
  'order_id',
  'source',
  'event_type',
  'from_status',
  'to_status',
  'payload_json',
  'notification_sent'
];

const SECTION_NAMES = new Set(['settings', 'communes', 'catalog', 'status_map']);
const DEFAULT_SETTINGS = {
  contact_email: SUPPORT_EMAIL,
  shipping_fee_clp: 3500,
  free_shipping_threshold_clp: 36000,
  flow_timeout_sec: 86400,
  flow_enabled: false,
  coverage_mode: 'covered_communes_only'
};

function parseSectionedConfig(rows) {
  const sections = {};
  let currentSection = null;
  let currentHeaders = null;

  rows.forEach(row => {
    const firstCell = normalizeKey(row[0] || '');
    const hasContent = row.some(cell => normalizeText(cell));

    if (!hasContent) return;

    if (SECTION_NAMES.has(firstCell) && row.slice(1).every(cell => !normalizeText(cell))) {
      currentSection = firstCell;
      currentHeaders = null;
      sections[currentSection] = sections[currentSection] || [];
      return;
    }

    if (!currentSection) return;

    if (!currentHeaders) {
      currentHeaders = row.map(cell => normalizeKey(cell));
      return;
    }

    const mappedRow = {};
    currentHeaders.forEach((header, index) => {
      if (header) {
        mappedRow[header] = row[index] || '';
      }
    });
    sections[currentSection].push(mappedRow);
  });

  return sections;
}

function rowListToKeyValueMap(rows) {
  return rows.reduce((accumulator, row) => {
    const key = normalizeKey(row.key || row.setting || row.name || row.clave || '');
    const value = row.value || row.valor || row.estado || row.status || '';

    if (key) {
      accumulator[key] = value;
    }

    return accumulator;
  }, {});
}

function normalizeCommune(value) {
  return normalizeKey(value).replace(/_/g, ' ');
}

function hasConfigValue(value) {
  return normalizeText(value) !== '';
}

function explicitBoolean(value, fallback) {
  return hasConfigValue(value) ? isTruthy(value) : fallback;
}

function findDefaultCommune(commune) {
  const communeKey = normalizeCommune(commune);
  return DEFAULT_COMMUNES.find(item => item.commune === communeKey) || null;
}

function buildCommuneConfig(row) {
  const displayName = normalizeText(row.display_name || row.commune || row.name || row.comuna || '');
  const commune = normalizeCommune(displayName);
  const fallback = findDefaultCommune(commune);
  const sector = normalizeText(row.sector || row.zone || row.zona) || fallback?.sector || '';
  const covered = explicitBoolean(
    row.covered || row.active || row.estado || row.enabled || row.cobertura,
    fallback?.covered || false
  );
  const dispatchable = explicitBoolean(row.dispatchable || row.despachable || row.delivery, covered);
  const freeShippingEligible = explicitBoolean(
    row.free_shipping_eligible || row.free_shipping || row.envio_gratis || row.envio_gratis_elegible,
    fallback?.free_shipping_eligible || ['Centro', 'Oriente'].includes(sector)
  );

  return {
    commune,
    display_name: displayName || fallback?.display_name || commune,
    sector,
    covered: dispatchable,
    dispatchable,
    free_shipping_eligible: freeShippingEligible
  };
}

function mergeCommuneConfig(configCommunes) {
  const merged = new Map(DEFAULT_COMMUNES.map(item => [item.commune, item]));

  configCommunes.forEach(item => {
    merged.set(item.commune, {
      ...(merged.get(item.commune) || {}),
      ...item
    });
  });

  return Array.from(merged.values());
}

function parseConfigRows(rows) {
  const sections = parseSectionedConfig(rows);
  const rawSettings = rowListToKeyValueMap(sections.settings || []);
  const settings = {
    ...DEFAULT_SETTINGS,
    ...rawSettings,
    shipping_fee_clp: toCurrencyNumber(rawSettings.shipping_fee_clp || DEFAULT_SETTINGS.shipping_fee_clp),
    free_shipping_threshold_clp: toCurrencyNumber(rawSettings.free_shipping_threshold_clp || DEFAULT_SETTINGS.free_shipping_threshold_clp),
    flow_timeout_sec: parseInteger(rawSettings.flow_timeout_sec || DEFAULT_SETTINGS.flow_timeout_sec, DEFAULT_SETTINGS.flow_timeout_sec),
    flow_enabled: isTruthy(rawSettings.flow_enabled)
  };
  const communes = mergeCommuneConfig((sections.communes || []).map(buildCommuneConfig).filter(row => row.commune));
  const catalog = (sections.catalog || []).map(row => ({
    product_code: normalizeKey(row.product_code || row.product || row.sku || row.product_id),
    product_name: normalizeText(row.product_name || row.name || row.product_label || row.producto),
    format_code: normalizeText(row.format_code || row.format || row.formato || row.size_code),
    format_label: normalizeText(row.format_label || row.format || row.formato || row.size_label),
    price_clp: toCurrencyNumber(row.price_clp || row.price || row.precio),
    unit_cost_clp: toCurrencyNumber(row.unit_cost_clp || row.cost_clp || row.costo),
    format_bucket: normalizeText(row.format_bucket || row.bucket || row.bucket_format || row.segmento || row.format_code || row.format),
    active: row.active === '' ? true : isTruthy(row.active || row.enabled || row.estado || 'true')
  })).filter(row => row.product_code && row.format_code && row.active);
  const statusMap = rowListToKeyValueMap(sections.status_map || []);

  return { settings, communes, catalog, statusMap };
}

export async function loadOperationalConfig(env) {
  const rows = await getSheetValues(env, 'Config!A:Z');

  if (!rows.length) {
    throw new Error('Config sheet is empty');
  }

  const config = parseConfigRows(rows);

  if (!config.catalog.length) {
    throw new Error('Config catalog is empty');
  }

  return config;
}

export async function getPublicCatalog(env) {
  const config = await loadOperationalConfig(env);

  return {
    ok: true,
    currency: 'CLP',
    generated_at: new Date().toISOString(),
    shipping_fee_clp: config.settings.shipping_fee_clp,
    free_shipping_threshold_clp: config.settings.free_shipping_threshold_clp,
    communes: config.communes.map(item => ({
      commune: item.display_name || item.commune,
      sector: item.sector || '',
      dispatchable: Boolean(item.dispatchable),
      free_shipping_eligible: Boolean(item.free_shipping_eligible)
    })),
    catalog: config.catalog.map(item => ({
      product_code: item.product_code,
      product_name: item.product_name,
      format_code: item.format_code,
      format_label: item.format_label,
      price_clp: item.price_clp
    }))
  };
}

function validateItems(items) {
  if (!Array.isArray(items) || !items.length) {
    throw new Error('At least one item is required');
  }

  return items.map((item, index) => {
    const productCode = normalizeKey(item.product_code || item.product || '');
    const formatCode = normalizeText(item.format_code || item.format || '');
    const grind = normalizeText(item.grind || '');
    const quantity = parseInteger(item.quantity || 1, 1);

    if (!productCode) {
      throw new Error(`Item ${index + 1} is missing product_code`);
    }

    if (!formatCode) {
      throw new Error(`Item ${index + 1} is missing format_code`);
    }

    if (!grind) {
      throw new Error(`Item ${index + 1} is missing grind`);
    }

    return {
      product_code: productCode,
      format_code: formatCode,
      grind,
      quantity: Math.max(quantity, 1)
    };
  });
}

function hydrateItems(items, config) {
  return items.map(item => {
    const catalogRow = config.catalog.find(candidate =>
      candidate.product_code === item.product_code &&
      normalizeText(candidate.format_code) === normalizeText(item.format_code)
    );

    if (!catalogRow) {
      throw new Error(`Catalog item not found for ${item.product_code} ${item.format_code}`);
    }

    const unitPrice = toCurrencyNumber(catalogRow.price_clp);
    const unitCost = toCurrencyNumber(catalogRow.unit_cost_clp);

    return {
      ...item,
      product_name: catalogRow.product_name,
      format_label: catalogRow.format_label || item.format_code,
      unit_price_clp: unitPrice,
      line_subtotal_clp: unitPrice * item.quantity,
      unit_cost_clp: unitCost,
      line_cost_clp: unitCost * item.quantity,
      format_bucket: catalogRow.format_bucket || item.format_code,
      is_combo_component: items.length > 1
    };
  });
}

function calculateOrderTotals(hydratedItems, commune, config) {
  const subtotal = hydratedItems.reduce((sum, item) => sum + item.line_subtotal_clp, 0);
  const communeKey = normalizeCommune(commune);
  const communeMatch = config.communes.find(item => item.commune === communeKey);
  const covered = Boolean(communeMatch && communeMatch.dispatchable);
  const freeShippingApplied = covered &&
    Boolean(communeMatch.free_shipping_eligible) &&
    subtotal >= config.settings.free_shipping_threshold_clp;
  const shipping = covered ? (freeShippingApplied ? 0 : config.settings.shipping_fee_clp) : 0;
  const internalStatus = covered ? 'draft' : 'manual_review';
  const manualReviewReason = covered ? '' : 'commune_outside_coverage';

  return {
    subtotal_clp: subtotal,
    shipping_clp: shipping,
    total_clp: subtotal + shipping,
    free_shipping_applied: freeShippingApplied,
    internal_status: internalStatus,
    manual_review_reason: manualReviewReason
  };
}

function buildItemsLabel(items) {
  return items
    .map(item => `${item.product_name} ${item.format_label}${item.quantity > 1 ? ` x${item.quantity}` : ''}`)
    .join(' + ');
}

function validateCustomerPayload(payload) {
  const requiredFields = ['customer_name', 'email', 'phone', 'commune', 'address'];
  const missingFields = requiredFields.filter(field => !normalizeText(payload[field]));

  if (missingFields.length) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }

  return {
    customer_name: normalizeText(payload.customer_name),
    email: normalizeText(payload.email).toLowerCase(),
    phone: normalizeText(payload.phone),
    commune: normalizeText(payload.commune),
    address: normalizeText(payload.address),
    address_ref: normalizeText(payload.address_ref),
    notes: normalizeText(payload.notes)
  };
}

function statusError(message, status = 400, details) {
  const error = new Error(message);
  error.status = status;
  if (details) {
    error.details = details;
  }
  return error;
}

function validateCheckoutCustomerPayload(payload) {
  const firstName = normalizeText(payload.first_name);
  const lastName = normalizeText(payload.last_name);
  const requiredFields = ['email', 'phone', 'commune', 'address'];
  const missingFields = requiredFields.filter(field => !normalizeText(payload[field]));

  if (!firstName) missingFields.unshift('first_name');
  if (!lastName) missingFields.splice(firstName ? 0 : 1, 0, 'last_name');

  if (missingFields.length) {
    throw statusError(`Missing required fields: ${missingFields.join(', ')}`);
  }

  if (!isTruthy(payload.accept_total) || !isTruthy(payload.accept_terms)) {
    throw statusError('accept_total and accept_terms are required');
  }

  const paymentMethod = normalizeKey(payload.payment_method);

  if (paymentMethod !== 'transfer') {
    throw statusError('Only bank transfer checkout is available');
  }

  return {
    customer_name: `${firstName} ${lastName}`.trim(),
    first_name: firstName,
    last_name: lastName,
    email: normalizeText(payload.email).toLowerCase(),
    phone: normalizeText(payload.phone),
    commune: normalizeText(payload.commune),
    address: normalizeText(payload.address),
    address_ref: normalizeText(payload.address_ref),
    notes: normalizeText(payload.notes),
    payment_method: 'transfer'
  };
}

function getCommuneCoverage(commune, config) {
  const communeKey = normalizeCommune(commune);
  return config.communes.find(item => item.commune === communeKey) || {
    commune: communeKey,
    sector: '',
    dispatchable: false,
    free_shipping_eligible: false,
    covered: false
  };
}

function googleAddressContainsCommune(result, commune) {
  const communeKey = normalizeKey(commune);
  const formatted = normalizeKey(result.formatted_address || '');
  const componentText = (result.address_components || [])
    .map(component => component.long_name || component.short_name || '')
    .join(' ');

  return formatted.includes(communeKey) || normalizeKey(componentText).includes(communeKey);
}

async function validateDeliveryAddress(env, customer) {
  if (!normalizeText(env.GOOGLE_MAPS_API_KEY)) {
    throw statusError('Missing GOOGLE_MAPS_API_KEY for checkout address validation', 422);
  }

  const query = `${customer.address}, ${customer.commune}, Región Metropolitana, Chile`;
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', query);
  url.searchParams.set('region', 'cl');
  url.searchParams.set('components', 'country:CL|administrative_area:Región Metropolitana');
  url.searchParams.set('key', env.GOOGLE_MAPS_API_KEY);

  const response = await fetch(url.toString());
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw statusError('Google Geocoding request failed', 422, {
      status: response.status,
      google_status: payload.status || ''
    });
  }

  const result = (payload.results || [])[0];

  if (!result || payload.status === 'ZERO_RESULTS') {
    throw statusError('Address could not be geocoded in Chile/RM', 422, {
      google_status: payload.status || 'ZERO_RESULTS'
    });
  }

  if (!googleAddressContainsCommune(result, customer.commune)) {
    throw statusError('Address commune does not match geocoding result', 422, {
      commune: customer.commune,
      formatted_address: result.formatted_address || ''
    });
  }

  return {
    commune: customer.commune,
    address: customer.address,
    address_ref: customer.address_ref,
    notes: customer.notes,
    formatted_address: result.formatted_address || '',
    place_id: result.place_id || '',
    location: result.geometry?.location || null
  };
}

async function upsertCustomer(env, customerPayload, orderId) {
  const table = await readSheetTable(env, 'Clientes');
  const email = customerPayload.email.toLowerCase();
  const phone = normalizeText(customerPayload.phone);
  const existingRow = table.rows.find(row =>
    normalizeText(row.email).toLowerCase() === email ||
    normalizeText(row.phone) === phone
  );
  const timestamp = getLocalTimestamp();

  if (existingRow) {
    const orderCount = parseInteger(existingRow.order_count, 0) + 1;
    const updatedRow = {
      customer_id: existingRow.customer_id || buildCustomerId(),
      created_at: existingRow.created_at || timestamp,
      updated_at: timestamp,
      full_name: customerPayload.customer_name,
      email,
      phone,
      commune: customerPayload.commune,
      address: customerPayload.address,
      address_ref: customerPayload.address_ref,
      notes: customerPayload.notes,
      order_count: orderCount,
      last_order_id: orderId,
      last_paid_at: existingRow.last_paid_at || '',
      total_paid_clp: existingRow.total_paid_clp || '0'
    };

    await updateSheetObjectRow(env, 'Clientes', CLIENT_HEADERS, existingRow._rowNumber, updatedRow);
    return updatedRow;
  }

  const newRow = {
    customer_id: buildCustomerId(),
    created_at: timestamp,
    updated_at: timestamp,
    full_name: customerPayload.customer_name,
    email,
    phone,
    commune: customerPayload.commune,
    address: customerPayload.address,
    address_ref: customerPayload.address_ref,
    notes: customerPayload.notes,
    order_count: 1,
    last_order_id: orderId,
    last_paid_at: '',
    total_paid_clp: 0
  };

  await appendSheetObject(env, 'Clientes', CLIENT_HEADERS, newRow);
  return newRow;
}

async function appendSalesRow(env, row) {
  await appendSheetObject(env, 'Ventas', SALES_HEADERS, row);
}

async function appendLineRows(env, lines, createdAt) {
  for (const item of lines) {
    await appendSheetObject(env, 'Lineas_Pedido', LINE_HEADERS, {
      line_id: `line_${buildOrderId()}`,
      order_id: item.order_id,
      created_at: createdAt,
      product_code: item.product_code,
      product_name: item.product_name,
      format_code: item.format_code,
      format_label: item.format_label,
      grind: item.grind,
      quantity: item.quantity,
      unit_price_clp: item.unit_price_clp,
      line_subtotal_clp: item.line_subtotal_clp,
      unit_cost_clp: item.unit_cost_clp,
      line_cost_clp: item.line_cost_clp,
      format_bucket: item.format_bucket,
      is_combo_component: item.is_combo_component
    });
  }
}

async function notifyEvent(env, event) {
  if (!shouldNotifyEvent(event.event_type)) {
    return false;
  }

  try {
    return await notifyOperationalEvent(env, {
      recipient: SUPPORT_EMAIL,
      support_email: SUPPORT_EMAIL,
      support_whatsapp: SUPPORT_WHATSAPP,
      ...event
    });
  } catch (error) {
    return false;
  }
}

async function appendEvent(env, event, options = {}) {
  let notificationSent = false;

  if (options.notificationSent === true) {
    notificationSent = true;
  } else if (options.notify !== false) {
    notificationSent = await notifyEvent(env, event);
  }

  if (options.requireNotification && !notificationSent) {
    throw new Error('Order contact notification could not be sent');
  }

  await appendSheetObject(env, 'Eventos', EVENT_HEADERS, {
    event_id: event.event_id || buildEventId(),
    created_at: event.created_at || getLocalTimestamp(),
    order_id: event.order_id,
    source: event.source,
    event_type: event.event_type,
    from_status: event.from_status || '',
    to_status: event.to_status || '',
    payload_json: safeJsonStringify(event.payload || {}),
    notification_sent: notificationSent
  });
}

async function upsertPaymentRow(env, paymentData) {
  const existing = await findSheetRowByField(env, 'Pagos_Flow', 'order_id', paymentData.order_id);
  const baseRow = {
    payment_id: paymentData.payment_id || (existing.row ? existing.row.payment_id : buildPaymentId()),
    order_id: paymentData.order_id,
    flow_order: paymentData.flow_order || '',
    token: paymentData.token || '',
    payment_url: paymentData.payment_url || '',
    flow_status: paymentData.flow_status || '',
    internal_status: paymentData.internal_status || '',
    amount_clp: paymentData.amount_clp || 0,
    payer_email: paymentData.payer_email || '',
    payment_method: paymentData.payment_method || '',
    fee_clp: paymentData.fee_clp || 0,
    balance_clp: paymentData.balance_clp || 0,
    transfer_date: paymentData.transfer_date || '',
    expires_at: paymentData.expires_at || '',
    confirmed_at: paymentData.confirmed_at || '',
    last_checked_at: paymentData.last_checked_at || getLocalTimestamp(),
    raw_status_json: paymentData.raw_status_json || ''
  };

  if (existing.row) {
    await updateSheetObjectRow(env, 'Pagos_Flow', PAYMENT_HEADERS, existing.row._rowNumber, {
      ...existing.row,
      ...baseRow
    });
    return {
      ...existing.row,
      ...baseRow
    };
  }

  await appendSheetObject(env, 'Pagos_Flow', PAYMENT_HEADERS, baseRow);
  return baseRow;
}

async function updateSalesOrder(env, orderId, updates) {
  const existing = await findSheetRowByField(env, 'Ventas', 'order_id', orderId);

  if (!existing.row) {
    throw new Error(`Order not found: ${orderId}`);
  }

  const merged = {
    ...existing.row,
    ...updates,
    updated_at: getLocalTimestamp()
  };

  await updateSheetObjectRow(env, 'Ventas', SALES_HEADERS, existing.row._rowNumber, merged);
  return merged;
}

async function updateCustomerPaymentStats(env, customerId, totalClp, paidAt) {
  const existing = await findSheetRowByField(env, 'Clientes', 'customer_id', customerId);

  if (!existing.row) return;

  const currentTotal = toCurrencyNumber(existing.row.total_paid_clp);
  const updated = {
    ...existing.row,
    updated_at: getLocalTimestamp(),
    last_paid_at: paidAt,
    total_paid_clp: currentTotal + totalClp
  };

  await updateSheetObjectRow(env, 'Clientes', CLIENT_HEADERS, existing.row._rowNumber, updated);
}

function buildLineItemDetail(row) {
  return {
    line_id: row.line_id || '',
    product_code: row.product_code || '',
    product_name: row.product_name || '',
    format_code: row.format_code || '',
    format_label: row.format_label || '',
    grind: row.grind || '',
    quantity: parseInteger(row.quantity, 0),
    unit_price_clp: toCurrencyNumber(row.unit_price_clp),
    line_subtotal_clp: toCurrencyNumber(row.line_subtotal_clp),
    unit_cost_clp: toCurrencyNumber(row.unit_cost_clp),
    line_cost_clp: toCurrencyNumber(row.line_cost_clp),
    format_bucket: row.format_bucket || '',
    is_combo_component: isTruthy(row.is_combo_component)
  };
}

async function getOrderLineItems(env, orderId) {
  const table = await readSheetTable(env, 'Lineas_Pedido');
  return table.rows
    .filter(row => String(row.order_id || '') === String(orderId || ''))
    .map(buildLineItemDetail);
}

function buildOrderContactPayload(order, lineItems, whatsappUrl) {
  return {
    order_id: order.order_id,
    customer_id: order.customer_id || '',
    customer_name: order.customer_name || '',
    email: order.email || '',
    phone: order.phone || '',
    commune: order.commune || '',
    address: order.address || '',
    address_ref: order.address_ref || '',
    notes: order.notes || '',
    items_label: order.items_label || '',
    items: lineItems,
    units_total: parseInteger(order.units_total, 0),
    subtotal_clp: toCurrencyNumber(order.subtotal_clp),
    shipping_clp: toCurrencyNumber(order.shipping_clp),
    total_clp: toCurrencyNumber(order.total_clp),
    origin: order.origin || '',
    channel: order.channel || '',
    accepted_total_at: order.accepted_total_at || '',
    accepted_terms_at: order.accepted_terms_at || '',
    internal_status: order.internal_status || '',
    manual_review_reason: order.manual_review_reason || '',
    support_email: SUPPORT_EMAIL,
    support_whatsapp: SUPPORT_WHATSAPP,
    whatsapp_url: whatsappUrl
  };
}

export async function createOrderDraft(env, payload) {
  const config = await loadOperationalConfig(env);
  const customer = validateCustomerPayload(payload);
  const validatedItems = validateItems(payload.items);
  const hydratedItems = hydrateItems(validatedItems, config);
  const orderMetrics = calculateOrderTotals(hydratedItems, customer.commune, config);
  const createdAt = getLocalTimestamp();
  const orderId = buildOrderId();
  const customerRow = await upsertCustomer(env, customer, orderId);
  const itemsLabel = buildItemsLabel(hydratedItems);
  const salesRow = {
    order_id: orderId,
    created_at: createdAt,
    updated_at: createdAt,
    order_date_local: getLocalDate(),
    week_key: getWeekKey(),
    channel: normalizeText(payload.channel || 'site_checkout'),
    origin: normalizeText(payload.origin || 'pedido_page'),
    customer_id: customerRow.customer_id,
    customer_name: customer.customer_name,
    email: customer.email,
    phone: customer.phone,
    commune: customer.commune,
    address: customer.address,
    address_ref: customer.address_ref,
    notes: customer.notes,
    items_label: itemsLabel,
    units_total: hydratedItems.reduce((sum, item) => sum + item.quantity, 0),
    subtotal_clp: orderMetrics.subtotal_clp,
    shipping_clp: orderMetrics.shipping_clp,
    total_clp: orderMetrics.total_clp,
    free_shipping_applied: orderMetrics.free_shipping_applied,
    accepted_total_at: '',
    accepted_terms_at: '',
    internal_status: orderMetrics.internal_status,
    manual_review_reason: orderMetrics.manual_review_reason,
    flow_order: '',
    flow_token: '',
    flow_checkout_url: '',
    flow_link_created_at: '',
    paid_at: '',
    preparing_at: '',
    dispatched_at: '',
    delivered_at: '',
    canceled_at: ''
  };

  await appendSalesRow(env, salesRow);
  await appendLineRows(env, hydratedItems.map(item => ({ ...item, order_id: orderId })), createdAt);

  await appendEvent(env, {
    order_id: orderId,
    source: 'api/order-drafts',
    event_type: orderMetrics.internal_status === 'manual_review' ? 'manual_review' : 'draft_created',
    from_status: '',
    to_status: orderMetrics.internal_status,
    payload: {
      order_id: orderId,
      origin: salesRow.origin,
      channel: salesRow.channel,
      total_clp: salesRow.total_clp,
      commune: salesRow.commune,
      items_label: itemsLabel,
      manual_review_reason: orderMetrics.manual_review_reason
    }
  });

  return {
    ok: true,
    order_id: orderId,
    subtotal_clp: orderMetrics.subtotal_clp,
    shipping_clp: orderMetrics.shipping_clp,
    total_clp: orderMetrics.total_clp,
    internal_status: orderMetrics.internal_status,
    manual_review_reason: orderMetrics.manual_review_reason,
    items_label: itemsLabel,
    support_email: SUPPORT_EMAIL,
    support_whatsapp: SUPPORT_WHATSAPP
  };
}

export async function createCheckoutOrder(env, payload) {
  const config = await loadOperationalConfig(env);
  const customer = validateCheckoutCustomerPayload(payload);
  const validatedItems = validateItems(payload.items);
  const hydratedItems = hydrateItems(validatedItems, config);
  const orderMetrics = calculateOrderTotals(hydratedItems, customer.commune, config);
  const communeCoverage = getCommuneCoverage(customer.commune, config);

  if (!communeCoverage.dispatchable) {
    throw statusError('No tenemos cobertura para esa comuna.', 422, {
      code: 'commune_outside_coverage',
      commune: customer.commune
    });
  }

  const delivery = await validateDeliveryAddress(env, customer);
  const createdAt = getLocalTimestamp();
  const acceptedAt = createdAt;
  const orderId = buildOrderId();
  const transferExpiresAt = new Date(Date.now() + (2 * 60 * 60 * 1000)).toISOString();
  const customerRow = await upsertCustomer(env, customer, orderId);
  const itemsLabel = buildItemsLabel(hydratedItems);
  const responseItems = hydratedItems.map(item => ({
    product_code: item.product_code,
    product_name: item.product_name,
    format_code: item.format_code,
    format_label: item.format_label,
    grind: item.grind,
    quantity: item.quantity,
    unit_price_clp: item.unit_price_clp,
    line_subtotal_clp: item.line_subtotal_clp
  }));
  const salesRow = {
    order_id: orderId,
    created_at: createdAt,
    updated_at: createdAt,
    order_date_local: getLocalDate(),
    week_key: getWeekKey(),
    channel: normalizeText(payload.channel || 'site_checkout'),
    origin: normalizeText(payload.origin || 'checkout_2_steps'),
    customer_id: customerRow.customer_id,
    customer_name: customer.customer_name,
    email: customer.email,
    phone: customer.phone,
    commune: customer.commune,
    address: customer.address,
    address_ref: customer.address_ref,
    notes: customer.notes,
    items_label: itemsLabel,
    units_total: hydratedItems.reduce((sum, item) => sum + item.quantity, 0),
    subtotal_clp: orderMetrics.subtotal_clp,
    shipping_clp: orderMetrics.shipping_clp,
    total_clp: orderMetrics.total_clp,
    free_shipping_applied: orderMetrics.free_shipping_applied,
    accepted_total_at: acceptedAt,
    accepted_terms_at: acceptedAt,
    internal_status: 'pending_transfer',
    manual_review_reason: '',
    flow_order: '',
    flow_token: '',
    flow_checkout_url: '',
    flow_link_created_at: '',
    paid_at: '',
    preparing_at: '',
    dispatched_at: '',
    delivered_at: '',
    canceled_at: ''
  };

  await appendSalesRow(env, salesRow);
  await appendLineRows(env, hydratedItems.map(item => ({ ...item, order_id: orderId })), createdAt);
  await upsertPaymentRow(env, {
    order_id: orderId,
    flow_order: '',
    token: '',
    payment_url: '',
    flow_status: '',
    internal_status: 'pending_transfer',
    amount_clp: orderMetrics.total_clp,
    payer_email: customer.email,
    payment_method: 'transfer',
    expires_at: transferExpiresAt,
    confirmed_at: '',
    last_checked_at: createdAt,
    raw_status_json: safeJsonStringify({
      payment_method: 'transfer',
      bank_transfer: BANK_TRANSFER_DETAILS
    })
  });

  await appendEvent(env, {
    order_id: orderId,
    source: 'api/checkout-orders',
    event_type: 'pending_transfer',
    from_status: '',
    to_status: 'pending_transfer',
    payload: {
      order_id: orderId,
      origin: salesRow.origin,
      channel: salesRow.channel,
      total_clp: salesRow.total_clp,
      commune: salesRow.commune,
      sector: communeCoverage.sector || '',
      items_label: itemsLabel,
      transfer_expires_at: transferExpiresAt,
      payment_method: 'transfer'
    }
  });

  return {
    ok: true,
    order_id: orderId,
    confirmation_number: orderId,
    internal_status: 'pending_transfer',
    subtotal_clp: orderMetrics.subtotal_clp,
    shipping_clp: orderMetrics.shipping_clp,
    total_clp: orderMetrics.total_clp,
    tax_included_clp: Math.round(orderMetrics.total_clp * 19 / 119),
    payment_method: 'transfer',
    transfer_expires_at: transferExpiresAt,
    bank_transfer: BANK_TRANSFER_DETAILS,
    delivery: {
      commune: customer.commune,
      sector: communeCoverage.sector || '',
      address: customer.address,
      address_ref: customer.address_ref,
      notes: customer.notes,
      geocoded_address: delivery.formatted_address,
      place_id: delivery.place_id,
      location: delivery.location
    },
    items: responseItems,
    items_label: itemsLabel,
    support_email: SUPPORT_EMAIL,
    support_whatsapp: SUPPORT_WHATSAPP
  };
}

export async function createOrderContactRequest(env, request) {
  const orderId = normalizeText(request.order_id);

  if (!orderId) {
    throw new Error('Missing order_id');
  }

  if (!isTruthy(request.accept_total) || !isTruthy(request.accept_terms)) {
    throw new Error('accept_total and accept_terms are required');
  }

  const existing = await findSheetRowByField(env, 'Ventas', 'order_id', orderId);

  if (!existing.row) {
    throw new Error('Order not found');
  }

  const previousStatus = normalizeText(existing.row.internal_status);

  if (previousStatus === 'contact_requested') {
    return {
      ok: true,
      order_id: orderId,
      internal_status: 'contact_requested',
      support_email: SUPPORT_EMAIL,
      whatsapp_url: buildSupportWhatsappMessage(orderId)
    };
  }

  if (!CONTACT_REQUEST_ALLOWED_STATUSES.has(previousStatus)) {
    throw new Error(`Order status ${previousStatus || 'unknown'} cannot request contact`);
  }

  const acceptedAt = getLocalTimestamp();
  const lineItems = await getOrderLineItems(env, orderId);
  const whatsappUrl = buildSupportWhatsappMessage(orderId);
  const nextOrder = {
    ...existing.row,
    accepted_total_at: acceptedAt,
    accepted_terms_at: acceptedAt,
    internal_status: 'contact_requested'
  };
  const event = {
    order_id: orderId,
    source: 'api/order-contact-requests',
    event_type: 'order_contact_requested',
    from_status: previousStatus,
    to_status: 'contact_requested',
    payload: buildOrderContactPayload(nextOrder, lineItems, whatsappUrl)
  };
  const notificationSent = await notifyEvent(env, event);

  if (!notificationSent) {
    throw new Error('Order contact notification could not be sent');
  }

  const updatedOrder = await updateSalesOrder(env, orderId, {
    accepted_total_at: acceptedAt,
    accepted_terms_at: acceptedAt,
    internal_status: 'contact_requested'
  });

  await appendEvent(env, {
    ...event,
    payload: buildOrderContactPayload(updatedOrder, lineItems, whatsappUrl)
  }, { notify: false, notificationSent });

  return {
    ok: true,
    order_id: orderId,
    internal_status: 'contact_requested',
    support_email: SUPPORT_EMAIL,
    whatsapp_url: whatsappUrl
  };
}

export async function createPaymentLink(env, request, publicBaseUrl) {
  const config = await loadOperationalConfig(env);
  const orderId = normalizeText(request.order_id);

  if (!orderId) {
    throw new Error('Missing order_id');
  }

  if (!isTruthy(request.accept_total) || !isTruthy(request.accept_terms)) {
    throw new Error('accept_total and accept_terms are required');
  }

  const existing = await findSheetRowByField(env, 'Ventas', 'order_id', orderId);

  if (!existing.row) {
    throw new Error('Order not found');
  }

  if (existing.row.internal_status === 'manual_review') {
    throw new Error('Order requires manual review before payment');
  }

  if (existing.row.flow_checkout_url && ['link_sent', 'pending_payment'].includes(existing.row.internal_status)) {
    return {
      ok: true,
      checkout_url: existing.row.flow_checkout_url,
      flow_order: existing.row.flow_order,
      internal_status: existing.row.internal_status
    };
  }

  if (!config.settings.flow_enabled) {
    throw new Error('Flow payment links are disabled. Use bank transfer checkout instead.');
  }

  if (normalizeText(existing.row.internal_status) !== 'draft') {
    throw new Error(`Order status ${existing.row.internal_status || 'unknown'} cannot create a payment link`);
  }

  const optionalData = {
    order_id: existing.row.order_id,
    channel: existing.row.channel,
    origin: existing.row.origin,
    phone: existing.row.phone,
    commune: existing.row.commune
  };
  const paymentResult = await createFlowPayment(env, {
    commerceOrder: existing.row.order_id,
    subject: `Pedido Roast · ${existing.row.items_label}`,
    amount: toCurrencyNumber(existing.row.total_clp),
    currency: 'CLP',
    email: existing.row.email,
    urlConfirmation: `${publicBaseUrl}/api/flow/confirmation`,
    urlReturn: `${publicBaseUrl}/pago/retorno`,
    optional: optionalData,
    timeout: config.settings.flow_timeout_sec
  });
  const checkoutUrl = `${paymentResult.url}?token=${paymentResult.token}`;
  const acceptedAt = getLocalTimestamp();

  await updateSalesOrder(env, orderId, {
    accepted_total_at: acceptedAt,
    accepted_terms_at: acceptedAt,
    internal_status: 'link_sent',
    flow_order: paymentResult.flowOrder,
    flow_token: paymentResult.token,
    flow_checkout_url: checkoutUrl,
    flow_link_created_at: acceptedAt
  });

  await upsertPaymentRow(env, {
    order_id: orderId,
    flow_order: paymentResult.flowOrder,
    token: paymentResult.token,
    payment_url: checkoutUrl,
    flow_status: '',
    internal_status: 'link_sent',
    amount_clp: toCurrencyNumber(existing.row.total_clp),
    payer_email: existing.row.email,
    expires_at: '',
    confirmed_at: '',
    last_checked_at: acceptedAt,
    raw_status_json: safeJsonStringify(paymentResult)
  });

  await appendEvent(env, {
    order_id: orderId,
    source: 'api/payment-links',
    event_type: 'payment_link_created',
    from_status: existing.row.internal_status,
    to_status: 'link_sent',
    payload: {
      order_id: orderId,
      flow_order: paymentResult.flowOrder,
      checkout_url: checkoutUrl
    }
  });

  return {
    ok: true,
    checkout_url: checkoutUrl,
    flow_order: paymentResult.flowOrder,
    internal_status: 'link_sent'
  };
}

function buildPaymentUpdateFromStatus(statusPayload, currentStatus) {
  const mappedStatus = mapFlowStatus(statusPayload.status);
  const checkedAt = getLocalTimestamp();
  const paidAt = mappedStatus === 'paid' ? (statusPayload.paymentData?.date || checkedAt) : '';
  const canceledAt = mappedStatus === 'canceled' ? checkedAt : currentStatus.canceled_at || '';

  return {
    salesUpdates: {
      internal_status: mappedStatus,
      flow_order: statusPayload.flowOrder || currentStatus.flow_order,
      flow_token: currentStatus.flow_token,
      flow_checkout_url: currentStatus.flow_checkout_url,
      paid_at: mappedStatus === 'paid' ? paidAt : currentStatus.paid_at || '',
      canceled_at: canceledAt
    },
    paymentUpdates: {
      order_id: statusPayload.commerceOrder,
      flow_order: statusPayload.flowOrder,
      token: currentStatus.flow_token,
      payment_url: currentStatus.flow_checkout_url,
      flow_status: statusPayload.status,
      internal_status: mappedStatus,
      amount_clp: toCurrencyNumber(statusPayload.amount),
      payer_email: statusPayload.payer || currentStatus.email,
      payment_method: statusPayload.paymentData?.media || statusPayload.pending_info?.media || '',
      fee_clp: toCurrencyNumber(statusPayload.paymentData?.fee),
      balance_clp: toCurrencyNumber(statusPayload.paymentData?.balance),
      transfer_date: statusPayload.paymentData?.transferDate || '',
      expires_at: '',
      confirmed_at: mappedStatus === 'paid' ? paidAt : '',
      last_checked_at: checkedAt,
      raw_status_json: safeJsonStringify(statusPayload)
    },
    mappedStatus,
    paidAt
  };
}

export async function syncPaymentStatus(env, token, source) {
  const statusPayload = await getFlowPaymentStatus(env, token);
  const orderId = statusPayload.commerceOrder;
  const existing = await findSheetRowByField(env, 'Ventas', 'order_id', orderId);

  if (!existing.row) {
    throw new Error(`Order not found for Flow commerceOrder ${orderId}`);
  }

  const transition = buildPaymentUpdateFromStatus(statusPayload, existing.row);
  const previousStatus = normalizeText(existing.row.internal_status);

  await updateSalesOrder(env, orderId, transition.salesUpdates);
  await upsertPaymentRow(env, transition.paymentUpdates);

  if (transition.mappedStatus === 'paid' && previousStatus !== 'paid') {
    await updateCustomerPaymentStats(env, existing.row.customer_id, toCurrencyNumber(existing.row.total_clp), transition.paidAt);
  }

  if (previousStatus !== transition.mappedStatus) {
    await appendEvent(env, {
      order_id: orderId,
      source,
      event_type: transition.mappedStatus,
      from_status: previousStatus,
      to_status: transition.mappedStatus,
      payload: {
        order_id: orderId,
        flow_order: statusPayload.flowOrder,
        flow_status: statusPayload.status,
        payment_method: statusPayload.paymentData?.media || statusPayload.pending_info?.media || ''
      }
    });
  }

  return {
    order_id: orderId,
    internal_status: transition.mappedStatus,
    flow_status: statusPayload.status,
    flow_order: statusPayload.flowOrder,
    payment_url: existing.row.flow_checkout_url
  };
}

export async function getPublicOrder(env, orderId) {
  const order = await findSheetRowByField(env, 'Ventas', 'order_id', orderId);

  if (!order.row) {
    throw new Error('Order not found');
  }

  return {
    ok: true,
    order_id: order.row.order_id,
    items_label: order.row.items_label,
    total_clp: toCurrencyNumber(order.row.total_clp),
    internal_status: order.row.internal_status,
    flow_checkout_url: order.row.flow_checkout_url,
    support_email: SUPPORT_EMAIL,
    support_whatsapp: buildSupportWhatsappMessage(order.row.order_id)
  };
}
