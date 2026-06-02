import { calcEMA, calcRSI } from '../../../shared/engine/helpers';

// v10: Client-side technical indicator computations for chart overlay.

export interface ChartIndicators {
  sma20: number[];
  ema12: number[];
  ema26: number[];
  rsi: number[];
  macd: number[];
  macdSignal: number[];
  macdHist: number[];
  bbUpper: number[];
  bbMiddle: number[];
  bbLower: number[];
}

export type IndicatorId = 'sma' | 'ema' | 'rsi' | 'macd' | 'bb';

export function computeIndicators(prices: number[]): ChartIndicators {
  const len = prices.length;
  const sma20: number[] = [];
  const ema12: number[] = [];
  const ema26: number[] = [];
  const rsi: number[] = [];
  const macd: number[] = [];
  const macdSignal: number[] = [];
  const macdHist: number[] = [];
  const bbUpper: number[] = [];
  const bbMiddle: number[] = [];
  const bbLower: number[] = [];

  let ema12Val: number | null = null;
  let ema26Val: number | null = null;
  let macdSignalVal: number | null = null;

  for (let i = 0; i < len; i++) {
    const p = prices[i];

    // SMA 20
    if (i >= 19) {
      let sum = 0;
      for (let j = i - 19; j <= i; j++) sum += prices[j];
      sma20.push(sum / 20);
    } else {
      sma20.push(NaN);
    }

    // EMA 12 & 26
    ema12Val = calcEMA(ema12Val, p, 2 / 13);
    ema26Val = calcEMA(ema26Val, p, 2 / 27);
    ema12.push(ema12Val);
    ema26.push(ema26Val);

    // MACD = EMA12 - EMA26
    const macdVal = ema12Val - ema26Val;
    macd.push(macdVal);
    macdSignalVal = calcEMA(macdSignalVal, macdVal, 2 / 10);
    macdSignal.push(macdSignalVal);
    macdHist.push(macdVal - macdSignalVal);

    // RSI 14
    if (i >= 14) {
      const slice = prices.slice(i - 14, i + 1);
      rsi.push(calcRSI(slice));
    } else {
      rsi.push(50);
    }

    // Bollinger Bands (20-period, 2 std dev)
    if (i >= 19) {
      let sum = 0;
      for (let j = i - 19; j <= i; j++) sum += prices[j];
      const mean = sum / 20;
      let variance = 0;
      for (let j = i - 19; j <= i; j++) {
        const d = prices[j] - mean;
        variance += d * d;
      }
      const std = Math.sqrt(variance / 20);
      bbMiddle.push(mean);
      bbUpper.push(mean + 2 * std);
      bbLower.push(mean - 2 * std);
    } else {
      bbMiddle.push(NaN);
      bbUpper.push(NaN);
      bbLower.push(NaN);
    }
  }

  return { sma20, ema12, ema26, rsi, macd, macdSignal, macdHist, bbUpper, bbMiddle, bbLower };
}
