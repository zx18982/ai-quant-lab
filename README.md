# AI Quant Lab

股票技术指标交互式计算工具 — 纯前端实现，零构建依赖。

## 功能概览

- **5 只股票切换**：中芯国际（A/H 股）、比亚迪（A/H 股）、长江电力（A 股）
- **4 个技术指标实时计算**：RSI、MACD、布林带、ATR
- **参数滑块实时调节**：拖动释放后 150ms 防抖触发重绘
- **ECharts 图表渲染**：涨红跌绿配色，支持滚轮缩放、拖动平移、十字光标
- **前复权 K 线数据**：250 个交易日，离线 JSON 数据源

## 快速开始

```bash
# 方式一：直接用浏览器打开
open web_tool/index.html

# 方式二：启动本地服务器（推荐，避免 CORS 限制）
cd web_tool && python3 -m http.server 8765
# 浏览器访问 http://localhost:8765
```

## 项目结构

```
ai-quant-lab/
├── web_tool/                # 交互式指标计算工具
│   ├── index.html           # 主页面
│   ├── css/style.css        # 样式（涨红跌绿配色）
│   ├── js/
│   │   ├── indicators.js    # 指标计算引擎（纯手写 RSI/MACD/布林带/ATR）
│   │   ├── charts.js        # ECharts 多 grid 图表渲染
│   │   └── app.js           # 主控制器（选股/参数/开关/导出）
│   └── data/
│       ├── stocks.json      # 股票配置
│       └── *_daily.json     # 5 只股票前复权日线数据
├── spec.yaml                # 指标计算 notebook 规范文件
├── stock_data_spec.yaml     # 股票数据取数规范 (v1.2.0)
├── tool_design.md           # 产品设计文档
└── fetch_stock_data.py      # 数据获取脚本
```

## 指标说明

| 指标 | 核心回答的问题 | 类型 | 默认参数 |
|------|--------------|------|---------|
| RSI | 现在是不是涨/跌过头了？ | 震荡（动量） | 14 日，阈值 70/30 |
| MACD | 趋势方向有没有变？ | 趋势跟踪 | 12/26/9 日 |
| 布林带 | 价格偏离常态多远？何时变盘？ | 波动率通道 | 20 日，2 倍标准差 |
| ATR | 当前波动有多大？止损放哪？ | 波动率度量 | 14 日 |

## 技术栈

- HTML5 + CSS3 + 原生 JavaScript（零构建依赖）
- ECharts 5.4（CDN 加载）
- 数据源：westock-data（腾讯自选股）

## License

MIT
