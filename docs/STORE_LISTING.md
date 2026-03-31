# Chrome Web Store Listing — Claude Usage Tracker v1.0.0

## English

### Name
Claude Usage Tracker

### Short Description (132 chars max)
Track your Claude.ai subscription usage. Auto-captures quotas, visualizes trends, exports history. All data stays local in your browser.

### Detailed Description
Claude Usage Tracker monitors your Claude.ai subscription usage so you always know where you stand.

Features:
- Auto-capture: Periodically reads your usage page in the background (configurable intervals from 15 min to 4 hours)
- Manual capture: One-click snapshot of current usage
- Visual dashboard: See quotas, progress bars, and plan info at a glance
- Trend chart: Canvas-based visualization of usage over time
- History table: Browse your last 50 snapshots
- Export: Download history as CSV or JSON for analysis
- Bilingual: English and Simplified Chinese

Privacy:
- All data stored locally in chrome.storage.local
- No external servers, no telemetry, no data collection
- Only accesses claude.ai/settings/usage
- Open source: https://github.com/a2d2-dev/claude-usage-ext

### Category
Productivity

### Language
English, Chinese (Simplified)

---

## 中文

### 名称
Claude 用量追踪器

### 简短描述（132 字符以内）
追踪 Claude.ai 订阅用量。自动采集配额数据，可视化趋势，支持导出历史记录。所有数据仅存储在浏览器本地。

### 详细描述
Claude 用量追踪器帮助你实时掌握 Claude.ai 订阅用量。

功能特性：
- 自动采集：后台定期读取用量页面（可设置 15 分钟到 4 小时的采集间隔）
- 手动采集：一键获取当前用量快照
- 可视化仪表盘：一目了然查看配额、进度条和订阅计划信息
- 趋势图表：基于 Canvas 的用量趋势可视化
- 历史记录：浏览最近 50 条快照
- 数据导出：以 CSV 或 JSON 格式下载历史记录用于分析
- 双语支持：英文和简体中文

隐私保护：
- 所有数据存储在浏览器本地（chrome.storage.local）
- 无外部服务器、无遥测、无数据收集
- 仅访问 claude.ai/settings/usage
- 开源项目：https://github.com/a2d2-dev/claude-usage-ext

---

## Privacy Questionnaire Answers

1. **Single purpose description**: This extension tracks and displays the user's Claude.ai subscription usage data.
2. **Permission justification**:
   - `storage`: Store captured usage snapshots and user settings locally
   - `alarms`: Schedule periodic auto-capture of usage data
   - `notifications`: Optional notification when a capture completes
   - `tabs`: Open claude.ai/settings/usage in a background tab for data capture
3. **Host permissions**: `https://claude.ai/*` — content script needs to read the usage page DOM
4. **Remote code**: No remote code is used. All code is bundled in the extension.
5. **Data collection**: No user data is collected, transmitted, or shared.
6. **Data usage**: All data remains in the user's browser (chrome.storage.local).
