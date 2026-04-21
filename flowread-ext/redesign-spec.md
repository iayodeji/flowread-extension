# FlowRead UX Redesign Spec

## 1. Document Purpose
This spec defines the complete UX redesign for FlowRead (popup, in-page experience, modes, onboarding) using the FlowRead design system in design.md.

Primary objective: reduce cognitive friction for dyslexia and ADHD users while preserving power features.

This is an implementation spec, not a moodboard. It includes:
- Product goals and success metrics
- Information architecture and interaction model
- Screen-by-screen UI requirements
- Component inventory and states
- Accessibility requirements
- File-by-file implementation plan
- Sprint plan, risks, and acceptance criteria

## 2. Product Goals

### 2.1 User Outcome Goals
- A first-time user can improve page readability in under 15 seconds.
- A returning user can start reading in 1 click (power toggle or preset apply).
- Users understand mode differences without reading docs.

### 2.2 UX System Goals
- One coherent visual language across popup and content overlays.
- No hardcoded visual values in UI surfaces (token-driven only).
- Accessible by default: keyboard, screen reader, contrast, reduced motion.

### 2.3 Technical Goals
- Keep popup width within Chrome constraints (<= 400px).
- Avoid CSP issues by using stylesheet injection patterns in content scripts.
- Maintain performance by limiting layout thrash and minimizing full re-applies.

## 3. Success Metrics
- Time to first readable state: <= 15s median for first session.
- Core task completion (enable + choose preset): >= 95%.
- Settings churn (rapid toggling/undo): reduced by 30%.
- Keyboard completion of core flow: 100%.
- Contrast checks pass for all primary text and controls.

## 4. Primary Personas and Core Jobs
- Reader in overload: "I need this page readable right now."
- Reader tuning comfort: "I need to adjust spacing/font for this document."
- Advanced reader: "I need special tools (ruler/autopace) when concentration drops."

Core jobs:
- Start or stop reading assistance quickly.
- Pick a readability preset that works immediately.
- Fine-tune only if needed.
- Exit overlays safely at any point.

## 5. New Information Architecture

Use a 3-layer IA on every surface.

### 5.1 Layer 1: Instant
- Power toggle (on/off)
- Preset selector
- Theme selector (light/dark/page)

### 5.2 Layer 2: Tune
- Font family
- Font size
- Line height
- Letter spacing
- Word spacing
- Column width

### 5.3 Layer 3: Advanced
- Bionic reading
- Living ruler (with color/opacity controls)
- Autopace (with WPM)
- Focus mode
- Experimental mode (legacy live mode)

Rule: no critical reading control is deeper than 2 interactions from popup open.

## 6. Feature Rationalization

### 6.1 Keep and Promote
- Power toggle
- Presets
- Typography controls
- Living ruler
- Focus mode

### 6.2 Keep but Demote to Advanced
- Bionic reading
- Autopace
- Column width fine controls

### 6.3 Reposition
- Live mode becomes "Experimental" and is never in the default primary path.

### 6.4 Remove from Main Surface
- Dense visual clusters that force parsing effort.
- Inline style-heavy bespoke buttons that break consistency.

## 7. Screen Specifications

## 7.1 Popup: Home (Default)

### Layout
- Header:
  - FlowRead wordmark (Fraunces)
  - Status chip: Enabled or Disabled
  - Primary power toggle on right
- Section A: Quick Start
  - Preset cards (3): Gentle, Focus, High Contrast
  - One-line helper text under section title
- Section B: Quick Tune
  - Setting rows for Font size, Line height, Theme
- Section C: Tools
  - Toggle rows for Living ruler, Focus mode
- Footer:
  - Ghost button: Advanced settings
  - Text action: Reset

### Behavior
- Enabling power immediately applies last-used preset.
- Preset selection immediately updates page and highlights selected card.
- If no active tab script is available, show inline warning with retry action.

### Empty/Disabled State
- Brief sentence: "Turn on FlowRead to make this page easier to read."
- Primary CTA: Enable FlowRead

## 7.2 Popup: Advanced Settings

### Layout
- Back button to Home
- Group 1: Typography
  - Font family pill group
  - Sliders for size/line/letter/word spacing
  - Column width toggle + width slider (conditional)
- Group 2: Reading Tools
  - Bionic toggle
  - Living ruler toggle + color + opacity sliders
  - Autopace toggle + WPM slider (conditional)
- Group 3: Modes
  - Focus mode toggle
  - Experimental mode launch button (secondary style + caution hint)

### Behavior
- Conditional controls animate open/close with <= 150ms transitions.
- All slider values are announced via aria-valuenow and visible value text.

## 7.3 In-Page Reading Overlay

### Layout
- Non-fullscreen overlay, 40px minimum viewport margins.
- Max content width 700px, centered.
- Top-right control cluster:
  - Close
  - Minimize
  - Preset quick switch
- Content area:
  - Left-aligned text only
  - Reading font from selected setting

### Behavior
- No focus trap.
- Esc closes overlay.
- Dynamic updates announced via aria-live polite region.
- Overlay z-index: 2147483647.

## 7.4 Focus Mode

### Positioning
- Focus mode remains a first-class mode for serious reading.
- Use same visual system as popup and overlay (tokens, typography, controls).

### Required updates
- Replace hardcoded mode styling with tokenized surfaces.
- Add visible keyboard help hint (J/K or arrows, Esc to exit).
- Ensure close button meets 44x44 touch target.

## 7.5 Experimental Mode (Live)

### Positioning
- Rename to "Experimental mode" in UI copy.
- Add caution hint: "May reduce readability on complex pages."

### Required updates
- Keep feature available but secondary and opt-in.
- Add easy escape route and confirmation on first launch.

## 7.6 Onboarding (First Run)

3 lightweight steps in popup (or dedicated onboarding panel):
1. Pick your reading goal (reduce crowding, improve focus, high contrast)
2. Pick base reading font
3. Preview and apply

Store completion in chrome.storage and allow re-open from Advanced settings.

## 8. Component Inventory

All components must map to design.md patterns.

- Popup shell (.fr-popup)
- Header row
- Status chip
- Toggle control (.fr-toggle)
- Setting row (.fr-setting-row)
- Preset card button
- Slider (.fr-slider)
- Primary button (.fr-btn-primary)
- Ghost button (.fr-btn-ghost)
- Inline error message row
- Empty state row
- Section title and helper text

### New component: Preset Card
- Min size 44px height
- Selected: accent light background + accent border + check indicator
- Keyboard selectable

## 9. Interaction and State Rules

- Every interactive control has hover, focus, active, disabled states.
- Focus style always visible: 2px accent outline with 2px offset.
- Never rely on color alone to indicate selection.
- Conditional rows should reserve space or animate smoothly to avoid layout jumps.
- Use subtle pulse for loading only on affected control.

## 10. Accessibility Requirements (Implementation Contract)

- Contrast:
  - Body text >= 7:1 target
  - Large text >= 4.5:1
- Touch targets: >= 44x44 px
- ARIA:
  - Toggles use role=switch and aria-checked
  - Sliders expose aria-valuenow and labels
- Keyboard:
  - Logical tab order
  - Enter/Space activate custom controls
  - Esc exits overlays/modes
- Motion:
  - Respect prefers-reduced-motion and disable transition/animation
- Screen readers:
  - Use aria-live polite for settings applied and mode changes

## 11. Content and Microcopy

Tone: calm, direct, supportive.

Use:
- "Enable FlowRead"
- "Make this page easier to read"
- "Advanced settings"
- "Experimental mode"

Avoid:
- Technical jargon in primary flow
- Alarmist error language

## 12. Data and Settings Model

Keep existing settings object, add:
- activePreset: gentle | focus | contrast | custom
- onboardingCompleted: boolean
- lastSurface: home | advanced
- experimentalAcknowledged: boolean

Preset mapping examples:
- gentle:
  - font: lexend
  - fontSize: 17
  - lineHeight: 1.8
  - letterSpacing: 0.05
  - bgColor: cream
- focus:
  - ruler: true
  - focusMode: true
  - columnWidth: true
- contrast:
  - bgColor: dark
  - font: atkinson

## 13. File-by-File Implementation Plan

## 13.1 popup.html
- Replace inline CSS and mixed ad-hoc classes with tokenized class structure.
- Add two views in markup:
  - Home view
  - Advanced settings view
- Add semantic structure for setting rows and proper labels.
- Add onboarding container (hidden by default after completion).

## 13.2 popup.js
- Introduce a small view state machine:
  - home
  - advanced
  - onboarding
- Add preset application logic and activePreset tracking.
- Add explicit ARIA synchronization for custom toggles/sliders.
- Move mode launch actions to advanced section and rename live to experimental.
- Add inline error handling UI updates instead of only console output.

## 13.3 content.js
- Add token-driven injected stylesheet for overlay/control surfaces.
- Ensure no external font request in content script context.
- Add aria-live region for dynamic setting updates.
- Avoid full disable/enable reflow for small setting changes when possible.
- Ensure overlay controls respect touch target and keyboard rules.

## 13.4 focused.js
- Replace hardcoded colors/sizing with FlowRead token values.
- Align close button and utility controls with popup button styles.
- Add reduced-motion behavior and keyboard hints.
- Ensure all controls and indicators have accessible names.

## 13.5 live.js
- Rename user-facing references to experimental mode.
- Add first-run acknowledgement gate.
- Align overlay UI controls with token styling and accessibility.

## 13.6 background.js
- Extend state handling for onboarding flags and activePreset.
- Add migration function for old setting states.
- Ensure robust message error responses for popup inline messaging.

## 13.7 manifest.json
- Verify required resources remain exposed.
- Keep permissions minimal.
- No change expected unless onboarding introduces new assets.

## 13.8 Optional New Files
- popup.css: canonical popup design system + layout
- overlay.css: injected token styles for content surfaces
- presets.js: preset definitions and apply/merge helpers

## 14. Engineering Sequence (4 Sprints)

### Sprint 1: Foundation
- Introduce tokens and shared component styles
- Rebuild popup Home view skeleton
- Add state machine and migration support

Exit criteria:
- No inline hardcoded styles in popup
- Home flow works with power + presets

### Sprint 2: Advanced Controls
- Build advanced settings view
- Wire full control set and conditional rows
- Add ARIA and keyboard hardening

Exit criteria:
- All controls reachable and operable via keyboard
- Settings persist and rehydrate correctly

### Sprint 3: In-Page Experience
- Tokenize overlay/focus surfaces
- Improve dynamic apply performance
- Add aria-live and mode consistency

Exit criteria:
- Overlay and focus mode match design language
- No blocking focus traps or inaccessible controls

### Sprint 4: Onboarding and Polish
- Implement onboarding flow and first-run flags
- Add experimental mode acknowledgement
- UX QA pass and accessibility audit

Exit criteria:
- First-run journey complete
- Accessibility checklist passes

## 15. QA and Validation Checklist

Functional:
- Toggle enable/disable works on major article pages
- Presets apply and persist
- Advanced controls update page behavior correctly

Accessibility:
- Keyboard-only flow from popup open to apply preset
- Screen reader announces state changes
- Focus rings visible on all controls

Performance:
- Popup interactions feel immediate (< 100ms local update)
- Setting changes avoid excessive full-page reflow

Compatibility:
- Test on common sites: Wikipedia, Medium-like blogs, news pages, docs pages

## 16. Risks and Mitigation

- Risk: Existing content transformations cause layout instability.
  - Mitigation: stage updates by feature and add smoke tests.

- Risk: Live/experimental mode confuses users.
  - Mitigation: demote in IA, add explicit labeling and acknowledgement.

- Risk: Accessibility regressions from custom controls.
  - Mitigation: enforce ARIA and keyboard test cases in each sprint.

## 17. Definition of Done

Redesign is complete when:
- Core reading flow is completed in <= 15 seconds by new users.
- Popup and in-page surfaces use shared tokens and component patterns.
- Advanced tools are discoverable but do not crowd primary flow.
- Accessibility requirements are verified and documented.
- Experimental mode is clearly labeled and safely separated.

## 18. Immediate Next Actions

1. Create popup.css and migrate popup.html away from inline/ad-hoc styles.
2. Implement Home view with power toggle + presets + quick tune rows.
3. Add preset model and activePreset persistence in popup.js/background.js.
4. Add Advanced view scaffold and move mode launch controls there.
5. Add onboarding flags and first-run flow.
