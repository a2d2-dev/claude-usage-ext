# Claude Usage Tracker

> Track and understand your Claude.ai subscription usage — automatic, private, and open source.
>
> 追踪并分析 Claude.ai 订阅用量 — 自动采集，完全私密，开源代码。

[![Build](https://github.com/a2d2-dev/claude-usage-ext/actions/workflows/build.yml/badge.svg)](https://github.com/a2d2-dev/claude-usage-ext/actions/workflows/build.yml)

**[🌐 Website](https://a2d2-dev.github.io/claude-usage-ext/)** · **[🔒 Privacy Policy](https://a2d2-dev.github.io/claude-usage-ext/privacy.html)** · **[🐛 Report an Issue](https://github.com/a2d2-dev/claude-usage-ext/issues)**

---

## What it does / 功能介绍

Claude's billing model is complex. This Chrome extension makes it simple:

- **Auto-capture** — opens `claude.ai/settings/usage` in a background tab on a schedule, grabs quota data, closes the tab
- **Trend chart** — visualize usage over time with a built-in canvas chart
- **History table** — browse and export up to 1500 snapshots (CSV / JSON)
- **Configurable** — choose capture interval (15 min → 4 h) and optional notifications
- **i18n** — English and Simplified Chinese; follows your browser language automatically
- **100% local** — all data in `chrome.storage.local`, no external requests, no telemetry

---

## Architecture / 架构

```
┌───────────────────────────────────────────────────────┐
│  background.js (Service Worker)                       │
│  ├── chrome.alarms → triggers every N minutes         │
│  ├── opens background tab → claude.ai/settings/usage  │
│  ├── waits for content.js to extract data             │
│  └── closes the tab                                   │
├───────────────────────────────────────────────────────┤
│  content.js (injected into the usage page)            │
│  ├── waits for SPA rendering to stabilize             │
│  ├── heuristic extraction:                            │
│  │     ARIA progressbars / "X of Y" quotas /          │
│  │     percentage text / raw text sections            │
│  └── saves snapshot to chrome.storage.local           │
├───────────────────────────────────────────────────────┤
│  popup.html + popup.js                                │
│  ├── LATEST: current snapshot with progress bars      │
│  ├── TREND:  canvas usage chart over time             │
│  ├── HISTORY: snapshot table + CSV/JSON export        │
│  └── CONFIG: capture interval / notifications         │
└───────────────────────────────────────────────────────┘
```

---

## Install / 安装

### From Chrome Web Store (recommended)
> Coming soon — link will be added here once published.

### Developer mode (manual)

1. Download the latest `.zip` from [Releases](https://github.com/a2d2-dev/claude-usage-ext/releases)
2. Unzip it
3. Open `chrome://extensions/` → enable **Developer mode**
4. Click **Load unpacked** → select the unzipped folder
5. Pin the extension to your toolbar

---

## Usage / 使用

| Action | How |
|--------|-----|
| First capture | Visit `claude.ai/settings/usage` — the content script runs automatically |
| Manual capture | Click the extension icon → press **⟳** |
| View trends | Click **TREND** tab in the popup |
| Export data | **HISTORY** tab → CSV or JSON button |
| Change interval | **CONFIG** tab → Interval dropdown |
| Clear all data | **HISTORY** tab → Clear button |

---

## CSV Fields / CSV 字段

| Field | Description |
|-------|-------------|
| `timestamp` | ISO 8601 capture time |
| `plan` | Subscription plan (Free / Pro / Max / …) |
| `reset_info` | Quota reset information shown on the page |
| `models` | Detected model names |
| `quota_labels` | Quota descriptions (e.g. "15 of 45 messages") |
| `quota_used` | Used amounts |
| `quota_total` | Total amounts |
| `quota_pct` | Usage percentages |
| `progress_labels` | Progress bar labels |
| `progress_values` | Progress bar values |
| `raw_first_section` | First 200 chars of raw page text |

### Python analysis example

```python
import pandas as pd

df = pd.read_csv('claude-usage-2025-03-30.csv')
df['timestamp'] = pd.to_datetime(df['timestamp'])
df['date'] = df['timestamp'].dt.date

daily = df.groupby('date')['quota_pct'].apply(
    lambda x: x.str.split('; ').explode().astype(float).mean()
)
daily.plot(title='Daily Average Usage %')
```

---

## Chrome Web Store Submission Checklist / 上架检查清单

- [x] Manifest V3
- [x] `default_locale` + `_locales/en` + `_locales/zh_CN`
- [x] Icons: 16×16, 48×48, 128×128
- [x] `homepage_url` set to GitHub Pages
- [x] Privacy policy at `https://a2d2-dev.github.io/claude-usage-ext/privacy.html`
- [x] Minimal permissions (no `<all_urls>`)
- [ ] Store screenshots (1280×800 or 640×400)
- [ ] Store listing description (EN + ZH)
- [ ] Chrome Web Store developer account

---

## Development / 开发

```bash
# Clone
git clone https://github.com/a2d2-dev/claude-usage-ext.git
cd claude-usage-ext

# Load in Chrome
# chrome://extensions/ → Developer mode → Load unpacked → select this folder
```

**Release a new version:**
1. Bump `"version"` in `manifest.json`
2. Commit and push
3. Create a git tag: `git tag v2.1.0 && git push origin v2.1.0`
4. GitHub Actions builds the `.zip` and creates a GitHub Release automatically

**Customizing the parser:**
If the usage page DOM changes:
1. Open `claude.ai/settings/usage` → F12 → Elements
2. Find the updated quota/progress elements
3. Edit `extractUsageData()` in `content.js`

---

## File Structure / 文件结构

```
claude-usage-ext/
├── manifest.json       # Manifest V3
├── background.js       # Alarm scheduler + background tab management
├── content.js          # Heuristic DOM parser for the usage page
├── popup.html          # Popup UI (data-i18n attributes)
├── popup.js            # Trend chart, export, settings, i18n init
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── _locales/
│   ├── en/messages.json
│   └── zh_CN/messages.json
├── docs/               # GitHub Pages (landing page)
│   ├── index.html
│   └── privacy.html
└── .github/
    └── workflows/
        └── build.yml   # CI: validate + package + release
```

---

## Privacy / 隐私

All data stays in your browser. No servers. No telemetry. See the [full privacy policy](https://a2d2-dev.github.io/claude-usage-ext/privacy.html).

---

## License / 许可

MIT — see [LICENSE](LICENSE)
