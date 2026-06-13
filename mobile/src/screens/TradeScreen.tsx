import { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, ScrollView } from 'react-native';
import { ASSETS, CATEGORY_LABELS } from '../engine/constants';
import { fmt, fmtPct, fmtNum } from '../engine/helpers';
import { TF_LIST } from '../engine/types';
import { bestBid, bestAsk } from '../engine/orderbook';
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
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [limitPx, setLimitPx] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [showAdv, setShowAdv] = useState(false);

  const aid = engine.state.active;
  const def = ASSETS.find((a) => a.id === aid);
  const ast = engine.state.assets[aid];
  const price = ast?.lastPrice ?? 0;
  const chg = ast ? ((ast.lastPrice - ast.open) / (ast.open || 1)) * 100 : 0;
  const up = chg >= 0;
  const dec = price < 10 ? 3 : 2;

  const bid = ast ? bestBid(ast.book) : 0;
  const ask = ast ? bestAsk(ast.book) : 0;
  const bids = (ast?.book?.bids || []).slice(0, 6);
  const asks = (ast?.book?.asks || []).slice(0, 6).reverse();
  const maxBookQty = Math.max(1, ...bids.map((o: any) => o.qty), ...asks.map((o: any) => o.qty));

  const order = (side: 'buy' | 'sell') => {
    const q = Math.max(1, Math.floor(Number(qty) || 0));
    const payload: any = { aid, side, qty: q, orderType };
    if (orderType === 'limit') payload.limitPx = Number(limitPx) || price;
    if (showAdv) {
      if (Number(sl) > 0) payload.slPct = Number(sl);
      if (Number(tp) > 0) payload.tpPct = Number(tp);
    }
    send({ type: 'order', payload });
  };

  const onTF = (t: string) => { setActiveTF(t as any); setTF(t); };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* header */}
      <View style={styles.head}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>{def?.name ?? aid}</Text>
          <Text style={styles.tkr}>{aid} · {def ? CATEGORY_LABELS[def.cat] || def.cat : ''}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.price, { color: up ? COLORS.green : COLORS.red }]}>{fmt(price, dec)}</Text>
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

      {/* asset details */}
      {def ? (
        <View style={styles.details}>
          <Text style={styles.detDesc}>{def.desc}</Text>
          <View style={styles.detRow}>
            <Detail label="Market" value={(def.market || '').toUpperCase()} />
            <Detail label="Hi" value={fmt(ast?.hi ?? price, dec)} />
            <Detail label="Lo" value={fmt(ast?.lo ?? price, dec)} />
            <Detail label="Vol" value={fmtNum(ast?.volume ?? 0)} />
          </View>
        </View>
      ) : null}

      {/* order book */}
      <Text style={styles.section}>ORDER BOOK</Text>
      <View style={styles.book}>
        {asks.map((o: any, i: number) => <BookRow key={'a' + i} px={o.px} qty={o.qty} dec={dec} ask max={maxBookQty} />)}
        <View style={styles.spread}>
          <Text style={styles.spreadTxt}>Spread {bid > 0 && isFinite(ask) ? fmt(ask - bid, dec) : '—'}</Text>
        </View>
        {bids.map((o: any, i: number) => <BookRow key={'b' + i} px={o.px} qty={o.qty} dec={dec} max={maxBookQty} />)}
      </View>

      {/* order type */}
      <View style={styles.seg}>
        {(['market', 'limit'] as const).map((t) => (
          <Pressable key={t} onPress={() => setOrderType(t)} style={[styles.segBtn, orderType === t && styles.segOn]}>
            <Text style={[styles.segTxt, orderType === t && styles.segTxtOn]}>{t === 'market' ? 'Market' : 'Limit'}</Text>
          </Pressable>
        ))}
      </View>

      {/* qty + limit price */}
      <View style={styles.qtyRow}>
        <Text style={styles.qtyLbl}>QTY</Text>
        <TextInput value={qty} onChangeText={setQty} keyboardType="number-pad" style={styles.qtyInput} placeholder="0" placeholderTextColor={COLORS.dim} />
        {[10, 50, 100].map((n) => (
          <Pressable key={n} onPress={() => setQty(String(n))} style={styles.preset}><Text style={styles.presetTxt}>{n}</Text></Pressable>
        ))}
      </View>
      {orderType === 'limit' && (
        <View style={styles.qtyRow}>
          <Text style={styles.qtyLbl}>PRICE</Text>
          <TextInput value={limitPx} onChangeText={setLimitPx} keyboardType="decimal-pad" style={styles.qtyInput} placeholder={fmt(price, dec)} placeholderTextColor={COLORS.dim} />
        </View>
      )}

      {/* SL/TP */}
      <Pressable onPress={() => setShowAdv((v) => !v)} style={styles.advToggle}>
        <Text style={styles.advTxt}>{showAdv ? '▼' : '▶'} Stop Loss / Take Profit</Text>
      </Pressable>
      {showAdv && (
        <View style={styles.qtyRow}>
          <View style={styles.advField}>
            <Text style={styles.qtyLbl}>SL %</Text>
            <TextInput value={sl} onChangeText={setSl} keyboardType="decimal-pad" style={styles.qtyInput} placeholder="—" placeholderTextColor={COLORS.dim} />
          </View>
          <View style={styles.advField}>
            <Text style={styles.qtyLbl}>TP %</Text>
            <TextInput value={tp} onChangeText={setTp} keyboardType="decimal-pad" style={styles.qtyInput} placeholder="—" placeholderTextColor={COLORS.dim} />
          </View>
        </View>
      )}

      {/* buy / short */}
      <View style={styles.actions}>
        <Pressable style={[styles.actBtn, { backgroundColor: COLORS.green }]} onPress={() => order('buy')}><Text style={styles.actTxt}>BUY</Text></Pressable>
        <Pressable style={[styles.actBtn, { backgroundColor: COLORS.red }]} onPress={() => order('sell')}><Text style={styles.actTxt}>SHORT</Text></Pressable>
      </View>
    </ScrollView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detLbl}>{label}</Text>
      <Text style={styles.detVal}>{value}</Text>
    </View>
  );
}
function BookRow({ px, qty, dec, ask, max }: { px: number; qty: number; dec: number; ask?: boolean; max: number }) {
  const w = Math.max(2, Math.min(100, (qty / max) * 100));
  return (
    <View style={styles.bookRow}>
      <View style={[styles.bookBar, { width: `${w}%`, backgroundColor: ask ? 'rgba(221,79,96,0.16)' : 'rgba(47,168,116,0.16)' }]} />
      <Text style={[styles.bookPx, { color: ask ? COLORS.red : COLORS.green }]}>{fmt(px, dec)}</Text>
      <Text style={styles.bookQty}>{fmtNum(qty)}</Text>
    </View>
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
  details: { marginTop: 12, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.borderDim, borderRadius: 12, padding: 12 },
  detDesc: { color: COLORS.text, fontSize: 12.5, marginBottom: 10 },
  detRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detail: { alignItems: 'center' },
  detLbl: { color: COLORS.dim, fontSize: 9, fontWeight: '700' },
  detVal: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  section: { color: COLORS.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 18, marginBottom: 6 },
  book: { backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.borderDim, borderRadius: 12, paddingVertical: 4 },
  bookRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, paddingHorizontal: 12, position: 'relative' },
  bookBar: { position: 'absolute', right: 0, top: 0, bottom: 0 },
  bookPx: { flex: 1, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bookQty: { color: COLORS.text, fontSize: 11.5, fontVariant: ['tabular-nums'] },
  spread: { alignItems: 'center', paddingVertical: 4 },
  spreadTxt: { color: COLORS.dim, fontSize: 10, fontWeight: '700' },
  seg: { flexDirection: 'row', backgroundColor: COLORS.panelRaise, borderRadius: 10, padding: 4, marginTop: 14 },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 7, alignItems: 'center' },
  segOn: { backgroundColor: COLORS.gold },
  segTxt: { color: COLORS.dim, fontWeight: '700', fontSize: 13 },
  segTxtOn: { color: '#0a0a14' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  qtyLbl: { color: COLORS.dim, fontSize: 11, fontWeight: '700' },
  qtyInput: { flex: 1, color: '#fff', backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.borderDim, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontWeight: '700' },
  preset: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: COLORS.panelRaise },
  presetTxt: { color: COLORS.text, fontWeight: '700', fontSize: 13 },
  advToggle: { marginTop: 14, paddingVertical: 6 },
  advTxt: { color: COLORS.cyan, fontSize: 12, fontWeight: '700' },
  advField: { flex: 1 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  actTxt: { color: '#04140c', fontWeight: '800', fontSize: 16, letterSpacing: 1 },
});
