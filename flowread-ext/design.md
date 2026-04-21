---
name: flowread-design
description: Design and build UI components, screens, and surfaces for the FlowRead Chrome extension — a reading aid for dyslexia and ADHD users. Use this skill whenever building or updating any FlowRead UI: popups, settings panels, reading overlays, onboarding flows, toggle controls, or any component that lives inside the extension or its companion web surfaces. Also trigger when the agent is asked to "make it look like FlowRead", match the FlowRead aesthetic, or keep a new UI consistent with existing FlowRead design patterns. This skill encodes the full design system, constraints, and component library — always load it before writing any FlowRead UI code.
---

# FlowRead Design Skill

FlowRead is a Chrome extension reading aid for users with dyslexia and ADHD. Every UI decision flows from one mandate: **reduce cognitive friction, not add to it**. This skill gives the agent a complete, opinionated design system so every surface — popup, overlay, settings, onboarding — feels like the same calm, focused product.

---

## Core Design Philosophy

**Calm productivity, not consumer delight.** FlowRead is a tool users reach for in moments of reading difficulty. The UI should feel like a quiet, capable assistant — not a flashy app. No unnecessary motion. No visual noise. No gratuitous color. Everything earns its place.

**Accessibility is the feature.** The product exists to help people read. The UI must never make reading harder: sufficient contrast, generous tap targets, no reliance on color alone to convey state.

**Chrome extension constraints are real.** Popups are 400px wide max, height auto. Sidepanels are 320–400px. Content scripts overlay real pages — be surgical, never obscure the reading surface.

---

## Design Tokens

Use these CSS variables as the single source of truth across all components.

```css
:root {
  /* Surfaces */
  --fr-bg-primary: #F9F8F6;       /* warm off-white, main popup bg */
  --fr-bg-secondary: #EFEDE9;     /* slightly deeper, card/section bg */
  --fr-bg-overlay: rgba(249, 248, 246, 0.97); /* reading overlay */
  --fr-bg-dark: #1C1B19;          /* dark mode primary */
  --fr-bg-dark-secondary: #26251F;

  /* Text */
  --fr-text-primary: #1A1916;     /* near-black, high contrast */
  --fr-text-secondary: #6B6660;   /* muted, for labels/hints */
  --fr-text-inverse: #F9F8F6;     /* on dark surfaces */

  /* Brand / Accent */
  --fr-accent: #3D6B4F;           /* muted forest green — calm, focused */
  --fr-accent-light: #EDF4EF;     /* green tint for selected states */
  --fr-accent-hover: #2F5440;     /* darker on hover */

  /* Status */
  --fr-success: #3D6B4F;
  --fr-warning: #8A6A00;
  --fr-error: #B83030;

  /* Borders */
  --fr-border: #DDD9D4;
  --fr-border-focus: #3D6B4F;

  /* Radius */
  --fr-radius-sm: 6px;
  --fr-radius-md: 10px;
  --fr-radius-lg: 16px;
  --fr-radius-pill: 999px;

  /* Shadows */
  --fr-shadow-sm: 0 1px 3px rgba(26, 25, 22, 0.08);
  --fr-shadow-md: 0 4px 12px rgba(26, 25, 22, 0.12);
  --fr-shadow-overlay: 0 8px 32px rgba(26, 25, 22, 0.18);

  /* Spacing scale */
  --fr-space-xs: 4px;
  --fr-space-sm: 8px;
  --fr-space-md: 16px;
  --fr-space-lg: 24px;
  --fr-space-xl: 32px;

  /* Transitions */
  --fr-transition: 150ms ease;
}

/* Dark mode overrides */
[data-theme="dark"] {
  --fr-bg-primary: #1C1B19;
  --fr-bg-secondary: #26251F;
  --fr-text-primary: #F0EDE8;
  --fr-text-secondary: #9E9890;
  --fr-border: #38352E;
  --fr-accent-light: #1F3027;
}
```

---

## Typography

FlowRead uses two fonts. Load from Google Fonts or bundle locally.

| Role | Font | Weight | Size |
|---|---|---|---|
| Display / Logo | **Fraunces** (serif) | 600 | 18–24px |
| Body / UI | **DM Sans** | 400, 500 | 13–15px |
| Mono / Code | **DM Mono** | 400 | 12px |

**Reading surface override** (injected into pages): Use the user's selected reading font (OpenDyslexic, Lexie Readable, Atkinson Hyperlegible, or system sans). Never apply Fraunces to reading body text.

Typography rules:
- Popup body text: 14px / 1.5 line-height minimum
- Labels: 12px, `letter-spacing: 0.02em`, `font-weight: 500`
- Never go below 12px anywhere
- Line length in reading overlays: 45–75ch

---

## Component Library

### Toggle (primary control)

FlowRead's most-used control. Pill-shaped, high contrast, animated.

```css
.fr-toggle {
  display: flex;
  align-items: center;
  gap: var(--fr-space-sm);
  cursor: pointer;
}

.fr-toggle__track {
  width: 44px;
  height: 24px;
  background: var(--fr-border);
  border-radius: var(--fr-radius-pill);
  position: relative;
  transition: background var(--fr-transition);
}

.fr-toggle__track--active {
  background: var(--fr-accent);
}

.fr-toggle__thumb {
  position: absolute;
  top: 3px; left: 3px;
  width: 18px; height: 18px;
  background: white;
  border-radius: 50%;
  box-shadow: var(--fr-shadow-sm);
  transition: transform var(--fr-transition);
}

.fr-toggle__track--active .fr-toggle__thumb {
  transform: translateX(20px);
}
```

### Slider (reading settings)

Used for font size, line spacing, word spacing, contrast.

```css
.fr-slider {
  -webkit-appearance: none;
  width: 100%;
  height: 4px;
  border-radius: var(--fr-radius-pill);
  background: var(--fr-border);
  outline: none;
}

.fr-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: var(--fr-accent);
  cursor: pointer;
  box-shadow: var(--fr-shadow-sm);
}
```

### Button variants

```css
/* Primary */
.fr-btn-primary {
  background: var(--fr-accent);
  color: white;
  border: none;
  border-radius: var(--fr-radius-md);
  padding: 10px 20px;
  font: 500 14px 'DM Sans', sans-serif;
  cursor: pointer;
  transition: background var(--fr-transition);
}
.fr-btn-primary:hover { background: var(--fr-accent-hover); }

/* Ghost */
.fr-btn-ghost {
  background: transparent;
  color: var(--fr-text-primary);
  border: 1.5px solid var(--fr-border);
  border-radius: var(--fr-radius-md);
  padding: 9px 18px;
  font: 500 14px 'DM Sans', sans-serif;
  cursor: pointer;
  transition: border-color var(--fr-transition), background var(--fr-transition);
}
.fr-btn-ghost:hover {
  border-color: var(--fr-accent);
  background: var(--fr-accent-light);
}
```

### Setting Row

A labeled control row — used in settings panels and the popup.

```html
<div class="fr-setting-row">
  <div class="fr-setting-row__label">
    <span class="fr-setting-row__name">Bionic Reading</span>
    <span class="fr-setting-row__hint">Bold first letters of each word</span>
  </div>
  <div class="fr-toggle" role="switch" aria-checked="false">
    <!-- toggle markup here -->
  </div>
</div>
```

```css
.fr-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--fr-space-md) 0;
  border-bottom: 1px solid var(--fr-border);
}

.fr-setting-row__name {
  font-size: 14px;
  font-weight: 500;
  color: var(--fr-text-primary);
}

.fr-setting-row__hint {
  display: block;
  font-size: 12px;
  color: var(--fr-text-secondary);
  margin-top: 2px;
}
```

### Popup Shell

The outer container for extension popups.

```css
.fr-popup {
  width: 360px;
  background: var(--fr-bg-primary);
  font-family: 'DM Sans', sans-serif;
  color: var(--fr-text-primary);
  border-radius: var(--fr-radius-lg);
  overflow: hidden;
}

.fr-popup__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--fr-space-md) var(--fr-space-lg);
  border-bottom: 1px solid var(--fr-border);
}

.fr-popup__logo {
  font-family: 'Fraunces', serif;
  font-size: 18px;
  font-weight: 600;
  color: var(--fr-text-primary);
}

.fr-popup__body {
  padding: var(--fr-space-md) var(--fr-space-lg);
}

.fr-popup__footer {
  padding: var(--fr-space-sm) var(--fr-space-lg);
  border-top: 1px solid var(--fr-border);
  background: var(--fr-bg-secondary);
}
```

---

## Reading Overlay

When FlowRead injects a reading overlay onto a page, follow these rules:

- Overlay must never be full-screen; leave ≥40px margins on all sides
- Background: `var(--fr-bg-overlay)` with `backdrop-filter: blur(2px)`
- Close/minimize button always visible in top-right, minimum 32×32px
- Max content width: 700px, centered
- Always respect user's reading font preference

---

## Interaction Patterns

**State feedback:** Every interactive element must show hover, focus, active, and disabled states. Never rely on color alone — use shape/shadow/opacity changes too.

**Focus rings:** Always visible, `outline: 2px solid var(--fr-accent); outline-offset: 2px`. Never `outline: none` without a custom focus style.

**Loading states:** Use a subtle pulse animation on the affected element, not a spinner in a blank UI.

**Error messages:** Inline, below the control, `var(--fr-error)` color, 12px, with an icon prefix (⚠). Never use modal alerts for recoverable errors.

**Empty states:** Friendly, short, actionable. One sentence max. Always include a CTA button.

---

## Accessibility Requirements

These are non-negotiable given FlowRead's user base:

1. **Contrast**: Body text ≥ 7:1, large text ≥ 4.5:1 (WCAG AAA target)
2. **Touch targets**: Minimum 44×44px for all interactive elements
3. **ARIA**: All toggles, sliders, and custom controls need proper `role`, `aria-label`, `aria-checked`/`aria-valuenow`
4. **Keyboard**: Full keyboard navigability, logical tab order, no keyboard traps
5. **Motion**: Respect `prefers-reduced-motion` — wrap all transitions in:
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, *::before, *::after { transition: none !important; animation: none !important; }
   }
   ```
6. **Screen readers**: Content script overlays must not trap focus; use `aria-live` regions for dynamic content updates

---

## Chrome Extension Constraints

- **Popup max-width**: 400px (Chrome enforces this)
- **No external font requests in content scripts** — bundle fonts locally or use system fonts there
- **CSP**: Avoid inline `style=""` in content scripts if the host page has a strict CSP — use injected stylesheets
- **z-index**: FlowRead overlay should use `z-index: 2147483647` (max int) to always render on top
- **Performance**: Content script styles must not trigger full page reflow — prefer `transform` and `opacity` for animation

---

## What NOT to Do

- ❌ Purple gradients, neon accents, glassmorphism for its own sake
- ❌ More than 2 fonts in any single surface
- ❌ Animations longer than 300ms or decorative animations that repeat
- ❌ Dense icon-only controls without accessible labels
- ❌ Hiding important settings behind 3+ levels of navigation
- ❌ Centering body text (left-align always for reading surfaces)
- ❌ Using placeholder text as a label substitute
- ❌ Building anything without dark mode support

---

## Implementation Checklist

Before shipping any FlowRead UI component:

- [ ] Uses design tokens (CSS variables), no hardcoded colors or sizes
- [ ] Tested in both light and dark mode
- [ ] All interactive elements have focus styles
- [ ] ARIA attributes correct on custom controls
- [ ] `prefers-reduced-motion` handled
- [ ] Minimum touch target sizes met
- [ ] Contrast ratios checked (use browser devtools accessibility panel)
- [ ] No layout shift when toggling features on/off