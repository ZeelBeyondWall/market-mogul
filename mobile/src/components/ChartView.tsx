import { View, StyleSheet } from 'react-native';
import { useGame } from '../store/game';
import { COLORS } from '../config';

const GREEN = '#2fa874';
const RED = '#dd4f60';
const HEIGHT = 220;
const VISIBLE = 40;

// Pure React Native chart (no native chart lib). Renders the recent candles as
// thin bars from open→close so the price action is visible. A proper
// candlestick chart can be layered back in once the native build is stable.
export function ChartView() {
  const engine = useGame((s) => s.engine);
  const tf = useGame((s) => s.activeTF);
  useGame((s) => s.dataTick);

  const ast = engine.state.assets[engine.state.active];
  const series = ast?.series?.[tf];
  const all = series ? series.candles.concat(series.curCandle ? [series.curCandle] : []) : [];
  const visible = all.slice(-VISIBLE);

  let lo = Infinity;
  let hi = -Infinity;
  visible.forEach((c) => { lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); });
  if (!isFinite(lo) || lo === hi) {
    const p = ast?.lastPrice ?? 1;
    lo = p * 0.99; hi = p * 1.01;
  }
  const range = hi - lo || 1;
  const pct = (p: number) => ((p - lo) / range) * 100;

  return (
    <View style={styles.wrap}>
      {visible.length < 2 ? (
        <View style={styles.empty} />
      ) : (
        <View style={styles.bars}>
          {visible.map((c, i) => {
            const green = c.c >= c.o;
            const top = 100 - pct(Math.max(c.o, c.c));
            const bodyH = Math.max(1, pct(Math.max(c.o, c.c)) - pct(Math.min(c.o, c.c)));
            const wickTop = 100 - pct(c.h);
            const wickH = Math.max(1, pct(c.h) - pct(c.l));
            return (
              <View key={i} style={styles.col}>
                {/* wick */}
                <View style={[styles.wick, { top: `${wickTop}%`, height: `${wickH}%`, backgroundColor: green ? GREEN : RED }]} />
                {/* body */}
                <View style={[styles.body, { top: `${top}%`, height: `${bodyH}%`, backgroundColor: green ? GREEN : RED }]} />
              </View>
            );
          })}
        </View>
      )}
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
    padding: 6,
  },
  empty: { flex: 1 },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  col: { flex: 1, position: 'relative', marginHorizontal: 0.5 },
  wick: { position: 'absolute', left: '50%', width: 1, marginLeft: -0.5 },
  body: { position: 'absolute', left: '15%', right: '15%' },
});
