/* Dashboard screen — KPI row, active filter tags, and bar-cell tables.
   Composes KpiCard, Panel, StatBar, Tag, Badge from the DS bundle. */
function BarTable({ title, count, columns, rows, pageSize = 6 }) {
  const { Panel, StatBar, Badge } = window.TainanRealtyAnalyticsDesignSystem_e1be47;
  const [page, setPage] = React.useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const slice = rows.slice(page * pageSize, page * pageSize + pageSize);
  const maxes = {};
  columns.forEach((c) => { if (c.bar) maxes[c.key] = Math.max(...rows.map((r) => +r[c.key] || 0), 1); });

  const pager = pages > 1 ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: '11px var(--font-mono)', color: 'var(--text-muted)' }}>
      <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} style={pagerBtn(page === 0)}>‹</button>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{page + 1} / {pages}</span>
      <button onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page === pages - 1} style={pagerBtn(page === pages - 1)}>›</button>
    </div>
  ) : null;

  return (
    <Panel title={title} count={count} actions={pager} flush>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
              {columns.map((c) => (
                <th key={c.key} className="t-label" style={{ padding: '8px 14px', textAlign: c.align || 'right', whiteSpace: 'nowrap' }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.03)' }}>
                {columns.map((c) => {
                  const v = r[c.key];
                  if (c.badge) {
                    const tone = v === '預售' ? 'info' : 'positive';
                    return <td key={c.key} style={{ padding: '7px 14px', textAlign: 'left' }}><Badge tone={tone}>{v}</Badge></td>;
                  }
                  if (c.bar) {
                    const pct = (+v / maxes[c.key]) * 100;
                    return <td key={c.key} style={{ padding: '6px 14px', textAlign: 'right' }}>
                      <StatBar value={c.fmt ? c.fmt(v) : Number(v).toLocaleString()} pct={pct} color={c.color} minWidth={c.minWidth || 72} />
                    </td>;
                  }
                  return <td key={c.key} style={{ padding: '7px 14px', textAlign: c.align || 'right', font: 'var(--weight-medium) 12px var(--font-sans)', color: 'var(--text-default)', whiteSpace: 'nowrap' }}>{c.fmt ? c.fmt(v) : v}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
function pagerBtn(disabled) {
  return { width: 24, height: 24, borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,.05)', border: 'none', color: 'var(--text-muted)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.3 : 1, fontSize: 13 };
}

function DashboardScreen({ filters }) {
  const { KpiCard, Tag } = window.TainanRealtyAnalyticsDesignSystem_e1be47;
  const D = window.TRA_DATA;
  const k = D.kpi;
  const tags = [...filters.districts, ...filters.types];

  const distCols = [
    { key: 'district', label: '行政區', align: 'left' },
    { key: 'count', label: '戶數', bar: true, color: 'var(--series-1)' },
    { key: 'unit_price', label: '單價(萬/坪)', bar: true, color: 'var(--series-3)', fmt: (v) => v },
    { key: 'area', label: '坪數', bar: true, color: 'var(--series-7)', fmt: (v) => v },
    { key: 'avg_total', label: '均總價(萬)', bar: true, color: 'var(--series-2)' },
    { key: 'sales', label: '總銷(億)', bar: true, color: 'var(--series-4)' },
    { key: 'pct', label: '佔比', bar: true, color: 'var(--series-5)', fmt: (v) => `${v}%`, minWidth: 56 },
  ];
  const typeCols = [
    { key: 'type', label: '類型', align: 'left' },
    { key: 'count', label: '戶數', bar: true, color: 'var(--series-1)' },
    { key: 'sales', label: '總銷(億)', bar: true, color: 'var(--series-4)' },
    { key: 'pct', label: '佔比', bar: true, color: 'var(--series-5)', fmt: (v) => `${v}%`, minWidth: 56 },
  ];
  const roomCols = [
    { key: 'rooms', label: '房型', align: 'left', fmt: (v) => `${v}房` },
    { key: 'count', label: '戶數', bar: true, color: 'var(--series-1)' },
    { key: 'unit_price', label: '單價(萬/坪)', bar: true, color: 'var(--series-3)', fmt: (v) => v },
    { key: 'area', label: '坪數', bar: true, color: 'var(--series-7)', fmt: (v) => v },
    { key: 'avg_total', label: '均總價(萬)', bar: true, color: 'var(--series-2)' },
    { key: 'pct', label: '佔比', bar: true, color: 'var(--series-5)', fmt: (v) => `${v}%`, minWidth: 56 },
  ];
  const caseCols = [
    { key: 'case_type', label: '類型', align: 'left', badge: true },
    { key: 'district', label: '行政區', align: 'left' },
    { key: 'name', label: '建案／地址', align: 'left' },
    { key: 'count', label: '銷售戶數', bar: true, color: 'var(--series-1)' },
    { key: 'sales_ratio', label: '銷售成數', bar: true, color: 'var(--series-5)', fmt: (v) => `${v}%` },
    { key: 'unit_price', label: '單價(萬/坪)', bar: true, color: 'var(--series-3)', fmt: (v) => v },
    { key: 'avg_total', label: '均總價(萬)', bar: true, color: 'var(--series-2)' },
  ];

  return (
    <div style={{ padding: '16px 20px 40px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
        <KpiCard label="成交戶數" value={k.total.toLocaleString()} unit="戶" tone="brass" icon="▦" delta="+4.2%" />
        <KpiCard label="均單價" value={k.avg_unit_price} unit="萬/坪" tone="sky" icon="◳" />
        <KpiCard label="均坪數" value={k.avg_area} unit="坪" tone="positive" icon="◰" />
        <KpiCard label="均總價" value={k.avg_total.toLocaleString()} unit="萬" tone="clay" icon="◆" delta="-1.1%" />
        <KpiCard label="總銷售額" value={k.total_sales.toLocaleString()} unit="億" tone="coral" icon="◈" />
      </div>

      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {tags.map((t) => <Tag key={t}>{t}</Tag>)}
        </div>
      )}

      <div style={{ display: 'grid', gap: 'var(--gap-card)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.9fr 1fr', gap: 'var(--gap-card)' }}>
          <BarTable title="行政區排行" count={D.districts.length} columns={distCols} rows={D.districts} />
          <BarTable title="類型統計" count={D.types.length} columns={typeCols} rows={D.types} />
        </div>
        <BarTable title="房型統計" count={D.rooms.length} columns={roomCols} rows={D.rooms} />
        <BarTable title="個案統計（成屋 ＋ 預售屋）" count={D.cases.length} columns={caseCols} rows={D.cases} />
      </div>
    </div>
  );
}
window.DashboardScreen = DashboardScreen;
