/* Top navigation bar. Composes Badge from the DS bundle. */
function Navbar({ view, onNav }) {
  const { Badge, ThemeToggle } = window.TainanRealtyAnalyticsDesignSystem_e1be47;
  const links = [
    { id: 'dashboard', label: '數據看板', icon: '▦' },
    { id: 'analytics', label: '趨勢分析', icon: '◈' },
    { id: 'chat', label: 'AI 問答', icon: '◇' },
  ];
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      borderBottom: '1px solid var(--border-card)',
      background: 'var(--chrome-bg)', backdropFilter: 'var(--blur-chrome)', WebkitBackdropFilter: 'var(--blur-chrome)',
    }}>
      <div style={{ height: 'var(--nav-h)', padding: '0 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 'var(--radius-md)', background: 'var(--gradient-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', font: 'var(--weight-bold) 15px var(--font-cjk)', boxShadow: 'var(--glow-accent)',
          }}>南</div>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ font: 'var(--weight-semibold) 14px var(--font-sans)', color: 'var(--text-strong)', letterSpacing: 'var(--tracking-tight)' }}>台南市不動產分析</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 1 }}>
              <span style={{ font: '10px var(--font-sans)', color: 'var(--text-faint)' }}>民國 110 年至今</span>
              <Badge tone="brass" dot pulse>最新 115年6月</Badge>
            </div>
          </div>
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {links.map((l) => {
            const active = view === l.id;
            return (
              <button key={l.id} onClick={() => onNav(l.id)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '0 13px', height: 32,
                borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'var(--transition-base)',
                font: 'var(--weight-medium) 12px var(--font-sans)',
                color: active ? 'var(--accent-tint)' : 'var(--text-muted)',
                background: active ? 'var(--accent-wash)' : 'transparent',
                border: active ? '1px solid var(--accent-wash-border)' : '1px solid transparent',
              }}>
                <span style={{ opacity: 0.75 }}>{l.icon}</span>{l.label}
              </button>
            );
          })}
          </div>
          <div style={{ width: 1, height: 22, background: 'var(--line-soft)' }} />
          <ThemeToggle labels={false} />
        </nav>
      </div>
    </header>
  );
}
window.Navbar = Navbar;
