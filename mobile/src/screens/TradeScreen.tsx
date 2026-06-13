import { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, ScrollView } from 'react-native';
import { ASSETS } from '../engine/constants';
import { fmt, fmtPct } from '../engine/helpers';
import { TF_LIST } from '../engine/types';
import { useGame } from '../store/game';
import { useLiveTick } from '../hooks/useLiveTick';
import { send, setTF } from '../net/ws';
import { ChartView } from '../components/ChartView';
import { COLORS } from '../config';

export function TradeScreen() {
  const engine = useGame((s) => s.engine);
  const tf = useGame((s) => s.activeTF);
  const setActiveTF = useGame((s) => s.setActiveTF);
  useLiveTick();
  const [qty, setQty] = useState('10');

  const aid = engine.state.active;
  const def = ASSETS.find((a) => a.id === aid);
  const ast = engine.state.assets[aid];
  const price = ast?.lastPrice ?? 0;
  const chg = ast ? ((ast.lastPrice - ast.open) / (ast.open || 1)) * 100 : 0;
  const up = chg >= 0;

  const order = (side: 'buy' | 'sell') => {
    const q = Math.max(1, Math.floor(Number(qty) || 0));
    send({ type: 'order', payload: { aid, side, qty: q, orderType: 'market' } });
  };

  const onTF = (t: string) => { setActiveTF(t as any); setTF(t); };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
      {/* header */}
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{def?.name ?? aid}</Text>
          <Text style={styles.tkr}>{aid}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.price, { color: up ? COLORS.green : COLORS.red }]}>{fmt(price, price < 10 ? 3 : 2)}</Text>
          <Text style={[styles.chg, { color: up ? COLORS.green : COLORS.red }]}>{up ? '▲' : '▼'} {fmtPct(chg)}</Text>
        </View>
      </View>

      {/* TF row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tfRow} contentContainerStyle={{ gap: 6 }}>
        {TF_LIST.map((t) => (
          <Pressable key={t} onPress={() => onTF(t)} style={[styles.tfBtn, tf === t && styles.tfBtnOn]}>
            <Text style={[styles.tfTxt, tf === t && styles.tfTxtOn]}>{t}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ChartView />

      {/* qty */}
      <View style={styles.qtyRow}>
        <Text style={styles.qtyLbl}>QTY</Text>
        <TextInput
          value={qty}
          onChangeText={setQty}
          keyboardType="number-pad"
          style={styles.qtyInput}
          placeholder="0"
          placeholderTextColor={COLORS.dim}
        />
        {[10, 50, 100].map((n) => (
          <Pressable key={n} onPress={() => setQty(String(n))} style={styles.preset}>
            <Text style={styles.presetTxt}>{n}</Text>
          </Pressable>
        ))}
      </View>

      {/* buy / short */}
      <View style={styles.actions}>
        <Pressable style={[styles.actBtn, { backgroundColor: COLORS.green }]} onPress={() => order('buy')}>
          <Text style={styles.actTxt}>BUY</Text>
        </Pressable>
        <Pressable style={[styles.actBtn, { backgroundColor: COLORS.red }]} onPress={() => order('sell')}>
          <Text style={styles.actTxt}>SHORT</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 12, paddingTop: 8 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  name: { color: '#fff', fontWeight: '800', fontSize: 18 },
  tkr: { color: COLORS.dim, fontSize: 11, fontWeight: '700', marginTop: 2 },
  price: { fontWeight: '800', fontSize: 22, fontVariant: ['tabular-nums'] },
  chg: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  tfRow: { marginBottom: 10, flexGrow: 0 },
  tfBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.borderDim },
  tfBtnOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  tfTxt: { color: COLORS.dim, fontSize: 11, fontWeight: '700' },
  tfTxtOn: { color: '#0a0a14' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  qtyLbl: { color: COLORS.dim, fontSize: 11, fontWeight: '700' },
  qtyInput: {
    flex: 1, color: '#fff', backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.borderDim,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontWeight: '700',
  },
  preset: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: COLORS.panelRaise },
  presetTxt: { color: COLORS.text, fontWeight: '700', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  actTxt: { color: '#04140c', fontWeight: '800', fontSize: 16, letterSpacing: 1 },
});
