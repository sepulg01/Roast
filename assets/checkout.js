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
    { value: 'molienda fina', label: 'Molienda Fina (Espresso, Cafetera italiana "Moka")' },
    { value: 'molienda media', label: 'Molienda Media (Goteo, Aeropress)' },
    { value: 'molienda gruesa', label: 'Molienda Gruesa (Prensa Francesa, Cold Brew)' },
    { value: 'grano entero', label: 'Grano Entero' }
  ];

  var FALLBACK_COMMUNES = [
    { name: 'Santiago', sector: 'Centro', covered: true, free_shipping_eligible: true },
    { name: 'Estación Central', sector: 'Centro', covered: true, free_shipping_eligible: true },
    { name: 'Independencia', sector: 'Centro', covered: true, free_shipping_eligible: true },
    { name: 'Quinta Normal', sector: 'Centro', covered: true, free_shipping_eligible: true },
    { name: 'Recoleta', sector: 'Centro', covered: true, free_shipping_eligible: true },
    { name: 'Pedro Aguirre Cerda', sector: 'Centro', covered: true, free_shipping_eligible: true },
    { name: 'San Joaquín', sector: 'Centro', covered: true, free_shipping_eligible: true },
    { name: 'San Miguel', sector: 'Centro', covered: true, free_shipping_eligible: true },
    { name: 'Providencia', sector: 'Oriente', covered: true, free_shipping_eligible: true },
    { name: 'Las Condes', sector: 'Oriente', covered: true, free_shipping_eligible: true },
    { name: 'Vitacura', sector: 'Oriente', covered: true, free_shipping_eligible: true },
    { name: 'Lo Barnechea', sector: 'Oriente', covered: true, free_shipping_eligible: true },
    { name: 'La Reina', sector: 'Oriente', covered: true, free_shipping_eligible: true },
    { name: 'Ñuñoa', sector: 'Oriente', covered: true, free_shipping_eligible: true },
    { name: 'Peñalolén', sector: 'Oriente', covered: true, free_shipping_eligible: true },
    { name: 'Macul', sector: 'Oriente', covered: true, free_shipping_eligible: true },
    { name: 'Conchalí', sector: 'Norte', covered: true, free_shipping_eligible: false },
    { name: 'Huechuraba', sector: 'Norte', covered: true, free_shipping_eligible: false },
    { name: 'Quilicura', sector: 'Norte', covered: true, free_shipping_eligible: false },
    { name: 'Renca', sector: 'Norte', covered: true, free_shipping_eligible: false },
    { name: 'Cerro Navia', sector: 'Norte', covered: true, free_shipping_eligible: false },
    { name: 'La Cisterna', sector: 'Sur', covered: true, free_shipping_eligible: false },
    { name: 'El Bosque', sector: 'Sur', covered: true, free_shipping_eligible: false },
    { name: 'San Ramón', sector: 'Sur', covered: true, free_shipping_eligible: false },
    { name: 'La Granja', sector: 'Sur', covered: true, free_shipping_eligible: false },
    { name: 'La Pintana', sector: 'Sur', covered: true, free_shipping_eligible: false },
    { name: 'Lo Espejo', sector: 'Sur', covered: true, free_shipping_eligible: false },
    { name: 'La Florida', sector: 'Sur', covered: true, free_shipping_eligible: false },
    { name: 'Puente Alto', sector: 'Sur', covered: true, free_shipping_eligible: false },
    { name: 'San Bernardo', sector: 'Sur', covered: true, free_shipping_eligible: false },
    { name: 'Maipú', sector: 'Poniente', covered: true, free_shipping_eligible: false },
    { name: 'Cerrillos', sector: 'Poniente', covered: true, free_shipping_eligible: false },
    { name: 'Pudahuel', sector: 'Poniente', covered: true, free_shipping_eligible: false },
    { name: 'Lo Prado', sector: 'Poniente', covered: true, free_shipping_eligible: false }
  ];

  var DEFAULT_SHIPPING_FEE_CLP = 3500;
  var TRANSFER_EXPIRES_HOURS = 2;
  var BANK_TRANSFER_DETAILS = {
    bank: 'BCI',
    account_type: 'Cuenta Corriente',
    account_number: '61947059',
    holder: 'Gonzalo Sepúlveda Hermosilla',
    rut: '17515638-0',
    email: 'contacto@caferoast.cl'
  };

  var state = {
    page: document.body.getAttribute('data-page') || '',
    origin: '',
    channel: '',
    currentItem: null,
    items: [],
    order: null,
    publicCatalog: {
      loaded: false,
      shippingFeeClp: DEFAULT_SHIPPING_FEE_CLP,
      communes: FALLBACK_COMMUNES.slice()
    }
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

  function buildBackendRouteNotFoundMessage(path) {
    var target = buildApiUrl(path);
    return 'El backend del checkout no está respondiendo correctamente en ' + target + '. El Worker desplegado no reconoce esta ruta o data-api-base apunta a un backend desactualizado.';
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
      if (response.status === 404 && payload.error === 'Not found' && String(path || '').indexOf('/api/') === 0) {
        throw new Error(buildBackendRouteNotFoundMessage(path));
      }

      throw new Error(payload.error || fallbackMessage || 'La API del checkout devolvió un error.');
    }

    return payload;
  }

  function normalizeIncomingGrind(value) {
    var raw = String(value || '').trim().toLowerCase();
    var map = {
      'molienda fina': 'molienda fina',
      'molienda fina (espresso, cafetera italiana "moka")': 'molienda fina',
      'molido para espresso': 'molienda fina',
      'molido fino para espresso': 'molienda fina',
      'molido para moka': 'molienda fina',
      'espresso': 'molienda fina',
      'moka': 'molienda fina',
      'molienda media': 'molienda media',
      'molienda media (goteo, aeropress)': 'molienda media',
      'goteo': 'molienda media',
      'molido grueso para prensa francesa': 'molienda gruesa',
      'molido para prensa francesa': 'molienda gruesa',
      'prensa francesa': 'molienda gruesa',
      'molienda gruesa': 'molienda gruesa',
      'molienda gruesa (prensa francesa, cold brew)': 'molienda gruesa',
      'cold brew': 'molienda gruesa',
      'molido medio para filtro': 'molienda media',
      'molido para filtro / pour over': 'molienda media',
      'molido para filtro': 'molienda media',
      'filtro / pour over': 'molienda media',
      'filtro': 'molienda media',
      'molido para chemex': 'molienda media',
      'chemex': 'molienda media',
      'molido para aeropress': 'molienda media',
      'aeropress': 'molienda media',
      'en grano entero': 'grano entero',
      'grano entero': 'grano entero'
    };

    return map[raw] || 'grano entero';
  }

  function getGrindLabel(value) {
    var option = GRIND_OPTIONS.find(function(item) {
      return item.value === value;
    });

    return option ? option.label : value;
  }

  function createDefaultCheckoutItem() {
    return window.RoastShop.createItem('downtime', '250g', 'grano entero', 1);
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

  function normalizeCommuneName(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function normalizeCommuneItem(item) {
    if (typeof item === 'string') {
      return {
        name: item,
        sector: '',
        covered: true
      };
    }

    var name = item && (item.name || item.commune || item.label || item.value);
    var sector = item && (item.sector || item.zone || '');
    var coveredValue = item && (item.dispatchable !== undefined ? item.dispatchable : (item.covered !== undefined ? item.covered : item.active));
    var covered = coveredValue === undefined ? true : ['true', '1', 'si', 'sí', 'yes', 'y', 'activo'].indexOf(String(coveredValue).toLowerCase()) !== -1 || coveredValue === true;
    var freeShippingValue = item && (item.free_shipping_eligible !== undefined ? item.free_shipping_eligible : item.freeShippingEligible);
    var normalizedSector = normalizeCommuneName(sector);
    var freeShippingEligible = freeShippingValue === undefined
      ? ['centro', 'oriente'].indexOf(normalizedSector) !== -1
      : ['true', '1', 'si', 'sí', 'yes', 'y', 'activo'].indexOf(String(freeShippingValue).toLowerCase()) !== -1 || freeShippingValue === true;

    return {
      name: String(name || '').trim(),
      sector: String(sector || '').trim(),
      covered: covered,
      free_shipping_eligible: freeShippingEligible
    };
  }

  function getSelectedCommune() {
    var field = document.getElementById('commune');
    var selected = field ? field.value : '';
    var normalized = normalizeCommuneName(selected);

    if (!normalized) return null;

    return state.publicCatalog.communes.find(function(item) {
      return normalizeCommuneName(item.name) === normalized;
    }) || null;
  }

  function getCheckoutTotals() {
    var subtotal = getLiveSubtotal();
    var commune = getSelectedCommune();
    var threshold = window.RoastShop.getFreeShippingThreshold ? window.RoastShop.getFreeShippingThreshold() : 36000;
    var shipping = null;
    var blocked = false;
    var blockReason = '';

    if (commune) {
      blocked = !commune.covered;
      blockReason = blocked ? 'Por ahora no tenemos cobertura automática en esa comuna.' : '';
      shipping = blocked ? null : (subtotal >= threshold ? 0 : state.publicCatalog.shippingFeeClp);
    }

    var total = subtotal + (Number.isFinite(shipping) ? shipping : 0);

    return {
      subtotal: subtotal,
      shipping: shipping,
      total: total,
      tax: Math.round(total * 19 / 119),
      commune: commune,
      blocked: blocked,
      blockReason: blockReason,
      freeShippingThreshold: threshold
    };
  }

  function renderFreeShippingAlert() {
    var alert = document.querySelector('[data-free-shipping-alert]');
    if (!alert) return;

    var totals = getCheckoutTotals();
    var remaining = Math.max(totals.freeShippingThreshold - totals.subtotal, 0);

    if (totals.commune && totals.blocked) {
      alert.setAttribute('data-free-shipping-state', 'paid');
      alert.textContent = 'Tu comuna queda fuera de cobertura automática para pedidos web.';
      return;
    }

    if (remaining > 0) {
      alert.setAttribute('data-free-shipping-state', 'remaining');
      alert.textContent = 'Te faltan ' + window.RoastShop.formatCurrency(remaining) + ' CLP para llegar al envío gratis.';
      return;
    }

    alert.setAttribute('data-free-shipping-state', 'qualified');
    alert.textContent = 'Envío gratis activado. Ya alcanzaste el mínimo para despacho gratis.';
  }

  function renderSummaryTotals() {
    var totals = getCheckoutTotals();
    var subtotal = document.getElementById('summarySubtotal');
    var shipping = document.getElementById('summaryShipping');
    var total = document.getElementById('summaryTotal');
    var tax = document.getElementById('summaryTax');
    var note = document.getElementById('checkoutCoverageNote');

    if (subtotal) subtotal.textContent = window.RoastShop.formatCurrency(totals.subtotal);
    if (shipping) {
      if (!totals.commune) {
        shipping.textContent = 'Pendiente';
      } else if (totals.blocked) {
        shipping.textContent = 'No disponible';
      } else {
        shipping.textContent = totals.shipping === 0 ? 'Gratis' : window.RoastShop.formatCurrency(totals.shipping);
      }
    }
    if (total) total.textContent = window.RoastShop.formatCurrency(totals.total);
    if (tax) tax.textContent = window.RoastShop.formatCurrency(totals.tax);

    if (note) {
      if (!totals.commune) {
        note.textContent = 'Selecciona tu comuna para validar cobertura y envío.';
      } else if (totals.blocked) {
        note.textContent = 'Tu comuna queda fuera de cobertura automática. No podemos finalizar este pedido por la web.';
      } else {
        note.textContent = 'Despacho validado para ' + totals.commune.name + '.';
      }
    }
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
    document.querySelectorAll('.checkout-field input, .checkout-field textarea, .checkout-field select').forEach(function(field) {
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
      '  <button type="button" class="checkout-summary-remove" data-summary-remove-item="' + index + '" aria-label="Eliminar ' + escapeHtml(productLabel) + ' del carrito">Eliminar</button>',
      '</li>'
    ].join('\n');
  }

  function renderLiveSummary() {
    var container = document.getElementById('checkoutSummaryItems');
    if (!container) return;

    container.innerHTML = state.items.length
      ? state.items.map(renderSummaryItem).join('')
      : '<li class="checkout-summary-empty">Aún no hay productos en tu carrito</li>';

    container.querySelectorAll('[data-summary-remove-item]').forEach(function(button) {
      button.addEventListener('click', function() {
        var index = Number(button.getAttribute('data-summary-remove-item'));
        state.items.splice(index, 1);
        renderLiveSummary();
      });
    });

    renderFreeShippingAlert();
    renderSummaryTotals();
    updateFinalizeButtonState();
  }

  function collectCustomerData() {
    return {
      first_name: document.getElementById('first_name').value.trim(),
      last_name: document.getElementById('last_name').value.trim(),
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
    var selectedCommune = getSelectedCommune();

    if (!data.first_name) {
      setInlineError('first_name', 'Ingresa tu nombre.');
      valid = false;
    }
    if (!data.last_name) {
      setInlineError('last_name', 'Ingresa tu apellido.');
      valid = false;
    }
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      setInlineError('email', 'Ingresa un email válido.');
      valid = false;
    }
    if (!data.phone) {
      setInlineError('phone', 'Ingresa un teléfono.');
      valid = false;
    }
    if (!data.commune) {
      setInlineError('commune', 'Selecciona tu comuna.');
      valid = false;
    } else if (!selectedCommune) {
      setInlineError('commune', 'Selecciona una comuna válida de la lista.');
      valid = false;
    } else if (!selectedCommune.covered) {
      setInlineError('commune', 'Por ahora no finalizamos pedidos web para esa comuna.');
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
    if (stepCounter) stepCounter.textContent = 'Paso ' + stepNumber + ' de 2';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bindFieldValidation() {
    ['first_name', 'last_name', 'email', 'phone', 'commune', 'address'].forEach(function(fieldId) {
      var field = document.getElementById(fieldId);
      if (!field) return;

      field.addEventListener('blur', function() {
        validateCustomerData();
        renderSummaryTotals();
        updateFinalizeButtonState();
      });
      field.addEventListener('change', function() {
        if (fieldId === 'commune') {
          var selectedCommune = getSelectedCommune();
          if (selectedCommune && !selectedCommune.covered) {
            setInlineError('commune', 'Por ahora no finalizamos pedidos web para esa comuna.');
          } else {
            setInlineError('commune', '');
          }
        }
        renderSummaryTotals();
        updateFinalizeButtonState();
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

  function renderCommuneOptions() {
    var field = document.getElementById('commune');
    if (!field) return;

    var currentValue = field.value;
    var options = state.publicCatalog.communes
      .filter(function(item) { return item.name; })
      .sort(function(a, b) { return a.name.localeCompare(b.name, 'es'); });

    field.innerHTML = '<option value="">Selecciona tu comuna</option>' + options.map(function(item) {
      var label = item.name;
      return '<option value="' + escapeHtml(item.name) + '">' + escapeHtml(label) + '</option>';
    }).join('');

    if (currentValue) {
      var matchingOption = options.find(function(item) {
        return normalizeCommuneName(item.name) === normalizeCommuneName(currentValue);
      });
      if (matchingOption) field.value = matchingOption.name;
    }
  }

  function applyPublicCatalog(payload) {
    if (!payload) return;

    var rawShippingFee = payload.shipping_fee_clp !== undefined ? payload.shipping_fee_clp : payload.shipping;
    var shippingFee = Number(rawShippingFee);
    if (rawShippingFee !== undefined && Number.isFinite(shippingFee) && shippingFee >= 0) {
      state.publicCatalog.shippingFeeClp = shippingFee;
    }

    if (Array.isArray(payload.communes) && payload.communes.length) {
      var communes = payload.communes.map(normalizeCommuneItem).filter(function(item) {
        return item.name;
      });

      if (communes.length) {
        state.publicCatalog.communes = communes;
      }
    }

    state.publicCatalog.loaded = true;
    renderCommuneOptions();
    renderLiveSummary();
  }

  async function loadCheckoutPublicCatalog() {
    renderCommuneOptions();

    try {
      var payload = await fetchJsonOrThrow('/api/public-catalog', {
        headers: {
          'Accept': 'application/json'
        }
      }, 'No pudimos cargar la cobertura actual. Usaremos la cobertura de respaldo.');
      applyPublicCatalog(payload);
    } catch (error) {
      renderCommuneOptions();
      renderLiveSummary();
    }
  }

  function getSelectedPaymentMethod() {
    var selected = document.querySelector('input[name="payment_method"]:checked');
    return selected ? selected.value : '';
  }

  function getCustomerConfirmationNumber(payload) {
    var candidates = payload ? [
      payload.confirmation_number,
      payload.order_number,
      payload.order_id,
      payload.id
    ] : [];

    for (var index = 0; index < candidates.length; index += 1) {
      var candidate = String(candidates[index] || '').trim();
      var exactDigits = candidate.match(/^\d{7}$/);
      if (exactDigits) return exactDigits[0];

      var legacyDate = candidate.match(/(?:^|_)(20\d{2})(\d{2})(\d{2})(?:_|$)/);
      if (legacyDate) return legacyDate[3] + legacyDate[2] + '000';

      var embeddedDigits = candidate.match(/\d{7}/);
      if (embeddedDigits) return embeddedDigits[0];
    }

    return 'pendiente';
  }

  function updatePaymentOptions() {
    document.querySelectorAll('[data-payment-option]').forEach(function(option) {
      var input = option.querySelector('input[type="radio"]');
      option.classList.toggle('checkout-payment-option-active', Boolean(input && input.checked));
    });

    updateFinalizeButtonState();
  }

  function updateFinalizeButtonState() {
    var payButton = document.getElementById('checkoutPayButton');
    if (!payButton) return;

    var acceptedTerms = document.getElementById('accept_terms');
    var totals = getCheckoutTotals();
    var method = getSelectedPaymentMethod();
    var canSubmit = validateItems() && Boolean(totals.commune) && !totals.blocked && method === 'transfer' && Boolean(acceptedTerms && acceptedTerms.checked);

    payButton.disabled = !canSubmit;
  }

  function buildTransferExpiration(payload) {
    var value = payload && (payload.transfer_expires_at || payload.expires_at || payload.transfer_expiration);
    if (value) return value;

    return new Date(Date.now() + (TRANSFER_EXPIRES_HOURS * 60 * 60 * 1000)).toISOString();
  }

  function formatDateTime(value) {
    if (!value) return 'Dentro de 2 horas';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  function getGroupedItems(items) {
    var groups = [];

    items.forEach(function(item) {
      var key = [item.product_code, item.format_code, item.grind].join('::');
      var match = groups.find(function(candidate) {
        return candidate.key === key;
      });

      if (match) {
        match.quantity += Number(item.quantity || 1);
        return;
      }

      groups.push({
        key: key,
        item: item,
        quantity: Number(item.quantity || 1)
      });
    });

    return groups;
  }

  function renderConfirmation(payload, customerData) {
    var shell = document.getElementById('checkoutFormShell');
    if (!shell) return;
    var layout = shell.closest('.checkout-layout');
    var summary = layout ? layout.querySelector('.checkout-summary-card') : document.querySelector('.checkout-summary-card');

    var confirmationNumber = getCustomerConfirmationNumber(payload);
    var totals = {
      subtotal: Number(payload.subtotal_clp || getCheckoutTotals().subtotal),
      shipping: Number(payload.shipping_clp || getCheckoutTotals().shipping || 0),
      total: Number(payload.total_clp || getCheckoutTotals().total)
    };
    var transferDetails = Object.assign({}, BANK_TRANSFER_DETAILS, payload.transfer_details || payload.bank_transfer || {});
    var expiration = buildTransferExpiration(payload);

    updateSupportLinks(confirmationNumber);

    if (summary) {
      summary.remove();
    }

    if (layout) {
      layout.classList.add('checkout-layout-confirmed');
    }

    shell.innerHTML = [
      '<article class="checkout-confirmation-panel" aria-live="polite">',
      '  <div class="checkout-confirmation-heading">',
      '    <p class="checkout-summary-kicker">Pedido recibido</p>',
      '    <span class="checkout-confirmation-logo-frame"><img class="checkout-confirmation-logo" src="/assets/logos/logo_black.png" alt="Roast" width="92" height="68" loading="lazy" decoding="async" /></span>',
      '  </div>',
      '  <h2>Confirmación N° ' + escapeHtml(confirmationNumber) + '</h2>',
      '  <p class="checkout-confirmation-id">Gracias, ' + escapeHtml(customerData.first_name) + '. Tu pedido está a la espera de transferencia</p>',
      '  <section class="checkout-confirmation-section">',
      '    <h3>Datos para transferencia</h3>',
      '    <p class="checkout-transfer-account-line">' + escapeHtml(transferDetails.account_type + ' ' + transferDetails.account_number) + '</p>',
      '    <p class="checkout-transfer-account-line">Rut ' + escapeHtml(transferDetails.rut) + '</p>',
      '    <dl class="checkout-confirmation-list">',
      '      <div><dt>Banco</dt><dd>' + escapeHtml(transferDetails.bank) + '</dd></div>',
      '      <div><dt>Tipo de cuenta</dt><dd>' + escapeHtml(transferDetails.account_type) + '</dd></div>',
      '      <div><dt>Número</dt><dd>' + escapeHtml(transferDetails.account_number) + '</dd></div>',
      '      <div><dt>Titular</dt><dd>' + escapeHtml(transferDetails.holder) + '</dd></div>',
      '      <div><dt>RUT</dt><dd>' + escapeHtml(transferDetails.rut) + '</dd></div>',
      '      <div><dt>Email</dt><dd>' + escapeHtml(transferDetails.email) + '</dd></div>',
      '    </dl>',
      '    <p class="checkout-confirmation-note">Tu transferencia vence el ' + escapeHtml(formatDateTime(expiration)) + '.</p>',
      '  </section>',
      '  <section class="checkout-confirmation-section">',
      '    <h3>Dirección de entrega validada</h3>',
      '    <p>' + escapeHtml(customerData.address) + ', ' + escapeHtml(customerData.commune) + '</p>',
      customerData.address_ref ? '    <p class="checkout-confirmation-note">' + escapeHtml(customerData.address_ref) + '</p>' : '',
      '  </section>',
      '  <section class="checkout-confirmation-section">',
      '    <h3>Detalle del pedido</h3>',
      '    <ul class="checkout-confirmation-items">' + getGroupedItems(state.items).map(function(group) {
        var item = group.item;
        var productLabel = window.RoastShop.PRODUCT_NAME_MAP[item.product_code] || item.product_code;
        return '<li><span>' + escapeHtml(productLabel + ' · ' + item.format_code + ' · ' + getGrindLabel(item.grind) + ' · x' + group.quantity) + '</span><strong>' + window.RoastShop.formatCurrency(getLiveItemPrice(item) * group.quantity) + '</strong></li>';
      }).join('') + '</ul>',
      '    <div class="checkout-review-rows">',
      '      <div class="checkout-review-row"><span>Subtotal</span><strong>' + window.RoastShop.formatCurrency(totals.subtotal) + '</strong></div>',
      '      <div class="checkout-review-row"><span>Envío</span><strong>' + (totals.shipping === 0 ? 'Gratis' : window.RoastShop.formatCurrency(totals.shipping)) + '</strong></div>',
      '      <div class="checkout-review-row checkout-review-row-total"><span>Total</span><strong>' + window.RoastShop.formatCurrency(totals.total) + '</strong></div>',
      '    </div>',
      '  </section>',
      '</article>'
    ].join('\n');

    updateSupportLinks(confirmationNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function submitCheckoutOrderRequest(requestPayload) {
    return fetchJsonOrThrow('/api/checkout-orders', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    }, 'No se pudo finalizar el pedido por transferencia.');
  }

  function requiresLegacyAcceptTotal(error) {
    return /accept_total and accept_terms are required/i.test(String(error && error.message || ''));
  }

  async function submitTransferOrder() {
    var payButton = document.getElementById('checkoutPayButton');
    var customerData = validateCustomerData();
    var acceptedTerms = document.getElementById('accept_terms');
    var method = getSelectedPaymentMethod();
    var totals = getCheckoutTotals();

    if (!customerData) {
      setGlobalStatus('Revisa los datos marcados antes de finalizar.', 'error');
      return;
    }

    if (method === 'flow') {
      setInlineError('payment_method', 'Flow está deshabilitado momentáneamente. Selecciona transferencia bancaria.');
      setGlobalStatus('Flow está deshabilitado momentáneamente.', 'error');
      updateFinalizeButtonState();
      return;
    }

    if (!acceptedTerms || !acceptedTerms.checked) {
      setGlobalStatus('Necesitas aceptar los términos antes de finalizar.', 'error');
      updateFinalizeButtonState();
      return;
    }

    if (totals.blocked) {
      setGlobalStatus(totals.blockReason, 'error');
      return;
    }

    setGlobalStatus('', 'info');
    setButtonLoading(payButton, 'Finalizando pedido...', true);

    try {
      var requestPayload = {
        origin: state.origin,
        channel: state.channel,
        items: state.items,
        first_name: customerData.first_name,
        last_name: customerData.last_name,
        email: customerData.email,
        phone: customerData.phone,
        commune: customerData.commune,
        address: customerData.address,
        address_ref: customerData.address_ref,
        notes: customerData.notes,
        payment_method: 'transfer',
        accept_terms: true
      };
      var payload;

      try {
        payload = await submitCheckoutOrderRequest(requestPayload);
      } catch (error) {
        if (!requiresLegacyAcceptTotal(error)) {
          throw error;
        }

        payload = await submitCheckoutOrderRequest(Object.assign({}, requestPayload, {
          accept_total: true
        }));
      }

      state.order = payload;
      window.RoastShop.trackEvent('checkout_order_created', {
        order_id: payload.order_id || payload.id,
        payment_method: 'transfer',
        total_clp: payload.total_clp || totals.total
      });
      renderConfirmation(payload, customerData);
    } catch (error) {
      setGlobalStatus(error.message || 'No pudimos finalizar el pedido.', 'error');
    } finally {
      setButtonLoading(payButton, 'Pagar ahora', false);
      updateFinalizeButtonState();
    }
  }

  function bindCheckout() {
    var addItemButton = document.getElementById('addCheckoutItem');
    var step1Next = document.getElementById('checkoutStep1Next');
    var step2Back = document.getElementById('checkoutStep2Back');
    var payButton = document.getElementById('checkoutPayButton');

    state.items = getInitialItems();
    state.currentItem = createDefaultCheckoutItem();
    renderItemsEditor();
    renderLiveSummary();
    loadCheckoutPublicCatalog();
    updateSupportLinks();
    bindFieldValidation();
    updatePaymentOptions();

    if (addItemButton) {
      addItemButton.addEventListener('click', function() {
        state.items.push(cloneCheckoutItem(state.currentItem));
        renderLiveSummary();
      });
    }

    if (step1Next) {
      step1Next.addEventListener('click', function() {
        if (!validateItems()) {
          setGlobalStatus('Agrega al menos un producto al carrito antes de continuar.', 'error');
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

    if (payButton) {
      payButton.addEventListener('click', submitTransferOrder);
    }

    document.querySelectorAll('input[name="payment_method"]').forEach(function(input) {
      input.addEventListener('change', function() {
        setInlineError('payment_method', '');
        if (input.value === 'flow' && input.checked) {
          setGlobalStatus('La integración con Flow se encuentra deshabilitada momentáneamente.', 'error');
        } else {
          setGlobalStatus('', 'info');
        }
        updatePaymentOptions();
      });
    });

    ['accept_terms'].forEach(function(fieldId) {
      var field = document.getElementById(fieldId);
      if (field) field.addEventListener('change', updateFinalizeButtonState);
    });

    document.addEventListener('roast:public-catalog-updated', function() {
      renderLiveSummary();
    });
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
      if (orderNode) orderNode.textContent = getCustomerConfirmationNumber(payload);
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
