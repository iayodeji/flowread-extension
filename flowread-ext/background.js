// FlowRead background service worker (Manifest V3, no module type needed)

const DEFAULT_SETTINGS = {
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

// In-memory tab state (enabled/disabled per tab)
const tabStates = new Map();

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get('settings', (res) => {
    const merged = { ...DEFAULT_SETTINGS, ...(res.settings || {}) };
    chrome.storage.sync.set({ settings: merged });
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
});

// Reset state when tab navigates to new page
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    tabStates.delete(tabId);
    chrome.action.setBadgeText({ text: '', tabId });
  }
});

async function injectAndToggle(tabId, url, enable) {
  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  } catch (_) {
    // Already injected or restricted page — fine
  }

  const { settings } = await chrome.storage.sync.get('settings');
  try {
    chrome.tabs.sendMessage(tabId, {
      type: 'FLOWREAD_TOGGLE',
      enable,
      settings: settings || DEFAULT_SETTINGS,
    });
  } catch (_) {}
}

// Message handler from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === 'GET_STATE') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      chrome.storage.sync.get('settings', ({ settings }) => {
        sendResponse({
          enabled: tabId ? (tabStates.get(tabId) ?? false) : false,
          settings: { ...DEFAULT_SETTINGS, ...(settings || {}) },
        });
      });
    });
    return true;
  }

  if (msg.type === 'TOGGLE_FROM_POPUP') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) { sendResponse({ ok: false }); return; }
      const enable = msg.enable;
      tabStates.set(tab.id, enable);
      await injectAndToggle(tab.id, tab.url, enable);
      chrome.action.setBadgeText({ text: enable ? 'ON' : '', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId: tab.id });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'UPDATE_SETTINGS') {
    chrome.storage.sync.get('settings', ({ settings }) => {
      const next = Object.assign({}, DEFAULT_SETTINGS, settings || {}, msg.patch);
      chrome.storage.sync.set({ settings: next }, () => {
        // Push live update to all active FlowRead tabs
        chrome.tabs.query({}, (tabs) => {
          for (const tab of tabs) {
            if (tab.id && tabStates.get(tab.id)) {
              try {
                chrome.tabs.sendMessage(tab.id, {
                  type: 'FLOWREAD_SETTINGS',
                  settings: next,
                });
              } catch (_) {}
            }
          }
        });
        sendResponse({ ok: true });
      });
    });
    return true;
  }
});
