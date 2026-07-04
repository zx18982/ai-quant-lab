/**
 * app.js — 主控制器
 *
 * 管理:
 *   - 股票选择与数据加载
 *   - 参数滑块交互 (防抖 150ms)
 *   - 指标开关切换
 *   - 信号摘要更新
 *   - 时间范围切换
 *   - 参数重置
 */

const App = {

  // 状态
  stocksConfig: [],
  stockDataCache: {},       // code -> data array
  currentStock: null,
  currentData: null,

  // 默认参数
  defaultParams: {
    rsi: { period: 14, overbought: 70, oversold: 30 },
    macd: { fast_period: 12, slow_period: 26, signal_period: 9 },
    bollinger: { period: 20, std_dev: 2.0 },
    atr: { period: 14, stop_multiplier: 2.0 }
  },

  // 当前参数 (深拷贝默认值)
  params: null,

  // 指标开关
  enabled: { bollinger: true, rsi: true, macd: true, atr: true },

  // 防抖计时器
  debounceTimer: null,

  // 时间范围 (百分比)
  timeRange: { start: 0, end: 100 },

  // ============================================================
  // 初始化
  // ============================================================
  async init() {
    this.params = JSON.parse(JSON.stringify(this.defaultParams));
    this.initChart();
    this.bindEvents();
    await this.loadStocksConfig();
  },

  initChart() {
    const container = document.getElementById("chart-container");
    ChartRenderer.init(container);
  },

  // ============================================================
  // 加载股票配置
  // ============================================================
  async loadStocksConfig() {
    try {
      const resp = await fetch("data/stocks.json");
      const config = await resp.json();
      this.stocksConfig = config.stocks;
      this.renderStockSelector();
      // 默认选中第一只 (中芯国际港股)
      if (this.stocksConfig.length > 0) {
        this.selectStock(this.stocksConfig[0].code);
      }
    } catch (err) {
      this.showToast("加载股票列表失败: " + err.message, "error");
      console.error(err);
    }
  },

  renderStockSelector() {
    const selector = document.getElementById("stock-selector");
    selector.innerHTML = "";

    // 按分组排列
    const groups = {};
    for (const s of this.stocksConfig) {
      if (!groups[s.group]) groups[s.group] = [];
      groups[s.group].push(s);
    }

    for (const [groupName, stocks] of Object.entries(groups)) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = groupName;
      for (const s of stocks) {
        const option = document.createElement("option");
        option.value = s.code;
        option.textContent = `${s.name} (${s.code}) · ${s.market}`;
        optgroup.appendChild(option);
      }
      selector.appendChild(optgroup);
    }
  },

  // ============================================================
  // 选择股票
  // ============================================================
  async selectStock(code) {
    const stock = this.stocksConfig.find(s => s.code === code);
    if (!stock) return;

    this.currentStock = stock;
    this.showLoading(true);

    try {
      // 从缓存或文件加载
      if (!this.stockDataCache[code]) {
        const resp = await fetch(`data/${stock.data_file}`);
        const data = await resp.json();
        this.stockDataCache[code] = data;
      }

      this.currentData = this.stockDataCache[code];
      this.updateStockInfo(stock);
      this.recalculateAndRender();
    } catch (err) {
      this.showToast("加载数据失败: " + err.message, "error");
      console.error(err);
    } finally {
      this.showLoading(false);
    }
  },

  // ============================================================
  // 更新股票信息卡
  // ============================================================
  updateStockInfo(stock) {
    const data = this.currentData;
    if (!data || data.length === 0) return;

    const last = data[data.length - 1];
    const prev = data[data.length - 2];
    const change = last.close - prev.close;
    const changePct = (change / prev.close * 100).toFixed(2);
    const isUp = change >= 0;

    const currencySymbol = stock.currency === "HKD" ? "HK$" : "¥";

    document.getElementById("info-name").textContent = stock.name;
    document.getElementById("info-code").textContent = `${stock.code} · ${stock.market} · ${stock.currency}`;
    document.getElementById("info-price").textContent = `${currencySymbol}${last.close.toFixed(2)}`;
    document.getElementById("info-change").textContent = `${isUp ? "+" : ""}${change.toFixed(2)} (${isUp ? "+" : ""}${changePct}%)`;
    document.getElementById("info-change").className = `info-change ${isUp ? "up" : "down"}`;
    document.getElementById("info-data").textContent = `${data.length}交易日 · 前复权 · ${data[0].date} ~ ${data[data.length - 1].date}`;
  },

  // ============================================================
  // 重新计算指标并渲染
  // ============================================================
  recalculateAndRender() {
    if (!this.currentData || this.currentData.length === 0) return;

    const data = this.currentData;

    // 计算四个指标
    const indicators = {
      rsi: this.enabled.rsi ? IndicatorEngine.rsi(data, this.params.rsi) : null,
      macd: this.enabled.macd ? IndicatorEngine.macd(data, this.params.macd) : null,
      bollinger: this.enabled.bollinger ? IndicatorEngine.bollinger(data, this.params.bollinger) : null,
      atr: this.enabled.atr ? IndicatorEngine.atr(data, this.params.atr) : null
    };

    // 渲染图表
    ChartRenderer.render(data, indicators, this.enabled, this.params);

    // 更新信号摘要
    this.updateSignalSummary(indicators);

    // 更新参数显示
    this.updateParamDisplay();
  },

  // ============================================================
  // 防抖重绘
  // ============================================================
  debouncedRecalculate() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.recalculateAndRender();
    }, 150);
  },

  // ============================================================
  // 信号摘要
  // ============================================================
  updateSignalSummary(indicators) {
    const summary = document.getElementById("signal-summary");
    const badges = [];

    for (const [key, ind] of Object.entries(indicators)) {
      if (!ind || !ind.signals) continue;
      for (const sig of ind.signals) {
        const cls = sig.level || "info";
        badges.push(`<span class="signal-badge ${cls}">${sig.text}</span>`);
      }
    }

    if (badges.length === 0) {
      summary.innerHTML = '<span class="signal-badge info">暂无信号</span>';
    } else {
      summary.innerHTML = badges.join("");
    }
  },

  // ============================================================
  // 参数滑块管理
  // ============================================================
  updateParamDisplay() {
    // RSI
    this._setSliderValue("rsi-period", this.params.rsi.period);
    this._setSliderValue("rsi-overbought", this.params.rsi.overbought);
    this._setSliderValue("rsi-oversold", this.params.rsi.oversold);

    // MACD
    this._setSliderValue("macd-fast", this.params.macd.fast_period);
    this._setSliderValue("macd-slow", this.params.macd.slow_period);
    this._setSliderValue("macd-signal", this.params.macd.signal_period);

    // Bollinger
    this._setSliderValue("bb-period", this.params.bollinger.period);
    this._setSliderValue("bb-stddev", this.params.bollinger.std_dev);

    // ATR
    this._setSliderValue("atr-period", this.params.atr.period);
    this._setSliderValue("atr-stop", this.params.atr.stop_multiplier);

    // 约束校验
    this.validateConstraints();
  },

  _setSliderValue(id, value) {
    const slider = document.getElementById(id);
    const display = document.getElementById(id + "-val");
    if (slider) slider.value = value;
    if (display) display.textContent = value;
  },

  validateConstraints() {
    // MACD: slow > fast
    const macdValid = this.params.macd.slow_period > this.params.macd.fast_period;
    this._toggleConstraintWarning("macd-slow", !macdValid, "慢线周期须大于快线周期");

    // RSI: overbought > oversold
    const rsiValid = this.params.rsi.overbought > this.params.rsi.oversold;
    this._toggleConstraintWarning("rsi-overbought", !rsiValid, "超买线须大于超卖线");

    return macdValid && rsiValid;
  },

  _toggleConstraintWarning(id, show, message) {
    const slider = document.getElementById(id);
    const wrapper = slider ? slider.closest(".slider-item") : null;
    if (wrapper) {
      if (show) {
        wrapper.classList.add("constraint-error");
        const hint = wrapper.querySelector(".constraint-hint");
        if (hint) hint.textContent = message;
      } else {
        wrapper.classList.remove("constraint-error");
      }
    }
  },

  // ============================================================
  // 事件绑定
  // ============================================================
  bindEvents() {
    // 股票选择
    document.getElementById("stock-selector").addEventListener("change", (e) => {
      this.selectStock(e.target.value);
    });

    // 指标开关
    document.querySelectorAll(".indicator-toggle input").forEach(checkbox => {
      checkbox.addEventListener("change", (e) => {
        const key = e.target.dataset.indicator;
        this.enabled[key] = e.target.checked;

        // 切换参数面板的展开/折叠状态
        const paramGroup = document.querySelector(`.param-group[data-indicator="${key}"]`);
        if (paramGroup) {
          paramGroup.classList.toggle("disabled", !e.target.checked);
        }

        // 切换对应子图的显示
        const chartSection = document.querySelector(`.chart-section[data-indicator="${key}"]`);
        if (chartSection) {
          chartSection.classList.toggle("hidden", !e.target.checked);
        }

        this.recalculateAndRender();
      });
    });

    // 参数滑块
    document.querySelectorAll('input[type="range"][data-param]').forEach(slider => {
      slider.addEventListener("input", (e) => {
        const indicator = e.target.dataset.indicator;
        const param = e.target.dataset.param;
        let value = parseFloat(e.target.value);

        // 更新显示
        const display = document.getElementById(e.target.id + "-val");
        if (display) {
          display.textContent = e.target.step && parseFloat(e.target.step) < 1 ? value.toFixed(1) : value;
        }

        // 更新参数
        this.params[indicator][param] = value;

        // 约束校验
        this.validateConstraints();

        // 防抖重绘
        this.debouncedRecalculate();
      });
    });

    // 折叠面板
    document.querySelectorAll(".param-group-header").forEach(header => {
      header.addEventListener("click", () => {
        header.parentElement.classList.toggle("collapsed");
      });
    });

    // 重置按钮
    document.getElementById("btn-reset").addEventListener("click", () => {
      this.params = JSON.parse(JSON.stringify(this.defaultParams));
      this.recalculateAndRender();
      this.showToast("参数已重置为默认值", "info");
    });

    // 时间范围按钮
    document.querySelectorAll(".time-range-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll(".time-range-btn").forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");

        const range = e.target.dataset.range;
        const total = this.currentData ? this.currentData.length : 250;

        let start = 0, end = 100;
        if (range === "1m") {
          start = Math.max(0, (1 - 22 / total) * 100);
        } else if (range === "3m") {
          start = Math.max(0, (1 - 66 / total) * 100);
        } else if (range === "6m") {
          start = Math.max(0, (1 - 132 / total) * 100);
        } else if (range === "1y") {
          start = 0;
        }

        if (ChartRenderer.chart) {
          ChartRenderer.chart.dispatchAction({ type: "dataZoom", start: start, end: end });
        }
      });
    });

    // 导出CSV
    document.getElementById("btn-export").addEventListener("click", () => {
      this.exportCSV();
    });
  },

  // ============================================================
  // 导出CSV
  // ============================================================
  exportCSV() {
    if (!this.currentData) return;

    const data = this.currentData;
    const indicators = {
      rsi: this.enabled.rsi ? IndicatorEngine.rsi(data, this.params.rsi) : null,
      macd: this.enabled.macd ? IndicatorEngine.macd(data, this.params.macd) : null,
      bollinger: this.enabled.bollinger ? IndicatorEngine.bollinger(data, this.params.bollinger) : null,
      atr: this.enabled.atr ? IndicatorEngine.atr(data, this.params.atr) : null
    };

    // 构建查找表
    const lookups = {};
    for (const [key, ind] of Object.entries(indicators)) {
      if (!ind) continue;
      lookups[key] = {};
      for (const v of ind.values) {
        lookups[key][v.date] = v;
      }
    }

    // 表头
    const headers = ["date", "open", "high", "low", "close", "volume"];
    if (indicators.rsi) headers.push("rsi");
    if (indicators.macd) headers.push("dif", "dea", "macd_hist");
    if (indicators.bollinger) headers.push("bb_upper", "bb_mid", "bb_lower", "bb_width");
    if (indicators.atr) headers.push("atr", "stop_long");

    // 数据行
    const rows = [headers.join(",")];
    for (const d of data) {
      const row = [d.date, d.open, d.high, d.low, d.close, d.volume];
      if (indicators.rsi) {
        const v = lookups.rsi[d.date];
        row.push(v ? v.rsi : "");
      }
      if (indicators.macd) {
        const v = lookups.macd[d.date];
        row.push(v ? v.dif : "", v ? v.dea : "", v ? v.hist : "");
      }
      if (indicators.bollinger) {
        const v = lookups.bollinger[d.date];
        row.push(v ? v.upper : "", v ? v.mid : "", v ? v.lower : "", v ? v.width : "");
      }
      if (indicators.atr) {
        const v = lookups.atr[d.date];
        row.push(v ? v.atr : "", v ? v.stop_long : "");
      }
      rows.push(row.join(","));
    }

    // 下载
    const csv = "\uFEFF" + rows.join("\n"); // BOM for Excel
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${this.currentStock.code}_indicators_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast("CSV 已导出", "success");
  },

  // ============================================================
  // UI 辅助
  // ============================================================
  showLoading(show) {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) overlay.style.display = show ? "flex" : "none";
  },

  showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
};

// 启动
document.addEventListener("DOMContentLoaded", () => App.init());
