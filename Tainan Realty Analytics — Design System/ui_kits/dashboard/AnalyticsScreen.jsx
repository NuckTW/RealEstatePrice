/* Analytics screen — the expanded data-analysis surface (增加數據分析).
   Trend line, transaction volume, type share, district comparison.
   Composes Panel, KpiCard, TabPills, Badge + the local chart helpers. */
function AnalyticsScreen() {
  const { Panel, KpiCard, TabPills, Badge } = window.TainanRealtyAnalyticsDesignSystem_e1be47;
  const { LineChart, BarChart, DonutChart } = window;
  const D = window.TRA_DATA;
  const [metric, setMetric] = React.useState('unit_price');

  const first = D.months[0].unit_price;
  const last = D.months[D.months.length - 1].unit_price;
  const yoy = (((last - first) / first) * 100).toFixed(1);
  const peak = D.months.reduce((a, b) => (b.volume > a.volume ? b : a));

  const metricMeta = {
    unit_price: { label: '均單價趨勢', unit: '萬/坪', color: 'var(--series-3)', fmt: (v) => v },
    volume: { label: '成交量趨勢', unit: '戶', color: 'var(--series-1)', fmt: (v) => Math.round(v).toLocaleString() },
  };
  const m = metricMeta[metric];

  return (
    <div style={{ padding: '16px 20px 40px', display: 'grid', gap: 'var(--gap-card)' }}>
      {/* analytical KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <KpiCard label="24個月漲幅" value={`+${yoy}`} unit="%" tone="positive" icon="↗" />
        <KpiCard label="現期均單價" value={last} unit="萬/坪" tone="sky" icon="◳" />
        <KpiCard label="成交高峰" value={peak.label} unit={`${peak.volume.toLocaleString()} 戶`} tone="clay" icon="◆" />
        <KpiCard label="主力房型" value="3房" unit="39.8%" tone="brass" icon="▦" />
      </div>

      {/* trend */}
      <Panel
        title={m.label}
        actions={
          <TabPills value={metric} onChange={setMetric} tabs={[
            { value: 'unit_price', label: '單價' },
            { value: 'volume', label: '成交量' },
          ]} />
        }
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
          <span style={{ font: 'var(--weight-bold) 24px var(--font-mono)', color: m.color, letterSpacing: 'var(--tracking-tight)' }}>
            {metric === 'unit_price' ? last : last && D.months[D.months.length - 1].volume.toLocaleString()}
          </span>
          <span style={{ font: '12px var(--font-sans)', color: 'var(--text-faint)' }}>{m.unit} · 民國 113/06 – 115/06</span>
          <Badge tone="positive" style={{ marginLeft: 'auto' }}>↗ 較期初 +{yoy}%</Badge>
        </div>
        <LineChart data={D.months} xKey="label" yKey={metric} color={m.color} format={m.fmt} />
      </Panel>

      {/* two-up: volume bars + type donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 'var(--gap-card)' }}>
        <Panel title="各行政區成交量">
          <BarChart data={D.districts.slice(0, 8)} xKey="district" yKey="count" color="var(--series-1)" format={(v) => v.toLocaleString()} />
        </Panel>
        <Panel title="建物類型佔比">
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
            <DonutChart data={D.types} valueKey="count" labelKey="type" />
          </div>
        </Panel>
      </div>

      {/* district avg price comparison */}
      <Panel title="各行政區均單價比較">
        <BarChart data={D.districts.slice(0, 8)} xKey="district" yKey="unit_price" color="var(--series-3)" format={(v) => `${v}`} height={200} />
      </Panel>
    </div>
  );
}
window.AnalyticsScreen = AnalyticsScreen;
