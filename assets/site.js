window.dataLayer = window.dataLayer || [];

var SUPPORT_EMAIL = 'contacto@caferoast.cl';
var SUPPORT_WHATSAPP = '+56991746361';
var SUPPORT_WHATSAPP_URL = 'https://wa.me/56991746361';
var PUBLIC_CATALOG_ENDPOINT = '/api/public-catalog';
var DEFAULT_FREE_SHIPPING_THRESHOLD = 36000;

var quizCups = null;
var quizMethod = null;
var quizProductChoice = null;
var QUIZ_DESKTOP_BREAKPOINT = 900;
var QUIZ_RESULT_REFERENCE_TEXT = '250g de Downtime + 250g de Hiperfoco, molido para prensa francesa';
var QUIZ_RESULT_REFERENCE_PRICE = '$18.000 CLP';

var PRICE_MAP = {
  '1_taza': { format: '250g', price: 9000 },
  '2_tazas': { format: '500g', price: 16500 },
  '3_o_mas': { format: '1kg', price: 29000 }
};

var QUIZ_COMBO_PRICE = 18000;

var METHOD_GRIND_MAP = {
  'moka': 'molido para moka',
  'prensa_francesa': 'molido grueso para prensa francesa',
  'filtro': 'molido medio para filtro',
  'espresso': 'molido fino para espresso',
  'hervidor': 'molido grueso para prensa francesa',
  'no_se': 'molido grueso para prensa francesa'
};

var PRODUCT_GRIND_LABEL_MAP = {
  'espresso': 'molido para espresso',
  'moka': 'molido para moka',
  'prensa francesa': 'molido para prensa francesa',
  'filtro / pour over': 'molido para filtro / pour over',
  'chemex': 'molido para chemex',
  'aeropress': 'molido para aeropress',
  'grano entero': 'en grano entero'
};

var PRODUCT_NAME_MAP = {
  'downtime': 'Downtime',
  'hiperfoco': 'Hiperfoco'
};

var PRODUCT_PRICE_MAP = {
  '250g': 9000,
  '500g': 16500,
  '1kg': 29000
};

var publicCatalogState = {
  loaded: false,
  productPrices: {},
  freeShippingThreshold: null
};

var PRODUCT_MEDIA_KIND_LABEL_MAP = {
  'mockup': 'Mockup',
  'hold': 'Hold',
  'video': 'Video',
  'etiqueta': 'Etiqueta'
};

var PRODUCT_MEDIA_MANIFEST = {
  'downtime': [
    { kind: 'hold', type: 'image', src: '/assets/products/Downtime/downtime_mockup_hold.png', alt: 'Downtime sostenido en manos' },
    { kind: 'video', type: 'video', src: '/assets/products/Downtime/downtime_mockup_video.mp4', alt: 'Video de Downtime' },
    { kind: 'etiqueta', type: 'image', src: '/assets/products/Downtime/Downtime-etiqueta.png', alt: 'Etiqueta de Downtime' },
    { kind: 'mockup', type: 'image', src: '/assets/products/Downtime/downtime_mockup_bolsa2.png', alt: 'Mockup de bolsa Downtime' }
  ],
  'hiperfoco': [
    { kind: 'hold', type: 'image', src: '/assets/products/Hiperfoco/Hiperfoco-hold.png', alt: 'Hiperfoco sostenido en manos' },
    { kind: 'video', type: 'video', src: '/assets/products/Hiperfoco/Hiperfoco-Video.mp4', alt: 'Video de Hiperfoco' },
    { kind: 'etiqueta', type: 'image', src: '/assets/products/Hiperfoco/Hiperfoco (9 x 12 cm).png', alt: 'Etiqueta de Hiperfoco' },
    { kind: 'mockup', type: 'image', src: '/assets/products/Hiperfoco/Hiperfoco-mockup (9 x 12 cm).png', alt: 'Mockup de bolsa Hiperfoco' }
  ]
};

function pushDataEvent(eventName, payload) {
  window.dataLayer.push(Object.assign({ event: eventName }, payload || {}));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function normalizeApiBase(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function buildApiUrl(path) {
  var apiBase = normalizeApiBase(document.body.getAttribute('data-api-base') || window.ROAST_API_BASE || '');
  var normalizedPath = String(path || '');

  if (normalizedPath.charAt(0) !== '/') {
    normalizedPath = '/' + normalizedPath;
  }

  return apiBase ? apiBase + normalizedPath : normalizedPath;
}

function normalizeCatalogToken(value) {
  return String(value || '').trim().toLowerCase();
}

function buildCatalogPriceKey(productId, format) {
  return normalizeCatalogToken(productId) + '::' + normalizeCatalogToken(format);
}

function hasCatalogPrice(productId, format) {
  return Object.prototype.hasOwnProperty.call(publicCatalogState.productPrices, buildCatalogPriceKey(productId, format));
}

function getProductPrice(productId, format, fallbackPrice) {
  var key = buildCatalogPriceKey(productId, format);
  var fallback = Number(fallbackPrice || PRODUCT_PRICE_MAP[format] || PRODUCT_PRICE_MAP['250g'] || 0);

  if (hasCatalogPrice(productId, format)) {
    return publicCatalogState.productPrices[key];
  }

  return fallback;
}

function getFreeShippingThreshold() {
  return publicCatalogState.freeShippingThreshold || DEFAULT_FREE_SHIPPING_THRESHOLD;
}

function getQuizComboPrice() {
  if (hasCatalogPrice('downtime', '250g') && hasCatalogPrice('hiperfoco', '250g')) {
    return getProductPrice('downtime', '250g') + getProductPrice('hiperfoco', '250g');
  }

  return QUIZ_COMBO_PRICE;
}

function encodeDraftPayload(payload) {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  } catch (error) {
    return '';
  }
}

function decodeDraftPayload(value) {
  if (!value) return null;

  try {
    var normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
    var padLength = (4 - (normalized.length % 4)) % 4;
    var padded = normalized + '='.repeat(padLength);
    return JSON.parse(decodeURIComponent(escape(atob(padded))));
  } catch (error) {
    return null;
  }
}

function createItem(productId, format, grind, quantity) {
  return {
    product_code: productId,
    format_code: format,
    grind: grind,
    quantity: quantity || 1
  };
}

function buildCheckoutUrl(options) {
  var url = new URL('/pedido/', window.location.origin);
  var origin = options && options.origin ? options.origin : '';
  var channel = options && options.channel ? options.channel : '';
  var draft = options && options.draft ? options.draft : null;

  if (origin) url.searchParams.set('origin', origin);
  if (channel) url.searchParams.set('channel', channel);
  if (draft) {
    url.searchParams.set('draft', encodeDraftPayload(draft));
  }

  return url.toString();
}

function buildSupportWhatsAppUrl(message) {
  return SUPPORT_WHATSAPP_URL + '?text=' + encodeURIComponent(message || 'Hola Roast. Necesito ayuda con mi pedido web.');
}

function buildSupportMessage(context, orderId) {
  var orderText = orderId ? ' Mi pedido es ' + orderId + '.' : '';
  return 'Hola Roast. Necesito ayuda con ' + context + '.' + orderText;
}

function syncQuizPanelHeight() {
  var stack = document.getElementById('quizStepStack');
  var resultStep = document.getElementById('quizStep4');
  var actualRec = document.getElementById('quizResultRec');
  var actualPrice = document.getElementById('quizResultPrice');

  if (!stack || !resultStep) return;

  if (window.innerWidth < QUIZ_DESKTOP_BREAKPOINT) {
    stack.style.minHeight = '';
    return;
  }

  if (!stack.clientWidth) return;

  var clone = resultStep.cloneNode(true);
  var cloneRec = clone.querySelector('.quiz-result-rec');
  var clonePrice = clone.querySelector('.quiz-result-price');
  var recText = QUIZ_RESULT_REFERENCE_TEXT;
  var priceText = QUIZ_RESULT_REFERENCE_PRICE;

  if (actualRec && actualRec.textContent.trim() !== '—' && actualRec.textContent.trim().length > QUIZ_RESULT_REFERENCE_TEXT.length) {
    recText = actualRec.textContent.trim();
  }

  if (actualPrice && actualPrice.textContent.trim() !== '—' && actualPrice.textContent.trim().length > QUIZ_RESULT_REFERENCE_PRICE.length) {
    priceText = actualPrice.textContent.trim();
  }

  clone.removeAttribute('id');
  clone.style.display = 'block';
  clone.style.visibility = 'hidden';
  clone.style.position = 'absolute';
  clone.style.top = '0';
  clone.style.left = '0';
  clone.style.width = stack.clientWidth + 'px';
  clone.style.pointerEvents = 'none';
  clone.setAttribute('aria-hidden', 'true');

  if (cloneRec) cloneRec.textContent = recText;
  if (clonePrice) clonePrice.textContent = priceText;

  stack.appendChild(clone);
  stack.style.minHeight = Math.ceil(clone.offsetHeight) + 'px';
  stack.removeChild(clone);
}

function showQuizStep(step) {
  document.querySelectorAll('.quiz-step').forEach(function(section) {
    section.classList.remove('active');
  });

  var target = document.getElementById('quizStep' + step);
  var fill = document.getElementById('quizProgressFill');
  var progress = document.querySelector('.quiz-progress[role="progressbar"]');
  var fills = { 1: 25, 2: 50, 3: 75, 4: 100 };

  if (target) target.classList.add('active');
  if (fill) fill.style.width = fills[step] + '%';
  if (progress) progress.setAttribute('aria-valuenow', String(fills[step]));

  syncQuizPanelHeight();
}

function clearQuizSelection(selector) {
  document.querySelectorAll(selector).forEach(function(button) {
    button.classList.remove('selected');
    button.setAttribute('aria-pressed', 'false');
  });
}

function selectCups(button) {
  clearQuizSelection('#quizStep1 .quiz-option');
  button.classList.add('selected');
  button.setAttribute('aria-pressed', 'true');
  quizCups = button.getAttribute('data-cups');
  quizMethod = null;
  quizProductChoice = null;
  clearQuizSelection('#quizStep2 .quiz-option');
  clearQuizSelection('#quizStep3 .quiz-option');
  pushDataEvent('quiz_started');
  setTimeout(function() {
    showQuizStep(2);
  }, 200);
}

function selectMethod(button) {
  clearQuizSelection('#quizStep2 .quiz-option');
  button.classList.add('selected');
  button.setAttribute('aria-pressed', 'true');
  quizMethod = button.getAttribute('data-method');
  quizProductChoice = null;
  clearQuizSelection('#quizStep3 .quiz-option');
  setTimeout(function() {
    showQuizStep(3);
  }, 200);
}

function selectProductChoice(button) {
  clearQuizSelection('#quizStep3 .quiz-option');
  button.classList.add('selected');
  button.setAttribute('aria-pressed', 'true');
  quizProductChoice = button.getAttribute('data-product-choice');
  window.setTimeout(function() {
    showQuizResult();
  }, 0);
}

function getQuizRecommendation() {
  var formatRecommendation = PRICE_MAP[quizCups] || PRICE_MAP['1_taza'];
  var grindLabel = METHOD_GRIND_MAP[quizMethod] || 'molido grueso para prensa francesa';

  if (quizProductChoice === 'ambos_250') {
    return {
      text: '250g de Downtime + 250g de Hiperfoco, ' + grindLabel,
      price: formatCurrency(getQuizComboPrice()),
      draft: {
        origin: 'index_quiz_result',
        channel: 'site_home_quiz',
        items: [
          createItem('downtime', '250g', grindLabel, 1),
          createItem('hiperfoco', '250g', grindLabel, 1)
        ]
      },
      supportMessage: buildSupportMessage('la recomendación del quiz')
    };
  }

  var productId = PRODUCT_NAME_MAP[quizProductChoice] ? quizProductChoice : 'downtime';
  var productName = PRODUCT_NAME_MAP[productId] || PRODUCT_NAME_MAP.downtime;
  var price = getProductPrice(productId, formatRecommendation.format, formatRecommendation.price);

  return {
    text: productName + ' en ' + formatRecommendation.format + ', ' + grindLabel,
    price: formatCurrency(price),
    draft: {
      origin: 'index_quiz_result',
      channel: 'site_home_quiz',
      items: [
        createItem(productId, formatRecommendation.format, grindLabel, 1)
      ]
    },
    supportMessage: buildSupportMessage('la recomendación del quiz')
  };
}

function showQuizResult() {
  if (!quizCups || !quizMethod || !quizProductChoice) return;

  var recommendation = getQuizRecommendation();
  var resultRec = document.getElementById('quizResultRec');
  var resultPrice = document.getElementById('quizResultPrice');
  var resultCta = document.getElementById('quizResultCta');
  var resultSupport = document.getElementById('quizResultSupport');

  if (resultRec) resultRec.textContent = recommendation.text;
  if (resultPrice) resultPrice.textContent = recommendation.price + ' CLP';
  if (resultCta) {
    resultCta.href = buildCheckoutUrl({
      origin: 'index_quiz_result',
      channel: 'site_home_quiz',
      draft: recommendation.draft
    });
    resultCta.setAttribute('data-checkout-origin', 'index_quiz_result');
    resultCta.setAttribute('data-checkout-channel', 'site_home_quiz');
  }
  if (resultSupport) {
    resultSupport.href = buildSupportWhatsAppUrl(recommendation.supportMessage);
  }

  showQuizStep(4);
}

function quizBack(step) {
  showQuizStep(step);
}

function quizRestart() {
  quizCups = null;
  quizMethod = null;
  quizProductChoice = null;
  document.querySelectorAll('.quiz-option').forEach(function(button) {
    button.classList.remove('selected');
    button.setAttribute('aria-pressed', 'false');
  });

  var resultRec = document.getElementById('quizResultRec');
  var resultPrice = document.getElementById('quizResultPrice');
  var resultCta = document.getElementById('quizResultCta');
  var resultSupport = document.getElementById('quizResultSupport');

  if (resultRec) resultRec.textContent = '—';
  if (resultPrice) resultPrice.textContent = '—';
  if (resultCta) resultCta.href = '/pedido/';
  if (resultSupport) resultSupport.href = buildSupportWhatsAppUrl(buildSupportMessage('mi recomendación del quiz'));

  showQuizStep(1);
}

function buildProductDraft(productId, format, grind) {
  return {
    origin: 'index_products_' + productId,
    channel: 'site_home_products',
    items: [
      createItem(productId, format, grind, 1)
    ]
  };
}

function updateProductCard(card) {
  if (!card) return;

  var productId = card.getAttribute('data-product-id') || '';
  var formatSelect = card.querySelector('[data-product-format]');
  var grindSelect = card.querySelector('[data-product-grind]');
  var priceEl = card.querySelector('[data-product-price]');
  var linkEl = card.querySelector('[data-product-link]');
  var supportEl = card.querySelector('[data-product-support-link]');
  var format = formatSelect ? formatSelect.value : '250g';
  var grind = grindSelect ? grindSelect.value : 'grano entero';
  var price = getProductPrice(productId, format);
  var draft = buildProductDraft(productId, format, grind);

  if (priceEl) {
    priceEl.setAttribute('aria-live', 'polite');
    priceEl.innerHTML = formatCurrency(price) + ' <span>CLP</span>';
  }

  if (linkEl) {
    linkEl.href = buildCheckoutUrl({
      origin: 'index_products_' + productId,
      channel: 'site_home_products',
      draft: draft
    });
    linkEl.setAttribute('aria-label', 'Continuar pedido de ' + (PRODUCT_NAME_MAP[productId] || productId));
    linkEl.setAttribute('data-checkout-origin', 'index_products_' + productId);
    linkEl.setAttribute('data-checkout-channel', 'site_home_products');
  }

  if (supportEl) {
    supportEl.href = buildSupportWhatsAppUrl(buildSupportMessage('elegir ' + (PRODUCT_NAME_MAP[productId] || productId)));
  }
}

function hydratePublicCatalog(payload) {
  if (!payload || !Array.isArray(payload.catalog)) return false;

  var nextProductPrices = {};
  var nextFormatPrices = {};

  payload.catalog.forEach(function(item) {
    var productId = normalizeCatalogToken(item.product_code);
    var formatCode = normalizeCatalogToken(item.format_code);
    var productName = String(item.product_name || '').trim();
    var price = Number(item.price_clp || 0);

    if (!productId || !formatCode || !Number.isFinite(price) || price <= 0) return;

    nextProductPrices[buildCatalogPriceKey(productId, formatCode)] = price;

    if (!Object.prototype.hasOwnProperty.call(nextFormatPrices, formatCode)) {
      nextFormatPrices[formatCode] = price;
    }

    if (productName) {
      PRODUCT_NAME_MAP[productId] = productName;
    }
  });

  if (!Object.keys(nextProductPrices).length) return false;

  publicCatalogState.loaded = true;
  publicCatalogState.productPrices = nextProductPrices;

  Object.keys(nextFormatPrices).forEach(function(formatCode) {
    PRODUCT_PRICE_MAP[formatCode] = nextFormatPrices[formatCode];
  });

  Object.keys(PRICE_MAP).forEach(function(key) {
    var format = normalizeCatalogToken(PRICE_MAP[key].format);
    if (Object.prototype.hasOwnProperty.call(nextFormatPrices, format)) {
      PRICE_MAP[key].price = nextFormatPrices[format];
    }
  });

  var freeShippingThreshold = Number(payload.free_shipping_threshold_clp || 0);
  if (Number.isFinite(freeShippingThreshold) && freeShippingThreshold > 0) {
    publicCatalogState.freeShippingThreshold = freeShippingThreshold;
  }

  QUIZ_RESULT_REFERENCE_PRICE = formatCurrency(getQuizComboPrice()) + ' CLP';

  return true;
}

function updateFreeShippingThresholdText() {
  var thresholdText = formatCurrency(getFreeShippingThreshold()) + ' CLP';

  document.querySelectorAll('[data-free-shipping-threshold]').forEach(function(node) {
    node.textContent = thresholdText;
  });
}

function refreshPublicCatalogUi() {
  document.querySelectorAll('[data-product-card]').forEach(function(card) {
    updateProductCard(card);
  });

  if (quizCups && quizMethod && quizProductChoice) {
    showQuizResult();
  }

  updateFreeShippingThresholdText();
  syncQuizPanelHeight();
  document.dispatchEvent(new CustomEvent('roast:public-catalog-updated', {
    detail: {
      freeShippingThreshold: getFreeShippingThreshold()
    }
  }));
}

function markPublicCatalogFallback() {
  document.querySelectorAll('[data-product-price]').forEach(function(priceEl) {
    priceEl.setAttribute('title', 'Precio referencial; se confirma en checkout.');
  });
}

async function fetchPublicCatalog() {
  var response = await fetch(buildApiUrl(PUBLIC_CATALOG_ENDPOINT), {
    headers: {
      'Accept': 'application/json'
    }
  });
  var contentType = String(response.headers.get('content-type') || '').toLowerCase();
  var raw = await response.text();

  if (contentType.indexOf('text/html') !== -1 || /^\s*</.test(raw)) {
    throw new Error('Public catalog endpoint returned HTML');
  }

  if (!response.ok) {
    throw new Error('Public catalog request failed');
  }

  return raw ? JSON.parse(raw) : {};
}

function initPublicCatalog() {
  fetchPublicCatalog()
    .then(function(payload) {
      if (!hydratePublicCatalog(payload)) {
        throw new Error('Public catalog payload is empty');
      }

      refreshPublicCatalogUi();
    })
    .catch(function() {
      markPublicCatalogFallback();
    });
}

function getProductMediaKindLabel(kind) {
  return PRODUCT_MEDIA_KIND_LABEL_MAP[kind] || 'Media';
}

function createProductMediaPlaceholder(slide, productName) {
  var placeholder = document.createElement('div');
  var kicker = document.createElement('span');
  var title = document.createElement('strong');
  var label = getProductMediaKindLabel(slide.kind);

  placeholder.className = 'product-media-placeholder';
  placeholder.hidden = true;
  placeholder.setAttribute('role', 'img');
  placeholder.setAttribute('aria-label', label + ' de ' + productName + ' proximamente');

  kicker.className = 'product-media-placeholder-kicker';
  kicker.textContent = label;

  title.textContent = label + ' proximamente';

  placeholder.appendChild(kicker);
  placeholder.appendChild(title);

  return placeholder;
}

function revealProductMediaFallback(slideEl) {
  if (!slideEl) return;

  var asset = slideEl.querySelector('.product-media-asset');
  var placeholder = slideEl.querySelector('.product-media-placeholder');

  if (asset) {
    if (asset.tagName === 'VIDEO') asset.pause();
    asset.hidden = true;
  }

  if (placeholder) {
    placeholder.hidden = false;
  }

  slideEl.setAttribute('data-media-fallback', 'true');
}

function createProductMediaSlide(slide, index, total, productName) {
  var slideEl = document.createElement('div');
  var asset = null;
  var placeholder = createProductMediaPlaceholder(slide, productName);
  var label = getProductMediaKindLabel(slide.kind);

  slideEl.className = 'product-media-slide';
  slideEl.setAttribute('data-product-slider-slide', '');
  slideEl.setAttribute('data-slide-index', String(index));
  slideEl.setAttribute('data-slide-kind', slide.kind);
  slideEl.setAttribute('data-media-fallback', 'false');
  slideEl.setAttribute('aria-hidden', index === 0 ? 'false' : 'true');
  slideEl.setAttribute('aria-label', (index + 1) + ' de ' + total + ': ' + label + ' de ' + productName);

  if (slide.type === 'video') {
    asset = document.createElement('video');
    asset.className = 'product-media-asset product-media-video';
    asset.src = slide.src;
    asset.muted = true;
    asset.defaultMuted = true;
    asset.loop = true;
    asset.playsInline = true;
    asset.preload = 'metadata';
    asset.setAttribute('muted', '');
    asset.setAttribute('loop', '');
    asset.setAttribute('playsinline', '');
    asset.setAttribute('aria-label', slide.alt);
    asset.addEventListener('error', function() {
      revealProductMediaFallback(slideEl);
    });
  } else {
    asset = document.createElement('img');
    asset.className = 'product-media-asset product-media-image';
    asset.src = slide.src;
    asset.alt = slide.alt;
    asset.decoding = 'async';
    asset.loading = index === 0 ? 'eager' : 'lazy';
    asset.addEventListener('error', function() {
      revealProductMediaFallback(slideEl);
    });
  }

  slideEl.appendChild(asset);
  slideEl.appendChild(placeholder);

  return slideEl;
}

function syncProductMediaButtons(slider, index, total) {
  var prevButton = slider.querySelector('[data-product-slider-prev]');
  var nextButton = slider.querySelector('[data-product-slider-next]');

  if (prevButton) prevButton.disabled = index <= 0;
  if (nextButton) nextButton.disabled = index >= total - 1;
}

function syncProductMediaVideos(slider, activeIndex) {
  slider.querySelectorAll('[data-product-slider-slide]').forEach(function(slideEl, slideIndex) {
    var video = slideEl.querySelector('video');

    if (!video) return;

    if (slideIndex !== activeIndex || slideEl.getAttribute('data-media-fallback') === 'true') {
      video.pause();
      return;
    }

    var playPromise = video.play();

    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(function() {});
    }
  });
}

function setProductMediaSlide(slider, slides, index) {
  if (!slider || !slides.length) return;

  var track = slider.querySelector('[data-product-slider-track]');
  var status = slider.querySelector('[data-product-slider-status]');
  var card = slider.closest('[data-product-card]');
  var productId = card ? card.getAttribute('data-product-id') || '' : '';
  var productName = PRODUCT_NAME_MAP[productId] || productId;
  var nextIndex = Math.max(0, Math.min(index, slides.length - 1));

  if (!track) return;

  slider.setAttribute('data-current-index', String(nextIndex));
  track.style.transform = '';

  slider.querySelectorAll('[data-product-slider-slide]').forEach(function(slideEl, slideIndex) {
    var isActive = slideIndex === nextIndex;
    slideEl.classList.toggle('is-active', isActive);
    slideEl.setAttribute('aria-hidden', isActive ? 'false' : 'true');
  });

  if (status) {
    status.textContent = productName + ': ' + getProductMediaKindLabel(slides[nextIndex].kind) + ' ' + (nextIndex + 1) + ' de ' + slides.length;
  }

  syncProductMediaButtons(slider, nextIndex, slides.length);
  syncProductMediaVideos(slider, nextIndex);
}

function stepProductMediaSlider(slider, slides, delta) {
  var currentIndex = Number(slider.getAttribute('data-current-index') || 0);
  setProductMediaSlide(slider, slides, currentIndex + delta);
}

function initProductMediaSliders() {
  document.querySelectorAll('[data-product-card]').forEach(function(card) {
    var productId = card.getAttribute('data-product-id') || '';
    var productName = PRODUCT_NAME_MAP[productId] || productId;
    var slider = card.querySelector('[data-product-slider]');
    var track = card.querySelector('[data-product-slider-track]');
    var prevButton = card.querySelector('[data-product-slider-prev]');
    var nextButton = card.querySelector('[data-product-slider-next]');
    var slides = PRODUCT_MEDIA_MANIFEST[productId] || [];

    if (!slider || !track || !slides.length || slider.getAttribute('data-slider-ready') === 'true') return;

    track.textContent = '';
    slider.setAttribute('aria-label', 'Slider de media de ' + productName);

    slides.forEach(function(slide, index) {
      track.appendChild(createProductMediaSlide(slide, index, slides.length, productName));
    });

    if (prevButton) {
      prevButton.addEventListener('click', function() {
        stepProductMediaSlider(slider, slides, -1);
      });
    }

    if (nextButton) {
      nextButton.addEventListener('click', function() {
        stepProductMediaSlider(slider, slides, 1);
      });
    }

    slider.addEventListener('keydown', function(event) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        stepProductMediaSlider(slider, slides, -1);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        stepProductMediaSlider(slider, slides, 1);
      }
    });

    slider.setAttribute('data-slider-ready', 'true');
    setProductMediaSlide(slider, slides, 0);
  });
}

function initProductCards() {
  var productCards = document.querySelectorAll('[data-product-card]');

  productCards.forEach(function(card) {
    var formatSelect = card.querySelector('[data-product-format]');
    var grindSelect = card.querySelector('[data-product-grind]');

    if (formatSelect) {
      formatSelect.addEventListener('change', function() {
        updateProductCard(card);
      });
    }

    if (grindSelect) {
      grindSelect.addEventListener('change', function() {
        updateProductCard(card);
      });
    }

    updateProductCard(card);
  });
}

function initCheckoutLinks() {
  document.querySelectorAll('[data-checkout-link]').forEach(function(link) {
    if (link.hasAttribute('data-product-link')) return;
    if (link.id === 'quizResultCta') return;

    var origin = link.getAttribute('data-checkout-origin') || '';
    var channel = link.getAttribute('data-checkout-channel') || '';

    if (!link.href || link.getAttribute('href') === '/pedido/' || link.getAttribute('href') === '#') {
      link.href = buildCheckoutUrl({ origin: origin, channel: channel });
    }
  });
}

function initSupportLinks() {
  document.querySelectorAll('[data-support-whatsapp-link]').forEach(function(link) {
    var context = link.getAttribute('data-support-context') || 'mi pedido web';
    link.href = buildSupportWhatsAppUrl(buildSupportMessage(context));
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });
}

function initAnalyticsLinks() {
  document.querySelectorAll('[data-checkout-link]').forEach(function(link) {
    link.addEventListener('click', function() {
      pushDataEvent('order_draft_started', {
        label: link.getAttribute('data-analytics-label') || '',
        origin: link.getAttribute('data-checkout-origin') || '',
        channel: link.getAttribute('data-checkout-channel') || ''
      });
    });
  });

  document.querySelectorAll('[data-support-whatsapp-link]').forEach(function(link) {
    link.addEventListener('click', function() {
      pushDataEvent('whatsapp_fallback_clicked', {
        label: link.getAttribute('data-analytics-label') || '',
        context: link.getAttribute('data-support-context') || ''
      });
    });
  });
}

function bindQuizControls() {
  document.querySelectorAll('#quizStep1 [data-cups]').forEach(function(button) {
    button.addEventListener('click', function() {
      selectCups(button);
    });
  });

  document.querySelectorAll('#quizStep2 [data-method]').forEach(function(button) {
    button.addEventListener('click', function() {
      selectMethod(button);
    });
  });

  document.querySelectorAll('#quizStep3 [data-product-choice]').forEach(function(button) {
    button.addEventListener('click', function() {
      selectProductChoice(button);
    });
  });

  document.querySelectorAll('[data-quiz-back]').forEach(function(button) {
    button.addEventListener('click', function() {
      quizBack(Number(button.getAttribute('data-quiz-back')));
    });
  });

  var restartButton = document.getElementById('quizRestartBtn');
  if (restartButton) {
    restartButton.addEventListener('click', quizRestart);
  }
}

var carouselTrack = document.getElementById('carouselTrack');
var carouselDotsContainer = document.getElementById('carouselDots');
var carouselInterval = null;
var currentDot = 0;
var isHovered = false;

function buildDots() {
  if (!carouselTrack || !carouselDotsContainer) return;
  var cards = carouselTrack.querySelectorAll('.review-card');

  cards.forEach(function(_, index) {
    var dot = document.createElement('button');
    dot.className = 'carousel-dot' + (index === 0 ? ' active' : '');
    dot.setAttribute('aria-label', 'Ir a reseña ' + (index + 1));
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
    dot.addEventListener('click', function() {
      scrollToCard(index);
    });
    carouselDotsContainer.appendChild(dot);
  });
}

function scrollToCard(index) {
  if (!carouselTrack) return;
  var cards = carouselTrack.querySelectorAll('.review-card');
  if (!cards[index]) return;
  carouselTrack.scrollTo({ left: cards[index].offsetLeft, behavior: 'smooth' });
  updateDot(index);
}

function updateDot(index) {
  currentDot = index;
  var dots = carouselDotsContainer ? carouselDotsContainer.querySelectorAll('.carousel-dot') : [];

  dots.forEach(function(dot, dotIndex) {
    dot.classList.toggle('active', dotIndex === index);
    dot.setAttribute('aria-selected', dotIndex === index ? 'true' : 'false');
  });
}

function autoScroll() {
  if (!carouselTrack || isHovered) return;
  var cards = carouselTrack.querySelectorAll('.review-card');
  if (!cards.length) return;
  var next = (currentDot + 1) % cards.length;
  scrollToCard(next);
}

function startCarousel() {
  carouselInterval = setInterval(autoScroll, 4000);
}

function initCarousel() {
  if (!carouselTrack) return;

  buildDots();
  startCarousel();
  carouselTrack.addEventListener('mouseenter', function() {
    isHovered = true;
  });
  carouselTrack.addEventListener('mouseleave', function() {
    isHovered = false;
  });
  carouselTrack.addEventListener('scroll', function() {
    var cards = carouselTrack.querySelectorAll('.review-card');
    var scrollLeft = carouselTrack.scrollLeft;
    var closest = 0;
    var minDist = Infinity;

    cards.forEach(function(card, index) {
      var distance = Math.abs(card.offsetLeft - scrollLeft);
      if (distance < minDist) {
        minDist = distance;
        closest = index;
      }
    });

    updateDot(closest);
  });
}

function initFaq() {
  var faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(function(item) {
    var button = item.querySelector('.faq-btn');
    var answer = item.querySelector('.faq-answer');
    if (!button || !answer) return;

    button.addEventListener('click', function() {
      var isOpen = item.classList.contains('open');

      faqItems.forEach(function(currentItem) {
        currentItem.classList.remove('open');
        var currentButton = currentItem.querySelector('.faq-btn');
        var currentAnswer = currentItem.querySelector('.faq-answer');
        if (currentButton) currentButton.setAttribute('aria-expanded', 'false');
        if (currentAnswer) currentAnswer.style.maxHeight = null;
      });

      if (!isOpen) {
        item.classList.add('open');
        button.setAttribute('aria-expanded', 'true');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });
}

function initFadeIn() {
  var fadeEls = document.querySelectorAll('.fade-in');
  if (!fadeEls.length) return;

  var fadeObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        fadeObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  fadeEls.forEach(function(element) {
    fadeObserver.observe(element);
  });
}

var hamburger = document.getElementById('navHamburger');
var drawer = document.getElementById('navDrawer');
var overlay = document.getElementById('navOverlay');

function openDrawer() {
  if (!hamburger || !drawer || !overlay) return;
  hamburger.classList.add('open');
  drawer.classList.add('open');
  overlay.classList.add('open');
  hamburger.setAttribute('aria-expanded', 'true');
  hamburger.setAttribute('aria-label', 'Cerrar menú');
  drawer.setAttribute('aria-hidden', 'false');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('menu-open');
}

function closeDrawer() {
  if (!hamburger || !drawer || !overlay) return;
  hamburger.classList.remove('open');
  drawer.classList.remove('open');
  overlay.classList.remove('open');
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.setAttribute('aria-label', 'Abrir menú');
  drawer.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('menu-open');
}

function initDrawer() {
  if (hamburger) {
    hamburger.addEventListener('click', function() {
      drawer.classList.contains('open') ? closeDrawer() : openDrawer();
    });
  }
  if (overlay) overlay.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') closeDrawer();
  });
}

function initSite() {
  bindQuizControls();
  initProductCards();
  initPublicCatalog();
  initProductMediaSliders();
  initCheckoutLinks();
  initSupportLinks();
  initAnalyticsLinks();
  initCarousel();
  initFaq();
  initFadeIn();
  initDrawer();
  syncQuizPanelHeight();

  window.addEventListener('resize', syncQuizPanelHeight);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(syncQuizPanelHeight);
  }
}

window.RoastShop = {
  SUPPORT_EMAIL: SUPPORT_EMAIL,
  SUPPORT_WHATSAPP: SUPPORT_WHATSAPP,
  SUPPORT_WHATSAPP_URL: SUPPORT_WHATSAPP_URL,
  PRODUCT_NAME_MAP: PRODUCT_NAME_MAP,
  PRODUCT_GRIND_LABEL_MAP: PRODUCT_GRIND_LABEL_MAP,
  PRODUCT_PRICE_MAP: PRODUCT_PRICE_MAP,
  buildCheckoutUrl: buildCheckoutUrl,
  buildSupportWhatsAppUrl: buildSupportWhatsAppUrl,
  buildSupportMessage: buildSupportMessage,
  getProductPrice: getProductPrice,
  getFreeShippingThreshold: getFreeShippingThreshold,
  decodeDraftPayload: decodeDraftPayload,
  encodeDraftPayload: encodeDraftPayload,
  createItem: createItem,
  formatCurrency: formatCurrency,
  trackEvent: pushDataEvent
};

initSite();

window.selectCups = selectCups;
window.selectMethod = selectMethod;
window.selectProductChoice = selectProductChoice;
window.quizBack = quizBack;
window.quizRestart = quizRestart;
window.closeDrawer = closeDrawer;
