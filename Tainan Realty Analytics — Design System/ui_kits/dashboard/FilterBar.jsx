/* Sticky filter bar. Composes Select, Button, Checkbox, Tag from the DS bundle. */
function FilterBar({ filters, onChange, onApply, onClear, loading }) {
  const { Select, Button, Checkbox } = window.TainanRealtyAnalyticsDesignSystem_e1be47;
  const [openMenu, setOpenMenu] = React.useState(null);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpenMenu(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const YEARS = [{ label: '114年', value: '114' }, { label: '115年', value: '115' }];
  const MONTHS = Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1}月`, value: String(i + 1) }));
  const PRESALE = [{ label: '成屋 + 預售', value: 'all' }, { label: '成屋', value: 'false' }, { label: '預售屋', value: 'true' }];
  const AGE = [{ label: '不限屋齡', value: 'all' }, { label: '5年以內', value: '5' }, { label: '10年以內', value: '10' }, { label: '20年以內', value: '20' }, { label: '30年以上', value: '30+' }];
  const DISTRICTS = ['永康區', '安南區', '東區', '中西區', '北區', '南區', '仁德區', '歸仁區'];
  const TYPES = ['住宅大樓', '透天厝', '華廈', '公寓', '套房', '辦公商業'];

  const set = (k, v) => onChange({ ...filters, [k]: v });
  const toggle = (k, v) => {
    const cur = filters[k];
    set(k, cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
  };

  const Multi = ({ k, label, options }) => {
    const sel = filters[k];
    const text = sel.length === 0 ? `全部${label}` : sel.length === 1 ? sel[0] : `${sel.length} 項`;
    const isOpen = openMenu === k;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, position: 'relative' }}>
        <span className="t-label">{label}</span>
        <button onClick={() => setOpenMenu(isOpen ? null : k)} style={{
          height: 'var(--control-h-sm)', minWidth: 112, padding: '0 10px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          background: 'var(--surface-control)', borderRadius: 'var(--radius-md)', cursor: 'pointer',
          border: `1px solid ${isOpen ? 'var(--accent)' : 'var(--border-control)'}`,
          font: '12px var(--font-sans)', color: sel.length ? 'var(--accent-tint)' : 'var(--text-default)',
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
          <span style={{ color: 'var(--text-faint)', fontSize: 9, transform: isOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
        </button>
        {isOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 5, zIndex: 200, width: 184,
            background: 'var(--surface-overlay)', border: '1px solid var(--border-control)',
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-pop)', padding: 5, maxHeight: 250, overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', gap: 12, padding: '4px 8px 8px', borderBottom: '1px solid var(--line-soft)', marginBottom: 4 }}>
              <button onClick={() => set(k, options.slice())} style={{ background: 'none', border: 'none', color: 'var(--accent-tint)', font: '11px var(--font-sans)', cursor: 'pointer' }}>全選</button>
              <button onClick={() => set(k, [])} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', font: '11px var(--font-sans)', cursor: 'pointer' }}>清除</button>
            </div>
            {options.map((o) => (
              <Checkbox key={o} checked={sel.includes(o)} onChange={() => toggle(k, o)} style={{ width: '100%' }}>{o}</Checkbox>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={ref} style={{
      position: 'sticky', top: 'var(--nav-h)', zIndex: 90,
      background: 'var(--chrome-bg)', backdropFilter: 'var(--blur-chrome)', WebkitBackdropFilter: 'var(--blur-chrome)',
      borderBottom: '1px solid var(--border-card)', padding: '12px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--gap-control)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span className="t-label">起始</span>
          <div style={{ display: 'flex', gap: 5 }}>
            <Select value={filters.fromYear} onChange={(v) => set('fromYear', v)} options={YEARS} />
            <Select value={filters.fromMonth} onChange={(v) => set('fromMonth', v)} options={MONTHS} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span className="t-label">結束</span>
          <div style={{ display: 'flex', gap: 5 }}>
            <Select value={filters.toYear} onChange={(v) => set('toYear', v)} options={YEARS} />
            <Select value={filters.toMonth} onChange={(v) => set('toMonth', v)} options={MONTHS} />
          </div>
        </div>
        <div style={{ width: 1, height: 30, background: 'var(--line-soft)', alignSelf: 'flex-end', marginBottom: 1 }} />
        <Multi k="districts" label="行政區" options={DISTRICTS} />
        <Multi k="types" label="類型" options={TYPES} />
        <Select label="成／預售" value={filters.presale} onChange={(v) => set('presale', v)} options={PRESALE} />
        <Select label="屋齡" value={filters.age} onChange={(v) => set('age', v)} options={AGE} />
        <div style={{ width: 1, height: 30, background: 'var(--line-soft)', alignSelf: 'flex-end', marginBottom: 1 }} />
        <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end' }}>
          <Button variant="primary" size="sm" loading={loading} onClick={onApply}>套用篩選</Button>
          <Button variant="secondary" size="sm" onClick={onClear}>清除</Button>
        </div>
      </div>
    </div>
  );
}
window.FilterBar = FilterBar;
