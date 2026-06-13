import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { fmt, fmtPct } from '../engine/helpers';
import { useGame } from '../store/game';
import { useLiveTick } from '../hooks/useLiveTick';
import { supabase } from '../net/supabase';
import { claimMission, reconnect } from '../net/ws';
import { COLORS } from '../config';

export function AccountScreen() {
  const engine = useGame((s) => s.engine);
  const session = useGame((s) => s.session);
  const level = useGame((s) => s.level);
  const xp = useGame((s) => s.xp);
  const xpAt = useGame((s) => s.xpAtCurrent);
  const xpTo = useGame((s) => s.xpToNext);
  const rank = useGame((s) => s.rank);
  const streak = useGame((s) => s.streak);
  const gems = useGame((s) => s.gems);
  const dailyMissions = useGame((s) => s.dailyMissions);
  const events = useGame((s) => s.events);
  const recentTrades = useGame((s) => s.recentTrades);
  useLiveTick();

  const p = engine.player();
  const cash = p.cash;
  const invested = engine.portfolioValue(0);
  const net = engine.netWorth(0);

  const positions = Object.keys(p.holdings).filter((aid) => (p.holdings[aid]?.shares || 0) !== 0);
  let unrealized = 0; let longs = 0; let shorts = 0;
  positions.forEach((aid) => {
    const h = p.holdings[aid]; const ast = engine.state.assets[aid];
    if (!h || !ast) return;
    if (h.shares > 0) { longs++; unrealized += h.shares * (ast.lastPrice - h.avgCost); }
    else { shorts++; unrealized += -h.shares * (h.avgCost - ast.lastPrice); }
  });

  const dayStart = p.dayStartNet || 10000;
  const todayPnL = net - dayStart;
  const todayPct = (todayPnL / dayStart) * 100;
  const username = session?.user?.user_metadata?.username || session?.user?.email?.split('@')[0] || 'Trader';
  const pushToast = useGame((s) => s.pushToast);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);

  const saveUsername = async () => {
    const next = nameInput.trim();
    if (next.length < 2 || next.length > 20) { pushToast('Username must be 2–20 chars', 'err'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { username: next } });
      if (error) { pushToast(error.message, 'err'); return; }
      reconnect(); // server re-reads the name on the fresh auth
      setEditing(false);
      pushToast('Username updated', 'ok');
    } catch (e: any) {
      pushToast(e?.message || 'Failed to update', 'err');
    } finally {
      setSaving(false);
    }
  };

  const upToday = todayPnL >= 0;
  const upUnreal = unrealized >= 0;
  const xpPct = Math.max(0, Math.min(100, ((xp - xpAt) / Math.max(1, xpTo - xpAt)) * 100));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 36 }}>
      {/* identity */}
      <View style={styles.identity}>
        <View style={styles.lvlBadge}><Text style={styles.lvlNum}>{level}</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Pressable onPress={() => { setNameInput(username); setEditing(true); }}>
            <Text style={styles.uname} numberOfLines={1}>{username} <Text style={styles.editHint}>✎</Text></Text>
          </Pressable>
          <View style={styles.xpBar}><View style={[styles.xpFill, { width: `${xpPct}%` }]} /></View>
          <Text style={styles.xpTxt}>{Math.max(0, xp - xpAt)} / {Math.max(1, xpTo - xpAt)} XP</Text>
        </View>
      </View>

      {editing && (
        <View style={styles.editRow}>
          <TextInput
            value={nameInput}
            onChangeText={setNameInput}
            autoFocus
            autoCapitalize="none"
            maxLength={20}
            placeholder="Username"
            placeholderTextColor={COLORS.dim}
            style={styles.editInput}
          />
          <Pressable style={[styles.editSave, saving && { opacity: 0.6 }]} disabled={saving} onPress={saveUsername}>
            <Text style={styles.editSaveTxt}>{saving ? '…' : 'Save'}</Text>
          </Pressable>
          <Pressable style={styles.editCancel} onPress={() => setEditing(false)}>
            <Text style={styles.editCancelTxt}>✕</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.pills}>
        <Pill icon="🏆" text={`Rank #${rank || '—'}`} />
        <Pill icon="🔥" text={`${streak} streak`} />
        <Pill icon="💎" text={`${fmt(gems)} gems`} />
      </View>

      {/* net worth */}
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

      {/* missions */}
      <Text style={styles.section}>DAILY MISSIONS</Text>
      {dailyMissions.length === 0 ? (
        <Text style={styles.muted}>No active missions.</Text>
      ) : (
        dailyMissions.map((m: any, i: number) => {
          const target = m?.def?.goal?.target || 1;
          const prog = Math.min(target, m?.progress || 0);
          const pct = Math.min(100, (prog / target) * 100);
          const canClaim = m?.completed && !m?.claimed;
          return (
            <View key={i} style={styles.mission}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.mTitle} numberOfLines={1}>{m?.def?.title || 'Mission'}</Text>
                <View style={styles.mBar}><View style={[styles.mFill, { width: `${pct}%` }]} /></View>
                <Text style={styles.mProg}>{Math.floor(prog)} / {target}</Text>
              </View>
              {canClaim ? (
                <Pressable style={styles.claimBtn} onPress={() => claimMission(m.def.id)}>
                  <Text style={styles.claimTxt}>CLAIM</Text>
                </Pressable>
              ) : (
                <Text style={styles.mReward}>{m?.claimed ? '✓' : `+${m?.def?.reward ?? ''}`}</Text>
              )}
            </View>
          );
        })
      )}

      {/* news */}
      <Text style={styles.section}>MARKET NEWS</Text>
      {events.length === 0 ? (
        <Text style={styles.muted}>No recent events.</Text>
      ) : (
        events.slice(0, 6).map((e: any, i: number) => (
          <View key={i} style={styles.news}>
            <Text style={styles.newsTitle} numberOfLines={1}>{e?.title || 'Event'}</Text>
            {e?.desc ? <Text style={styles.newsDesc} numberOfLines={2}>{e.desc}</Text> : null}
          </View>
        ))
      )}

      {/* trade history */}
      <Text style={styles.section}>RECENT TRADES</Text>
      {recentTrades.length === 0 ? (
        <Text style={styles.muted}>No trades yet.</Text>
      ) : (
        recentTrades.slice(0, 12).map((t: any, i: number) => {
          const pnl = t?.pnl ?? 0;
          const hasPnl = t?.pnl !== undefined && t?.pnl !== null;
          const profit = pnl >= 0;
          return (
            <View key={i} style={styles.trade}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.tSym} numberOfLines={1}>
                  {t?.assetId} <Text style={[styles.tSide, { color: t?.side === 'buy' ? COLORS.green : COLORS.red }]}>{(t?.side || '').toUpperCase()}</Text>
                </Text>
                <Text style={styles.tMeta}>{fmt(t?.qty || 0)} @ {fmt(t?.price || 0)}</Text>
              </View>
              {hasPnl ? (
                <Text style={[styles.tPnl, { color: profit ? COLORS.green : COLORS.red }]}>{profit ? '+' : ''}{fmt(pnl)}</Text>
              ) : null}
            </View>
          );
        })
      )}

      <View style={styles.signoutWrap}>
        <Text style={styles.signout} onPress={() => supabase.auth.signOut()}>Sign Out</Text>
      </View>
    </ScrollView>
  );
}

function Pill({ icon, text }: { icon: string; text: string }) {
  return <View style={styles.pill}><Text style={styles.pillTxt}>{icon} {text}</Text></View>;
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
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  lvlBadge: { width: 50, height: 50, borderRadius: 14, backgroundColor: COLORS.panelRaise, borderWidth: 1.5, borderColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  lvlNum: { color: COLORS.gold, fontWeight: '800', fontSize: 20 },
  uname: { color: '#fff', fontWeight: '800', fontSize: 17 },
  editHint: { color: COLORS.dim, fontSize: 13 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  editInput: { flex: 1, color: '#fff', backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.gold, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, fontWeight: '700' },
  editSave: { backgroundColor: COLORS.gold, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  editSaveTxt: { color: '#0a0a14', fontWeight: '800', fontSize: 13 },
  editCancel: { paddingHorizontal: 8, paddingVertical: 9 },
  editCancelTxt: { color: COLORS.dim, fontSize: 16, fontWeight: '700' },
  xpBar: { height: 7, borderRadius: 4, backgroundColor: COLORS.panelRaise, overflow: 'hidden', marginTop: 6 },
  xpFill: { height: '100%', backgroundColor: COLORS.gold },
  xpTxt: { color: COLORS.dim, fontSize: 9.5, marginTop: 3, fontFamily: undefined },
  pills: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  pill: { backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.borderDim, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 10 },
  pillTxt: { color: COLORS.text, fontSize: 11, fontWeight: '700' },
  hero: { backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.gold, borderRadius: 16, padding: 18, marginBottom: 12 },
  heroLbl: { color: COLORS.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  heroVal: { color: '#fff', fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 2 },
  heroChg: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexBasis: '47%', flexGrow: 1, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.borderDim, borderRadius: 12, padding: 14 },
  statLbl: { color: COLORS.dim, fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
  statVal: { color: '#fff', fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 4 },
  statSub: { color: COLORS.dim, fontSize: 10, marginTop: 3 },
  section: { color: COLORS.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 22, marginBottom: 8 },
  muted: { color: COLORS.dim, fontSize: 12, paddingVertical: 6 },
  mission: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.borderDim, borderRadius: 11, padding: 11, marginBottom: 7 },
  mTitle: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  mBar: { height: 6, borderRadius: 3, backgroundColor: COLORS.panelRaise, overflow: 'hidden', marginTop: 6 },
  mFill: { height: '100%', backgroundColor: COLORS.cyan },
  mProg: { color: COLORS.dim, fontSize: 9.5, marginTop: 3 },
  mReward: { color: COLORS.gold, fontWeight: '800', fontSize: 12 },
  claimBtn: { backgroundColor: COLORS.gold, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  claimTxt: { color: '#0a0a14', fontWeight: '800', fontSize: 11 },
  news: { backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.borderDim, borderRadius: 11, padding: 11, marginBottom: 7 },
  newsTitle: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  newsDesc: { color: COLORS.dim, fontSize: 11, marginTop: 3, lineHeight: 15 },
  trade: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.borderDim, borderRadius: 10, padding: 10, marginBottom: 6 },
  tSym: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  tSide: { fontSize: 10, fontWeight: '800' },
  tMeta: { color: COLORS.dim, fontSize: 10.5, marginTop: 2, fontVariant: ['tabular-nums'] },
  tPnl: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  signoutWrap: { marginTop: 26, alignItems: 'center' },
  signout: { color: COLORS.red, fontSize: 13, fontWeight: '700', padding: 10 },
});
