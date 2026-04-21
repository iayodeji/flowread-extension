// FlowRead popup script

const DEFAULT_SETTINGS = {
  enabled: false,
  font: 'lexend',
  fontSize: 17,
  lineHeight: 1.8,
  letterSpacing: 0.05,
  wordSpacing: 0.1,
  bgColor: 'cream',
  ruler: true,
  rulerColor: '#ffd700',
  rulerOpacity: 0.25,
  autopace: false,
  autopaceWPM: 180,
  focusMode: false,
  bionic: false,
  columnWidth: false,
  columnWidthPx: 680,
  activePreset: 'gentle',
  onboardingCompleted: false,
  lastSurface: 'home',
  experimentalAcknowledged: false,
};

const PRESETS = {
  gentle: {
    font: 'lexend',
    fontSize: 17,
    lineHeight: 1.8,
    letterSpacing: 0.05,
    bgColor: 'cream',
    ruler: true,
    focusMode: false,
    bionic: false,
    autopace: false,
  },
  focus: {
    font: 'lexend',
    fontSize: 18,
    lineHeight: 1.9,
    letterSpacing: 0.06,
    bgColor: 'sepia',
    ruler: true,
    focusMode: true,
    bionic: false,
    autopace: false,
  },
  contrast: {
    font: 'atkinson',
    fontSize: 18,
    lineHeight: 1.8,
    letterSpacing: 0.04,
    bgColor: 'dark',
    ruler: true,
    focusMode: false,
    bionic: false,
    autopace: false,
  },
};

let state = {
  enabled: false,
  view: 'home',
  onboardingStep: 0,
  onboardingDraft: {
    goal: 'gentle',
    font: 'lexend',
  },
  settings: { ...DEFAULT_SETTINGS },
};

function showError(message) {
  const banner = document.getElementById('error-banner');
  if (!banner) return;
  banner.hidden = !message;
  if (message) banner.textContent = `⚠ ${message}`;
}

async function boot() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.runtime.sendMessage({ type: 'GET_STATE', tabId: tab?.id }, (res) => {
    if (chrome.runtime.lastError) {
      showError('Could not connect to background service.');
      return;
    }
    if (res) {
      state.enabled = Boolean(res.enabled);
      state.settings = { ...DEFAULT_SETTINGS, ...res.settings };
      state.onboardingDraft.goal = PRESETS[state.settings.activePreset] ? state.settings.activePreset : 'gentle';
      state.onboardingDraft.font = state.settings.font || 'lexend';
      state.view = state.settings.onboardingCompleted
        ? (state.settings.lastSurface === 'advanced' ? 'advanced' : 'home')
        : 'onboarding';
    }
    renderAll();
  });
}

function setSwitchState(id, active) {
  const el = document.getElementById(id);
  if (!el) return;
  el.setAttribute('aria-checked', String(Boolean(active)));
  const controlsId = el.getAttribute('aria-controls');
  if (controlsId) {
    el.setAttribute('aria-expanded', String(Boolean(active)));
  }
}

function setPillState(selector, activeValue, keyName) {
  document.querySelectorAll(selector).forEach((el) => {
    const isActive = el.dataset[keyName] === activeValue;
    el.classList.toggle('is-active', isActive);
    el.setAttribute('aria-pressed', String(isActive));
  });
}

function setSlider(id, value, formatter) {
  const input = document.getElementById(id);
  const label = document.getElementById(`${id}-val`);
  if (input) {
    input.value = value;
    input.setAttribute('aria-valuenow', String(value));
  }
  if (label) label.textContent = formatter(value);
}

function renderView() {
  const isOnboarding = state.view === 'onboarding';
  const isAdvanced = state.view === 'advanced';
  const onboarding = document.getElementById('onboarding-view');
  const home = document.getElementById('home-view');
  const advanced = document.getElementById('advanced-view');
  const footer = document.getElementById('popup-footer');
  const viewToggleBtn = document.getElementById('view-toggle-btn');

  onboarding.classList.toggle('is-active', isOnboarding);
  home.classList.toggle('is-active', !isAdvanced);
  advanced.classList.toggle('is-active', isAdvanced);
  onboarding.hidden = !isOnboarding;
  home.hidden = isAdvanced;
  advanced.hidden = !isAdvanced;
  footer.hidden = isOnboarding;
  viewToggleBtn.textContent = isAdvanced ? 'Back to home' : 'Advanced settings';
}

function renderOnboarding() {
  const step = state.onboardingStep;
  document.querySelectorAll('[id^="onboarding-step-"]').forEach((panel, idx) => {
    panel.hidden = idx !== step;
  });

  document.querySelectorAll('.fr-onboarding-step').forEach((dot, idx) => {
    const active = idx === step;
    dot.classList.toggle('is-active', active);
    dot.setAttribute('aria-selected', String(active));
  });

  document.querySelectorAll('[data-onboard-goal]').forEach((btn) => {
    const active = btn.dataset.onboardGoal === state.onboardingDraft.goal;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });

  document.querySelectorAll('[data-onboard-font]').forEach((btn) => {
    const active = btn.dataset.onboardFont === state.onboardingDraft.font;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });

  const next = document.getElementById('onboarding-next-btn');
  const back = document.getElementById('onboarding-back-btn');
  const preview = document.getElementById('onboarding-preview');
  back.disabled = step === 0;
  next.textContent = step === 2 ? 'Apply and start' : 'Next';
  preview.textContent = `Preset: ${labelForPreset(state.onboardingDraft.goal)}, Font: ${labelForFont(state.onboardingDraft.font)}`;
}

function labelForPreset(preset) {
  if (preset === 'focus') return 'Focus';
  if (preset === 'contrast') return 'High Contrast';
  return 'Gentle';
}

function labelForFont(font) {
  if (font === 'opendyslexic') return 'OpenDyslexic';
  if (font === 'atkinson') return 'Atkinson';
  return 'Lexend';
}

function completeOnboarding(skip = false) {
  const chosenPreset = PRESETS[state.onboardingDraft.goal] ? state.onboardingDraft.goal : 'gentle';
  const patch = skip
    ? { onboardingCompleted: true, lastSurface: 'home' }
    : {
        ...PRESETS[chosenPreset],
        font: state.onboardingDraft.font,
        activePreset: chosenPreset,
        onboardingCompleted: true,
        lastSurface: 'home',
      };

  updateSettings(patch);
  if (!skip && !state.enabled) togglePower(true);
  state.view = 'home';
  state.onboardingStep = 0;
  renderAll();
}

function renderAll() {
  const s = state.settings;

  setSwitchState('power-toggle', state.enabled);
  document.getElementById('status-chip').textContent = state.enabled ? 'Enabled' : 'Disabled';
  document.getElementById('off-note').hidden = state.enabled;

  const preset = PRESETS[s.activePreset] ? s.activePreset : 'gentle';
  setPillState('[data-preset]', preset, 'preset');

  setPillState('[data-bg]', s.bgColor, 'bg');
  setPillState('[data-font]', s.font, 'font');

  setSlider('font-size', s.fontSize, (v) => `${v}px`);
  setSlider('line-height', s.lineHeight, (v) => Number(v).toFixed(1));
  setSlider('letter-spacing', s.letterSpacing, (v) => `${Number(v).toFixed(2)}em`);
  setSlider('word-spacing', s.wordSpacing, (v) => `${Number(v).toFixed(2)}em`);
  setSlider('column-width', s.columnWidthPx, (v) => `${v}px`);
  setSlider('wpm', s.autopaceWPM, (v) => `${v}`);
  setSlider('ruler-opacity', s.rulerOpacity, (v) => Number(v).toFixed(2));

  const rulerColor = document.getElementById('ruler-color');
  const rulerColorVal = document.getElementById('ruler-color-val');
  if (rulerColor) rulerColor.value = s.rulerColor;
  if (rulerColorVal) rulerColorVal.textContent = String(s.rulerColor).toUpperCase();

  setSwitchState('toggle-ruler', s.ruler);
  setSwitchState('toggle-ruler-advanced', s.ruler);
  setSwitchState('toggle-focus', s.focusMode);
  setSwitchState('toggle-bionic', s.bionic);
  setSwitchState('toggle-autopace', s.autopace);
  setSwitchState('toggle-column', s.columnWidth);

  document.getElementById('wpm-row').hidden = !s.autopace;
  document.getElementById('column-width-row').hidden = !s.columnWidth;
  document.getElementById('ruler-controls').hidden = !s.ruler;
  renderView();
  renderOnboarding();
}

function updateSettings(delta) {
  state.settings = { ...state.settings, ...delta };
  chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', patch: delta }, () => {
    if (chrome.runtime.lastError) {
      showError('Could not save settings.');
      return;
    }
    showError('');
  });
}

function togglePower(enable) {
  state.enabled = enable;
  chrome.runtime.sendMessage({ type: 'TOGGLE_FROM_POPUP', enable }, () => {
    if (chrome.runtime.lastError) {
      showError('Could not update the active tab.');
      return;
    }
    showError('');
    renderAll();
  });
}

function wirePresetButtons() {
  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      if (!PRESETS[preset]) return;
      updateSettings({ ...PRESETS[preset], activePreset: preset });
      if (!state.enabled) togglePower(true);
      renderAll();
    });
  });
}

function wireThemeButtons() {
  document.querySelectorAll('[data-bg]').forEach((btn) => {
    btn.addEventListener('click', () => {
      updateSettings({ bgColor: btn.dataset.bg, activePreset: 'custom' });
      renderAll();
    });
  });
}

function wireFontButtons() {
  document.querySelectorAll('[data-font]').forEach((btn) => {
    btn.addEventListener('click', () => {
      updateSettings({ font: btn.dataset.font, activePreset: 'custom' });
      renderAll();
    });
  });
}

function wireSlider(id, key, parse, format) {
  const input = document.getElementById(id);
  const label = document.getElementById(`${id}-val`);
  if (!input) return;
  input.addEventListener('input', () => {
    const value = parse(input.value);
    if (label) label.textContent = format(value);
    input.setAttribute('aria-valuenow', String(value));
    updateSettings({ [key]: value, activePreset: 'custom' });
  });
}

function wireSwitch(id, key) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', () => {
    const next = !state.settings[key];
    updateSettings({ [key]: next, activePreset: 'custom' });
    if (key === 'autopace') {
      document.getElementById('wpm-row').hidden = !next;
    }
    renderAll();
  });
}

function wireViewToggle() {
  document.getElementById('view-toggle-btn').addEventListener('click', () => {
    state.view = state.view === 'home' ? 'advanced' : 'home';
    updateSettings({ lastSurface: state.view });
    renderView();
  });
}

function wireOnboarding() {
  document.querySelectorAll('[data-onboard-goal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.onboardingDraft.goal = btn.dataset.onboardGoal;
      renderOnboarding();
    });
  });

  document.querySelectorAll('[data-onboard-font]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.onboardingDraft.font = btn.dataset.onboardFont;
      renderOnboarding();
    });
  });

  document.querySelectorAll('.fr-onboarding-step').forEach((dot) => {
    dot.addEventListener('click', () => {
      state.onboardingStep = Number(dot.dataset.step) || 0;
      renderOnboarding();
    });
  });

  document.getElementById('onboarding-back-btn')?.addEventListener('click', () => {
    state.onboardingStep = Math.max(0, state.onboardingStep - 1);
    renderOnboarding();
  });

  document.getElementById('onboarding-next-btn')?.addEventListener('click', () => {
    if (state.onboardingStep < 2) {
      state.onboardingStep += 1;
      renderOnboarding();
      return;
    }
    completeOnboarding(false);
  });

  document.getElementById('onboarding-skip-btn')?.addEventListener('click', () => {
    completeOnboarding(true);
  });
}

function wireAccessibleToggleButton(id) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    btn.click();
  });
}

document.getElementById('power-toggle').addEventListener('click', () => {
  togglePower(!state.enabled);
});

wireAccessibleToggleButton('power-toggle');
wireAccessibleToggleButton('toggle-ruler');
wireAccessibleToggleButton('toggle-ruler-advanced');
wireAccessibleToggleButton('toggle-focus');
wireAccessibleToggleButton('toggle-bionic');
wireAccessibleToggleButton('toggle-autopace');
wireAccessibleToggleButton('toggle-column');

wirePresetButtons();
wireThemeButtons();
wireFontButtons();
wireOnboarding();
wireSlider('font-size', 'fontSize', (v) => parseInt(v, 10), (v) => `${v}px`);
wireSlider('line-height', 'lineHeight', (v) => parseFloat(v), (v) => Number(v).toFixed(1));
wireSlider('letter-spacing', 'letterSpacing', (v) => parseFloat(v), (v) => `${Number(v).toFixed(2)}em`);
wireSlider('word-spacing', 'wordSpacing', (v) => parseFloat(v), (v) => `${Number(v).toFixed(2)}em`);
wireSlider('column-width', 'columnWidthPx', (v) => parseInt(v, 10), (v) => `${v}px`);
wireSlider('wpm', 'autopaceWPM', (v) => parseInt(v, 10), (v) => `${v}`);
wireSlider('ruler-opacity', 'rulerOpacity', (v) => parseFloat(v), (v) => Number(v).toFixed(2));

document.getElementById('ruler-color')?.addEventListener('input', (event) => {
  const value = event.target.value;
  const label = document.getElementById('ruler-color-val');
  if (label) label.textContent = String(value).toUpperCase();
  updateSettings({ rulerColor: value, activePreset: 'custom' });
});

wireSwitch('toggle-ruler', 'ruler');
wireSwitch('toggle-ruler-advanced', 'ruler');
wireSwitch('toggle-focus', 'focusMode');
wireSwitch('toggle-bionic', 'bionic');
wireSwitch('toggle-autopace', 'autopace');
wireSwitch('toggle-column', 'columnWidth');
wireViewToggle();

document.getElementById('reset-btn').addEventListener('click', () => {
  state.settings = { ...DEFAULT_SETTINGS };
  updateSettings({ ...DEFAULT_SETTINGS });
  renderAll();
});

async function injectMode(file, btnId) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (file === 'live.js' && !state.settings.experimentalAcknowledged) {
    const acknowledged = window.confirm('Experimental mode may reduce readability on complex pages. Continue?');
    if (!acknowledged) return;
    updateSettings({ experimentalAcknowledged: true });
  }

  const btn = document.getElementById(btnId);
  btn.disabled = true;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [file] });
    window.close();
  } catch (_) {
    showError('This mode is not available on the current page.');
    btn.disabled = false;
  }
}

document.getElementById('focused-btn')?.addEventListener('click', () => injectMode('focused.js', 'focused-btn'));
document.getElementById('live-btn')?.addEventListener('click', () => injectMode('live.js', 'live-btn'));

boot();
