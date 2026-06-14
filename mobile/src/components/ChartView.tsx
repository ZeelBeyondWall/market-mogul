import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Line, Polyline } from 'react-native-svg';
import { computeIndicators } from '../utils/indicators';
import { useGame } from '../store/game';
import { useLiveTick } from '../hooks/useLiveTick';
import { COLORS } from '../config';

const GREEN = '#2fa874';
const RED = '#dd4f60';
const HEIGHT = 230;
const PAD = 6;
const VISIBLE = 40;
// Trade screen has 12px horizontal padding each side; chart fills the rest.
const W = Dimensions.get('window').width - 24;

export function ChartView() {
  const engine = useGame((s) => s.engine);
  const tf = useGame((s) => s.activeTF);
  const inds = useGame((s) => s.activeIndicators);
  useLiveTick();
  const w = W;

  const ast = engine.state.assets[engine.state.active];
  const series = ast?.series?.[tf];
  const all = series ? series.candles.concat(series.curCandle ? [series.curCandle] : []) : [];
  const visible = all.slice(-VISIBLE);

  const hasRsi = inds.includes('rsi') || inds.includes('macd');
  const subH = hasRsi ? 52 : 0;
  const mainH = HEIGHT - subH;

  if (visible.length < 2) {
    return (
      <View style={[styles.wrap, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: COLORS.dim, fontSize: 12 }}>Building candles… ({all.length})</Text>
      </View>
    );
  }

  const closes = visible.map((c) => c.c);
  const ind = inds.length ? computeIndicators(closes) : null;

  // price range (include visible BB/SMA/EMA so overlays fit)
  let lo = Infinity, hi = -Infinity;
  visible.forEach((c) => { lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); });
  if (ind) {
    const extra = [
      ...(inds.includes('bb') ? ind.bbUpper.concat(ind.bbLower) : []),
      ...(inds.includes('sma') ? ind.sma20 : []),
      ...(inds.includes('ema') ? ind.ema12.concat(ind.ema26) : []),
    ];
    extra.forEach((v) => { if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
  }
  if (!isFinite(lo) || lo === hi) { const p = ast?.lastPrice ?? 1; lo = p * 0.99; hi = p * 1.01; }
  const pad = (hi - lo) * 0.08 || 1;
  lo -= pad; hi += pad;
  const range = hi - lo || 1;

  const innerW = w - PAD * 2;
  const cw = innerW / visible.length;
  const bw = cw * 0.62;
  const ch = mainH - PAD * 2;
  const x = (i: number) => PAD + i * cw + cw / 2;
  const y = (p: number) => PAD + ch - ((p - lo) / range) * ch;

  const polyline = (arr: number[], color: string, sw = 1.5) => {
    let pts = '';
    arr.forEach((v, i) => { if (isFinite(v)) pts += `${x(i)},${y(v)} `; });
    return pts ? <Polyline key={color} points={pts.trim()} fill="none" stroke={color} strokeWidth={sw} /> : null;
  };

  return (
    <View style={styles.wrap}>
      <Svg width={w} height={HEIGHT}>
        {/* candles */}
        {visible.map((c, i) => {
          const cx = x(i);
          const green = c.c >= c.o;
          const col = green ? GREEN : RED;
          const top = y(Math.max(c.o, c.c));
          const bot = y(Math.min(c.o, c.c));
          return (
            <React.Fragment key={i}>
              <Line x1={cx} y1={y(c.h)} x2={cx} y2={y(c.l)} stroke={col} strokeWidth={1} />
              <Rect x={cx - bw / 2} y={top} width={bw} height={Math.max(1, bot - top)} fill={col} />
            </React.Fragment>
          );
        })}
        {/* overlays */}
        {ind && inds.includes('bb') && polyline(ind.bbUpper, 'rgba(138,43,226,0.7)', 1)}
        {ind && inds.includes('bb') && polyline(ind.bbLower, 'rgba(138,43,226,0.7)', 1)}
        {ind && inds.includes('sma') && polyline(ind.sma20, '#f5a623')}
        {ind && inds.includes('ema') && polyline(ind.ema12, '#00d4ff')}
        {ind && inds.includes('ema') && polyline(ind.ema26, '#ff6b9d')}

        {/* RSI sub-panel */}
        {ind && hasRsi && (() => {
          const sy0 = mainH + 4;
          const sH = subH - 8;
          const ry = (v: number) => sy0 + sH - (v / 100) * sH;
          let pts = '';
          ind.rsi.forEach((v, i) => { if (isFinite(v)) pts += `${x(i)},${ry(v)} `; });
          return (
            <React.Fragment>
              <Line x1={PAD} y1={ry(70)} x2={w - PAD} y2={ry(70)} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
              <Line x1={PAD} y1={ry(30)} x2={w - PAD} y2={ry(30)} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
              {pts ? <Polyline points={pts.trim()} fill="none" stroke="#e2b93d" strokeWidth={1.3} /> : null}
            </React.Fragment>
          );
        })()}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: HEIGHT,
    backgroundColor: '#030816',
    borderWidth: 1,
    borderColor: COLORS.borderDim,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
