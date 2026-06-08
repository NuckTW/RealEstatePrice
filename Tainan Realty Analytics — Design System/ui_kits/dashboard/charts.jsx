/* Lightweight SVG charts for the Analytics screen. Data-viz only —
   colours come from --series-* tokens. Attaches to window. */

function useTokenColor(varName, fallback) {
  return `var(${varName}, ${fallback})`;
}

/* ── Area + line trend ─────────────────────────────────────── */
function LineChart({ data, xKey, yKey, color = 'var(--series-1)', height = 220, format = (v) => v }) {
  const w = 720, h = height, padL = 44, padR = 16, padT = 16, padB = 28;
  const xs = data.map((d) => d[xKey]);
  const ys = data.map((d) => d[yKey]);
  const min = Math.min(...ys), max = Math.max(...ys);
  const range = max - min || 1;
  const ix = (i) => padL + (i / (data.length - 1)) * (w - padL - padR);
  const iy = (v) => padT + (1 - (v - min) / range) * (h - padT - padB);
  const line = ys.map((v, i) => `${i === 0 ? 'M' : 'L'}${ix(i).toFixed(1)},${iy(v).toFixed(1)}`).join(' ');
  const area = `${line} L${ix(data.length - 1).toFixed(1)},${h - padB} L${ix(0).toFixed(1)},${h - padB} Z`;
  const gridVals = [min, min + range / 2, max];
  const gid = 'g' + Math.random().toString(36).slice(2, 7);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridVals.map((g, i) => (
        <g key={i}>
          <line x1={padL} x2={w - padR} y1={iy(g)} y2={iy(g)} stroke="rgba(255,255,255,.06)" strokeWidth="1" />
          <text x={padL - 8} y={iy(g) + 3} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="var(--text-faint)">{format(+g.toFixed(1))}</text>
        </g>
      ))}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {ys.map((v, i) => (i % 4 === 0 || i === ys.length - 1) && (
        <circle key={i} cx={ix(i)} cy={iy(v)} r="2.5" fill="var(--bg-app)" stroke={color} strokeWidth="1.5" />
      ))}
      {xs.map((x, i) => (i % 4 === 0 || i === xs.length - 1) && (
        <text key={i} x={ix(i)} y={h - 8} textAnchor="middle" fontSize="9.5" fontFamily="var(--font-mono)" fill="var(--text-faint)">{x}</text>
      ))}
    </svg>
  );
}

/* ── Vertical bar chart ────────────────────────────────────── */
function BarChart({ data, xKey, yKey, color = 'var(--series-1)', height = 220, format = (v) => v }) {
  const w = 720, h = height, padL = 44, padR = 12, padT = 14, padB = 30;
  const ys = data.map((d) => d[yKey]);
  const max = Math.max(...ys) || 1;
  const bw = (w - padL - padR) / data.length;
  const iy = (v) => padT + (1 - v / max) * (h - padT - padB);
  const ticks = [0, max / 2, max];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: 'block' }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={w - padR} y1={iy(t)} y2={iy(t)} stroke="rgba(255,255,255,.06)" strokeWidth="1" />
          <text x={padL - 8} y={iy(t) + 3} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="var(--text-faint)">{format(Math.round(t))}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const bh = (h - padT - padB) * (d[yKey] / max);
        const x = padL + i * bw + bw * 0.16;
        const bwInner = bw * 0.68;
        return (
          <g key={i}>
            <rect x={x} y={h - padB - bh} width={bwInner} height={bh} rx="4" fill={color} opacity="0.85" />
            <text x={x + bwInner / 2} y={h - 10} textAnchor="middle" fontSize="10" fontFamily="var(--font-sans)" fill="var(--text-muted)">{d[xKey]}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Donut / share chart ───────────────────────────────────── */
function DonutChart({ data, valueKey, labelKey, size = 200, colors }) {
  const palette = colors || ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)'];
  const total = data.reduce((s, d) => s + d[valueKey], 0) || 1;
  const r = size / 2, ir = r * 0.62, cx = r, cy = r;
  let a0 = -Math.PI / 2;
  const arc = (val) => {
    const a1 = a0 + (val / total) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a, rad) => [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
    const [x0, y0] = p(a0, r), [x1, y1] = p(a1, r);
    const [x2, y2] = p(a1, ir), [x3, y3] = p(a0, ir);
    a0 = a1;
    return `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${ir},${ir} 0 ${large} 0 ${x3},${y3} Z`;
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flex: 'none' }}>
        {data.map((d, i) => <path key={i} d={arc(d[valueKey])} fill={palette[i % palette.length]} />)}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: palette[i % palette.length], flex: 'none' }} />
            <span style={{ font: '12px var(--font-sans)', color: 'var(--text-default)', minWidth: 64 }}>{d[labelKey]}</span>
            <span style={{ font: 'var(--weight-semibold) 12px var(--font-mono)', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{((d[valueKey] / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { LineChart, BarChart, DonutChart });
