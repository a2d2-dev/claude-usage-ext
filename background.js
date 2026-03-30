/**
 * Claude Usage Tracker v2 — Background Service Worker
 *
 * Periodically opens claude.ai/settings/usage in a background tab,
 * waits for the content script to extract data, then closes the tab.
 */

const STORAGE_KEY = 'claude_usage_history';
const SETTINGS_KEY = 'claude_usage_settings';
const USAGE_URL = 'https://claude.ai/settings/usage';

const DEFAULT_SETTINGS = {
  autoCapture: true,
  captureIntervalMinutes: 15,
  notificationsEnabled: false,
};

// ─── Install / update ───────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  setupAlarm(settings);
  chrome.action.setBadgeBackgroundColor({ color: '#c4704b' });
});

// ─── Alarm setup ────────────────────────────────────────────────────
function setupAlarm(settings) {
  chrome.alarms.clear('auto-capture');
  if (settings.autoCapture) {
    chrome.alarms.create('auto-capture', {
      periodInMinutes: settings.captureIntervalMinutes || 15,
    });
    console.log(`[BG] Alarm set: every ${settings.captureIntervalMinutes}min`);
  }
}

// ─── Handle alarm → open background tab → capture → close ──────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'auto-capture') return;

  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = result[SETTINGS_KEY] || DEFAULT_SETTINGS;
  if (!settings.autoCapture) return;

  console.log('[BG] Auto-capture triggered');
  await performCapture(settings);
});

async function performCapture(settings) {
  let tab;
  try {
    // Open usage page in a background tab (not active)
    tab = await chrome.tabs.create({ url: USAGE_URL, active: false });

    // Wait for page to load
    await waitForTabLoad(tab.id, 30000);

    // Give content script extra time for SPA rendering
    await sleep(6000);

    // Ask content script to capture
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_NOW' });
    console.log('[BG] Capture result:', response);

    // Update badge
    if (response?.saved) {
      chrome.action.setBadgeText({ text: '✓' });
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 10000);

      if (settings.notificationsEnabled) {
        chrome.notifications.create('capture-done-' + Date.now(), {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'Claude Usage Captured',
          message: `Snapshot saved at ${new Date().toLocaleTimeString()}`,
        });
      }
    }
  } catch (err) {
    console.error('[BG] Auto-capture failed:', err);
  } finally {
    // Always close the background tab
    if (tab?.id) {
      try { await chrome.tabs.remove(tab.id); } catch (_) {}
    }
  }
}

function waitForTabLoad(tabId, timeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Tab load timeout'));
    }, timeout);

    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Messages from popup / content script ───────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'UPDATE_SETTINGS') {
    chrome.storage.local.set({ [SETTINGS_KEY]: msg.settings });
    setupAlarm(msg.settings);
    sendResponse({ ok: true });
  }

  if (msg.type === 'MANUAL_CAPTURE') {
    (async () => {
      const result = await chrome.storage.local.get(SETTINGS_KEY);
      const settings = result[SETTINGS_KEY] || DEFAULT_SETTINGS;
      await performCapture(settings);
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === 'SNAPSHOT_SAVED') {
    // Content script notifies us after saving
    chrome.action.setBadgeText({ text: '✓' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 8000);
  }
});
