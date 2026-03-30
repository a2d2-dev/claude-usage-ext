/**
 * Claude Usage Tracker v2 — Popup
 */

const STORAGE_KEY = 'claude_usage_history';
const SETTINGS_KEY = 'claude_usage_settings';
const USAGE_URL = 'https://claude.ai/settings/usage';

// ─── i18n helpers ───────────────────────────────────────────────────

/**
 * Get a localized message string, with optional substitutions.
 * @param {string} key - Message key defined in _locales/{locale}/messages.json
 * @param {string|string[]} [subs] - Substitution value(s)
 * @returns {string}
 */
function t(key, subs) {
  return chrome.i18n.getMessage(key, subs) || key;
}

/**
 * Apply i18n to all elements with data-i18n / data-i18n-title attributes.
 * Called once on load; dynamic content is handled inline via t().
 */
function initI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const msg = t(el.dataset.i18n);
    if (msg) el.textContent = msg;
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const msg = t(el.dataset.i18nTitle);
    if (msg) el.title = msg;
  });
  document.querySelectorAll('option[data-i18n]').forEach(el => {
    const msg = t(el.dataset.i18n);
    if (msg) el.textContent = msg;
  });
}

// ─── Tabs ───────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('on'));
    tab.classList.add('on');
    document.getElementById('p-' + tab.dataset.t).classList.add('on');
  });
});

// ─── Navigation ─────────────────────────────────────────────────────
const openUsage = () => chrome.tabs.create({ url: USAGE_URL });
document.getElementById('btn-open').addEventListener('click', openUsage);
document.getElementById('btn-goto').addEventListener('click', openUsage);

document.getElementById('btn-capture').addEventListener('click', () => {
  document.getElementById('btn-capture').textContent = '…';
  chrome.runtime.sendMessage({ type: 'MANUAL_CAPTURE' }, () => {
    setTimeout(() => {
      document.getElementById('btn-capture').textContent = '⟳';
      init();
    }, 10000);
  });
});

// ─── Helpers ────────────────────────────────────────────────────────
const esc = s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };

/**
 * Return a localized "time ago" string for the given ISO timestamp.
 * @param {string} ts - ISO timestamp string
 * @returns {string}
 */
function timeAgo(ts) {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 1) return t('timeJustNow');
  if (m < 60) return t('timeMinAgo', String(m));
  const h = Math.floor(m / 60);
  if (h < 24) return t('timeHourAgo', String(h));
  return t('timeDayAgo', String(Math.floor(h / 24)));
}

/**
 * Format a timestamp for display using the browser's locale.
 * @param {string} ts - ISO timestamp string
 * @returns {string}
 */
function fmtTime(ts) {
  return new Date(ts).toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Return the CSS class name for a model name string.
 * @param {string} text
 * @returns {string}
 */
function modelColor(text) {
  const l = (text || '').toLowerCase();
  if (l.includes('opus')) return 'opus';
  if (l.includes('sonnet')) return 'sonnet';
  if (l.includes('haiku')) return 'haiku';
  return 'default';
}

// ─── Render: Latest ─────────────────────────────────────────────────
function renderLatest(data) {
  const ct = document.getElementById('now-content');
  if (!data) { document.getElementById('empty-state').style.display = 'block'; return; }
  document.getElementById('empty-state').style.display = 'none';

  let h = '';

  // Plan
  if (data.plan) {
    h += `<div class="sec"><div class="sec-t">${t('sectionPlanLabel')}</div>
      <div style="font-size:15px;font-weight:700">${esc(data.plan)}</div>
      ${data.reset_info ? `<div style="font-size:11px;color:var(--text-3);margin-top:3px">${esc(data.reset_info)}</div>` : ''}
    </div>`;
  }

  // Quotas
  if (data.quotas?.length) {
    h += `<div class="sec"><div class="sec-t">${t('sectionQuotas')}</div>`;
    data.quotas.forEach(q => {
      const c = q.pct > 80 ? 'danger' : 'default';
      h += `<div class="card"><div class="card-row">
        <span class="card-label">${esc(q.label)}</span>
        <span class="card-val">${q.pct}%</span>
      </div><div class="bar-bg"><div class="bar-fg ${c}" style="width:${q.pct}%"></div></div></div>`;
    });
    h += `</div>`;
  }

  // Progress bars
  if (data.progress_bars?.length) {
    h += `<div class="sec"><div class="sec-t">${t('sectionProgress')}</div>`;
    data.progress_bars.forEach(b => {
      const c = b.value > 80 ? 'danger' : modelColor(b.label);
      h += `<div class="card"><div class="card-row">
        <span class="card-label">${esc(b.label || t('defaultUsageLabel'))}</span>
        <span class="card-val">${b.value}%</span>
      </div><div class="bar-bg"><div class="bar-fg ${c}" style="width:${Math.min(b.value, 100)}%"></div></div></div>`;
    });
    h += `</div>`;
  }

  // Raw preview
  if (data.raw_sections?.length) {
    const preview = data.raw_sections.join('\n\n').substring(0, 600);
    h += `<div class="sec"><div class="sec-t">${t('sectionRawContent')}</div>
      <div class="raw">${esc(preview)}</div></div>`;
  }

  ct.innerHTML = h;
}

// ─── Render: Trend chart (pure canvas, no deps) ─────────────────────
function renderTrend(history) {
  const canvas = document.getElementById('chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth;
  const H = 140;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  // Collect data points: timestamp + max quota pct
  const points = [];
  history.forEach(snap => {
    let pct = null;
    if (snap.quotas?.length) {
      pct = Math.max(...snap.quotas.map(q => q.pct));
    } else if (snap.progress_bars?.length) {
      pct = Math.max(...snap.progress_bars.map(b => b.value));
    } else if (snap.percentages?.length) {
      pct = Math.max(...snap.percentages.map(p => p.value));
    }
    if (pct !== null) {
      points.push({ t: new Date(snap.timestamp).getTime(), v: pct });
    }
  });

  const pad = { t: 18, r: 10, b: 24, l: 36 };
  const cw = W - pad.l - pad.r;
  const ch = H - pad.t - pad.b;

  ctx.fillStyle = '#131322';
  ctx.fillRect(0, 0, W, H);

  if (points.length < 2) {
    ctx.fillStyle = '#606080';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(t('needMoreSnapshots'), W / 2, H / 2);
    return;
  }

  const minT = points[0].t;
  const maxT = points[points.length - 1].t;
  const rangeT = maxT - minT || 1;

  const x = p => pad.l + ((p.t - minT) / rangeT) * cw;
  const y = p => pad.t + ch - (p.v / 100) * ch;

  // Grid lines
  ctx.strokeStyle = '#2e2e50';
  ctx.lineWidth = 0.5;
  for (let pct = 0; pct <= 100; pct += 25) {
    const yy = pad.t + ch - (pct / 100) * ch;
    ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(W - pad.r, yy); ctx.stroke();
    ctx.fillStyle = '#606080';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(pct + '%', pad.l - 4, yy + 3);
  }

  // X axis labels
  ctx.fillStyle = '#606080';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(fmtTime(new Date(minT).toISOString()), pad.l, H - 4);
  ctx.fillText(fmtTime(new Date(maxT).toISOString()), W - pad.r, H - 4);

  // Danger zone (> 80%)
  ctx.fillStyle = 'rgba(217,79,79,.06)';
  ctx.fillRect(pad.l, pad.t, cw, ch * 0.2);

  // Line
  ctx.beginPath();
  ctx.strokeStyle = '#c4704b';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(x(p), y(p));
    else ctx.lineTo(x(p), y(p));
  });
  ctx.stroke();

  // Area fill
  ctx.lineTo(x(points[points.length - 1]), pad.t + ch);
  ctx.lineTo(x(points[0]), pad.t + ch);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
  grad.addColorStop(0, 'rgba(196,112,75,.25)');
  grad.addColorStop(1, 'rgba(196,112,75,.02)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Dots
  points.forEach(p => {
    ctx.beginPath();
    ctx.arc(x(p), y(p), 2.5, 0, Math.PI * 2);
    ctx.fillStyle = p.v > 80 ? '#d94f4f' : '#c4704b';
    ctx.fill();
  });
}

// ─── Render: History table ──────────────────────────────────────────
function renderHistory(history) {
  const el = document.getElementById('hist-list');
  if (!history?.length) {
    el.innerHTML = `<div style="color:var(--text-3);font-size:11px;padding:8px 0">${t('noSnapshotsYet')}</div>`;
    return;
  }

  const rows = [...history].reverse().slice(0, 50);
  let h = `<table class="htbl"><thead><tr>
    <th>${t('thTime')}</th><th>${t('thPlan')}</th><th>${t('thQuotas')}</th><th>${t('thBars')}</th>
  </tr></thead><tbody>`;

  rows.forEach(snap => {
    const quotas = snap.quotas?.map(q => `${q.used}/${q.total}`).join(', ') || '—';
    const bars = snap.progress_bars?.map(b => `${b.value}%`).join(', ') || '—';
    h += `<tr>
      <td>${fmtTime(snap.timestamp)}</td>
      <td>${esc(snap.plan || '—')}</td>
      <td>${esc(quotas)}</td>
      <td>${esc(bars)}</td>
    </tr>`;
  });

  h += '</tbody></table>';
  el.innerHTML = h;
}

// ─── Status bar ─────────────────────────────────────────────────────
function updateStatus(history) {
  const dot = document.getElementById('st-dot');
  const text = document.getElementById('st-text');
  const cnt = document.getElementById('st-count');

  if (!history?.length) {
    dot.className = 'dot dot-off';
    text.textContent = t('statusNoData');
    cnt.textContent = '';
    return;
  }

  const last = history[history.length - 1];
  const hrs = (Date.now() - new Date(last.timestamp).getTime()) / 3.6e6;
  dot.className = hrs < 1 ? 'dot dot-ok' : hrs < 8 ? 'dot dot-warn' : 'dot dot-off';
  text.textContent = t('statusLast', timeAgo(last.timestamp));
  cnt.textContent = t('snapshotCount', String(history.length));
}

// ─── Export: CSV ────────────────────────────────────────────────────
function exportCSV(history) {
  const headers = ['timestamp', 'plan', 'reset_info', 'models', 'quota_labels', 'quota_used', 'quota_total', 'quota_pct', 'progress_labels', 'progress_values', 'raw_first_section'];
  const rows = history.map(s => [
    s.timestamp,
    s.plan || '',
    s.reset_info || '',
    (s.models || []).join('; '),
    (s.quotas || []).map(q => q.label).join('; '),
    (s.quotas || []).map(q => q.used).join('; '),
    (s.quotas || []).map(q => q.total).join('; '),
    (s.quotas || []).map(q => q.pct).join('; '),
    (s.progress_bars || []).map(b => b.label).join('; '),
    (s.progress_bars || []).map(b => b.value).join('; '),
    (s.raw_sections?.[0] || '').replace(/[\n\r,]/g, ' ').substring(0, 200),
  ]);

  const csvContent = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  download(csvContent, `claude-usage-${today()}.csv`, 'text/csv');
}

// ─── Export: JSON ───────────────────────────────────────────────────
function exportJSON(history) {
  download(JSON.stringify(history, null, 2), `claude-usage-${today()}.json`, 'application/json');
}

function download(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function today() { return new Date().toISOString().slice(0, 10); }

document.getElementById('btn-csv').addEventListener('click', async () => {
  const r = await chrome.storage.local.get(STORAGE_KEY);
  exportCSV(r[STORAGE_KEY] || []);
});
document.getElementById('btn-json').addEventListener('click', async () => {
  const r = await chrome.storage.local.get(STORAGE_KEY);
  exportJSON(r[STORAGE_KEY] || []);
});

// ─── Clear ──────────────────────────────────────────────────────────
document.getElementById('btn-clear').addEventListener('click', async () => {
  if (confirm(t('clearConfirm'))) {
    await chrome.storage.local.set({ [STORAGE_KEY]: [] });
    init();
  }
});

// ─── Settings ───────────────────────────────────────────────────────
async function loadSettings() {
  const r = await chrome.storage.local.get(SETTINGS_KEY);
  const s = r[SETTINGS_KEY] || {};
  document.getElementById('cfg-auto').checked = s.autoCapture !== false;
  document.getElementById('cfg-notif').checked = s.notificationsEnabled === true;
  document.getElementById('cfg-interval').value = String(s.captureIntervalMinutes || 15);
}

function saveSettings() {
  const settings = {
    autoCapture: document.getElementById('cfg-auto').checked,
    notificationsEnabled: document.getElementById('cfg-notif').checked,
    captureIntervalMinutes: parseInt(document.getElementById('cfg-interval').value),
  };
  chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings });
}

['cfg-auto', 'cfg-notif'].forEach(id => document.getElementById(id).addEventListener('change', saveSettings));
document.getElementById('cfg-interval').addEventListener('change', saveSettings);

// ─── Live update listener ───────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SNAPSHOT_SAVED') init();
});

// ─── Init ───────────────────────────────────────────────────────────
async function init() {
  initI18n();
  const r = await chrome.storage.local.get(STORAGE_KEY);
  const history = r[STORAGE_KEY] || [];
  const latest = history.length ? history[history.length - 1] : null;

  renderLatest(latest);
  renderTrend(history);
  renderHistory(history);
  updateStatus(history);
  loadSettings();
}

init();
