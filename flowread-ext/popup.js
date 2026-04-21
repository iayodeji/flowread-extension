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
      state.view = state.settings.lastSurface === 'advanced' ? 'advanced' : 'home';
    }
    renderAll();
  });
}

function setSwitchState(id, active) {
  const el = document.getElementById(id);
  if (!el) return;
  el.setAttribute('aria-checked', String(Boolean(active)));
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
  const isAdvanced = state.view === 'advanced';
  const home = document.getElementById('home-view');
  const advanced = document.getElementById('advanced-view');
  const viewToggleBtn = document.getElementById('view-toggle-btn');

  home.classList.toggle('is-active', !isAdvanced);
  advanced.classList.toggle('is-active', isAdvanced);
  home.hidden = isAdvanced;
  advanced.hidden = !isAdvanced;
  viewToggleBtn.textContent = isAdvanced ? 'Back to home' : 'Advanced settings';
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
  setSlider('wpm', s.autopaceWPM, (v) => `${v}`);

  setSwitchState('toggle-ruler', s.ruler);
  setSwitchState('toggle-focus', s.focusMode);
  setSwitchState('toggle-bionic', s.bionic);
  setSwitchState('toggle-autopace', s.autopace);

  document.getElementById('wpm-row').hidden = !s.autopace;
  renderView();
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

function markCustomPreset() {
  if (state.settings.activePreset !== 'custom') {
    updateSettings({ activePreset: 'custom' });
  }
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

document.getElementById('power-toggle').addEventListener('click', () => {
  togglePower(!state.enabled);
});

wirePresetButtons();
wireThemeButtons();
wireFontButtons();
wireSlider('font-size', 'fontSize', (v) => parseInt(v, 10), (v) => `${v}px`);
wireSlider('line-height', 'lineHeight', (v) => parseFloat(v), (v) => Number(v).toFixed(1));
wireSlider('letter-spacing', 'letterSpacing', (v) => parseFloat(v), (v) => `${Number(v).toFixed(2)}em`);
wireSlider('wpm', 'autopaceWPM', (v) => parseInt(v, 10), (v) => `${v}`);
wireSwitch('toggle-ruler', 'ruler');
wireSwitch('toggle-focus', 'focusMode');
wireSwitch('toggle-bionic', 'bionic');
wireSwitch('toggle-autopace', 'autopace');
wireViewToggle();

document.getElementById('reset-btn').addEventListener('click', () => {
  state.settings = { ...DEFAULT_SETTINGS };
  updateSettings({ ...DEFAULT_SETTINGS });
  renderAll();
});

async function injectMode(file, btnId) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
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
