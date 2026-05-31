import { useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPost } from '../api';
import type { UserRow, UserDetail } from '../types';
import {
  fmt, fmtNum, fmtPct, fmtTime,
  ConfirmModal, KV, toast, safe,
} from '../components';

type SortKey = 'net' | 'cash' | 'level' | 'id' | 'name';
type StatusFilter = 'all' | 'active' | 'rekt';

interface UsersResp {
  ok: boolean;
  total: number;
  items: UserRow[];
}

interface UserDetailResp {
  ok: boolean;
  user: UserDetail;
}

const DEFAULT_LIMIT = 200;
const REFRESH_MS = 5000;

export default function Users() {
  // ----- list state -----
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [limit, setLimit] = useState<number>(DEFAULT_LIMIT);
  const [loading, setLoading] = useState<boolean>(true);

  // ----- filters -----
  const [q, setQ] = useState<string>('');
  const [minLevel, setMinLevel] = useState<string>('');
  const [strat, setStrat] = useState<string>('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('net');

  // ----- drawer state -----
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // ----- quick action inputs -----
  const [giveCashAmt, setGiveCashAmt] = useState<string>('1000');
  const [giveXpAmt, setGiveXpAmt] = useState<string>('100');
  const [setLevelVal, setSetLevelVal] = useState<string>('10');

  // ----- confirmation modal -----
  const [confirm, setConfirm] = useState<{
    title: string; body: string; danger?: boolean; confirmLabel?: string;
    onYes: () => void;
  } | null>(null);

  // ----- fetch list -----
  const filtersRef = useRef({ q, minLevel, status, sort, limit });
  filtersRef.current = { q, minLevel, status, sort, limit };

  const fetchUsers = async () => {
    const f = filtersRef.current;
    const params = new URLSearchParams();
    if (f.q) params.set('q', f.q);
    if (f.minLevel) params.set('minLevel', f.minLevel);
    if (f.status === 'rekt') params.set('rekt', 'true');
    if (f.status === 'active') params.set('rekt', 'false');
    params.set('sort', f.sort);
    params.set('limit', String(f.limit));
    const data = await safe<UsersResp>(() => apiGet<UsersResp>('/admin/users?' + params.toString()));
    if (data) {
      setRows(data.items || []);
      setTotal(data.total || 0);
    }
    setLoading(false);
  };

  // initial + filter change
  useEffect(() => {
    setLoading(true);
    fetchUsers();
  }, [q, minLevel, status, sort, limit]);

  // auto-refresh every 5s — only when drawer closed
  useEffect(() => {
    if (openId != null) return;
    const id = setInterval(() => { fetchUsers(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [openId]);

  // ----- fetch detail -----
  const loadDetail = async (id: number) => {
    setDetailLoading(true);
    const data = await safe<UserDetailResp>(() => apiGet<UserDetailResp>('/admin/user/' + id));
    if (data?.user) setDetail(data.user);
    setDetailLoading(false);
  };

  const openDrawer = (id: number) => {
    setOpenId(id);
    setDetail(null);
    loadDetail(id);
  };
  const closeDrawer = () => {
    setOpenId(null);
    setDetail(null);
  };
  // FIX: Escape key closes drawer.
  useEffect(() => {
    if (openId === null) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDrawer(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [openId]);

  // ----- client-side strat filter (server doesn't support strat query) -----
  const stratOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.strat) set.add(r.strat);
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!strat) return rows;
    return rows.filter(r => r.strat === strat);
  }, [rows, strat]);

  // ----- actions -----
  const refreshAfter = async () => {
    await fetchUsers();
    if (openId != null) await loadDetail(openId);
  };

  const doGiveCash = async () => {
    if (openId == null) return;
    const amt = Number(giveCashAmt) || 0;
    if (!amt) { toast('Enter cash amount', 'err'); return; }
    const r = await safe(() => apiPost('/admin/user/' + openId + '/giveCash', { amount: amt }));
    if (r) { toast('Cash updated', 'ok'); refreshAfter(); }
  };

  const doGiveXp = async () => {
    if (openId == null) return;
    const amt = Number(giveXpAmt) || 0;
    if (!amt) { toast('Enter XP amount', 'err'); return; }
    const r = await safe(() => apiPost('/admin/user/' + openId + '/giveXp', { amount: amt }));
    if (r) { toast('XP granted', 'ok'); refreshAfter(); }
  };

  const doSetLevel = async () => {
    if (openId == null) return;
    const lvl = Math.floor(Number(setLevelVal) || 1);
    if (lvl < 1 || lvl > 99) { toast('Level must be 1-99', 'err'); return; }
    const r = await safe(() => apiPost('/admin/user/' + openId + '/setLevel', { level: lvl }));
    if (r) { toast('Level set', 'ok'); refreshAfter(); }
  };

  const doResetMissions = async () => {
    if (openId == null) return;
    const r = await safe(() => apiPost('/admin/user/' + openId + '/resetMissions'));
    if (r) { toast('Missions reset', 'ok'); refreshAfter(); }
  };

  const doResetPortfolio = async () => {
    if (openId == null) return;
    const r = await safe(() => apiPost('/admin/user/' + openId + '/resetPortfolio'));
    if (r) { toast('Portfolio reset', 'ok'); refreshAfter(); }
  };

  const doClosePositions = async () => {
    if (openId == null) return;
    const r = await safe(() => apiPost('/admin/user/' + openId + '/closePositions'));
    if (r) { toast('Closing positions requested', 'ok'); refreshAfter(); }
  };

  const doBan = async (id: number) => {
    const r = await safe(() => apiPost('/admin/user/' + id + '/ban'));
    if (r) { toast('User banned', 'ok'); refreshAfter(); }
  };

  const doUnban = async (id: number) => {
    const r = await safe(() => apiPost('/admin/user/' + id + '/unban'));
    if (r) { toast('User unbanned', 'ok'); refreshAfter(); }
  };

  const resetFilters = () => {
    setQ(''); setMinLevel(''); setStrat(''); setStatus('all'); setSort('net'); setLimit(DEFAULT_LIMIT);
  };

  // ----- render -----
  const shown = filteredRows.length;

  return (
    <>
      <div className="a-page-header">
        <div>
          <h1 className="a-page-title">Users</h1>
          <div className="a-page-sub">Search, inspect and moderate all traders</div>
        </div>
        <div className="a-page-actions">
          <button className="a-btn ghost" onClick={() => fetchUsers()}>Refresh</button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="a-card" style={{ marginBottom: 14 }}>
        <div className="a-form-row">
          <div>
            <label className="a-label">Search</label>
            <input
              className="a-input"
              placeholder="name or id…"
              value={q}
              onChange={e => setQ(e.target.value)}
              style={{ width: 200 }}
            />
          </div>
          <div>
            <label className="a-label">Min Level</label>
            <input
              className="a-input"
              type="number"
              min={0}
              max={99}
              placeholder="0"
              value={minLevel}
              onChange={e => setMinLevel(e.target.value)}
              style={{ width: 100 }}
            />
          </div>
          <div>
            <label className="a-label">Strategy</label>
            <select className="a-select" value={strat} onChange={e => setStrat(e.target.value)} style={{ width: 160 }}>
              <option value="">All strategies</option>
              {stratOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="a-label">Status</label>
            <select className="a-select" value={status} onChange={e => setStatus(e.target.value as StatusFilter)} style={{ width: 130 }}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="rekt">Rekt</option>
            </select>
          </div>
          <div>
            <label className="a-label">Sort</label>
            <select className="a-select" value={sort} onChange={e => setSort(e.target.value as SortKey)} style={{ width: 130 }}>
              <option value="net">Net worth</option>
              <option value="cash">Cash</option>
              <option value="level">Level</option>
              <option value="id">ID</option>
              <option value="name">Name</option>
            </select>
          </div>
          <div>
            <button className="a-btn ghost" onClick={resetFilters}>Reset</button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="a-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div className="a-page-sub">
            Showing <strong>{fmtNum(shown)}</strong> of <strong>{fmtNum(total)}</strong>
            {strat && <> · filtered by strat: <code>{strat}</code></>}
          </div>
          <div className="a-page-sub" style={{ opacity: 0.6 }}>
            {openId == null ? 'Auto-refresh: 5s' : 'Auto-refresh paused (drawer open)'}
          </div>
        </div>

        {loading ? (
          <div className="a-empty">Loading…</div>
        ) : shown === 0 ? (
          <div className="a-empty">No users match the current filters.</div>
        ) : (
          <table className="a-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Strategy</th>
                <th>Level</th>
                <th style={{ textAlign: 'right' }}>Cash</th>
                <th style={{ textAlign: 'right' }}>Net</th>
                <th style={{ textAlign: 'right' }}>Open</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(r => (
                <tr
                  key={r.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => openDrawer(r.id)}
                >
                  <td><code>{r.id}</code></td>
                  <td>
                    {r.name}
                    {r.isPlayer && <span className="a-badge info" style={{ marginLeft: 6 }}>YOU</span>}
                  </td>
                  <td><span className="a-badge muted">{r.strat || '—'}</span></td>
                  <td>Lv {r.level}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(r.cash)}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(r.net)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtNum(r.openOrders || 0)}</td>
                  <td>
                    {r.rekt
                      ? <span className="a-badge err dot">Rekt</span>
                      : <span className="a-badge ok dot">Active</span>}
                  </td>
                  <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <button
                      className="a-btn ghost"
                      style={{ marginRight: 6 }}
                      onClick={() => openDrawer(r.id)}
                    >View</button>
                    {r.rekt ? (
                      <button
                        className="a-btn primary"
                        onClick={() => setConfirm({
                          title: 'Unban user',
                          body: `Unban ${r.name} (#${r.id})? They will be re-enabled for trading.`,
                          confirmLabel: 'Unban',
                          onYes: () => doUnban(r.id),
                        })}
                      >Unban</button>
                    ) : (
                      <button
                        className="a-btn danger"
                        disabled={r.isPlayer}
                        onClick={() => setConfirm({
                          title: 'Ban user',
                          body: `Ban ${r.name} (#${r.id})? They will be marked rekt and stopped from trading.`,
                          confirmLabel: 'Ban',
                          danger: true,
                          onYes: () => doBan(r.id),
                        })}
                      >Ban</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {total > shown && !strat && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
            <button
              className="a-btn primary"
              onClick={() => setLimit(l => l + DEFAULT_LIMIT)}
            >Load more ({fmtNum(total - shown)} remaining)</button>
          </div>
        )}
      </div>

      {/* Drawer + backdrop (backdrop click closes) */}
      {openId != null && (
        <>
        <div onClick={closeDrawer} style={{ position: 'fixed', inset: 0, background: 'rgba(6,8,13,.45)', zIndex: 70, backdropFilter: 'blur(2px)' }} />
        <div className="a-drawer">
          <div className="a-drawer-head">
            <div>
              <div style={{ fontSize: 11, color: 'var(--a-text-mute)', textTransform: 'uppercase', letterSpacing: 1 }}>
                User #{openId}
              </div>
              <h2 style={{ margin: '4px 0 0', fontSize: 18 }}>
                {detail?.name || 'Loading…'}
                {detail?.isPlayer && <span className="a-badge info" style={{ marginLeft: 8 }}>YOU</span>}
                {detail?.rekt && <span className="a-badge err" style={{ marginLeft: 8 }}>REKT</span>}
              </h2>
            </div>
            <button className="a-btn ghost" onClick={closeDrawer}>Close</button>
          </div>

          <div className="a-drawer-body">
            {detailLoading || !detail ? (
              <div className="a-empty">Loading user details…</div>
            ) : (
              <>
                {/* Profile */}
                <div className="a-drawer-section">
                  <h4>Profile</h4>
                  <div className="a-grid-2">
                    <KV label="ID" value={detail.id} />
                    <KV label="Strategy" value={detail.strat || '—'} />
                    <KV label="Level" value={'Lv ' + detail.level} />
                    <KV label="XP" value={fmtNum(detail.xp || 0)} />
                    <KV label="Cash" value={fmt(detail.cash)} />
                    <KV label="Net Worth" value={fmt(detail.net)} tone={detail.net >= detail.cash ? 'up' : 'dn'} />
                    <KV label="Bonus" value={fmt(detail.bonus || 0)} />
                    <KV label="Login Streak" value={fmtNum(detail.loginStreak || 0) + 'd'} />
                  </div>
                </div>

                {/* Holdings */}
                <div className="a-drawer-section">
                  <h4>Holdings ({detail.holdings?.length || 0})</h4>
                  {!detail.holdings || detail.holdings.length === 0 ? (
                    <div className="a-empty">No open positions</div>
                  ) : (
                    <table className="a-table">
                      <thead>
                        <tr>
                          <th>Asset</th>
                          <th style={{ textAlign: 'right' }}>Qty</th>
                          <th style={{ textAlign: 'right' }}>Avg Cost</th>
                          <th style={{ textAlign: 'right' }}>Last</th>
                          <th style={{ textAlign: 'right' }}>Value</th>
                          <th style={{ textAlign: 'right' }}>PnL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.holdings.map(h => {
                          const pnlPct = h.avgCost > 0
                            ? ((h.lastPrice - h.avgCost) / h.avgCost) * 100 * (h.shares >= 0 ? 1 : -1)
                            : 0;
                          return (
                            <tr key={h.aid}>
                              <td><code>{h.aid}</code></td>
                              <td style={{ textAlign: 'right' }}>{fmtNum(h.shares)}</td>
                              <td style={{ textAlign: 'right' }}>{fmt(h.avgCost)}</td>
                              <td style={{ textAlign: 'right' }}>{fmt(h.lastPrice)}</td>
                              <td style={{ textAlign: 'right' }}>{fmt(h.value)}</td>
                              <td style={{ textAlign: 'right', color: h.pnl >= 0 ? 'var(--a-green)' : 'var(--a-red)' }}>
                                {fmt(h.pnl)} <span style={{ opacity: 0.7, fontSize: 10 }}>({fmtPct(pnlPct)})</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Recent Trades */}
                <div className="a-drawer-section">
                  <h4>Recent Trades (last 20)</h4>
                  {!detail.recentTrades || detail.recentTrades.length === 0 ? (
                    <div className="a-empty">No recent trades</div>
                  ) : (
                    <table className="a-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Asset</th>
                          <th>Side</th>
                          <th style={{ textAlign: 'right' }}>Qty</th>
                          <th style={{ textAlign: 'right' }}>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.recentTrades.slice(-20).reverse().map((t: any, i: number) => (
                          <tr key={i}>
                            <td>{fmtTime(t.ts || t.time || 0)}</td>
                            <td><code>{t.aid || t.symbol || '—'}</code></td>
                            <td>
                              {t.side === 'buy' || t.side === 'long'
                                ? <span className="a-badge ok">{String(t.side).toUpperCase()}</span>
                                : <span className="a-badge err">{String(t.side || '?').toUpperCase()}</span>}
                            </td>
                            <td style={{ textAlign: 'right' }}>{fmtNum(t.qty || t.shares || 0)}</td>
                            <td style={{ textAlign: 'right' }}>{fmt(t.price || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="a-drawer-section">
                  <h4>Quick Actions</h4>

                  <div className="a-form-row" style={{ marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label className="a-label">Give Cash</label>
                      <input
                        className="a-input"
                        type="number"
                        value={giveCashAmt}
                        onChange={e => setGiveCashAmt(e.target.value)}
                      />
                    </div>
                    <button className="a-btn primary" onClick={doGiveCash}>Apply</button>
                  </div>

                  <div className="a-form-row" style={{ marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label className="a-label">Give XP</label>
                      <input
                        className="a-input"
                        type="number"
                        value={giveXpAmt}
                        onChange={e => setGiveXpAmt(e.target.value)}
                      />
                    </div>
                    <button className="a-btn primary" onClick={doGiveXp}>Apply</button>
                  </div>

                  <div className="a-form-row" style={{ marginBottom: 14 }}>
                    <div style={{ flex: 1 }}>
                      <label className="a-label">Set Level (1-99)</label>
                      <input
                        className="a-input"
                        type="number"
                        min={1}
                        max={99}
                        value={setLevelVal}
                        onChange={e => setSetLevelVal(e.target.value)}
                      />
                    </div>
                    <button className="a-btn primary" onClick={doSetLevel}>Apply</button>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button
                      className="a-btn ghost"
                      onClick={() => setConfirm({
                        title: 'Reset missions',
                        body: `Reset daily + weekly missions for ${detail.name}?`,
                        confirmLabel: 'Reset',
                        onYes: doResetMissions,
                      })}
                    >Reset Missions</button>

                    <button
                      className="a-btn danger"
                      onClick={() => setConfirm({
                        title: 'Reset portfolio',
                        body: `Wipe ALL holdings, open orders and trade history for ${detail.name}? This cannot be undone.`,
                        confirmLabel: 'Reset Portfolio',
                        danger: true,
                        onYes: doResetPortfolio,
                      })}
                    >Reset Portfolio</button>

                    <button
                      className="a-btn ghost"
                      onClick={() => setConfirm({
                        title: 'Close all positions',
                        body: `Submit market orders to flatten every open position for ${detail.name}?`,
                        confirmLabel: 'Close All',
                        onYes: doClosePositions,
                      })}
                    >Close All Positions</button>

                    {detail.rekt ? (
                      <button
                        className="a-btn primary"
                        onClick={() => setConfirm({
                          title: 'Unban user',
                          body: `Unban ${detail.name} and restore them to trading?`,
                          confirmLabel: 'Unban',
                          onYes: () => doUnban(detail.id),
                        })}
                      >Unban User</button>
                    ) : (
                      <button
                        className="a-btn danger"
                        disabled={detail.isPlayer}
                        title={detail.isPlayer ? 'Cannot ban the player' : ''}
                        onClick={() => setConfirm({
                          title: 'Ban user',
                          body: `Ban ${detail.name}? They will be marked rekt and disabled.`,
                          confirmLabel: 'Ban',
                          danger: true,
                          onYes: () => doBan(detail.id),
                        })}
                      >Ban User</button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        </>
      )}

      <ConfirmModal
        open={!!confirm}
        title={confirm?.title || ''}
        body={confirm?.body || ''}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        onConfirm={() => {
          const c = confirm;
          setConfirm(null);
          c?.onYes();
        }}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
