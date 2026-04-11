// ===== dataLayer init =====
window.dataLayer = window.dataLayer || [];

// ===== QUIZ STATE =====
var quizCups = null;
var quizMethod = null;
var quizProductChoice = null;
var QUIZ_DESKTOP_BREAKPOINT = 900;
var QUIZ_RESULT_REFERENCE_TEXT = '250g de Downtime + 250g de Hiperfoco, molido para prensa francesa';
var QUIZ_RESULT_REFERENCE_PRICE = '$18.000 CLP';

var PRICE_MAP = {
  '1_taza': { format: '250g', price: '$9.000' },
  '2_tazas': { format: '500g', price: '$16.500' },
  '3_o_mas': { format: '1kg', price: '$29.000' }
};

var QUIZ_COMBO_PRICE = '$18.000';

// Molienda recomendada según método. Hervidor y no_se → prensa francesa
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
  var cloneCta = clone.querySelector('a');
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
  if (cloneCta) cloneCta.href = '#';

  stack.appendChild(clone);
  stack.style.minHeight = Math.ceil(clone.offsetHeight) + 'px';
  stack.removeChild(clone);
}

function showQuizStep(step) {
  document.querySelectorAll('.quiz-step').forEach(function(s) {
    s.classList.remove('active');
  });

  var el = document.getElementById('quizStep' + step);
  if (el) el.classList.add('active');

  var fills = { 1: 25, 2: 50, 3: 75, 4: 100 };
  var fill = document.getElementById('quizProgressFill');
  var progress = document.querySelector('.quiz-progress[role="progressbar"]');
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

function selectCups(btn) {
  clearQuizSelection('#quizStep1 .quiz-option');
  btn.classList.add('selected');
  btn.setAttribute('aria-pressed', 'true');
  quizCups = btn.getAttribute('data-cups');
  quizMethod = null;
  quizProductChoice = null;
  clearQuizSelection('#quizStep2 .quiz-option');
  clearQuizSelection('#quizStep3 .quiz-option');
  dataLayer.push({ event: 'quiz_started' });
  setTimeout(function() {
    showQuizStep(2);
  }, 200);
}

function selectMethod(btn) {
  clearQuizSelection('#quizStep2 .quiz-option');
  btn.classList.add('selected');
  btn.setAttribute('aria-pressed', 'true');
  quizMethod = btn.getAttribute('data-method');
  quizProductChoice = null;
  clearQuizSelection('#quizStep3 .quiz-option');
  setTimeout(function() {
    showQuizStep(3);
  }, 200);
}

function selectProductChoice(btn) {
  clearQuizSelection('#quizStep3 .quiz-option');
  btn.classList.add('selected');
  btn.setAttribute('aria-pressed', 'true');
  quizProductChoice = btn.getAttribute('data-product-choice');
  window.setTimeout(function() {
    showQuizResult();
  }, 0);
}

function getQuizRecommendation() {
  var formatRec = PRICE_MAP[quizCups] || PRICE_MAP['1_taza'];
  var grindLabel = METHOD_GRIND_MAP[quizMethod] || 'molido grueso para prensa francesa';

  if (quizProductChoice === 'ambos_250') {
    return {
      text: '250g de Downtime + 250g de Hiperfoco, ' + grindLabel,
      price: QUIZ_COMBO_PRICE + ' CLP',
      message: 'Hola Café Roast! 👋 El quiz me recomendó:\n• 250g de Downtime\n• 250g de Hiperfoco\n• Molienda: ' + grindLabel + '\n¿Tienen disponibilidad?'
    };
  }

  var productName = PRODUCT_NAME_MAP[quizProductChoice] || PRODUCT_NAME_MAP.downtime;
  return {
    text: productName + ' en ' + formatRec.format + ', ' + grindLabel,
    price: formatRec.price + ' CLP',
    message: 'Hola Café Roast! 👋 El quiz me recomendó:\n• ' + productName + '\n• Formato: ' + formatRec.format + '\n• Molienda: ' + grindLabel + '\n¿Tienen disponibilidad?'
  };
}

function showQuizResult() {
  if (!quizCups || !quizMethod || !quizProductChoice) return;

  var recommendation = getQuizRecommendation();
  document.getElementById('quizResultRec').textContent = recommendation.text;
  document.getElementById('quizResultPrice').textContent = recommendation.price;
  document.getElementById('quizResultCta').href = 'https://wa.me/56951172813?text=' + encodeURIComponent(recommendation.message);

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
  if (resultRec) resultRec.textContent = '—';
  if (resultPrice) resultPrice.textContent = '—';
  if (resultCta) resultCta.href = '#';
  showQuizStep(1);
}

// ===== PRODUCT WHATSAPP LINKS =====
var PRODUCT_PRICE_MAP = {
  '250g': '$9.000',
  '500g': '$16.500',
  '1kg': '$29.000'
};

function buildProductMessage(productId, format, grind) {
  var productName = PRODUCT_NAME_MAP[productId] || productId;
  var grindText = PRODUCT_GRIND_LABEL_MAP[grind] || grind;
  return 'Hola Café Roast. Quiero pedir ' + productName + ' en formato ' + format + ' y molienda ' + grindText + '.';
}

function updateProductCard(card) {
  if (!card) return;

  var productId = card.getAttribute('data-product-id') || '';
  var formatSelect = card.querySelector('[data-product-format]');
  var grindSelect = card.querySelector('[data-product-grind]');
  var priceEl = card.querySelector('[data-product-price]');
  var linkEl = card.querySelector('[data-product-link]');
  var format = formatSelect ? formatSelect.value : '250g';
  var grind = grindSelect ? grindSelect.value : 'grano entero';
  var price = PRODUCT_PRICE_MAP[format] || PRODUCT_PRICE_MAP['250g'];

  if (priceEl) {
    priceEl.innerHTML = price + ' <span>CLP</span>';
  }

  if (linkEl) {
    var msg = buildProductMessage(productId, format, grind);
    linkEl.href = 'https://wa.me/56951172813?text=' + encodeURIComponent(msg);
    linkEl.setAttribute('aria-label', 'Pedir ' + (PRODUCT_NAME_MAP[productId] || productId) + ' por WhatsApp');
    linkEl.setAttribute('data-product-format-selected', format);
    linkEl.setAttribute('data-product-grind-selected', grind);
  }
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

// ===== CAROUSEL =====
var carouselTrack = document.getElementById('carouselTrack');
var carouselDotsContainer = document.getElementById('carouselDots');
var carouselInterval = null;
var currentDot = 0;
var isHovered = false;

function buildDots() {
  if (!carouselTrack || !carouselDotsContainer) return;
  var cards = carouselTrack.querySelectorAll('.review-card');
  cards.forEach(function(_, i) {
    var dot = document.createElement('button');
    dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', 'Ir a reseña ' + (i + 1));
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    dot.addEventListener('click', function() {
      scrollToCard(i);
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
  dots.forEach(function(dot, i) {
    dot.classList.toggle('active', i === index);
    dot.setAttribute('aria-selected', i === index ? 'true' : 'false');
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

if (carouselTrack) {
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
    cards.forEach(function(card, i) {
      var dist = Math.abs(card.offsetLeft - scrollLeft);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });
    updateDot(closest);
  });
}

// ===== ACCORDION (one open at a time) =====
var faqItems = document.querySelectorAll('.faq-item');
faqItems.forEach(function(item) {
  var btn = item.querySelector('.faq-btn');
  var answer = item.querySelector('.faq-answer');
  if (!btn || !answer) return;
  btn.addEventListener('click', function() {
    var isOpen = item.classList.contains('open');
    faqItems.forEach(function(i) {
      i.classList.remove('open');
      var currentButton = i.querySelector('.faq-btn');
      var currentAnswer = i.querySelector('.faq-answer');
      if (currentButton) currentButton.setAttribute('aria-expanded', 'false');
      if (currentAnswer) currentAnswer.style.maxHeight = null;
    });
    if (!isOpen) {
      item.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      answer.style.maxHeight = answer.scrollHeight + 'px';
    }
  });
});

// ===== FADE IN ON SCROLL =====
var fadeEls = document.querySelectorAll('.fade-in');
var fadeObserver = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
fadeEls.forEach(function(el) {
  fadeObserver.observe(el);
});

// ===== HAMBURGUESA =====
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

if (hamburger) {
  hamburger.addEventListener('click', function() {
    drawer.classList.contains('open') ? closeDrawer() : openDrawer();
  });
}
if (overlay) overlay.addEventListener('click', closeDrawer);
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeDrawer();
});
window.addEventListener('resize', syncQuizPanelHeight);
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(syncQuizPanelHeight);
}

// ===== INIT =====
bindQuizControls();
initProductCards();
syncQuizPanelHeight();

window.selectCups = selectCups;
window.selectMethod = selectMethod;
window.selectProductChoice = selectProductChoice;
window.quizBack = quizBack;
window.quizRestart = quizRestart;
