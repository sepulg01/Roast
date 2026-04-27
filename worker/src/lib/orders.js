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

function parseConfigRows(rows) {
  const sections = parseSectionedConfig(rows);
  const rawSettings = rowListToKeyValueMap(sections.settings || []);
  const settings = {
    ...DEFAULT_SETTINGS,
    ...rawSettings,
    shipping_fee_clp: toCurrencyNumber(rawSettings.shipping_fee_clp || DEFAULT_SETTINGS.shipping_fee_clp),
    free_shipping_threshold_clp: toCurrencyNumber(rawSettings.free_shipping_threshold_clp || DEFAULT_SETTINGS.free_shipping_threshold_clp),
    flow_timeout_sec: parseInteger(rawSettings.flow_timeout_sec || DEFAULT_SETTINGS.flow_timeout_sec, DEFAULT_SETTINGS.flow_timeout_sec)
  };
  const communes = (sections.communes || []).map(row => ({
    commune: normalizeCommune(row.commune || row.name || row.comuna || row.display_name || ''),
    covered: isTruthy(row.covered || row.active || row.estado || row.enabled || row.cobertura)
  })).filter(row => row.commune);
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
    free_shipping_threshold_clp: config.settings.free_shipping_threshold_clp,
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
  const covered = Boolean(communeMatch && communeMatch.covered);
  const freeShippingApplied = covered && subtotal >= config.settings.free_shipping_threshold_clp;
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

async function appendEvent(env, event) {
  let notificationSent = false;

  if (shouldNotifyEvent(event.event_type)) {
    try {
      notificationSent = await notifyOperationalEvent(env, {
        recipient: SUPPORT_EMAIL,
        support_email: SUPPORT_EMAIL,
        support_whatsapp: SUPPORT_WHATSAPP,
        ...event
      });
    } catch (error) {
      notificationSent = false;
    }
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

export async function createPaymentLink(env, request, publicBaseUrl) {
  const config = await loadOperationalConfig(env);
  const orderId = normalizeText(request.order_id);

  if (!orderId) {
    throw new Error('Missing order_id');
  }

  if (!request.accept_total || !request.accept_terms) {
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
