/**
 * charts.js — ECharts 图表渲染引擎
 *
 * 使用单个 ECharts 实例 + 多 grid 布局，实现四个子图共享 X 轴、
 * 同步 tooltip 和 dataZoom。
 *
 * 布局:
 *   Grid 1: 价格 + 布林带 (40% 高度)
 *   Grid 2: RSI        (20% 高度)
 *   Grid 3: MACD       (20% 高度)
 *   Grid 4: ATR        (20% 高度)
 */

const ChartRenderer = {

  chart: null,
  currentData: null,
  currentIndicators: null,
  enabledIndicators: { bollinger: true, rsi: true, macd: true, atr: true },

  // 配色 (涨红跌绿)
  colors: {
    up: "#e74c3c",
    down: "#27ae60",
    rsi: "#9b59b6",
    macd_dif: "#e74c3c",
    macd_dea: "#f39c12",
    bb_upper: "#e74c3c",
    bb_mid: "#f39c12",
    bb_lower: "#27ae60",
    atr: "#e67e22",
    grid: "#ecf0f1",
    text: "#2c3e50",
    subText: "#7f8c8d",
    price: "#2c3e50",
    bg: "#ffffff"
  },

  /**
   * 初始化图表
   * @param {HTMLElement} container - 图表容器
   */
  init(container) {
    this.chart = echarts.init(container, null, { renderer: "canvas" });
    window.addEventListener("resize", () => this.chart && this.chart.resize());
  },

  /**
   * 计算布局 (根据启用的指标动态分配高度)
   */
  _calcLayout() {
    const enabled = this.enabledIndicators;
    const totalUnits = (enabled.bollinger ? 2 : 2) + (enabled.rsi ? 1 : 0) + (enabled.macd ? 1 : 0) + (enabled.atr ? 1 : 0);
    const unitHeight = 100 / totalUnits;

    // 留出间距
    const gap = 3;
    let topOffset = 5;
    const grids = [];
    const xAxes = [];
    const xAxisIndices = [];
    let gridIdx = 0;

    // Grid 1: 价格 + 布林带 (始终显示)
    const priceHeight = 2 * unitHeight;
    grids.push({
      left: 70, right: 30, top: `${topOffset}%`, height: `${priceHeight - gap}%`
    });
    xAxes.push({ gridIndex: gridIdx, show: false });
    xAxisIndices.push(gridIdx);
    gridIdx++;
    topOffset += priceHeight;

    // Grid 2: RSI
    if (enabled.rsi) {
      const h = unitHeight;
      grids.push({
        left: 70, right: 30, top: `${topOffset}%`, height: `${h - gap}%`
      });
      xAxes.push({ gridIndex: gridIdx, show: false });
      xAxisIndices.push(gridIdx);
      gridIdx++;
      topOffset += h;
    }

    // Grid 3: MACD
    if (enabled.macd) {
      const h = unitHeight;
      grids.push({
        left: 70, right: 30, top: `${topOffset}%`, height: `${h - gap}%`
      });
      xAxes.push({ gridIndex: gridIdx, show: false });
      xAxisIndices.push(gridIdx);
      gridIdx++;
      topOffset += h;
    }

    // Grid 4: ATR
    if (enabled.atr) {
      const h = unitHeight;
      grids.push({
        left: 70, right: 30, top: `${topOffset - 1}%`, height: `${h - gap}%`
      });
      xAxes.push({ gridIndex: gridIdx, show: true, type: "category" });
      xAxisIndices.push(gridIdx);
      gridIdx++;
    } else {
      // 最后一个 grid 显示 x 轴
      const lastGrid = grids[grids.length - 1];
      xAxes[xAxes.length - 1].show = true;
      xAxes[xAxes.length - 1].type = "category";
    }

    return { grids, xAxes, xAxisIndices };
  },

  /**
   * 渲染所有图表
   * @param {Array} rawData - 原始K线数据 (升序)
   * @param {Object} indicators - 计算结果 { bollinger, rsi, macd, atr }
   * @param {Object} enabled - 指标开关 { bollinger, rsi, macd, atr }
   * @param {Object} params - 当前参数 (用于标题显示)
   */
  render(rawData, indicators, enabled, params) {
    if (!this.chart) return;

    this.currentData = rawData;
    this.currentIndicators = indicators;
    this.enabledIndicators = enabled;

    const dates = rawData.map(d => d.date);
    const closes = rawData.map(d => d.close);
    const volumes = rawData.map(d => d.volume);

    const { grids, xAxes } = this._calcLayout();
    const C = this.colors;

    // ---- 构建各子图数据 ----

    // 价格图数据
    const priceSeries = [{
      name: "收盘价",
      type: "line",
      xAxisIndex: 0,
      yAxisIndex: 0,
      data: closes,
      smooth: false,
      symbol: "none",
      lineStyle: { color: C.price, width: 1.5 },
      z: 10
    }];

    // 布林带叠加
    if (enabled.bollinger && indicators.bollinger && indicators.bollinger.values.length > 0) {
      const bb = indicators.bollinger.values;
      const bbDates = bb.map(v => v.date);
      // 对齐到主数据 dates
      const upperData = this._alignToDates(dates, bbDates, bb.map(v => v.upper));
      const midData = this._alignToDates(dates, bbDates, bb.map(v => v.mid));
      const lowerData = this._alignToDates(dates, bbDates, bb.map(v => v.lower));

      priceSeries.push({
        name: "布林上轨",
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: upperData,
        symbol: "none",
        lineStyle: { color: C.bb_upper, width: 1, type: "solid" },
        z: 5
      });
      priceSeries.push({
        name: "布林中轨",
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: midData,
        symbol: "none",
        lineStyle: { color: C.bb_mid, width: 1, type: "dashed" },
        z: 5
      });
      priceSeries.push({
        name: "布林下轨",
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: lowerData,
        symbol: "none",
        lineStyle: { color: C.bb_lower, width: 1, type: "solid" },
        z: 5
      });
      // 通道填充: 上轨向下填充，下轨向上填充，叠加产生通道效果
      priceSeries.push({
        name: "布林上轨(填充)",
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: upperData,
        symbol: "none",
        lineStyle: { width: 0 },
        areaStyle: { color: "rgba(243, 156, 18, 0.06)", origin: "start" },
        z: 1,
        tooltip: { show: false },
        silent: true
      });
      priceSeries.push({
        name: "布林下轨(填充)",
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: lowerData,
        symbol: "none",
        lineStyle: { width: 0 },
        areaStyle: { color: "rgba(255, 255, 255, 0.85)", origin: "start" },
        z: 2,
        tooltip: { show: false },
        silent: true
      });
    }

    // RSI 子图
    let rsiSeries = [];
    let rsiYAxis = [];
    if (enabled.rsi && indicators.rsi && indicators.rsi.values.length > 0) {
      const rsiVals = indicators.rsi.values;
      const rsiDates = rsiVals.map(v => v.date);
      const rsiData = this._alignToDates(dates, rsiDates, rsiVals.map(v => v.rsi));
      const gridIdx = enabled.bollinger ? 1 : 1; // 价格图总是 grid 0

      rsiSeries.push({
        name: "RSI",
        type: "line",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: rsiData,
        symbol: "none",
        lineStyle: { color: C.rsi, width: 2 },
        markLine: {
          symbol: "none",
          silent: true,
          data: [
            { yAxis: params.rsi.overbought, lineStyle: { color: C.up, type: "dashed", width: 1 }, label: { show: true, formatter: `超买 ${params.rsi.overbought}`, position: "insideEndTop", fontSize: 10, color: C.up } },
            { yAxis: 50, lineStyle: { color: C.subText, type: "dashed", width: 1 }, label: { show: false } },
            { yAxis: params.rsi.oversold, lineStyle: { color: C.down, type: "dashed", width: 1 }, label: { show: true, formatter: `超卖 ${params.rsi.oversold}`, position: "insideEndBottom", fontSize: 10, color: C.down } }
          ]
        },
        markArea: {
          silent: true,
          itemStyle: { color: "rgba(231, 76, 60, 0.05)" },
          data: [[{ yAxis: params.rsi.overbought }, { yAxis: 100 }]]
        }
      });
      // 超卖区域
      rsiSeries.push({
        name: "RSI超卖区",
        type: "line",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: [],
        markArea: {
          silent: true,
          itemStyle: { color: "rgba(39, 174, 96, 0.05)" },
          data: [[{ yAxis: 0 }, { yAxis: params.rsi.oversold }]]
        },
        tooltip: { show: false }
      });

      rsiYAxis = {
        type: "value",
        gridIndex: 1,
        min: 0,
        max: 100,
        scale: true,
        name: "RSI",
        nameLocation: "middle",
        nameGap: 50,
        nameTextStyle: { color: C.rsi, fontSize: 11, fontWeight: "bold" },
        axisLabel: { color: C.subText, fontSize: 10 },
        splitLine: { lineStyle: { color: C.grid } }
      };
    }

    // MACD 子图
    let macdSeries = [];
    let macdYAxis = [];
    const macdGridIdx = (enabled.rsi ? 2 : 1);
    if (enabled.macd && indicators.macd && indicators.macd.values.length > 0) {
      const macdVals = indicators.macd.values;
      const macdDates = macdVals.map(v => v.date);
      const difData = this._alignToDates(dates, macdDates, macdVals.map(v => v.dif));
      const deaData = this._alignToDates(dates, macdDates, macdVals.map(v => v.dea));
      const histData = this._alignToDates(dates, macdDates, macdVals.map(v => v.hist));

      // 柱状图
      const histBarColors = histData.map(v => {
        if (v === null) return C.down;
        return v >= 0 ? C.up : C.down;
      });

      macdSeries.push({
        name: "MACD柱",
        type: "bar",
        xAxisIndex: macdGridIdx,
        yAxisIndex: macdGridIdx,
        data: histData.map((v, i) => ({
          value: v,
          itemStyle: { color: histBarColors[i] }
        })),
        barWidth: "60%",
        z: 1
      });
      macdSeries.push({
        name: "DIF",
        type: "line",
        xAxisIndex: macdGridIdx,
        yAxisIndex: macdGridIdx,
        data: difData,
        symbol: "none",
        lineStyle: { color: C.macd_dif, width: 1.5 },
        z: 2
      });
      macdSeries.push({
        name: "DEA",
        type: "line",
        xAxisIndex: macdGridIdx,
        yAxisIndex: macdGridIdx,
        data: deaData,
        symbol: "none",
        lineStyle: { color: C.macd_dea, width: 1.5 },
        z: 2
      });

      macdYAxis = {
        type: "value",
        gridIndex: macdGridIdx,
        scale: true,
        name: "MACD",
        nameLocation: "middle",
        nameGap: 50,
        nameTextStyle: { color: C.macd_dif, fontSize: 11, fontWeight: "bold" },
        axisLabel: { color: C.subText, fontSize: 10 },
        splitLine: { lineStyle: { color: C.grid } }
      };
    }

    // ATR 子图
    let atrSeries = [];
    let atrYAxis = [];
    const atrGridIdx = (enabled.rsi ? 1 : 0) + (enabled.macd ? 1 : 0) + 1;
    if (enabled.atr && indicators.atr && indicators.atr.values.length > 0) {
      const atrVals = indicators.atr.values;
      const atrDates = atrVals.map(v => v.date);
      const atrData = this._alignToDates(dates, atrDates, atrVals.map(v => v.atr));

      atrSeries.push({
        name: "ATR",
        type: "line",
        xAxisIndex: atrGridIdx,
        yAxisIndex: atrGridIdx,
        data: atrData,
        symbol: "none",
        lineStyle: { color: C.atr, width: 2 },
        areaStyle: { color: "rgba(230, 126, 34, 0.08)" },
        z: 2
      });

      atrYAxis = {
        type: "value",
        gridIndex: atrGridIdx,
        scale: true,
        name: "ATR",
        nameLocation: "middle",
        nameGap: 50,
        nameTextStyle: { color: C.atr, fontSize: 11, fontWeight: "bold" },
        axisLabel: { color: C.subText, fontSize: 10 },
        splitLine: { lineStyle: { color: C.grid } }
      };
    }

    // ---- 组装 Y 轴列表 ----
    const yAxes = [{
      type: "value",
      gridIndex: 0,
      scale: true,
      name: "价格",
      nameLocation: "middle",
      nameGap: 50,
      nameTextStyle: { color: C.text, fontSize: 11, fontWeight: "bold" },
      axisLabel: { color: C.subText, fontSize: 10 },
      splitLine: { lineStyle: { color: C.grid } }
    }];

    if (enabled.rsi) yAxes.push(rsiYAxis);
    if (enabled.macd) yAxes.push(macdYAxis);
    if (enabled.atr) yAxes.push(atrYAxis);

    // ---- 构建完整 option ----
    const allSeries = [...priceSeries, ...rsiSeries, ...macdSeries, ...atrSeries];

    // 构建 grid 数组 (与 xAxes 对齐)
    const finalGrids = grids.slice(0, xAxes.length);
    const finalXAxes = xAxes.map((xa, i) => {
      const isLast = (i === xAxes.length - 1);
      return {
        type: "category",
        data: dates,
        gridIndex: xa.gridIndex,
        show: xa.show || isLast,
        axisLabel: {
          color: C.subText,
          fontSize: 10,
          show: xa.show || isLast,
          formatter: function(val) {
            // 只显示月-日
            return val.length > 5 ? val.substring(5) : val;
          }
        },
        axisLine: { lineStyle: { color: C.grid } },
        axisTick: { show: false },
        splitLine: { show: false }
      };
    });

    // dataZoom: 所有 x 轴联动
    const dataZoomRefs = finalXAxes.map((_, i) => i);
    const dataZoom = [
      {
        type: "inside",
        xAxisIndex: dataZoomRefs,
        start: 0,
        end: 100,
        zoomOnMouseWheel: true,
        moveOnMouseWheel: true,
        moveOnMouseMove: true
      },
      {
        type: "slider",
        xAxisIndex: dataZoomRefs,
        bottom: 5,
        height: 20,
        start: 0,
        end: 100,
        borderColor: C.grid,
        fillerColor: "rgba(52, 152, 219, 0.1)",
        handleStyle: { color: C.text },
        textStyle: { color: C.subText, fontSize: 10 }
      }
    ];

    const option = {
      backgroundColor: C.bg,
      animation: false,
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
          link: [{ xAxisIndex: "all" }],
          label: { backgroundColor: "#6a7985" }
        },
        backgroundColor: "rgba(255,255,255,0.95)",
        borderColor: C.grid,
        borderWidth: 1,
        textStyle: { color: C.text, fontSize: 12 },
        formatter: function(params) {
          if (!params || params.length === 0) return "";
          const date = params[0].axisValue;
          let html = `<div style="font-weight:bold;margin-bottom:4px;">${date}</div>`;
          for (const p of params) {
            if (p.value === null || p.value === undefined) continue;
            const val = typeof p.value === "object" ? p.value[1] : p.value;
            html += `<div style="display:flex;align-items:center;margin:2px 0;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px;"></span>
              <span style="flex:1;">${p.seriesName}</span>
              <span style="font-weight:bold;margin-left:12px;">${Number(val).toFixed(2)}</span>
            </div>`;
          }
          return html;
        }
      },
      axisPointer: {
        link: [{ xAxisIndex: "all" }],
        label: { backgroundColor: "#6a7985" }
      },
      grid: finalGrids,
      xAxis: finalXAxes,
      yAxis: yAxes,
      dataZoom: dataZoom,
      series: allSeries
    };

    this.chart.setOption(option, true);
  },

  /**
   * 将指标数据对齐到主数据日期轴
   * @param {Array} mainDates - 主数据日期数组
   * @param {Array} indicatorDates - 指标日期数组
   * @param {Array} indicatorValues - 指标值数组
   * @returns {Array} 对齐后的值数组 (null 填充)
   */
  _alignToDates(mainDates, indicatorDates, indicatorValues) {
    const dateMap = {};
    for (let i = 0; i < indicatorDates.length; i++) {
      dateMap[indicatorDates[i]] = indicatorValues[i];
    }
    return mainDates.map(d => dateMap[d] !== undefined ? dateMap[d] : null);
  },

  /**
   * 获取十字光标数据 (用于信号标注)
   */
  getSignalAnnotations(indicators, params) {
    const annotations = [];

    // MACD 金叉/死叉标注
    if (indicators.macd && indicators.macd.values.length > 0) {
      const vals = indicators.macd.values;
      for (let i = 1; i < vals.length; i++) {
        const prev = vals[i - 1];
        const cur = vals[i];
        if (prev.dif <= prev.dea && cur.dif > cur.dea) {
          annotations.push({ date: cur.date, type: "golden_cross", grid: "macd" });
        }
        if (prev.dif >= prev.dea && cur.dif < cur.dea) {
          annotations.push({ date: cur.date, type: "death_cross", grid: "macd" });
        }
      }
    }

    return annotations;
  },

  /**
   * 调整容器大小
   */
  resize() {
    if (this.chart) this.chart.resize();
  }
};
