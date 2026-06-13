import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { ASSETS } from '../engine/constants';
import { fmt, fmtPct, fmtNum } from '../engine/helpers';
import { useGame } from '../store/game';
import { send } from '../net/ws';
import { COLORS } from '../config';

export function PositionsScreen() {
  const engine = useGame((s) => s.engine);
  useGame((s) => s.dataTick);

  const p = engine.player();
  const cash = p.cash;
  const rows = Object.keys(p.holdings)
    .map((aid) => {
      const h = p.holdings[aid];
      const ast = engine.state.assets[aid];
      const def = ASSETS.find((a) => a.id === aid);
      if (!h || h.shares === 0 || !ast || !def) return null;
      const val = Math.abs(h.shares) * ast.lastPrice;
      const unreal = h.shares > 0
        ? h.shares * (ast.lastPrice - h.avgCost)
        : -h.shares * (h.avgCost - ast.lastPrice);
      const unrealPct = (unreal / (Math.abs(h.shares) * h.avgCost)) * 100;
      return { aid, name: def.name, shares: h.shares, avgCost: h.avgCost, last: ast.lastPrice, val, unreal, unrealPct };
    })
    .filter(Boolean) as any[];

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.sumLbl}>CASH</Text>
        <Text style={styles.sumVal}>{fmt(cash)}</Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.aid}
        ListEmptyComponent={<Text style={styles.empty}>No open positions. Buy something from Trade.</Text>}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => {
          const up = item.unreal >= 0;
          const isLong = item.shares > 0;
          return (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.tag, { color: isLong ? COLORS.green : COLORS.red }]}>{isLong ? 'LONG' : 'SHORT'}</Text>
                </View>
                <Text style={styles.sub}>{fmtNum(Math.abs(item.shares))} sh @ {fmt(item.avgCost)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                <Text style={styles.val}>{fmt(item.val)}</Text>
                <Text style={[styles.pnl, { color: up ? COLORS.green : COLORS.red }]}>
                  {up ? '+' : ''}{fmt(item.unreal)} ({fmtPct(item.unrealPct)})
                </Text>
              </View>
              <Pressable style={styles.closeBtn} onPress={() => send({ type: 'close', payload: { aid: item.aid } })}>
                <Text style={styles.closeTxt}>CLOSE</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 12, paddingTop: 8 },
  summary: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingVertical: 12 },
  sumLbl: { color: COLORS.dim, fontSize: 11, fontWeight: '700' },
  sumVal: { color: '#fff', fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  empty: { color: COLORS.dim, textAlign: 'center', marginTop: 40, fontSize: 13 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.borderDim,
    borderRadius: 12, padding: 10, marginBottom: 8,
  },
  name: { color: '#fff', fontWeight: '700', fontSize: 14 },
  tag: { fontSize: 8.5, fontWeight: '800' },
  sub: { color: COLORS.dim, fontSize: 10.5, marginTop: 3 },
  val: { color: '#fff', fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] },
  pnl: { fontSize: 10.5, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  closeBtn: { backgroundColor: COLORS.panelRaise, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  closeTxt: { color: COLORS.red, fontWeight: '800', fontSize: 11 },
});
