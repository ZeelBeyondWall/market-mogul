import { useEffect, useState } from 'react';
import './admin.css';
import { apiGet, getActor, setToken, setActor } from './api';
import { fmt, fmtDuration, ToastHost } from './components';
import type { HealthResp, EconomyResp } from './types';

// Pages
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Economy from './pages/Economy';
import GameMaster from './pages/GameMaster';
import Emergency from './pages/Emergency';
import Analytics from './pages/Analytics';
import AuditLog from './pages/AuditLog';
import Manual from './pages/Manual';
import Feedback from './pages/Feedback';

type PageId = 'dashboard' | 'users' | 'economy' | 'gm' | 'analytics' | 'audit' | 'emergency' | 'manual' | 'feedback';

interface NavItem { id: PageId; label: string; icon: string; section: string; danger?: boolean }

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard',    icon: '◧', section: 'Overview' },
  { id: 'analytics', label: 'Analytics',    icon: '📊', section: 'Overview' },
  { id: 'users',     label: 'Users',        icon: '👥', section: 'Operations' },
  { id: 'economy',   label: 'Economy',      icon: '$',  section: 'Operations' },
  { id: 'gm',        label: 'Game Master',  icon: '⚙',  section: 'Operations' },
  { id: 'feedback',  label: 'Feedback',     icon: '💬', section: 'Operations' },
  { id: 'audit',     label: 'Audit Log',    icon: '◰',  section: 'System' },
  { id: 'manual',    label: 'Manual',       icon: '📖', section: 'System' },
  { id: 'emergency', label: 'Emergency',    icon: '🚨', section: 'System', danger: true },
];

const PAGE_TITLES: Record<PageId, { title: string; sub: string }> = {
  dashboard: { title: 'Dashboard',         sub: 'Real-time overview of every market system' },
  analytics: { title: 'Analytics',         sub: 'Live charts, heatmaps + historical metrics' },
  users:     { title: 'User Management',   sub: 'Search, inspect, and moderate every account' },
  economy:   { title: 'Economy Control',   sub: 'Liquidity, tuning + global market parameters' },
  gm:        { title: 'Game Master',       sub: 'Balancing tools + simulation controls' },
  feedback:  { title: 'Player Feedback',   sub: 'Bug reports + ideas from players' },
  audit:     { title: 'Audit Log',         sub: 'Every administrative action is recorded' },
  manual:    { title: 'Admin Manual',      sub: 'Operations runbook + reference' },
  emergency: { title: 'Emergency Center',  sub: 'Critical controls — handle with care' },
};

export function AdminApp() {
  const [page, setPage] = useState<PageId>(() => {
    try { return (localStorage.getItem('mm_admin_page') as PageId) || 'dashboard'; } catch { return 'dashboard'; }
  });
  const [health, setHealth] = useState<HealthResp | null>(null);
  const [economy, setEconomy] = useState<EconomyResp | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => { try { localStorage.setItem('mm_admin_page', page); } catch {} }, [page]);

  // Sidebar/topbar polling — health + economy (for banner + flags).
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const [h, e] = await Promise.all([
          apiGet<HealthResp>('/admin/health').catch(() => null),
          apiGet<EconomyResp>('/admin/economy').catch(() => null),
        ]);
        if (!alive) return;
        if (h) setHealth(h);
        if (e) setEconomy(e);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  useEffect(() => { document.body.setAttribute('data-admin', '1'); return () => { document.body.removeAttribute('data-admin'); }; }, []);

  // v8.1: explicit list of "abnormal" states to count for badge.
  // Previously the auto-flip logic counted new flags (botsRespectPlayerLevel=false)
  // as active when default, showing a phantom (1) badge.
  const flagsActive = (() => {
    const f: any = economy?.flags;
    if (!f) return 0;
    let n = 0;
    if (f.maintenanceMode) n++;
    if (f.tradingHalted) n++;
    if (f.botsEnabled === false) n++;
    if (f.eventsEnabled === false) n++;
    if (f.registrationDisabled) n++;
    if (f.broadcastBanner) n++;
    if (typeof f.volatilityMult === 'number' && f.volatilityMult !== 1) n++;
    if (typeof f.spreadMult === 'number' && f.spreadMult !== 1) n++;
    if (typeof f.activityMult === 'number' && f.activityMult !== 1) n++;
    return n;
  })();

  const handlePageChange = (id: PageId) => {
    setPage(id);
    setMobileNavOpen(false);
  };

  const pageEl = (() => {
    switch (page) {
      case 'dashboard': return <Dashboard />;
      case 'users':     return <Users />;
      case 'economy':   return <Economy />;
      case 'gm':        return <GameMaster />;
      case 'emergency': return <Emergency />;
      case 'analytics': return <Analytics />;
      case 'audit':     return <AuditLog />;
      case 'manual':    return <Manual />;
      case 'feedback':  return <Feedback />;
    }
  })();

  const navContent = (
    <nav className="a-nav">
      {['Overview', 'Operations', 'System'].map(section => (
        <div key={section}>
          <div className="a-nav-section">{section}</div>
          {NAV.filter(n => n.section === section).map(n => (
            <div
              key={n.id}
              className={'a-nav-item' + (page === n.id ? ' active' : '') + (n.danger ? ' danger' : '')}
              onClick={() => handlePageChange(n.id)}
            >
              <span className="a-nav-icon">{n.icon}</span>
              <span>{n.label}</span>
              {n.id === 'emergency' && flagsActive > 0 && <span className="a-nav-badge" style={{ background: 'var(--a-red)', color: '#fff' }}>{flagsActive}</span>}
            </div>
          ))}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="admin-shell">
      <aside className="a-sidebar">
        <div className="a-sidebar-brand">
          <div className="a-brand-mark">M</div>
          <div>
            <div className="a-brand-name">MARKETVERSEX</div>
            <div className="a-brand-sub">Admin Center</div>
          </div>
        </div>
        {navContent}
        <div className="a-sidebar-footer">
          <div className="a-uptime">
            <span className={'a-status-dot' + (health ? '' : ' danger')} />
            <span>{health ? `Engine online · ${fmtDuration(health.uptimeSec)}` : 'Engine offline'}</span>
          </div>
          {health && <div style={{ marginTop: 5 }}>{health.tradersCount.toLocaleString()} traders · {health.clientCount} clients</div>}
        </div>
      </aside>

      <header className="a-topbar">
        {/* Mobile hamburger */}
        <button
          className="a-icon-btn a-mobile-menu-btn"
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          title="Menu"
          style={{ display: 'none' }}
        >
          ☰
        </button>

        <h1>{PAGE_TITLES[page].title}</h1>
        <div className="a-topbar-spacer" />
        <div className="a-topbar-search">
          <span style={{ color: 'var(--a-text-mute)' }}>⌕</span>
          <input placeholder="Quick search… (Users page)" />
        </div>
        <button className="a-icon-btn" title="Notifications">
          🔔
          {economy?.flags && (economy.flags.tradingHalted || economy.flags.maintenanceMode) && <span className="a-dot-notif" />}
        </button>
        <button className="a-icon-btn" onClick={() => setShowAuthModal(true)} title="Admin settings">⚙</button>
        <div className="a-profile" onClick={() => setShowAuthModal(true)}>
          <div className="a-profile-avatar">{getActor().charAt(0).toUpperCase()}</div>
          <div className="a-profile-name">{getActor()}</div>
        </div>
        <a href="/" className="a-btn ghost">← Game</a>
      </header>

      {/* Mobile nav overlay */}
      {mobileNavOpen && (
        <div className="a-mobile-nav-overlay" onClick={() => setMobileNavOpen(false)}>
          <div className="a-mobile-nav" onClick={e => e.stopPropagation()}>
            <div className="a-sidebar-brand" style={{ borderBottom: '1px solid var(--a-border)' }}>
              <div className="a-brand-mark">M</div>
              <div>
                <div className="a-brand-name">MARKETVERSEX</div>
                <div className="a-brand-sub">Admin Center</div>
              </div>
            </div>
            {navContent}
          </div>
        </div>
      )}

      <main className="a-main">
        {economy?.flags?.broadcastBanner && (
          <div className="a-banner" style={{ marginBottom: 18, borderRadius: 'var(--a-radius)' }}>
            📢 {economy.flags.broadcastBanner}
          </div>
        )}
        {pageEl}
      </main>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      <ToastHost />
    </div>
  );
}

function AuthModal({ onClose }: { onClose: () => void }) {
  const [tok, setTok] = useState(() => { try { return localStorage.getItem('mm_admin_token') || ''; } catch { return ''; } });
  const [act, setAct] = useState(() => { try { return localStorage.getItem('mm_admin_actor') || 'admin'; } catch { return 'admin'; } });
  const save = () => { setToken(tok); setActor(act); onClose(); };
  return (
    <div className="a-modal-backdrop" onClick={onClose}>
      <div className="a-modal" onClick={e => e.stopPropagation()}>
        <div className="a-modal-header"><h2><span className="a-modal-icon">🔑</span> Admin Credentials</h2></div>
        <div className="a-modal-body">
          <p>These are stored in browser localStorage and sent with every admin API request.</p>
          <div className="a-form-row">
            <div style={{ flex: 1 }}>
              <label className="a-label">Actor name</label>
              <input className="a-input" value={act} onChange={e => setAct(e.target.value)} placeholder="admin" />
            </div>
          </div>
          <div className="a-form-row" style={{ marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="a-label">Admin token (MM_ADMIN_TOKEN env)</label>
              <input className="a-input" type="password" value={tok} onChange={e => setTok(e.target.value)} placeholder="Leave blank in dev" />
            </div>
          </div>
        </div>
        <div className="a-modal-footer">
          <button className="a-btn ghost" onClick={onClose}>Cancel</button>
          <button className="a-btn primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
