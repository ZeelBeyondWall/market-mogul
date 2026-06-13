import { View, Text, FlatList, StyleSheet } from 'react-native';
import { fmt } from '../engine/helpers';
import { useGame } from '../store/game';
import { useLiveTick } from '../hooks/useLiveTick';
import { COLORS } from '../config';

const MEDAL = ['🥇', '🥈', '🥉'];

function returnPct(e: { net: number; bornNet?: number }): number {
  const base = e.bornNet || 10000;
  return ((e.net - base) / base) * 100;
}

export function LeaderboardScreen() {
  const leaderboard = useGame((s) => s.leaderboard);
  const rank = useGame((s) => s.rank);
  const total = useGame((s) => s.totalTraders);
  useLiveTick();

  const top = leaderboard.slice(0, 50);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>LEADERBOARD</Text>
        <Text style={styles.yourRank}>You: #{rank || '—'} / {total || '—'}</Text>
      </View>
      <FlatList
        data={top}
        keyExtractor={(e, i) => String(e.id) + i}
        removeClippedSubviews
        initialNumToRender={15}
        windowSize={6}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={<Text style={styles.empty}>Loading rankings…</Text>}
        renderItem={({ item, index }) => {
          const pct = returnPct(item);
          const up = pct >= 0;
          const r = index + 1;
          return (
            <View style={[styles.row, item.isPlayer && styles.rowMe]}>
              <View style={styles.rankCol}>
                <Text style={styles.rankTxt}>{r <= 3 ? MEDAL[r - 1] : r}</Text>
              </View>
              <View style={styles.avatar}><Text style={styles.avatarTxt}>{(item.name || '?')[0].toUpperCase()}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}{item.isPlayer ? ' (You)' : ''}
                </Text>
                <Text style={styles.sub}>Lvl {item.level}{item.rekt ? ' · REKT' : ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.net}>{fmt(item.net)}</Text>
                <Text style={[styles.ret, { color: up ? COLORS.green : COLORS.red }]}>
                  {up ? '▲' : '▼'} {Math.abs(pct) >= 1000 ? (pct / 1000).toFixed(1) + 'K' : pct.toFixed(1)}%
                </Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 12, paddingTop: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  header: { color: COLORS.gold, fontWeight: '800', fontSize: 13, letterSpacing: 1.5 },
  yourRank: { color: COLORS.cyan, fontSize: 11, fontWeight: '700' },
  empty: { color: COLORS.dim, textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.borderDim,
    borderRadius: 11, padding: 9, marginBottom: 7,
  },
  rowMe: { borderColor: COLORS.gold },
  rankCol: { width: 26, alignItems: 'center' },
  rankTxt: { color: COLORS.dim, fontWeight: '800', fontSize: 14 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.panelRaise, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: COLORS.cyan, fontWeight: '800', fontSize: 14 },
  name: { color: '#fff', fontWeight: '700', fontSize: 13 },
  sub: { color: COLORS.dim, fontSize: 10, marginTop: 2 },
  net: { color: '#fff', fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] },
  ret: { fontSize: 10.5, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
});
