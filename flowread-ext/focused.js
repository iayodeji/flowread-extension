// FlowRead — Focused Reading Mode
// Architecture: extract → Pretext layout → DOM render (not canvas) → per-line ruler
// Constraint: text stays in DOM. Selectable. Accessible. Zero canvas.
// Pretext role: pixel-perfect line boundary detection only. No re-render gimmicks.

(async function () {
  // ── Guard ──────────────────────────────────────────────────────────────────
  if (window.__frFocused) { window.__frFocused.destroy(); return; }

  // ── Load Pretext ───────────────────────────────────────────────────────────
  const PT = await import(chrome.runtime.getURL('pretext-layout.js')).catch(() => null);
  if (!PT) { console.error('[FlowRead] Pretext failed to load'); return; }

  // ── Constants ──────────────────────────────────────────────────────────────
  const FONT_SIZE    = 19;        // px — large enough to reduce crowding
  const LINE_H       = FONT_SIZE * 1.85;  // generous line height, science-backed
  const LETTER_SPC   = 0.06;     // em — 25% crowding reduction per 2025 research
  const COL_W        = 640;       // max reading column px
  const PARA_ALPHA   = 0.07;      // opacity of non-active paragraphs
  const RULER_COLOR  = '#E4B100';
  const RULER_ALPHA  = 0.22;
  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TRANSITION   = REDUCED_MOTION ? '0s' : '0.12s ease';
  const FONT_STACK   = "'FlowRead-Lexend', Georgia, serif";
  const TOKENS = {
    bg: '#1C1B19',
    text: '#F0EDE8',
    textMuted: '#9E9890',
    border: '#38352E',
    accent: '#3D6B4F',
    accentSoft: '#1F3027',
  };

  // ── Selectors — where articles live on the web ─────────────────────────────
  const ARTICLE_SELECTORS = [
    'article',
    '[role="main"]',
    'main',
    '.mw-parser-output',   // Wikipedia
    '.post-content',
    '.entry-content',
    '.article-body',
    '.story-body',
    '#article-body',
    '#content-body',
  ];

  // ── Find the article ───────────────────────────────────────────────────────
  function findArticle() {
    for (const sel of ARTICLE_SELECTORS) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim().length > 300) return el;
    }
    // Fallback: largest text block
    return [...document.querySelectorAll('div, section')]
      .filter(el => el.offsetHeight > 200)
      .sort((a, b) => (b.innerText?.length || 0) - (a.innerText?.length || 0))[0]
      || document.body;
  }

  // ── Extract paragraphs with metadata ──────────────────────────────────────
  function extractParas(container) {
    const paras = [];
    const els = container.querySelectorAll('p, h1, h2, h3, h4, blockquote, li');
    for (const el of els) {
      const text = el.innerText?.trim();
      if (!text || text.length < 20) continue;
      paras.push({
        text,
        isHeading: /^h[1-4]$/i.test(el.tagName),
        isList: el.tagName === 'LI',
      });
    }
    return paras;
  }

  // ── Build DOM ──────────────────────────────────────────────────────────────
  // Overlay: fixed full-screen dark container
  const overlay = document.createElement('div');
  overlay.id = '__fr_focused__';
  overlay.setAttribute('role', 'region');
  overlay.setAttribute('aria-label', 'FlowRead focused reading mode');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0',
    zIndex: '2147483640',
    background: TOKENS.bg,
    overflowY: 'auto',
    overflowX: 'hidden',
  });

  // Reading column: centered, max-width constrained
  const col = document.createElement('div');
  Object.assign(col.style, {
    maxWidth: COL_W + 'px',
    margin: '0 auto',
    padding: '80px 40px 120px',
    position: 'relative',
  });

  // Ruler: spans full viewport width, not just column
  const ruler = document.createElement('div');
  ruler.id = '__fr_ruler__';
  Object.assign(ruler.style, {
    position: 'fixed',
    left: '0', top: '-200px',
    width: '100%',
    height: LINE_H + 'px',
    background: RULER_COLOR,
    opacity: '0',
    pointerEvents: 'none',
    zIndex: '2147483641',
    transition: `top ${TRANSITION}, height ${TRANSITION}, opacity 0.15s ease`,
    mixBlendMode: 'multiply',
  });

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Exit focused mode');
  closeBtn.title = 'Exit focused mode (Esc)';
  Object.assign(closeBtn.style, {
    position: 'fixed', top: '18px', right: '22px',
    zIndex: '2147483642',
    minWidth: '44px',
    minHeight: '44px',
    background: TOKENS.accentSoft,
    color: TOKENS.text,
    border: `1px solid ${TOKENS.border}`,
    borderRadius: '10px',
    padding: '9px 14px',
    fontSize: '12px',
    letterSpacing: '0.02em',
    cursor: 'pointer',
    fontFamily: 'DM Sans, Segoe UI, sans-serif',
  });
  closeBtn.textContent = 'Exit focused mode';

  closeBtn.addEventListener('focus', () => {
    closeBtn.style.outline = `2px solid ${TOKENS.accent}`;
    closeBtn.style.outlineOffset = '2px';
  });
  closeBtn.addEventListener('blur', () => {
    closeBtn.style.outline = 'none';
  });

  // Keyboard hint
  const keyboardHint = document.createElement('p');
  keyboardHint.textContent = 'Use J/K or Arrow keys to move. Press Esc to exit.';
  Object.assign(keyboardHint.style, {
    position: 'fixed',
    top: '22px',
    left: '22px',
    margin: '0',
    fontSize: '12px',
    color: TOKENS.textMuted,
    zIndex: '2147483642',
    pointerEvents: 'none',
    fontFamily: 'DM Sans, Segoe UI, sans-serif',
  });

  // Progress indicator
  const progress = document.createElement('div');
  Object.assign(progress.style, {
    position: 'fixed', bottom: '0', left: '0',
    height: '2px', width: '0%',
    background: TOKENS.accent,
    zIndex: '2147483642',
    transition: REDUCED_MOTION ? 'none' : 'width 0.3s ease',
    pointerEvents: 'none',
  });

  // Para index label
  const paraLabel = document.createElement('div');
  Object.assign(paraLabel.style, {
    position: 'fixed', bottom: '12px', right: '22px',
    fontSize: '12px',
    color: TOKENS.textMuted,
    letterSpacing: '0.02em',
    fontFamily: 'DM Sans, Segoe UI, sans-serif',
    zIndex: '2147483642',
    pointerEvents: 'none',
  });

  // Screen-reader status updates for paragraph progress
  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  Object.assign(liveRegion.style, {
    position: 'fixed',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
  });

  document.body.appendChild(overlay);
  document.body.appendChild(ruler);
  document.body.appendChild(closeBtn);
  document.body.appendChild(keyboardHint);
  document.body.appendChild(progress);
  document.body.appendChild(paraLabel);
  document.body.appendChild(liveRegion);
  overlay.appendChild(col);

  // ── Render paragraphs into DOM ─────────────────────────────────────────────
  const article = findArticle();
  const paras   = extractParas(article);
  if (!paras.length) { cleanup(); alert('[FlowRead] No readable content found.'); return; }

  const paraEls = [];

  for (const para of paras) {
    const el = document.createElement(para.isHeading ? 'h2' : 'p');
    el.textContent = para.text;
    Object.assign(el.style, {
      fontFamily: FONT_STACK,
      fontSize:   para.isHeading ? (FONT_SIZE * 1.4) + 'px' : FONT_SIZE + 'px',
      lineHeight: para.isHeading ? '1.4' : LINE_H / FONT_SIZE + '',
      letterSpacing: LETTER_SPC + 'em',
      wordSpacing: '0.08em',
      color: para.isHeading ? '#ffffff' : '#c8c4bc',
      fontWeight: para.isHeading ? '600' : '400',
      margin: '0 0 ' + (para.isHeading ? '28px' : '22px') + ' 0',
      opacity: PARA_ALPHA + '',
      transition: REDUCED_MOTION ? 'none' : 'opacity 0.2s ease',
      cursor: 'default',
      userSelect: 'text',         // keep text selectable
      WebkitUserSelect: 'text',
    });
    col.appendChild(el);
    paraEls.push(el);
  }

  // ── Pretext cache ──────────────────────────────────────────────────────────
  // Key: paragraph index. Value: { prepared, lineCount, lineH }
  const ptCache = new Map();

  function getPrepared(idx) {
    if (ptCache.has(idx)) return ptCache.get(idx);
    const para = paras[idx];
    const el   = paraEls[idx];
    const fs   = para.isHeading ? FONT_SIZE * 1.4 : FONT_SIZE;
    const lh   = para.isHeading ? fs * 1.4 : LINE_H;
    const font = (para.isHeading ? '600 ' : '400 ') + fs + 'px ' + FONT_STACK;
    try {
      const prepared  = PT.prepareWithSegments(para.text, font);
      const colWidth  = Math.min(el.offsetWidth || COL_W - 80, COL_W - 80);
      const result    = PT.layoutWithLines(prepared, colWidth, lh);
      const entry = { prepared, lines: result.lines, lineCount: result.lineCount, lh };
      ptCache.set(idx, entry);
      return entry;
    } catch (e) {
      return null;
    }
  }

  // ── Active paragraph tracking ──────────────────────────────────────────────
  let activePara  = -1;   // index
  let activeLineY = 0;    // screen-space Y of the ruler

  function setActive(idx) {
    if (idx === activePara) return;
    // Dim old
    if (activePara >= 0 && paraEls[activePara]) {
      paraEls[activePara].style.opacity = PARA_ALPHA + '';
    }
    activePara = idx;
    // Illuminate new
    if (idx >= 0 && paraEls[idx]) {
      paraEls[idx].style.opacity = '1';
    }
    // Update progress
    const pct = paras.length > 1 ? Math.round((idx / (paras.length - 1)) * 100) : 100;
    progress.style.width = pct + '%';
    paraLabel.textContent = (idx + 1) + ' / ' + paras.length;
    liveRegion.textContent = `Paragraph ${idx + 1} of ${paras.length}`;
  }

  // ── Mouse → ruler ──────────────────────────────────────────────────────────
  let mouseY = -9999;

  function positionRuler(screenY, lh) {
    ruler.style.top     = screenY + 'px';
    ruler.style.height  = lh + 'px';
    ruler.style.opacity = RULER_ALPHA + '';
  }

  function onMove(e) {
    mouseY = e.clientY;

    // Find which paragraph the mouse is over
    let hit = -1;
    for (let i = 0; i < paraEls.length; i++) {
      const r = paraEls[i].getBoundingClientRect();
      if (mouseY >= r.top && mouseY <= r.bottom) { hit = i; break; }
    }

    if (hit < 0) {
      ruler.style.opacity = '0';
      return;
    }

    setActive(hit);

    const el   = paraEls[hit];
    const rect = el.getBoundingClientRect();
    const entry = getPrepared(hit);

    if (!entry) {
      // No Pretext data — snap ruler to paragraph top
      positionRuler(rect.top, LINE_H);
      return;
    }

    // Pretext path: find exact line
    const relY    = mouseY - rect.top;
    const lineIdx = Math.max(0, Math.min(
      Math.floor(relY / entry.lh),
      entry.lineCount - 1
    ));
    const lineTop = rect.top + lineIdx * entry.lh;
    positionRuler(lineTop, entry.lh);
  }

  overlay.addEventListener('mousemove', onMove, { passive: true });
  overlay.addEventListener('mouseleave', () => { ruler.style.opacity = '0'; });

  // Touch support
  overlay.addEventListener('touchmove', e => {
    onMove({ clientY: e.touches[0].clientY });
  }, { passive: true });

  // ── Keyboard navigation ────────────────────────────────────────────────────
  // J/K or arrow keys advance paragraphs for keyboard readers
  function onKey(e) {
    if (e.key === 'j' || e.key === 'ArrowDown') {
      const next = Math.min(activePara + 1, paras.length - 1);
      paraEls[next]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setActive(next);
    }
    if (e.key === 'k' || e.key === 'ArrowUp') {
      const prev = Math.max(activePara - 1, 0);
      paraEls[prev]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setActive(prev);
    }
    if (e.key === 'Escape') cleanup();
  }
  document.addEventListener('keydown', onKey);

  // ── Scroll → active para ───────────────────────────────────────────────────
  // When scrolling without mouse, track which para is in the center of screen
  overlay.addEventListener('scroll', () => {
    const centerY = window.innerHeight / 2;
    for (let i = 0; i < paraEls.length; i++) {
      const r = paraEls[i].getBoundingClientRect();
      if (r.top <= centerY && r.bottom >= centerY) {
        setActive(i);
        break;
      }
    }
  }, { passive: true });

  // ── Activate first visible paragraph ──────────────────────────────────────
  setActive(0);

  // Pre-warm Pretext on first 5 paragraphs in background
  setTimeout(() => {
    for (let i = 0; i < Math.min(5, paras.length); i++) getPrepared(i);
  }, 200);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  function cleanup() {
    overlay.remove();
    ruler.remove();
    closeBtn.remove();
    progress.remove();
    paraLabel.remove();
    keyboardHint.remove();
    liveRegion.remove();
    document.removeEventListener('keydown', onKey);
    delete window.__frFocused;
  }

  closeBtn.addEventListener('click', cleanup);

  window.__frFocused = { destroy: cleanup };

  console.log(`[FlowRead Focused] ${paras.length} paragraphs, Pretext loaded`);
})();
