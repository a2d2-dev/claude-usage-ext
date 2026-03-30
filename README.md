# Claude Usage Tracker v2 — Chrome Extension

定期自动采集 claude.ai 订阅用量数据，持久化存储，支持导出分析。

## 架构

```
┌─────────────────────────────────────────────────────┐
│  background.js (Service Worker)                     │
│  ├── chrome.alarms → 每 N 小时触发                   │
│  ├── 打开后台 tab → claude.ai/settings/usage         │
│  ├── 等待 content.js 抓取完成                        │
│  └── 关闭 tab                                       │
├─────────────────────────────────────────────────────┤
│  content.js (注入 usage 页面)                        │
│  ├── 等待 SPA 渲染完成                               │
│  ├── 启发式提取: progressbar / 百分比 / X of Y / 文本 │
│  └── 存入 chrome.storage.local                      │
├─────────────────────────────────────────────────────┤
│  popup (HTML + JS)                                  │
│  ├── LATEST: 最新快照                                │
│  ├── TREND: canvas 趋势图                            │
│  ├── HISTORY: 快照列表 + CSV/JSON 导出               │
│  └── CONFIG: 采集间隔 / 通知开关                      │
└─────────────────────────────────────────────────────┘
```

## 安装

1. `chrome://extensions/` → 开启 **开发者模式**
2. **加载已解压的扩展程序** → 选本文件夹
3. Pin 到工具栏

## 使用

### 手动采集
点击扩展图标 → ↗ 打开 usage 页面 → 自动抓取

### 自动采集
默认每 4 小时自动在后台标签页打开 usage 页面抓取数据，抓完自动关闭。
在 CONFIG 标签页可调整间隔（1h / 2h / 4h / 8h / 12h / 24h）。

### 导出分析
HISTORY 标签页支持:
- **CSV 导出**: 直接用 Excel / Google Sheets 打开
- **JSON 导出**: 用 Python / jq 等工具处理

### CSV 字段说明

| 字段 | 说明 |
|------|------|
| timestamp | ISO 8601 采集时间 |
| plan | 订阅计划 (Pro/Max/...) |
| reset_info | 配额重置信息 |
| models | 检测到的模型名称 |
| quota_labels | 配额描述 (如 "15 of 45 messages") |
| quota_used | 已用量 |
| quota_total | 总量 |
| quota_pct | 使用百分比 |
| progress_labels | 进度条标签 |
| progress_values | 进度条值 |
| raw_first_section | 页面原始文本 (前 200 字) |

### Python 分析示例

```python
import pandas as pd

df = pd.read_csv('claude-usage-2026-03-30.csv')
df['timestamp'] = pd.to_datetime(df['timestamp'])

# 按天聚合平均用量
df['date'] = df['timestamp'].dt.date
daily = df.groupby('date')['quota_pct'].apply(
    lambda x: x.str.split('; ').explode().astype(float).mean()
)
daily.plot(title='Daily Average Usage %')
```

## 自定义抓取逻辑

usage 页面的 DOM 结构没有公开文档，首次使用后检查 popup 里的 "Raw Content" 预览：

1. 如果看到结构化数据 → 抓取逻辑已能工作
2. 如果看到的文本不含用量信息 → 需要调整 `content.js` 里的选择器

调整方法:
1. 打开 `claude.ai/settings/usage`
2. F12 → Elements → 找到用量相关的 DOM 元素
3. 记下 class / id / aria 属性
4. 修改 `content.js` 中 `extractUsageData()` 的选择器

## 数据存储

- 位置: `chrome.storage.local`（仅浏览器本地）
- 容量: 最多 2000 条快照（约 6 个月 @4h 间隔）
- 隐私: 无外部请求，无遥测，无数据上传

## 文件结构

```
claude-usage-ext/
├── manifest.json    # V3 manifest
├── content.js       # 页面抓取 (启发式 DOM 解析)
├── background.js    # 定时任务 + 后台 tab 管理
├── popup.html       # 弹窗 UI
├── popup.js         # 趋势图 + 导出 + 设置
├── icons/
└── README.md
```
