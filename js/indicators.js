/**
 * indicators.js — 技术指标计算引擎
 * 
 * 纯手动实现 RSI / MACD / 布林带 / ATR 四个技术指标
 * 不依赖任何第三方 TA 库
 * 
 * 数据格式: [{ date, open, high, low, close, volume }, ...]  (升序)
 */

const IndicatorEngine = {

  // ============================================================
  // RSI — 相对强弱指标 (Wilder 平滑法)
  // ============================================================
  /**
   * @param {Array} data - K线数据 (升序)
   * @param {Object} params - { period, overbought, oversold }
   * @returns {Object} { values: [{date, rsi}], signals: [...] }
   */
  rsi(data, { period = 14, overbought = 70, oversold = 30 } = {}) {
    if (data.length < period + 1) {
      return { values: [], signals: [], error: "数据不足" };
    }

    const closes = data.map(d => d.close);
    const values = [];

    // Step 1-2: 计算每日涨跌
    const gains = [0]; // 第一天无变动
    const losses = [0];
    for (let i = 1; i < closes.length; i++) {
      const delta = closes[i] - closes[i - 1];
      gains.push(Math.max(delta, 0));
      losses.push(Math.max(-delta, 0));
    }

    // Step 3: Wilder 平滑法
    // 首次: 前 period 天的简单平均
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 1; i <= period; i++) {
      avgGain += gains[i];
      avgLoss += losses[i];
    }
    avgGain /= period;
    avgLoss /= period;

    // 第一个 RSI 值
    const results = [];
    let firstRSI;
    if (avgLoss === 0) {
      firstRSI = 100;
    } else {
      const rs = avgGain / avgLoss;
      firstRSI = 100 - 100 / (1 + rs);
    }
    results.push({ idx: period, rsi: firstRSI });

    // 后续: Wilder 平滑
    for (let i = period + 1; i < closes.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

      let rsiVal;
      if (avgLoss === 0) {
        rsiVal = 100;
      } else if (avgGain === 0) {
        rsiVal = 0;
      } else {
        const rs = avgGain / avgLoss;
        rsiVal = 100 - 100 / (1 + rs);
      }
      results.push({ idx: i, rsi: rsiVal });
    }

    // 构建输出 (对齐日期)
    for (const r of results) {
      values.push({
        date: data[r.idx].date,
        rsi: Math.round(r.rsi * 100) / 100
      });
    }

    // 信号检测
    const signals = [];
    const lastVal = values[values.length - 1];
    if (lastVal) {
      if (lastVal.rsi > overbought) {
        signals.push({ type: "overbought", text: `RSI ${lastVal.rsi.toFixed(1)} (超买>${overbought})`, level: "warn" });
      } else if (lastVal.rsi < oversold) {
        signals.push({ type: "oversold", text: `RSI ${lastVal.rsi.toFixed(1)} (超卖<${oversold})`, level: "warn" });
      } else {
        signals.push({ type: "normal", text: `RSI ${lastVal.rsi.toFixed(1)} (正常)`, level: "info" });
      }
    }

    return { values, signals };
  },

  // ============================================================
  // MACD — 指数移动平均收敛/发散
  // ============================================================
  /**
   * @param {Array} data - K线数据 (升序)
   * @param {Object} params - { fast_period, slow_period, signal_period }
   * @returns {Object} { values: [{date, dif, dea, hist}], signals: [...] }
   */
  macd(data, { fast_period = 12, slow_period = 26, signal_period = 9 } = {}) {
    if (data.length < slow_period + signal_period) {
      return { values: [], signals: [], error: "数据不足" };
    }

    const closes = data.map(d => d.close);

    // EMA 计算 (SMA 初始化)
    function calcEMA(values, period) {
      const ema = new Array(values.length).fill(null);
      if (values.length < period) return ema;

      // 初始值: 前 period 个的 SMA
      let sma = 0;
      for (let i = 0; i < period; i++) {
        sma += values[i];
      }
      sma /= period;
      ema[period - 1] = sma;

      // 后续 EMA
      const alpha = 2 / (period + 1);
      for (let i = period; i < values.length; i++) {
        ema[i] = alpha * values[i] + (1 - alpha) * ema[i - 1];
      }
      return ema;
    }

    const emaFast = calcEMA(closes, fast_period);
    const emaSlow = calcEMA(closes, slow_period);

    // DIF = EMA_fast - EMA_slow
    const dif = new Array(closes.length).fill(null);
    for (let i = 0; i < closes.length; i++) {
      if (emaFast[i] !== null && emaSlow[i] !== null) {
        dif[i] = emaFast[i] - emaSlow[i];
      }
    }

    // DEA = EMA(DIF, signal_period), 用 DIF 的非 null 部分计算
    const difValid = dif.filter(v => v !== null);
    const difStartIdx = dif.indexOf(dif.find(v => v !== null));
    const deaValid = calcEMA(difValid, signal_period);

    const dea = new Array(closes.length).fill(null);
    const deaStart = difStartIdx + signal_period - 1;
    for (let i = 0; i < deaValid.length; i++) {
      if (deaValid[i] !== null) {
        dea[difStartIdx + i] = deaValid[i];
      }
    }

    // 柱状图 = DIF - DEA
    const hist = new Array(closes.length).fill(null);
    for (let i = 0; i < closes.length; i++) {
      if (dif[i] !== null && dea[i] !== null) {
        hist[i] = dif[i] - dea[i];
      }
    }

    // 构建输出
    const values = [];
    for (let i = 0; i < closes.length; i++) {
      if (dif[i] !== null && dea[i] !== null) {
        values.push({
          date: data[i].date,
          dif: Math.round(dif[i] * 10000) / 10000,
          dea: Math.round(dea[i] * 10000) / 10000,
          hist: Math.round(hist[i] * 10000) / 10000
        });
      }
    }

    // 信号检测: 金叉/死叉
    const signals = [];
    if (values.length >= 2) {
      const last = values[values.length - 1];
      const prev = values[values.length - 2];

      // 检查最近金叉/死叉
      let crossType = null;
      let crossDays = 0;
      for (let i = values.length - 1; i >= 1; i--) {
        const cur = values[i];
        const p = values[i - 1];
        if (p.dif <= p.dea && cur.dif > cur.dea) {
          crossType = "golden";
          crossDays = values.length - 1 - i;
          break;
        }
        if (p.dif >= p.dea && cur.dif < cur.dea) {
          crossType = "death";
          crossDays = values.length - 1 - i;
          break;
        }
      }

      if (crossType === "golden") {
        signals.push({
          type: "golden_cross",
          text: `MACD 金叉 (${crossDays === 0 ? "今日" : crossDays + "天前"})`,
          level: crossDays <= 3 ? "buy" : "info"
        });
      } else if (crossType === "death") {
        signals.push({
          type: "death_cross",
          text: `MACD 死叉 (${crossDays === 0 ? "今日" : crossDays + "天前"})`,
          level: crossDays <= 3 ? "sell" : "info"
        });
      } else {
        if (last.dif > last.dea) {
          signals.push({ type: "bullish", text: "MACD 多头排列 (DIF>DEA)", level: "info" });
        } else {
          signals.push({ type: "bearish", text: "MACD 空头排列 (DIF<DEA)", level: "info" });
        }
      }

      // 零轴位置
      if (last.dif > 0 && last.dea > 0) {
        signals.push({ type: "zero_above", text: "DIF/DEA 均在零轴上方", level: "info" });
      } else if (last.dif < 0 && last.dea < 0) {
        signals.push({ type: "zero_below", text: "DIF/DEA 均在零轴下方", level: "info" });
      }
    }

    return { values, signals };
  },

  // ============================================================
  // Bollinger Bands — 布林带
  // ============================================================
  /**
   * @param {Array} data - K线数据 (升序)
   * @param {Object} params - { period, std_dev }
   * @returns {Object} { values: [{date, upper, mid, lower, width, pct_b}], signals: [...] }
   */
  bollinger(data, { period = 20, std_dev = 2.0 } = {}) {
    if (data.length < period) {
      return { values: [], signals: [], error: "数据不足" };
    }

    const closes = data.map(d => d.close);
    const values = [];

    for (let i = period - 1; i < closes.length; i++) {
      // 中轨: SMA
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += closes[j];
      }
      const mid = sum / period;

      // 标准差
      let sqSum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sqSum += Math.pow(closes[j] - mid, 2);
      }
      const std = Math.sqrt(sqSum / period);

      const upper = mid + std_dev * std;
      const lower = mid - std_dev * std;
      const width = mid !== 0 ? ((upper - lower) / mid) * 100 : 0;
      const range = upper - lower;
      const pctB = range !== 0 ? ((closes[i] - lower) / range) * 100 : 50;

      values.push({
        date: data[i].date,
        upper: Math.round(upper * 100) / 100,
        mid: Math.round(mid * 100) / 100,
        lower: Math.round(lower * 100) / 100,
        width: Math.round(width * 100) / 100,
        pct_b: Math.round(pctB * 100) / 100
      });
    }

    // 信号检测
    const signals = [];
    if (values.length > 0) {
      const last = values[values.length - 1];
      const lastClose = closes[closes.length - 1];

      // 触及轨道
      if (lastClose >= last.upper) {
        signals.push({ type: "touch_upper", text: `价格触及上轨 (${lastClose.toFixed(2)} ≥ ${last.upper.toFixed(2)})`, level: "warn" });
      } else if (lastClose <= last.lower) {
        signals.push({ type: "touch_lower", text: `价格触及下轨 (${lastClose.toFixed(2)} ≤ ${last.lower.toFixed(2)})`, level: "warn" });
      } else {
        signals.push({ type: "normal", text: `价格在中轨附近 (%B=${last.pct_b.toFixed(1)}%)`, level: "info" });
      }

      // 带宽收窄检测
      if (values.length >= 60) {
        const recentWidths = values.slice(-60).map(v => v.width);
        const minWidth = Math.min(...recentWidths);
        const maxWidth = Math.max(...recentWidths);
        const avgWidth = recentWidths.reduce((a, b) => a + b, 0) / recentWidths.length;

        if (last.width < avgWidth * 0.6) {
          signals.push({ type: "squeeze", text: `布林带收窄 (带宽${last.width.toFixed(1)}% < 均值${avgWidth.toFixed(1)}%)`, level: "warn" });
        } else if (last.width > maxWidth * 0.8) {
          signals.push({ type: "expansion", text: `布林带扩张 (带宽${last.width.toFixed(1)}%)`, level: "info" });
        } else {
          signals.push({ type: "normal_width", text: `带宽正常 (${last.width.toFixed(1)}%)`, level: "info" });
        }
      }
    }

    return { values, signals };
  },

  // ============================================================
  // ATR — 平均真实波幅 (Wilder 平滑法)
  // ============================================================
  /**
   * @param {Array} data - K线数据 (升序)
   * @param {Object} params - { period, stop_multiplier }
   * @returns {Object} { values: [{date, tr, atr, stop_long, stop_short}], signals: [...] }
   */
  atr(data, { period = 14, stop_multiplier = 2.0 } = {}) {
    if (data.length < period + 1) {
      return { values: [], signals: [], error: "数据不足" };
    }

    // Step 1: 计算每日 TR
    const trs = [null]; // 第一天无 TR
    for (let i = 1; i < data.length; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const prevClose = data[i - 1].close;
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trs.push(tr);
    }

    // Step 2: Wilder 平滑
    // 首次: 前 period 天 TR 的简单平均
    let atrVal = 0;
    for (let i = 1; i <= period; i++) {
      atrVal += trs[i];
    }
    atrVal /= period;

    const results = [];
    results.push({
      idx: period,
      tr: trs[period],
      atr: atrVal,
      stop_long: data[period].close - stop_multiplier * atrVal,
      stop_short: data[period].close + stop_multiplier * atrVal
    });

    // 后续: Wilder 平滑
    for (let i = period + 1; i < data.length; i++) {
      atrVal = (atrVal * (period - 1) + trs[i]) / period;
      results.push({
        idx: i,
        tr: trs[i],
        atr: atrVal,
        stop_long: data[i].close - stop_multiplier * atrVal,
        stop_short: data[i].close + stop_multiplier * atrVal
      });
    }

    // 构建输出
    const values = results.map(r => ({
      date: data[r.idx].date,
      tr: Math.round(r.tr * 10000) / 10000,
      atr: Math.round(r.atr * 10000) / 10000,
      stop_long: Math.round(r.stop_long * 10000) / 10000,
      stop_short: Math.round(r.stop_short * 10000) / 10000
    }));

    // 信号检测
    const signals = [];
    if (values.length > 0) {
      const last = values[values.length - 1];

      // 与近期 ATR 比较
      if (values.length >= 20) {
        const recentATRs = values.slice(-20).map(v => v.atr);
        const avgATR = recentATRs.reduce((a, b) => a + b, 0) / recentATRs.length;
        const maxATR = Math.max(...recentATRs);

        if (last.atr > avgATR * 1.3) {
          signals.push({ type: "high_volatility", text: `ATR ${last.atr.toFixed(2)} (偏高, >均值30%)`, level: "warn" });
        } else if (last.atr < avgATR * 0.7) {
          signals.push({ type: "low_volatility", text: `ATR ${last.atr.toFixed(2)} (偏低, <均值30%)`, level: "info" });
        } else {
          signals.push({ type: "normal", text: `ATR ${last.atr.toFixed(2)} (正常)`, level: "info" });
        }
      } else {
        signals.push({ type: "normal", text: `ATR ${last.atr.toFixed(2)}`, level: "info" });
      }

      // 止损位
      const lastClose = data[data.length - 1].close;
      signals.push({
        type: "stop_loss",
        text: `多头止损: ${last.stop_long.toFixed(2)} (−${stop_multiplier}×ATR)`,
        level: "info"
      });
    }

    return { values, signals };
  }
};

// 导出 (支持浏览器全局和模块)
if (typeof module !== "undefined" && module.exports) {
  module.exports = IndicatorEngine;
}
