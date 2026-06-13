import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { ASSETS } from '../engine/constants';
import { fmt, fmtPct } from '../engine/helpers';
import { useGame } from '../store/game';
import { useLiveTick } from '../hooks/useLiveTick';
import { supabase } from '../net/supabase';
import { COLORS } from '../config';

export function AccountScreen() {
  const engine = useGame((s) => s.engine);
  const session = useGame((s) => s.session);
  useLiveTick();

  const p = engine.player();
  const cash = p.cash;
  const invested = engine.portfolioValue(0);
  const net = engine.netWorth(0);

  const positions = Object.keys(p.holdings).filter((aid) => (p.holdings[aid]?.shares || 0) !== 0);
  let unrealized = 0;
  let longs = 0;
  let shorts = 0;
  positions.forEach((aid) => {
    const h = p.holdings[aid];
    const ast = engine.state.assets[aid];
    if (!h || !ast) return;
    if (h.shares > 0) { longs++; unrealized += h.shares * (ast.lastPrice - h.avgCost); }
    else { shorts++; unrealized += -h.shares * (h.avgCost - ast.lastPrice); }
  });

  const dayStart = p.dayStartNet || 10000;
  const todayPnL = net - dayStart;
  const todayPct = (todayPnL / dayStart) * 100;
  const username = session?.user?.user_metadata?.username || session?.user?.email?.split('@')[0] || 'Trader';
  const upToday = todayPnL >= 0;
  const upUnreal = unrealized >= 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
      <Text style={styles.hi}>{username}</Text>

      <View style={styles.hero}>
        <Text style={styles.heroLbl}>NET WORTH</Text>
        <Text style={styles.heroVal}>{fmt(net)}</Text>
        <Text style={[styles.heroChg, { color: upToday ? COLORS.green : COLORS.red }]}>
          {upToday ? '▲' : '▼'} {fmt(Math.abs(todayPnL))} ({fmtPct(todayPct)}) today
        </Text>
      </View>

      <View style={styles.grid}>
        <Stat label="CASH" value={fmt(cash)} />
        <Stat label="INVESTED" value={fmt(invested)} />
        <Stat label="OPEN P&L" value={`${upUnreal ? '+' : ''}${fmt(unrealized)}`} color={upUnreal ? COLORS.green : COLORS.red} />
        <Stat label="POSITIONS" value={String(positions.length)} sub={`${longs} long · ${shorts} short`} />
      </View>

      <View style={styles.signoutWrap}>
        <Text style={styles.signout} onPress={() => supabase.auth.signOut()}>Sign Out</Text>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLbl}>{label}</Text>
      <Text style={[styles.statVal, color ? { color } : null]}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 12, paddingTop: 10 },
  hi: { color: COLORS.dim, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  hero: {
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.gold,
    borderRadius: 16, padding: 18, marginBottom: 12,
  },
  heroLbl: { color: COLORS.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  heroVal: { color: '#fff', fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 2 },
  heroChg: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    flexBasis: '47%', flexGrow: 1, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.borderDim,
    borderRadius: 12, padding: 14,
  },
  statLbl: { color: COLORS.dim, fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
  statVal: { color: '#fff', fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 4 },
  statSub: { color: COLORS.dim, fontSize: 10, marginTop: 3 },
  signoutWrap: { marginTop: 24, alignItems: 'center' },
  signout: { color: COLORS.red, fontSize: 13, fontWeight: '700', padding: 10 },
});
