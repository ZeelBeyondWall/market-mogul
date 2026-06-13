import { useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Image } from 'react-native';
import { ASSETS } from '../engine/constants';
import { fmt, fmtPct } from '../engine/helpers';
import { useGame } from '../store/game';
import { useLiveTick } from '../hooks/useLiveTick';
import { setActiveAsset } from '../net/ws';
import { COLORS } from '../config';

const FILTERS = [
  { key: 'all', label: 'All', market: null },
  { key: 'stocks', label: 'Stocks', market: 'stocks' },
  { key: 'crypto', label: 'Crypto', market: 'crypto' },
  { key: 'forex', label: 'Forex', market: 'forex' },
] as const;

export function MarketsScreen({ navigation }: any) {
  const engine = useGame((s) => s.engine);
  useLiveTick(); // re-render on data updates, only while this tab is focused
  const [filter, setFilter] = useState<string>('all');

  const market = FILTERS.find((f) => f.key === filter)?.market ?? null;
  const rows = ASSETS.filter((a) => !market || a.market === market).map((a) => {
    const ast = engine.state.assets[a.id];
    const chg = ast ? ((ast.lastPrice - ast.open) / (ast.open || 1)) * 100 : 0;
    return { a, price: ast?.lastPrice ?? 0, chg };
  });

  return (
    <View style={styles.container}>
      <Text style={styles.header}>MARKETS</Text>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.filterBtn, filter === f.key && styles.filterOn]}>
            <Text style={[styles.filterTxt, filter === f.key && styles.filterTxtOn]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.a.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        removeClippedSubviews
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={5}
        renderItem={({ item }) => {
          const up = item.chg >= 0;
          return (
            <Pressable
              style={styles.row}
              onPress={() => {
                setActiveAsset(item.a.id);
                navigation.navigate('Trade');
              }}
            >
              <Image
                source={{ uri: `http://52.66.176.80/assets/logos/${item.a.id}.webp` }}
                style={styles.logo}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{item.a.name}</Text>
                <Text style={styles.tkr}>{item.a.id}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.price}>{fmt(item.price, item.price < 10 ? 3 : 2)}</Text>
                <Text style={[styles.chg, { color: up ? COLORS.green : COLORS.red }]}>
                  {up ? '▲' : '▼'} {fmtPct(item.chg)}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 12, paddingTop: 8 },
  header: { color: COLORS.gold, fontWeight: '800', fontSize: 13, letterSpacing: 1.5, marginTop: 10, marginBottom: 8 },
  filters: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  filterBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.borderDim, alignItems: 'center' },
  filterOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  filterTxt: { color: COLORS.dim, fontSize: 12, fontWeight: '700' },
  filterTxtOn: { color: '#0a0a14' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.borderDim,
    borderRadius: 12, padding: 10, marginBottom: 8,
  },
  logo: { width: 34, height: 34, borderRadius: 8, backgroundColor: COLORS.panelRaise },
  name: { color: '#fff', fontWeight: '700', fontSize: 14 },
  tkr: { color: COLORS.dim, fontSize: 10, marginTop: 2, fontWeight: '700' },
  price: { color: '#fff', fontWeight: '800', fontSize: 14, fontVariant: ['tabular-nums'] },
  chg: { fontSize: 11, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
});
