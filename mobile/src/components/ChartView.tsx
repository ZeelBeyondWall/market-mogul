import { useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Canvas, Rect, Line, vec } from '@shopify/react-native-skia';
import { useGame } from '../store/game';
import { COLORS } from '../config';

const GREEN = '#2fa874';
const RED = '#dd4f60';
const HEIGHT = 260;
const PAD_T = 10;
const PAD_B = 10;
const VISIBLE = 40;

export function ChartView() {
  const engine = useGame((s) => s.engine);
  const tf = useGame((s) => s.activeTF);
  useGame((s) => s.dataTick); // redraw on each tick
  const [w, setW] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  const ast = engine.state.assets[engine.state.active];
  const series = ast?.series?.[tf];
  const all = series ? series.candles.concat(series.curCandle ? [series.curCandle] : []) : [];
  const visible = all.slice(-VISIBLE);

  let content: React.ReactNode = null;
  if (w > 0 && visible.length > 1) {
    let lo = Infinity, hi = -Infinity;
    visible.forEach((c) => { lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); });
    if (!isFinite(lo) || lo === hi) {
      const p = ast?.lastPrice ?? 1;
      lo = p * 0.99; hi = p * 1.01;
    }
    const pad = (hi - lo) * 0.1 || 1;
    lo -= pad; hi += pad;
    const range = hi - lo || 1;
    const ch = HEIGHT - PAD_T - PAD_B;
    const cw = w / visible.length;
    const bw = cw * 0.62;
    const y = (p: number) => PAD_T + ch - ((p - lo) / range) * ch;

    content = (
      <>
        {visible.map((c, i) => {
          const cx = i * cw + cw / 2;
          const green = c.c >= c.o;
          const col = green ? GREEN : RED;
          const top = y(Math.max(c.o, c.c));
          const bot = y(Math.min(c.o, c.c));
          return (
            <Line key={`w${i}`} p1={vec(cx, y(c.h))} p2={vec(cx, y(c.l))} color={col} strokeWidth={1} />
          );
        })}
        {visible.map((c, i) => {
          const cx = i * cw + cw / 2;
          const green = c.c >= c.o;
          const col = green ? GREEN : RED;
          const top = y(Math.max(c.o, c.c));
          const bot = y(Math.min(c.o, c.c));
          return (
            <Rect key={`b${i}`} x={cx - bw / 2} y={top} width={bw} height={Math.max(1, bot - top)} color={col} />
          );
        })}
      </>
    );
  }

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <Canvas style={{ width: '100%', height: HEIGHT }}>{content}</Canvas>
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
