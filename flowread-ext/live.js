// FlowRead Live Mode
// Extracts page text, re-renders it on Canvas using Pretext for layout,
// then runs a physics simulation so characters respond to mouse/touch in real time.

(async function () {
  if (window.__flowreadLive) {
    window.__flowreadLive.destroy();
    delete window.__flowreadLive;
    return;
  }

  // ── Load Pretext ───────────────────────────────────────────────────────────
  let PT;
  try {
    PT = await import(chrome.runtime.getURL('pretext-layout.js'));
  } catch (e) {
    console.error('[FlowRead Live] Pretext failed:', e);
    return;
  }

  // ── Find article container ─────────────────────────────────────────────────
  function findArticleEl() {
    const candidates = [
      document.querySelector('article'),
      document.querySelector('[role="main"]'),
      document.querySelector('main'),
      document.querySelector('.mw-parser-output'), // Wikipedia
      document.querySelector('.post-content'),
      document.querySelector('.article-body'),
      document.querySelector('.entry-content'),
      document.querySelector('#content'),
    ].filter(Boolean);

    if (candidates.length) return candidates[0];

    // Fallback: biggest block by text length
    let best = document.body;
    let bestLen = 0;
    document.querySelectorAll('div, section').forEach(el => {
      const len = el.innerText?.length || 0;
      if (len > bestLen && el.offsetHeight > 200) {
        bestLen = len;
        best = el;
      }
    });
    return best;
  }

  // ── Extract paragraphs ─────────────────────────────────────────────────────
  function extractParagraphs(container) {
    const paras = [];
    const els = container.querySelectorAll('p, h1, h2, h3, h4, li');
    for (const el of els) {
      const text = el.innerText?.trim();
      if (!text || text.length < 15) continue;
      const isHeading = /^h[1-4]$/i.test(el.tagName);
      paras.push({ text, heading: isHeading });
    }
    return paras.slice(0, 60); // cap for performance
  }

  // ── Setup ──────────────────────────────────────────────────────────────────
  const articleEl = findArticleEl();
  const paragraphs = extractParagraphs(articleEl);
  if (!paragraphs.length) {
    alert('[FlowRead Live] No readable content found on this page.');
    return;
  }

  // Hide original content, inject canvas overlay
  const articleRect = articleEl.getBoundingClientRect();
  const containerWidth = Math.min(articleEl.offsetWidth || 720, 780);

  // Create full-page overlay
  const overlay = document.createElement('div');
  overlay.id = '__fr_live_overlay__';
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483645',
    background: '#0d0d14',
    overflow: 'auto',
    cursor: 'none',
  });

  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;

  // Canvas fills the viewport width, height determined by content
  const W = window.innerWidth;
  const CONTENT_W = Math.min(W - 80, 760);
  const MARGIN_X = Math.floor((W - CONTENT_W) / 2);

  // We'll size height dynamically after layout
  canvas.style.display = 'block';
  canvas.style.width = W + 'px';

  overlay.appendChild(canvas);
  document.body.appendChild(overlay);

  const ctx = canvas.getContext('2d');

  // ── Close button ───────────────────────────────────────────────────────────
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ Exit Live Mode';
  Object.assign(closeBtn.style, {
    position: 'fixed',
    top: '16px',
    right: '20px',
    zIndex: '2147483646',
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'monospace',
    letterSpacing: '0.05em',
  });
  document.body.appendChild(closeBtn);

  // ── Physics settings ───────────────────────────────────────────────────────
  const FONT_SIZE = 16;
  const LINE_H = FONT_SIZE * 1.75;
  const PARA_GAP = LINE_H * 0.8;
  const HEAD_SIZE = 22;
  const HEAD_LINE_H = HEAD_SIZE * 1.6;
  const REPEL_RADIUS = 90;
  const REPEL_FORCE = 18000;
  const SPRING_K = 0.12;
  const DAMPING = 0.78;
  const MAX_SPEED = 40;

  // ── Build character particles ─────────────────────────────────────────────
  async function buildParticles() {
    const particles = [];
    let y = 60; // top padding

    for (const para of paragraphs) {
      const isHead = para.heading;
      const fs = isHead ? HEAD_SIZE : FONT_SIZE;
      const lh = isHead ? HEAD_LINE_H : LINE_H;
      const fontStr = `${isHead ? 600 : 400} ${fs}px system-ui, sans-serif`;
      const color = isHead ? '#ffffff' : '#c8c4bc';

      let prepared;
      try {
        prepared = PT.prepareWithSegments(para.text, fontStr);
      } catch (e) {
        continue;
      }

      let result;
      try {
        result = PT.layoutWithLines(prepared, CONTENT_W, lh);
      } catch (e) {
        continue;
      }

      for (const line of result.lines) {
        let charX = MARGIN_X;

        for (const ch of line.text) {
          // Measure this char with canvas (Pretext doesn't expose per-char widths directly)
          ctx.font = fontStr;
          const cw = ctx.measureText(ch).width;

          particles.push({
            ch,
            ox: charX,      // original/rest x
            oy: y,          // original/rest y
            x: charX + (Math.random() - 0.5) * W, // start scattered
            y: -100 - Math.random() * 400,          // fall in from top
            vx: (Math.random() - 0.5) * 8,
            vy: Math.random() * 6,
            cw,
            color,
            fs,
            fontStr,
            settled: false,
          });

          charX += cw;
        }

        y += lh;
      }

      y += PARA_GAP;
    }

    return { particles, totalHeight: y + 80 };
  }

  // ── Mouse tracking ─────────────────────────────────────────────────────────
  let mouseX = -9999, mouseY = -9999;
  let scrollY = 0;

  overlay.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY + overlay.scrollTop;
  });
  overlay.addEventListener('mouseleave', () => { mouseX = -9999; mouseY = -9999; });

  // Touch support
  overlay.addEventListener('touchmove', e => {
    e.preventDefault();
    mouseX = e.touches[0].clientX;
    mouseY = e.touches[0].clientY + overlay.scrollTop;
  }, { passive: false });
  overlay.addEventListener('touchend', () => { mouseX = -9999; mouseY = -9999; });

  // ── Click to explode ───────────────────────────────────────────────────────
  let exploding = false;
  overlay.addEventListener('click', e => {
    if (exploding) return;
    exploding = true;
    const cx = e.clientX;
    const cy = e.clientY + overlay.scrollTop;
    for (const p of particles) {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const force = 8000 / (dist * dist + 100);
      p.vx += (dx / dist) * force;
      p.vy += (dy / dist) * force;
    }
    setTimeout(() => { exploding = false; }, 100);
  });

  // ── Build particles then size canvas ──────────────────────────────────────
  const { particles, totalHeight } = await buildParticles();

  const H = totalHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  // ── Render loop ────────────────────────────────────────────────────────────
  let rafId;
  let frame = 0;
  let settled = 0;

  // Custom cursor
  const cursor = document.createElement('div');
  Object.assign(cursor.style, {
    position: 'fixed',
    width: '20px', height: '20px',
    borderRadius: '50%',
    border: '1.5px solid rgba(255,200,0,0.7)',
    background: 'rgba(255,200,0,0.08)',
    pointerEvents: 'none',
    zIndex: '2147483647',
    transform: 'translate(-50%,-50%)',
    transition: 'transform 0.05s',
    display: 'none',
  });
  document.body.appendChild(cursor);

  overlay.addEventListener('mousemove', e => {
    cursor.style.display = 'block';
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });
  overlay.addEventListener('mouseleave', () => { cursor.style.display = 'none'; });

  function tick() {
    ctx.clearRect(0, 0, W, H);

    // Dark background
    ctx.fillStyle = '#0d0d14';
    ctx.fillRect(0, 0, W, H);

    const scrollOffset = overlay.scrollTop;
    const mx = mouseX;
    const my = mouseY;

    for (const p of particles) {
      // Spring toward rest position
      const dox = p.ox - p.x;
      const doy = p.oy - p.y;

      p.vx += dox * SPRING_K;
      p.vy += doy * SPRING_K;

      // Mouse repulsion
      const dx = p.x - mx;
      const dy = p.y - my;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq) || 1;

      if (dist < REPEL_RADIUS) {
        const force = REPEL_FORCE / (distSq + 200);
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      }

      // Damping
      p.vx *= DAMPING;
      p.vy *= DAMPING;

      // Speed cap
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > MAX_SPEED) {
        p.vx = (p.vx / speed) * MAX_SPEED;
        p.vy = (p.vy / speed) * MAX_SPEED;
      }

      p.x += p.vx;
      p.y += p.vy;

      // Color shifts with displacement
      const disp = Math.hypot(p.x - p.ox, p.y - p.oy);
      const heat = Math.min(1, disp / 60);

      // Proximity to mouse — glow
      const proximity = Math.max(0, 1 - dist / REPEL_RADIUS);

      let alpha = 0.85 + proximity * 0.15;
      let r, g, b;

      if (proximity > 0.1) {
        // Glow: shift toward amber/gold near cursor
        r = Math.floor(200 + proximity * 55);
        g = Math.floor(180 + proximity * 20 - heat * 100);
        b = Math.floor(140 - proximity * 100);
      } else if (heat > 0.1) {
        r = Math.floor(200 + heat * 55);
        g = Math.floor(196 - heat * 60);
        b = Math.floor(188 - heat * 80);
      } else {
        // Parse base color
        r = p.color === '#ffffff' ? 255 : 200;
        g = p.color === '#ffffff' ? 255 : 196;
        b = p.color === '#ffffff' ? 255 : 188;
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.font = p.fontStr;
      ctx.fillText(p.ch, p.x, p.y);
    }

    ctx.globalAlpha = 1;

    // Subtle vignette at top and bottom of viewport
    const scrollTop = overlay.scrollTop;
    const grad = ctx.createLinearGradient(0, scrollTop, 0, scrollTop + 60);
    grad.addColorStop(0, 'rgba(13,13,20,0.9)');
    grad.addColorStop(1, 'rgba(13,13,20,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, scrollTop, W, 60);

    frame++;
    rafId = requestAnimationFrame(tick);
  }

  tick();

  // ── Hint text ──────────────────────────────────────────────────────────────
  const hint = document.createElement('div');
  Object.assign(hint.style, {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    color: 'rgba(255,255,255,0.25)',
    fontSize: '11px',
    letterSpacing: '0.1em',
    fontFamily: 'monospace',
    zIndex: '2147483646',
    pointerEvents: 'none',
    transition: 'opacity 2s',
  });
  hint.textContent = 'hover to repel · click to explode · scroll to read';
  document.body.appendChild(hint);
  setTimeout(() => { hint.style.opacity = '0'; }, 4000);

  // ── Destroy ────────────────────────────────────────────────────────────────
  function destroy() {
    cancelAnimationFrame(rafId);
    overlay.remove();
    closeBtn.remove();
    cursor.remove();
    hint.remove();
  }

  closeBtn.addEventListener('click', () => {
    destroy();
    delete window.__flowreadLive;
  });

  window.__flowreadLive = { destroy };

  console.log(`[FlowRead Live] ${particles.length} character particles rendered`);
})();
