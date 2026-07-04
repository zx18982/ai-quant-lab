# AI Quant Lab

股票技术指标交互式计算工具 — 纯前端、零构建、浏览器直接打开即用。

## 功能概览

- 5 只股票切换（中芯国际 A/H、比亚迪 A/H、长江电力 A）
- 4 个技术指标实时计算与可视化：
  - **RSI**（相对强弱指标）— Wilder 平滑法
  - **MACD**（指数移动平均收敛/发散）— EMA 快慢线 + 红绿柱状图
  - **布林带**（Bollinger Bands）— 20 日均线 ± 2σ 通道
  - **ATR**（平均真实波幅）— Wilder 平滑法 + 动态止损线
- 参数滑块实时调节，150ms 防抖重绘
- 参数约束校验（MACD 慢线 > 快线、RSI 超买 > 超卖）
- 时间范围切换（1 月 / 3 月 / 6 月 / 1 年）
- 滚轮缩放 + 拖动平移 + 十字光标 tooltip
- 底栏信号摘要实时更新
- CSV 数据导出

## 快速开始

```bash
# 方式一：直接打开
open web_tool/index.html

# 方式二：本地服务器（推荐，避免 CORS 限制）
cd web_tool
python3 -m http.server 8765
# 浏览器访问 http://localhost:8765
```

## 项目结构

```
ai-quant-lab/
├── README.md                       # 本文件
├── stock_data_spec.yaml            # 股票数据取数规范 (v1.2.0)
├── fetch_stock_data.py             # 数据获取脚本
├── spec.yaml                       # 指标计算实验室规范
├── tool_design.md                  # 产品设计文档
└── web_tool/                       # 网页应用
    ├── index.html                  # 主页面
    ├── css/
    │   └── style.css               # 完整样式
    ├── js/
    │   ├── indicators.js           # 指标计算引擎（纯手写）
    │   ├── charts.js               # ECharts 图表渲染
    │   └── app.js                  # 主控制器
    └── data/
        ├── stocks.json             # 股票配置
        ├── fetch_data.py           # 数据获取脚本
        ├── hk00981_daily.json      # 中芯国际港股
        ├── sh688981_daily.json     # 中芯国际 A 股
        ├── sz002594_daily.json     # 比亚迪
        ├── hk01211_daily.json      # 比亚迪股份港股
        └── sh600900_daily.json     # 长江电力
```

## 数据说明

- 数据来源：腾讯自选股（westock-data）
- 复权方式：前复权（qfq）
- 数据量：每只股票约 250 个交易日
- 更新数据：运行 `python3 web_tool/data/fetch_data.py`

## 技术栈

- 纯 HTML / CSS / JavaScript，零构建依赖
- ECharts 5.x（CDN 引入）
- 中国股市配色惯例：涨红跌绿

## 预置股票

| 名称 | 代码 | 市场 | 币种 |
|------|------|------|------|
| 中芯国际 | hk00981 | HK | HKD |
| 中芯国际 | sh688981 | A | CNY |
| 比亚迪 | sz002594 | A | CNY |
| 比亚迪股份 | hk01211 | HK | HKD |
| 长江电力 | sh600900 | A | CNY |

## License

MIT
