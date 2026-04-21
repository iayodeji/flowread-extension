// FlowRead content script — injected into pages
// Uses dynamic import() to load Pretext ES modules from extension URL

(function () {
  // Guard against double injection
  if (window.__flowreadLoaded) return;
  window.__flowreadLoaded = true;

  // ── Constants ─────────────────────────────────────────────────────────────
  const FONTS = {
    lexend:      { name: 'FlowRead-Lexend',    url: chrome.runtime.getURL('fonts/Lexend-Regular.woff2') },
    opendyslexic:{ name: 'FlowRead-OD',        url: chrome.runtime.getURL('fonts/OpenDyslexic-Regular.woff2') },
    atkinson:    { name: 'FlowRead-Atkinson',  url: chrome.runtime.getURL('fonts/AtkinsonHyperlegible-Regular.woff2') },
  };

  const BG = {
    cream:    { bg: '#fdf6e3', fg: '#2d2a21' },
    sepia:    { bg: '#f4ecd8', fg: '#3d2b1f' },
    dark:     { bg: '#1a1a2e', fg: '#e0d9c8' },
    grey:     { bg: '#f0f0f0', fg: '#1a1a1a' },
    original: { bg: null, fg: null },
  };

  const TEXT_SCOPE = [
    'p', 'li', 'td', 'th', 'blockquote',
    'article', 'section', 'main',
    '[class*="content"]', '[class*="article"]',
    '[class*="post"]', '[class*="body"]',
    '[class*="text"]', '[class*="prose"]',
  ].join(', ');

  // ── Runtime state ─────────────────────────────────────────────────────────
  let pretext = null;       // loaded lazily
  let settings = null;
  let active = false;

  // DOM refs
  let $style = null;
  let $fonts = null;
  let $ruler = null;
  let $focusTop = null;
  let $focusBot = null;

  // Autopace
  let paceTimer = null;
  let paceLines = [];
  let paceIdx = 0;

  // Ruler
  let mouseY = 0;
  let currentParagraph = null;
  let preparedCache = new WeakMap(); // el → { text, width, prepared }

  // ── Load Pretext asynchronously ───────────────────────────────────────────
  async function loadPretext() {
    if (pretext) return pretext;
    try {
      pretext = await import(chrome.runtime.getURL('pretext-layout.js'));
      preparedCache = new WeakMap(); // reset cache after load
      return pretext;
    } catch (e) {
      console.warn('[FlowRead] Pretext load failed — ruler uses fallback', e);
      return null;
    }
  }

  // ── Main enable / disable ─────────────────────────────────────────────────
  async function enable(s) {
    disable(); // clean slate
    settings = s;
    active = true;

    injectFonts(s);
    injectStyles(s);
    if (s.bionic) applyBionic();
    if (s.ruler || s.focusMode) buildRuler(s);
    if (s.focusMode) buildFocusOverlay();
    if (s.autopace) await startAutopace(s);

    document.addEventListener('mousemove', onMouseMove, { passive: true });

    // Load pretext in background — ruler will upgrade itself once loaded
    loadPretext();
  }

  function disable() {
    active = false;
    settings = null;

    $style?.remove();    $style = null;
    $fonts?.remove();    $fonts = null;
    $ruler?.remove();    $ruler = null;
    $focusTop?.remove(); $focusTop = null;
    $focusBot?.remove(); $focusBot = null;

    stopAutopace();
    removeBionic();
    preparedCache = new WeakMap();
    currentParagraph = null;

    document.removeEventListener('mousemove', onMouseMove);
  }

  // ── Style injection ───────────────────────────────────────────────────────
  function injectFonts(s) {
    const f = FONTS[s.font];
    if (!f) return;
    $fonts = document.createElement('style');
    $fonts.id = '__flowread_fonts__';
    $fonts.textContent = `
      @font-face {
        font-family: '${f.name}';
        src: url('${f.url}') format('woff2');
        font-display: swap;
      }
    `;
    document.head.appendChild($fonts);
  }

  function injectStyles(s) {
    const f = FONTS[s.font];
    const fontFamily = f ? `'${f.name}', Georgia, serif` : null;
    const { bg, fg } = BG[s.bgColor] || {};

    let css = '';
    if (bg) css += `html,body{background:${bg}!important;}`;

    css += `${TEXT_SCOPE}{`;
    if (fontFamily) css += `font-family:${fontFamily}!important;`;
    css += `font-size:${s.fontSize}px!important;`;
    css += `line-height:${s.lineHeight}!important;`;
    css += `letter-spacing:${s.letterSpacing}em!important;`;
    css += `word-spacing:${s.wordSpacing}em!important;`;
    if (fg) css += `color:${fg}!important;`;
    if (s.columnWidth) css += `max-width:${s.columnWidthPx}px!important;margin-left:auto!important;margin-right:auto!important;`;
    css += '}';

    $style = document.createElement('style');
    $style.id = '__flowread_styles__';
    $style.textContent = css;
    document.head.appendChild($style);
  }

  // ── Living Ruler ──────────────────────────────────────────────────────────
  function buildRuler(s) {
    $ruler = document.createElement('div');
    $ruler.id = '__flowread_ruler__';
    Object.assign($ruler.style, {
      position: 'fixed',
      left: '0', top: '-100px',
      width: '100%',
      height: `${s.fontSize * s.lineHeight}px`,
      background: s.rulerColor,
      opacity: String(s.rulerOpacity),
      pointerEvents: 'none',
      zIndex: '2147483640',
      transition: 'top 0.07s ease-out, height 0.07s ease-out',
      mixBlendMode: 'multiply',
    });
    document.body.appendChild($ruler);
  }

  function buildFocusOverlay() {
    $focusTop = document.createElement('div');
    Object.assign($focusTop.style, {
      position: 'fixed', left: '0', top: '0', width: '100%', height: '0',
      background: 'rgba(0,0,0,0.6)', pointerEvents: 'none',
      zIndex: '2147483639', transition: 'height 0.07s ease-out',
    });
    $focusBot = document.createElement('div');
    Object.assign($focusBot.style, {
      position: 'fixed', left: '0', top: '100vh', width: '100%', height: '100vh',
      background: 'rgba(0,0,0,0.6)', pointerEvents: 'none',
      zIndex: '2147483639', transition: 'top 0.07s ease-out',
    });
    document.body.appendChild($focusTop);
    document.body.appendChild($focusBot);
  }

  function positionRuler(top, height) {
    if ($ruler) {
      $ruler.style.top = `${top}px`;
      $ruler.style.height = `${height}px`;
    }
    if ($focusTop) $focusTop.style.height = `${Math.max(0, top)}px`;
    if ($focusBot) {
      $focusBot.style.top = `${top + height}px`;
      $focusBot.style.height = `${window.innerHeight}px`;
    }
  }

  function onMouseMove(e) {
    mouseY = e.clientY;
    if (!$ruler || !settings || !active) return;

    // Hit-test paragraphs
    const els = document.elementsFromPoint(e.clientX, e.clientY);
    let para = null;
    for (const el of els) {
      if (el.matches && el.matches('p, li, blockquote, td, h1, h2, h3, h4')) {
        para = el;
        break;
      }
    }
    if (!para) return;

    const rect = para.getBoundingClientRect();
    const lineH = settings.fontSize * settings.lineHeight;

    if (pretext) {
      // Pretext path: pixel-perfect line detection
      const text = para.textContent || '';
      const fontName = FONTS[settings.font]?.name || 'sans-serif';
      const fontStr = `${settings.fontSize}px ${fontName}`;
      const cacheKey = para;
      const cached = preparedCache.get(cacheKey);

      let prepared;
      if (cached && cached.text === text && Math.abs(cached.width - rect.width) < 2) {
        prepared = cached.prepared;
      } else {
        try {
          prepared = pretext.prepare(text, fontStr);
          preparedCache.set(cacheKey, { text, width: rect.width, prepared });
        } catch (_) {
          prepared = null;
        }
      }

      if (prepared) {
        try {
          const relY = e.clientY - rect.top;
          const lineIdx = Math.max(0, Math.min(
            Math.floor(relY / lineH),
            pretext.layout(prepared, rect.width, lineH).lineCount - 1
          ));
          positionRuler(rect.top + lineIdx * lineH, lineH);
          return;
        } catch (_) {}
      }
    }

    // Fallback: snap ruler to hovered paragraph top
    const relY = e.clientY - rect.top;
    const lineIdx = Math.max(0, Math.floor(relY / lineH));
    positionRuler(rect.top + lineIdx * lineH, lineH);
  }

  // ── Autopace ──────────────────────────────────────────────────────────────
  async function startAutopace(s) {
    stopAutopace();
    await loadPretext();
    if (!$ruler) buildRuler(s);

    paceLines = [];
    const lineH = s.fontSize * s.lineHeight;
    const paras = Array.from(document.querySelectorAll('p, li, blockquote'))
      .filter(el => el.textContent.trim().length > 10);

    for (const para of paras) {
      const rect = para.getBoundingClientRect();
      if (rect.height < 1) continue;
      const top = rect.top + window.scrollY;
      let lineCount = Math.round(rect.height / lineH) || 1;

      if (pretext) {
        try {
          const fontStr = `${s.fontSize}px ${FONTS[s.font]?.name || 'sans-serif'}`;
          const prepared = pretext.prepare(para.textContent || '', fontStr);
          lineCount = pretext.layout(prepared, rect.width, lineH).lineCount;
        } catch (_) {}
      }

      for (let i = 0; i < lineCount; i++) {
        paceLines.push({ top: top + i * lineH, height: lineH });
      }
    }

    paceIdx = 0;
    // Average ~8 words per line; convert WPM → ms per line
    const msPerLine = Math.round((60 / s.autopaceWPM) * 8 * 1000);

    paceTimer = setInterval(() => {
      if (paceIdx >= paceLines.length) { stopAutopace(); return; }
      const { top, height } = paceLines[paceIdx];
      const screenTop = top - window.scrollY;
      positionRuler(screenTop, height);
      // Scroll to keep ruler in view (70% threshold)
      if (screenTop > window.innerHeight * 0.72) {
        window.scrollBy({ top: height * 4, behavior: 'smooth' });
      }
      paceIdx++;
    }, msPerLine);
  }

  function stopAutopace() {
    clearInterval(paceTimer);
    paceTimer = null;
    paceLines = [];
    paceIdx = 0;
  }

  // ── Bionic Reading ────────────────────────────────────────────────────────
  function applyBionic() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const p = node.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          const tag = p.tagName?.toLowerCase();
          if (['script','style','code','pre','kbd','samp'].includes(tag)) return NodeFilter.FILTER_REJECT;
          if (p.closest('[id*="flowread"]')) return NodeFilter.FILTER_REJECT;
          if (node.textContent.trim().length < 3) return NodeFilter.FILTER_SKIP;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);

    for (const node of nodes) {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(part => {
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
          return;
        }
        const boldLen = Math.max(1, Math.ceil(part.length * 0.45));
        const span = document.createElement('span');
        span.setAttribute('data-fr-bionic', '1');
        const b = document.createElement('b');
        b.style.fontWeight = '750';
        b.textContent = part.slice(0, boldLen);
        span.appendChild(b);
        span.appendChild(document.createTextNode(part.slice(boldLen)));
        frag.appendChild(span);
      });
      node.parentNode?.replaceChild(frag, node);
    }
  }

  function removeBionic() {
    document.querySelectorAll('[data-fr-bionic]').forEach(span => {
      span.replaceWith(document.createTextNode(span.textContent || ''));
    });
  }

  // ── Message listener ───────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'FLOWREAD_TOGGLE') {
      if (msg.enable) enable(msg.settings);
      else disable();
    }
    if (msg.type === 'FLOWREAD_SETTINGS') {
      if (active) enable(msg.settings); // re-apply with new settings
    }
    return false;
  });

  console.log('[FlowRead] ready on', location.hostname);
})();
