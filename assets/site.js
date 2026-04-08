  // ===== dataLayer init =====
  window.dataLayer = window.dataLayer || [];

  // ===== QUIZ STATE =====
  var quizCups = null;
  var quizMethod = null;
  var QUIZ_DESKTOP_BREAKPOINT = 900;
  var QUIZ_RESULT_REFERENCE_TEXT = '1kg de café molido grueso para prensa francesa';
  var QUIZ_RESULT_REFERENCE_PRICE = '$29.000 CLP';

  var PRICE_MAP = {
    '1_taza':  { format: '250g', price: '$9.000' },
    '2_tazas': { format: '500g', price: '$16.500' },
    '3_o_mas': { format: '1kg',  price: '$29.000' }
  };

  // Molienda recomendada según método. Hervidor y no_se → prensa francesa
  var METHOD_GRIND_MAP = {
    'moka':            'molido para moka',
    'prensa_francesa': 'molido grueso para prensa francesa',
    'filtro':          'molido medio para filtro',
    'espresso':        'molido fino para espresso',
    'hervidor':        'molido grueso para prensa francesa',
    'no_se':           'molido grueso para prensa francesa'
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

  function syncQuizPanelHeight() {
    var stack = document.getElementById('quizStepStack');
    var stepThree = document.getElementById('quizStep3');
    var actualRec = document.getElementById('quizResultRec');
    var actualPrice = document.getElementById('quizResultPrice');
    if (!stack || !stepThree) return;

    if (window.innerWidth < QUIZ_DESKTOP_BREAKPOINT) {
      stack.style.minHeight = '';
      return;
    }

    if (!stack.clientWidth) return;

    var clone = stepThree.cloneNode(true);
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
    document.querySelectorAll('.quiz-step').forEach(function(s) { s.classList.remove('active'); });
    var el = document.getElementById('quizStep' + step);
    if (el) el.classList.add('active');
    var fills = { 1: 50, 2: 100, 3: 100 };
    var fill = document.getElementById('quizProgressFill');
    var progress = document.querySelector('.quiz-progress[role="progressbar"]');
    if (fill) fill.style.width = fills[step] + '%';
    if (progress) progress.setAttribute('aria-valuenow', String(fills[step]));
    syncQuizPanelHeight();
  }

  function selectCups(btn) {
    document.querySelectorAll('#quizStep1 .quiz-option').forEach(function(b) { b.classList.remove('selected'); b.setAttribute('aria-pressed','false'); });
    btn.classList.add('selected'); btn.setAttribute('aria-pressed','true');
    quizCups = btn.getAttribute('data-cups');
    dataLayer.push({ event: 'quiz_started' });
    setTimeout(function() { showQuizStep(2); }, 200);
  }

  function selectMethod(btn) {
    document.querySelectorAll('#quizStep2 .quiz-option').forEach(function(b) { b.classList.remove('selected'); b.setAttribute('aria-pressed','false'); });
    btn.classList.add('selected'); btn.setAttribute('aria-pressed','true');
    quizMethod = btn.getAttribute('data-method');
    setTimeout(function() { showQuizResult(); }, 200);
  }

  function showQuizResult() {
    if (!quizCups || !quizMethod) return;
    var rec = PRICE_MAP[quizCups];
    var grindLabel = METHOD_GRIND_MAP[quizMethod] || 'molido grueso para prensa francesa';
    var recText = rec.format + ' de café ' + grindLabel;
    document.getElementById('quizResultRec').textContent = recText;
    document.getElementById('quizResultPrice').textContent = rec.price + ' CLP';
    var msg = 'Hola Café Roast! 👋 El quiz me recomendó:\n• ' + recText + '\n¿Tienen disponibilidad?';
    document.getElementById('quizResultCta').href = 'https://wa.me/56951172813?text=' + encodeURIComponent(msg);
    showQuizStep(3);
  }

  function quizBack(step) { showQuizStep(step); }

  function quizRestart() {
    quizCups = null; quizMethod = null;
    document.querySelectorAll('.quiz-option').forEach(function(b) { b.classList.remove('selected'); b.setAttribute('aria-pressed','false'); });
    showQuizStep(1);
  }

  // ===== PRODUCT WHATSAPP LINKS =====
  function buildProductLink(format, grindId) {
    var grind = document.getElementById(grindId) ? document.getElementById(grindId).value : '';
    var grindText = PRODUCT_GRIND_LABEL_MAP[grind] || grind;
    var msg = 'Hola Café Roast! 👋 Quiero pedir:\n• ' + format + ' de café ' + grindText + '\n¿Tienen disponibilidad?';
    return 'https://wa.me/56951172813?text=' + encodeURIComponent(msg);
  }

  function updateProductLink(size) {
    if (size === '250') {
      var el = document.getElementById('waLink250');
      if (el) el.href = buildProductLink('250g', 'grind250');
    } else if (size === '500') {
      var el = document.getElementById('waLink500');
      if (el) el.href = buildProductLink('500g', 'grind500');
    } else if (size === '1kg') {
      var el = document.getElementById('waLink1kg');
      if (el) el.href = buildProductLink('1kg', 'grind1kg');
    }
  }

  function initProductLinks() {
    updateProductLink('250');
    updateProductLink('500');
    updateProductLink('1kg');
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
      dot.addEventListener('click', function() { scrollToCard(i); });
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
    dots.forEach(function(d, i) {
      d.classList.toggle('active', i === index);
      d.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });
  }

  function autoScroll() {
    if (!carouselTrack || isHovered) return;
    var cards = carouselTrack.querySelectorAll('.review-card');
    var next = (currentDot + 1) % cards.length;
    scrollToCard(next);
  }

  function startCarousel() {
    carouselInterval = setInterval(autoScroll, 4000);
  }

  if (carouselTrack) {
    buildDots();
    startCarousel();
    carouselTrack.addEventListener('mouseenter', function() { isHovered = true; });
    carouselTrack.addEventListener('mouseleave', function() { isHovered = false; });
    carouselTrack.addEventListener('scroll', function() {
      var cards = carouselTrack.querySelectorAll('.review-card');
      var scrollLeft = carouselTrack.scrollLeft;
      var closest = 0;
      var minDist = Infinity;
      cards.forEach(function(card, i) {
        var dist = Math.abs(card.offsetLeft - scrollLeft);
        if (dist < minDist) { minDist = dist; closest = i; }
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
        var b = i.querySelector('.faq-btn');
        var a = i.querySelector('.faq-answer');
        if (b) b.setAttribute('aria-expanded', 'false');
        if (a) a.style.maxHeight = null;
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
  fadeEls.forEach(function(el) { fadeObserver.observe(el); });

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
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeDrawer(); });
  window.addEventListener('resize', syncQuizPanelHeight);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(syncQuizPanelHeight);
  }

  // ===== INIT =====
  initProductLinks();
  syncQuizPanelHeight();
