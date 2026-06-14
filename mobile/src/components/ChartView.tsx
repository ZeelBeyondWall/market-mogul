import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { computeIndicators } from '../utils/indicators';
import { useGame } from '../store/game';
import { useLiveTick } from '../hooks/useLiveTick';
import { COLORS } from '../config';

// Pure React Native chart (Views only) — no SVG/Skia native module, so it can't
// hit "No ViewManager" build issues and updates on a plain JS reload.
// Candles are drawn as absolutely-positioned bars; indicator overlays as a row
// of small dots (a dotted line). RSI/MACD render in a sub-panel.

const GREEN = '#2fa874';
const RED = '#dd4f60';
const HEIGHT = 230;
const PAD = 6;
const VISIBLE = 40;
const W = Dimensions.get('window').width - 24;

export function ChartView() {
  const engine = useGame((s) => s.engine);
  const tf = useGame((s) => s.activeTF);
  const inds = useGame((s) => s.activeIndicators);
  useLiveTick();

  const ast = engine.state.assets[engine.state.active];
  const series = ast?.series?.[tf];
  const all = series ? series.candles.concat(series.curCandle ? [series.curCandle] : []) : [];
  const visible = all.slice(-VISIBLE);

  const hasSub = inds.includes('rsi') || inds.includes('macd');
  const subH = hasSub ? 50 : 0;
  const mainH = HEIGHT - subH;

  if (visible.length < 2) {
    return (
      <View style={[styles.wrap, styles.center]}>
        <Text style={styles.waiting}>Building candles… ({all.length})</Text>
      </View>
    );
  }

  const closes = visible.map((c) => c.c);
  const ind = inds.length ? computeIndicators(closes) : null;

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

  const innerW = W - PAD * 2;
  const cw = innerW / visible.length;
  const bw = Math.max(2, cw * 0.62);
  const ch = mainH - PAD * 2;
  const cx = (i: number) => PAD + i * cw + cw / 2;
  const y = (p: number) => PAD + ch - ((p - lo) / range) * ch;

  const dots = (arr: number[], color: string) =>
    arr.map((v, i) => (isFinite(v) ? <View key={`${color}${i}`} style={[styles.dot, { left: cx(i) - 1, top: y(v) - 1, backgroundColor: color }]} /> : null));

  return (
    <View style={styles.wrap}>
      {/* candles */}
      {visible.map((c, i) => {
        const x = cx(i);
        const green = c.c >= c.o;
        const col = green ? GREEN : RED;
        const top = y(Math.max(c.o, c.c));
        const bot = y(Math.min(c.o, c.c));
        return (
          <React.Fragment key={i}>
            <View style={{ position: 'absolute', left: x - 0.5, top: y(c.h), width: 1, height: Math.max(1, y(c.l) - y(c.h)), backgroundColor: col }} />
            <View style={{ position: 'absolute', left: x - bw / 2, top, width: bw, height: Math.max(1, bot - top), backgroundColor: col, borderRadius: 1 }} />
          </React.Fragment>
        );
      })}

      {/* overlays */}
      {ind && inds.includes('bb') && dots(ind.bbUpper, 'rgba(138,43,226,0.85)')}
      {ind && inds.includes('bb') && dots(ind.bbLower, 'rgba(138,43,226,0.85)')}
      {ind && inds.includes('sma') && dots(ind.sma20, '#f5a623')}
      {ind && inds.includes('ema') && dots(ind.ema12, '#00d4ff')}
      {ind && inds.includes('ema') && dots(ind.ema26, '#ff6b9d')}

      {/* RSI sub-panel */}
      {ind && hasSub && (() => {
        const sy0 = mainH + 2;
        const sH = subH - 6;
        const ry = (v: number) => sy0 + sH - (v / 100) * sH;
        return (
          <>
            <View style={{ position: 'absolute', left: PAD, right: PAD, top: ry(70), height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
            <View style={{ position: 'absolute', left: PAD, right: PAD, top: ry(30), height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
            {ind.rsi.map((v, i) => (isFinite(v) ? <View key={`r${i}`} style={[styles.dot, { left: cx(i) - 1, top: ry(v) - 1, backgroundColor: '#e2b93d' }]} /> : null))}
            <Text style={styles.subLbl}>RSI</Text>
          </>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: HEIGHT,
    width: W,
    backgroundColor: '#030816',
    borderWidth: 1,
    borderColor: COLORS.borderDim,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  waiting: { color: COLORS.dim, fontSize: 12 },
  dot: { position: 'absolute', width: 2.5, height: 2.5, borderRadius: 2 },
  subLbl: { position: 'absolute', left: 6, top: HEIGHT - 50 + 2, color: '#94a3b8', fontSize: 8, fontWeight: '700' },
});
