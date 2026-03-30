/**
 * Claude Usage Tracker v2 — Content Script
 *
 * Extracts structured usage data from claude.ai/settings/usage.
 * Works in two modes:
 *   - Manual: user visits the page normally
 *   - Auto:   background opens a tab, we extract and signal "done"
 *
 * CUSTOMIZATION:
 *   The page DOM is not documented. Open DevTools (F12 → Elements) on the
 *   usage page and adjust selectors in extractUsageData() as needed.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'claude_usage_history';
  const MAX_HISTORY = 1500; // ~15 days at 15min intervals

  // ─── Wait for SPA to finish rendering ─────────────────────────────
  function waitForStableDOM(timeout = 20000) {
    return new Promise((resolve) => {
      let timer = null;
      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          observer.disconnect();
          resolve();
        }, 2000); // 2s of no DOM changes = stable
      });
      observer.observe(document.body, { childList: true, subtree: true });
      // Fallback timeout
      setTimeout(() => { observer.disconnect(); resolve(); }, timeout);
      // Also start the initial timer
      timer = setTimeout(() => { observer.disconnect(); resolve(); }, 5000);
    });
  }

  // ─── Extract structured data ──────────────────────────────────────
  function extractUsageData() {
    const snapshot = {
      version: 2,
      timestamp: new Date().toISOString(),
      plan: null,
      reset_info: null,
      models: [],
      quotas: [],        // { label, used, total, unit, pct }
      progress_bars: [],  // { label, value }
      percentages: [],    // { value, context }
      raw_sections: [],   // text blocks for debugging
    };

    const main = document.querySelector('main')
      || document.querySelector('[class*="usage"]')
      || document.querySelector('[class*="settings"]')
      || document.body;
    const text = main?.innerText || '';

    // ── Plan ──
    const planMatch = text.match(/(Free|Pro|Max|Team|Enterprise)\s*(Plan|plan|用户)?/i);
    if (planMatch) snapshot.plan = planMatch[0].trim();

    // ── Reset / renewal ──
    const resetPatterns = [
      /(reset|renew|refresh|resets?\s+in|重置|刷新)[^\n]{0,80}/i,
      /(\d+\s*(hours?|minutes?|days?|小时|分钟|天)\s*(left|remaining|后))/i,
    ];
    for (const pat of resetPatterns) {
      const m = text.match(pat);
      if (m) { snapshot.reset_info = m[0].trim(); break; }
    }

    // ── Models ──
    const modelSet = new Set();
    const modelRe = /claude[\s-]*(opus|sonnet|haiku)[\s\d.]*/gi;
    let mm;
    while ((mm = modelRe.exec(text)) !== null) modelSet.add(mm[0].trim());
    // Also standalone
    for (const name of ['Opus', 'Sonnet', 'Haiku']) {
      if (text.includes(name)) modelSet.add(name);
    }
    snapshot.models = [...modelSet];

    // ── Progress bars (aria) ──
    document.querySelectorAll('[role="progressbar"]').forEach(el => {
      const value = parseFloat(el.getAttribute('aria-valuenow'));
      const max = parseFloat(el.getAttribute('aria-valuemax')) || 100;
      const label = el.getAttribute('aria-label')
        || el.closest('[class]')?.previousElementSibling?.textContent?.trim()
        || '';
      if (!isNaN(value)) {
        snapshot.progress_bars.push({ label, value: Math.round((value / max) * 100) });
      }
    });

    // ── Progress bars (style width) ──
    if (snapshot.progress_bars.length === 0) {
      document.querySelectorAll('[style*="width"]').forEach(el => {
        const style = el.getAttribute('style') || '';
        const wm = style.match(/width:\s*([\d.]+)%/);
        if (wm && el.offsetHeight > 2 && el.offsetHeight < 30) {
          const label = el.closest('div')?.previousElementSibling?.textContent?.trim() || '';
          snapshot.progress_bars.push({ label, value: parseFloat(wm[1]) });
        }
      });
    }

    // ── "X of Y" quotas ──
    const ofRe = /(\d+)\s*(of|\/|out of)\s*(\d+)\s*(messages?|requests?|tokens?|queries?|次|条)?/gi;
    let om;
    while ((om = ofRe.exec(text)) !== null) {
      const used = parseInt(om[1]);
      const total = parseInt(om[3]);
      if (total > 0) {
        snapshot.quotas.push({
          label: om[0].trim(),
          used,
          total,
          unit: om[4] || '',
          pct: Math.round((used / total) * 100),
        });
      }
    }

    // ── Percentages ──
    const pctRe = /(\d+(?:\.\d+)?)\s*%\s*(used|remaining|left|已用|剩余)?/gi;
    let pm;
    while ((pm = pctRe.exec(text)) !== null) {
      snapshot.percentages.push({ value: parseFloat(pm[1]), context: pm[0].trim() });
    }

    // ── Raw text sections (for analysis & debugging) ──
    // Split by likely section boundaries and keep meaningful blocks
    const blocks = text.split(/\n{2,}/).map(b => b.trim()).filter(b => b.length > 5);
    snapshot.raw_sections = blocks.slice(0, 20);

    return snapshot;
  }

  // ─── Save snapshot ────────────────────────────────────────────────
  async function saveSnapshot(snapshot) {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const history = result[STORAGE_KEY] || [];

    // Dedupe: skip if last snapshot is < 5 min old and identical raw_sections
    const last = history[history.length - 1];
    if (last) {
      const gap = Date.now() - new Date(last.timestamp).getTime();
      if (gap < 5 * 60 * 1000) {
        console.log('[Claude Usage Tracker] Skipped duplicate snapshot (< 5 min)');
        return false;
      }
    }

    history.push(snapshot);
    while (history.length > MAX_HISTORY) history.shift();
    await chrome.storage.local.set({ [STORAGE_KEY]: history });
    console.log('[Claude Usage Tracker] Snapshot saved:', snapshot.timestamp);
    return true;
  }

  // ─── Toast badge ──────────────────────────────────────────────────
  function showBadge(text = chrome.i18n.getMessage('toastCaptured') || '✓ Usage captured') {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `
      position:fixed;bottom:20px;right:20px;z-index:99999;
      background:#1a1a2e;color:#e0e0e0;padding:10px 16px;
      border-radius:8px;font-size:13px;font-family:system-ui;
      box-shadow:0 4px 20px rgba(0,0,0,.3);border:1px solid #333;
      transition:opacity .5s;opacity:1;
    `;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 600); }, 2500);
  }

  // ─── Listen for background auto-capture request ───────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'CAPTURE_NOW') {
      (async () => {
        await waitForStableDOM();
        const snapshot = extractUsageData();
        const saved = await saveSnapshot(snapshot);
        sendResponse({ ok: true, saved, snapshot });
      })();
      return true; // async response
    }
  });

  // ─── Auto-run on page load ────────────────────────────────────────
  async function main() {
    console.log('[Claude Usage Tracker] Content script loaded');
    await waitForStableDOM();
    const snapshot = extractUsageData();

    if (snapshot.raw_sections.length > 0) {
      const saved = await saveSnapshot(snapshot);
      if (saved) showBadge();
      // Notify background
      chrome.runtime.sendMessage({ type: 'SNAPSHOT_SAVED', snapshot }).catch(() => {});
    } else {
      console.warn('[Claude Usage Tracker] No content extracted');
    }
  }

  main();
})();
