import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { fmt } from '../engine/helpers';
import { COSMETICS_LIST, rarityClass } from '../data/cosmetics';
import { useGame } from '../store/game';
import { useLiveTick } from '../hooks/useLiveTick';
import { storePurchase } from '../net/ws';
import { COLORS } from '../config';

const BOOSTS = [
  { id: 'xp1h', name: '2× XP Boost', sub: '1 hour', cost: 100 },
  { id: 'xp24h', name: '2× XP Boost', sub: '24 hours', cost: 500 },
  { id: 'daily', name: 'Daily Reward Boost', sub: '7 days', cost: 300 },
];

const TABS = [
  { key: 'boosts', label: 'Boosts' },
  { key: 'frame', label: 'Frames' },
  { key: 'badge', label: 'Badges' },
  { key: 'name_color', label: 'Colors' },
] as const;

const rarityColor = (cost: number) => (cost >= 400 ? COLORS.gold : cost >= 150 ? '#a78bfa' : COLORS.borderDim);

export function StoreScreen() {
  const gems = useGame((s) => s.gems);
  const allowed = useGame((s) => s.storeBuyAllowed);
  const pushToast = useGame((s) => s.pushToast);
  useLiveTick();
  const [tab, setTab] = useState<string>('boosts');
  const [owned, setOwned] = useState<Set<string>>(new Set());

  const buy = (id: string, cost: number, label: string) => {
    if (!allowed) { pushToast('Store purchases coming soon!', 'info'); return; }
    if (owned.has(id)) { pushToast('Already owned', 'info'); return; }
    if (gems < cost) { pushToast('Not enough gems — earn from missions', 'err'); return; }
    storePurchase(-cost);
    setOwned((s) => new Set(s).add(id));
    pushToast(`Purchased ${label}!`, 'ok');
  };

  const cosmetics = COSMETICS_LIST.filter((c) => c.type === tab);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 36 }}>
      <View style={styles.headRow}>
        <Text style={styles.header}>STORE</Text>
        <View style={styles.gemPill}><Text style={styles.gemTxt}>💎 {fmt(gems)}</Text></View>
      </View>

      {!allowed && (
        <View style={styles.soon}>
          <Text style={styles.soonTxt}>🚧 Purchases are coming soon — browsing only for now.</Text>
        </View>
      )}

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tabBtn, tab === t.key && styles.tabOn]}>
            <Text style={[styles.tabTxt, tab === t.key && styles.tabTxtOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'boosts'
        ? BOOSTS.map((b) => (
            <View key={b.id} style={styles.card}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.cName}>{b.name}</Text>
                <Text style={styles.cSub}>{b.sub}</Text>
              </View>
              <Pressable style={styles.buyBtn} onPress={() => buy(b.id, b.cost, b.name)}>
                <Text style={styles.buyTxt}>💎 {b.cost}</Text>
              </Pressable>
            </View>
          ))
        : cosmetics.map((c) => {
            const isOwned = owned.has(c.id);
            return (
              <View key={c.id} style={[styles.card, { borderColor: rarityColor(c.cost) }]}>
                {c.type === 'name_color' ? (
                  <View style={[styles.swatch, { backgroundColor: c.value }]} />
                ) : (
                  <View style={[styles.swatch, { backgroundColor: COLORS.panelRaise }]}><Text style={{ fontSize: 16 }}>{c.type === 'frame' ? '🖼️' : '🎖️'}</Text></View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cName} numberOfLines={1}>{c.name}</Text>
                  <Text style={styles.cSub}>{rarityClass(c.cost) === 'rarity-gold' ? 'Legendary' : rarityClass(c.cost) === 'rarity-purple' ? 'Rare' : 'Common'}</Text>
                </View>
                <Pressable style={[styles.buyBtn, isOwned && styles.ownedBtn]} onPress={() => buy(c.id, c.cost, c.name)}>
                  <Text style={[styles.buyTxt, isOwned && { color: COLORS.green }]}>{isOwned ? '✓ Owned' : `💎 ${c.cost}`}</Text>
                </Pressable>
              </View>
            );
          })}

      <Text style={styles.note}>Cosmetics show on your profile across the game. Earn gems from missions & daily rewards.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 12, paddingTop: 10 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  header: { color: COLORS.gold, fontWeight: '800', fontSize: 13, letterSpacing: 1.5 },
  gemPill: { backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.gold, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12 },
  gemTxt: { color: COLORS.gold, fontWeight: '800', fontSize: 12 },
  soon: { backgroundColor: 'rgba(251,191,36,0.08)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)', borderRadius: 10, padding: 10, marginBottom: 10 },
  soonTxt: { color: COLORS.gold, fontSize: 11.5, fontWeight: '700', textAlign: 'center' },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.borderDim, alignItems: 'center' },
  tabOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  tabTxt: { color: COLORS.dim, fontSize: 11.5, fontWeight: '700' },
  tabTxtOn: { color: '#0a0a14' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.borderDim, borderRadius: 12, padding: 12, marginBottom: 8 },
  swatch: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.borderDim },
  cName: { color: '#fff', fontWeight: '700', fontSize: 13.5 },
  cSub: { color: COLORS.dim, fontSize: 10.5, marginTop: 2 },
  buyBtn: { backgroundColor: COLORS.gold, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  ownedBtn: { backgroundColor: COLORS.panelRaise },
  buyTxt: { color: '#0a0a14', fontWeight: '800', fontSize: 12 },
  note: { color: COLORS.dim, fontSize: 10.5, textAlign: 'center', marginTop: 16, lineHeight: 15 },
});
