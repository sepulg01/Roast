(function() {
  if (!window.RoastShop) return;

  var PRODUCT_OPTIONS = [
    { value: 'downtime', label: 'Downtime' },
    { value: 'hiperfoco', label: 'Hiperfoco' }
  ];

  var FORMAT_OPTIONS = [
    { value: '250g', label: '250g' },
    { value: '500g', label: '500g' },
    { value: '1kg', label: '1kg' }
  ];

  var GRIND_OPTIONS = [
    { value: 'espresso', label: 'Molido para espresso' },
    { value: 'moka', label: 'Molido para moka' },
    { value: 'prensa francesa', label: 'Molido para prensa francesa' },
    { value: 'filtro / pour over', label: 'Molido para filtro / pour over' },
    { value: 'chemex', label: 'Molido para chemex' },
    { value: 'aeropress', label: 'Molido para aeropress' },
    { value: 'grano entero', label: 'En grano entero' }
  ];

  var state = {
    page: document.body.getAttribute('data-page') || '',
    origin: '',
    channel: '',
    currentItem: null,
    items: [],
    order: null
  };
  var apiBase = normalizeApiBase(document.body.getAttribute('data-api-base') || window.ROAST_API_BASE || '');

  function getQueryParams() {
    return new URLSearchParams(window.location.search);
  }

  function normalizeApiBase(value) {
    return String(value || '').trim().replace(/\/+$/, '');
  }

  function buildApiUrl(path) {
    var normalizedPath = String(path || '');

    if (normalizedPath.charAt(0) !== '/') {
      normalizedPath = '/' + normalizedPath;
    }

    return apiBase ? apiBase + normalizedPath : normalizedPath;
  }

  function buildBackendRouteMessage() {
    var target = apiBase ? apiBase + '/api' : '/api';
    return 'El backend del checkout no está respondiendo en ' + target + '. El dominio está devolviendo HTML del hosting estático o falta configurar data-api-base hacia el Worker.';
  }

  async function fetchJsonOrThrow(path, options, fallbackMessage) {
    var response = await fetch(buildApiUrl(path), options);
    var contentType = String(response.headers.get('content-type') || '').toLowerCase();
    var raw = await response.text();
    var payload = {};

    if (!raw) {
      if (!response.ok) {
        throw new Error(fallbackMessage || 'La API del checkout no respondió como esperábamos.');
      }
      return payload;
    }

    if (contentType.indexOf('text/html') !== -1 || /^\s*</.test(raw)) {
      throw new Error(buildBackendRouteMessage());
    }

    try {
      payload = JSON.parse(raw);
    } catch (error) {
      if (contentType.indexOf('application/json') !== -1) {
        throw new Error('La API del checkout respondió con JSON inválido.');
      }
      throw new Error('La API del checkout respondió en un formato inesperado.');
    }

    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || fallbackMessage || 'La API del checkout devolvió un error.');
    }

    return payload;
  }

  function normalizeIncomingGrind(value) {
    var raw = String(value || '').trim().toLowerCase();
    var map = {
      'molido para espresso': 'espresso',
      'molido fino para espresso': 'espresso',
      'molido para moka': 'moka',
      'molido grueso para prensa francesa': 'prensa francesa',
      'molido para prensa francesa': 'prensa francesa',
      'molido medio para filtro': 'filtro / pour over',
      'molido para filtro / pour over': 'filtro / pour over',
      'molido para filtro': 'filtro / pour over',
      'molido para chemex': 'chemex',
      'molido para aeropress': 'aeropress',
      'en grano entero': 'grano entero'
    };

    return map[raw] || value || 'prensa francesa';
  }

  function getGrindLabel(value) {
    var option = GRIND_OPTIONS.find(function(item) {
      return item.value === value;
    });

    return option ? option.label : value;
  }

  function createDefaultCheckoutItem() {
    return window.RoastShop.createItem('downtime', '250g', 'prensa francesa', 1);
  }

  function normalizeCheckoutItem(item) {
    return {
      product_code: item.product_code || item.product || 'downtime',
      format_code: item.format_code || item.format || '250g',
      grind: normalizeIncomingGrind(item.grind),
      quantity: Math.max(Number(item.quantity || 1), 1)
    };
  }

  function cloneCheckoutItem(item) {
    return normalizeCheckoutItem(Object.assign({}, item || createDefaultCheckoutItem()));
  }

  function getLiveItemPrice(item) {
    if (window.RoastShop.getProductPrice) {
      return window.RoastShop.getProductPrice(item.product_code, item.format_code);
    }

    return window.RoastShop.PRODUCT_PRICE_MAP[item.format_code] || 0;
  }

  function getLiveSubtotal() {
    return state.items.reduce(function(total, item) {
      return total + (getLiveItemPrice(item) * Math.max(Number(item.quantity || 1), 1));
    }, 0);
  }

  function renderFreeShippingAlert() {
    var alert = document.querySelector('[data-free-shipping-alert]');
    if (!alert) return;

    var threshold = window.RoastShop.getFreeShippingThreshold ? window.RoastShop.getFreeShippingThreshold() : 36000;
    var subtotal = getLiveSubtotal();
    var remaining = Math.max(threshold - subtotal, 0);

    if (remaining > 0) {
      alert.setAttribute('data-free-shipping-state', 'remaining');
      alert.textContent = 'Te faltan ' + window.RoastShop.formatCurrency(remaining) + ' CLP para llegar al envío gratis.';
      return;
    }

    alert.setAttribute('data-free-shipping-state', 'qualified');
    alert.textContent = 'Envío gratis activado. Ya alcanzaste el mínimo para despacho gratis.';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setInlineError(fieldId, message) {
    var field = document.getElementById(fieldId);
    var error = document.querySelector('[data-error-for="' + fieldId + '"]');

    if (field) field.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (error) error.textContent = message || '';
  }

  function clearInlineErrors() {
    document.querySelectorAll('[data-error-for]').forEach(function(node) {
      node.textContent = '';
    });
    document.querySelectorAll('.checkout-field input, .checkout-field textarea').forEach(function(field) {
      field.setAttribute('aria-invalid', 'false');
    });
  }

  function setGlobalStatus(message, tone) {
    var box = document.getElementById('checkoutStatus');
    if (!box) return;

    box.textContent = message || '';
    box.classList.remove('status-box-visible', 'status-box-error', 'status-box-success', 'status-box-info');

    if (message) {
      box.classList.add('status-box-visible');
      box.classList.add('status-box-' + (tone || 'info'));
    }
  }

  function setButtonLoading(button, loadingLabel, isLoading) {
    if (!button) return;
    if (!button.dataset.originalLabel) {
      button.dataset.originalLabel = button.textContent;
    }

    button.disabled = Boolean(isLoading);
    button.textContent = isLoading ? loadingLabel : button.dataset.originalLabel;
  }

  function getInitialItems() {
    var params = getQueryParams();
    var decodedDraft = window.RoastShop.decodeDraftPayload(params.get('draft'));
    var items = decodedDraft && Array.isArray(decodedDraft.items) ? decodedDraft.items : [];

    state.origin = params.get('origin') || (decodedDraft && decodedDraft.origin) || 'pedido_page';
    state.channel = params.get('channel') || (decodedDraft && decodedDraft.channel) || 'site_checkout';

    return items.map(normalizeCheckoutItem);
  }

  function renderItemsEditor() {
    var container = document.getElementById('checkoutItems');
    if (!container) return;

    var item = state.currentItem || createDefaultCheckoutItem();

    container.innerHTML = [
        '<article class="checkout-item-card">',
        '  <div class="checkout-item-grid">',
        '    <label class="checkout-field">',
        '      <span class="checkout-label">Producto</span>',
        '      <select data-current-item-field="product_code">',
        PRODUCT_OPTIONS.map(function(option) {
          return '        <option value="' + option.value + '"' + (option.value === item.product_code ? ' selected' : '') + '>' + option.label + '</option>';
        }).join(''),
        '      </select>',
        '    </label>',
        '    <label class="checkout-field">',
        '      <span class="checkout-label">Formato</span>',
        '      <select data-current-item-field="format_code">',
        FORMAT_OPTIONS.map(function(option) {
          return '        <option value="' + option.value + '"' + (option.value === item.format_code ? ' selected' : '') + '>' + option.label + '</option>';
        }).join(''),
        '      </select>',
        '    </label>',
        '    <label class="checkout-field">',
        '      <span class="checkout-label">Molienda</span>',
        '      <select data-current-item-field="grind">',
        GRIND_OPTIONS.map(function(option) {
          return '        <option value="' + option.value + '"' + (option.value === item.grind ? ' selected' : '') + '>' + option.label + '</option>';
        }).join(''),
        '      </select>',
        '    </label>',
        '    <label class="checkout-field">',
        '      <span class="checkout-label">Cantidad</span>',
        '      <input type="number" min="1" step="1" value="' + Number(item.quantity || 1) + '" data-current-item-field="quantity" />',
        '    </label>',
        '  </div>',
        '</article>'
      ].join('\n');

    container.querySelectorAll('[data-current-item-field]').forEach(function(input) {
      input.addEventListener('change', function() {
        var field = input.getAttribute('data-current-item-field');
        state.currentItem[field] = field === 'quantity' ? Math.max(Number(input.value || 1), 1) : input.value;
        renderFreeShippingAlert();
      });
    });
  }

  function renderSummaryItem(item, index) {
    var productLabel = window.RoastShop.PRODUCT_NAME_MAP[item.product_code] || item.product_code;
    var quantityLabel = Number(item.quantity || 1) > 1 ? ' · x' + Number(item.quantity || 1) : '';

    return [
      '<li>',
      '  <span>' + escapeHtml(productLabel + ' · ' + item.format_code + ' · ' + getGrindLabel(item.grind) + quantityLabel) + '</span>',
      '  <button type="button" class="checkout-summary-remove" data-summary-remove-item="' + index + '" aria-label="Eliminar ' + escapeHtml(productLabel) + ' del resumen">Eliminar</button>',
      '</li>'
    ].join('\n');
  }

  function renderLiveSummary() {
    var container = document.getElementById('checkoutSummaryItems');
    if (!container) return;

    container.innerHTML = state.items.map(renderSummaryItem).join('');

    container.querySelectorAll('[data-summary-remove-item]').forEach(function(button) {
      button.addEventListener('click', function() {
        var index = Number(button.getAttribute('data-summary-remove-item'));
        state.items.splice(index, 1);
        renderLiveSummary();
      });
    });

    renderFreeShippingAlert();
  }

  function collectCustomerData() {
    return {
      customer_name: document.getElementById('customer_name').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      commune: document.getElementById('commune').value.trim(),
      address: document.getElementById('address').value.trim(),
      address_ref: document.getElementById('address_ref').value.trim(),
      notes: document.getElementById('notes').value.trim()
    };
  }

  function validateItems() {
    return state.items.length > 0 && state.items.every(function(item) {
      return item.product_code && item.format_code && item.grind && Number(item.quantity || 0) > 0;
    });
  }

  function validateCustomerData() {
    clearInlineErrors();
    var data = collectCustomerData();
    var valid = true;

    if (!data.customer_name) {
      setInlineError('customer_name', 'Ingresa tu nombre.');
      valid = false;
    }
    if (!data.email) {
      setInlineError('email', 'Ingresa un email válido.');
      valid = false;
    }
    if (!data.phone) {
      setInlineError('phone', 'Ingresa un teléfono.');
      valid = false;
    }
    if (!data.commune) {
      setInlineError('commune', 'Ingresa tu comuna.');
      valid = false;
    }
    if (!data.address) {
      setInlineError('address', 'Ingresa tu dirección.');
      valid = false;
    }

    return valid ? data : null;
  }

  function setStep(stepNumber) {
    document.querySelectorAll('[data-checkout-step]').forEach(function(step) {
      step.classList.toggle('checkout-step-active', step.getAttribute('data-checkout-step') === String(stepNumber));
    });
    document.querySelectorAll('[data-step-indicator]').forEach(function(step) {
      step.classList.toggle('checkout-step-indicator-active', step.getAttribute('data-step-indicator') === String(stepNumber));
    });
    var stepCounter = document.getElementById('checkoutStepLabel');
    if (stepCounter) stepCounter.textContent = 'Paso ' + stepNumber + ' de 3';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bindFieldValidation() {
    ['customer_name', 'email', 'phone', 'commune', 'address'].forEach(function(fieldId) {
      var field = document.getElementById(fieldId);
      if (!field) return;

      field.addEventListener('blur', function() {
        validateCustomerData();
      });
    });
  }

  function updateSupportLinks(orderId) {
    var message = window.RoastShop.buildSupportMessage('mi pedido web', orderId);
    document.querySelectorAll('[data-checkout-support-link]').forEach(function(link) {
      link.href = window.RoastShop.buildSupportWhatsAppUrl(message);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    });
    document.querySelectorAll('[data-support-email-link]').forEach(function(link) {
      link.href = 'mailto:' + window.RoastShop.SUPPORT_EMAIL;
      link.textContent = window.RoastShop.SUPPORT_EMAIL;
    });
  }

  async function createDraft() {
    var customerData = validateCustomerData();
    var nextButton = document.getElementById('checkoutStep2Next');

    if (!customerData) return;

    setGlobalStatus('', 'info');
    setButtonLoading(nextButton, 'Calculando total...', true);

    try {
      var payload = await fetchJsonOrThrow('/api/order-drafts', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          origin: state.origin,
          channel: state.channel,
          items: state.items,
          customer_name: customerData.customer_name,
          email: customerData.email,
          phone: customerData.phone,
          commune: customerData.commune,
          address: customerData.address,
          address_ref: customerData.address_ref,
          notes: customerData.notes
        })
      }, 'No se pudo crear el borrador del pedido.');

      state.order = payload;
      updateSupportLinks(payload.order_id);
      renderReview();
      window.RoastShop.trackEvent('order_draft_created', {
        origin: state.origin,
        channel: state.channel,
        order_id: payload.order_id,
        total_clp: payload.total_clp
      });
      setStep(3);
    } catch (error) {
      setGlobalStatus(error.message || 'No pudimos calcular tu pedido.', 'error');
      window.RoastShop.trackEvent('order_draft_failed', {
        origin: state.origin,
        channel: state.channel
      });
    } finally {
      setButtonLoading(nextButton, 'Continuar a revisión', false);
    }
  }

  function renderReview() {
    if (!state.order) return;

    var subtotal = document.getElementById('reviewSubtotal');
    var shipping = document.getElementById('reviewShipping');
    var total = document.getElementById('reviewTotal');
    var itemsLabel = document.getElementById('reviewItemsLabel');
    var orderIdNode = document.getElementById('reviewOrderId');
    var payButton = document.getElementById('checkoutPayButton');
    var manualReviewBox = document.getElementById('manualReviewBox');

    if (subtotal) subtotal.textContent = window.RoastShop.formatCurrency(state.order.subtotal_clp);
    if (shipping) shipping.textContent = state.order.shipping_clp === 0 ? 'Gratis / por confirmar' : window.RoastShop.formatCurrency(state.order.shipping_clp);
    if (total) total.textContent = window.RoastShop.formatCurrency(state.order.total_clp);
    if (itemsLabel) itemsLabel.textContent = state.order.items_label || 'Pedido web Roast';
    if (orderIdNode) orderIdNode.textContent = state.order.order_id;

    if (state.order.internal_status === 'manual_review') {
      if (manualReviewBox) manualReviewBox.hidden = false;
      if (payButton) payButton.disabled = false;
      setGlobalStatus('Tu comuna quedó en revisión manual. Envía el pedido y cerramos despacho + pago contigo por WhatsApp o email.', 'info');
    } else {
      if (manualReviewBox) manualReviewBox.hidden = true;
      if (payButton) payButton.disabled = false;
      setGlobalStatus('', 'info');
    }
  }

  async function requestOrderContact() {
    var payButton = document.getElementById('checkoutPayButton');
    var acceptedTotal = document.getElementById('accept_total');
    var acceptedTerms = document.getElementById('accept_terms');

    if (!state.order || !state.order.order_id) {
      setGlobalStatus('Primero necesitamos calcular tu pedido.', 'error');
      return;
    }

    if (!acceptedTotal.checked || !acceptedTerms.checked) {
      setGlobalStatus('Necesitas aceptar el total y los términos antes de enviar el pedido.', 'error');
      return;
    }

    setButtonLoading(payButton, 'Enviando pedido...', true);

    try {
      var payload = await fetchJsonOrThrow('/api/order-contact-requests', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          order_id: state.order.order_id,
          accept_total: true,
          accept_terms: true
        })
      }, 'No se pudo enviar el pedido para cierre por contacto.');

      if (!payload.whatsapp_url) {
        throw new Error('No recibimos el link de WhatsApp para cerrar el pedido.');
      }

      window.RoastShop.trackEvent('order_contact_requested', {
        order_id: state.order.order_id,
        total_clp: state.order.total_clp,
        internal_status: payload.internal_status || state.order.internal_status
      });
      window.RoastShop.trackEvent('whatsapp_redirected', {
        order_id: state.order.order_id
      });
      window.location.href = payload.whatsapp_url;
    } catch (error) {
      setGlobalStatus(error.message || 'No pudimos enviar el pedido.', 'error');
    } finally {
      setButtonLoading(payButton, 'Enviar pedido', false);
    }
  }

  function bindCheckout() {
    var addItemButton = document.getElementById('addCheckoutItem');
    var step1Next = document.getElementById('checkoutStep1Next');
    var step2Back = document.getElementById('checkoutStep2Back');
    var step2Next = document.getElementById('checkoutStep2Next');
    var step3Back = document.getElementById('checkoutStep3Back');
    var payButton = document.getElementById('checkoutPayButton');

    state.items = getInitialItems();
    state.currentItem = createDefaultCheckoutItem();
    renderItemsEditor();
    renderLiveSummary();
    updateSupportLinks();
    bindFieldValidation();

    if (addItemButton) {
      addItemButton.addEventListener('click', function() {
        state.items.push(cloneCheckoutItem(state.currentItem));
        renderLiveSummary();
      });
    }

    if (step1Next) {
      step1Next.addEventListener('click', function() {
        if (!validateItems()) {
          setGlobalStatus('Agrega al menos un producto al resumen antes de continuar.', 'error');
          return;
        }
        setGlobalStatus('', 'info');
        setStep(2);
      });
    }

    if (step2Back) {
      step2Back.addEventListener('click', function() {
        setStep(1);
      });
    }

    if (step2Next) {
      step2Next.addEventListener('click', createDraft);
    }

    if (step3Back) {
      step3Back.addEventListener('click', function() {
        setStep(2);
      });
    }

    if (payButton) {
      payButton.addEventListener('click', requestOrderContact);
    }

    document.addEventListener('roast:public-catalog-updated', renderLiveSummary);
  }

  function getStatusConfig(status) {
    var normalized = String(status || '').toLowerCase();
    var map = {
      paid: {
        title: 'Pago recibido',
        copy: 'Tu pago quedó confirmado y el pedido ya está registrado en Roast.',
        tone: 'success'
      },
      pending_payment: {
        title: 'Pago pendiente',
        copy: 'El procesador todavía no confirma el pago. Si pagaste con un medio asíncrono, espera unos minutos y vuelve a revisar.',
        tone: 'info'
      },
      link_sent: {
        title: 'Link generado',
        copy: 'Tu link de pago sigue activo. Puedes retomarlo cuando quieras.',
        tone: 'info'
      },
      payment_failed: {
        title: 'Pago no completado',
        copy: 'El procesador informó un intento fallido. Puedes volver a abrir el link o escribirnos para cerrar el pedido contigo.',
        tone: 'error'
      },
      canceled: {
        title: 'Pago cancelado',
        copy: 'El pago fue cancelado. Si quieres retomarlo, abre nuevamente el link o escríbenos.',
        tone: 'error'
      },
      expired: {
        title: 'Link expirado',
        copy: 'El link de pago venció. Si todavía quieres el pedido, escríbenos y lo reactivamos.',
        tone: 'error'
      },
      manual_review: {
        title: 'Pedido en revisión manual',
        copy: 'Tu comuna necesita confirmación manual antes de cerrar despacho y pago.',
        tone: 'info'
      }
    };

    return map[normalized] || {
      title: 'Estado del pedido',
      copy: 'Estamos revisando tu pedido. Si tienes dudas, escríbenos y lo vemos contigo.',
      tone: 'info'
    };
  }

  async function loadPaymentResult() {
    var params = getQueryParams();
    var orderId = params.get('order_id');
    var title = document.getElementById('paymentResultTitle');
    var copy = document.getElementById('paymentResultCopy');
    var orderNode = document.getElementById('paymentResultOrder');
    var total = document.getElementById('paymentResultTotal');
    var items = document.getElementById('paymentResultItems');
    var resumeLink = document.getElementById('paymentResumeLink');
    var statusPill = document.getElementById('paymentResultPill');

    if (!orderId) {
      if (title) title.textContent = 'No encontramos el pedido';
      if (copy) copy.textContent = 'Llegaste aquí sin un order_id válido. Escríbenos y lo revisamos contigo.';
      return;
    }

    updateSupportLinks(orderId);

    try {
      var payload = await fetchJsonOrThrow('/api/orders/' + encodeURIComponent(orderId), {
        headers: {
          'Accept': 'application/json'
        }
      }, 'No pudimos cargar el estado del pedido.');

      var config = getStatusConfig(payload.internal_status);

      if (title) title.textContent = config.title;
      if (copy) copy.textContent = config.copy;
      if (orderNode) orderNode.textContent = payload.order_id;
      if (total) total.textContent = window.RoastShop.formatCurrency(payload.total_clp);
      if (items) items.textContent = payload.items_label;
      if (statusPill) {
        statusPill.textContent = payload.internal_status;
        statusPill.className = 'result-pill result-pill-' + config.tone;
      }

      if (resumeLink && payload.flow_checkout_url && ['pending_payment', 'link_sent'].includes(payload.internal_status)) {
        resumeLink.href = payload.flow_checkout_url;
        resumeLink.hidden = false;
      }

      if (payload.internal_status === 'paid') {
        window.RoastShop.trackEvent('payment_confirmed', {
          order_id: payload.order_id
        });
      } else if (payload.internal_status === 'pending_payment' || payload.internal_status === 'link_sent') {
        window.RoastShop.trackEvent('payment_pending', {
          order_id: payload.order_id
        });
      } else if (payload.internal_status === 'payment_failed' || payload.internal_status === 'canceled' || payload.internal_status === 'expired') {
        window.RoastShop.trackEvent('payment_failed', {
          order_id: payload.order_id,
          status: payload.internal_status
        });
      }
    } catch (error) {
      if (title) title.textContent = 'No pudimos cargar el resultado';
      if (copy) copy.textContent = error.message || 'Intenta nuevamente o escríbenos por soporte.';
    }
  }

  function init() {
    if (state.page === 'checkout') {
      bindCheckout();
    }

    if (state.page === 'payment-result') {
      loadPaymentResult();
    }
  }

  init();
}());
