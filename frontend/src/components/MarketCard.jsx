import Tier from './Tier'

function Metric({ label, value, tone }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
      <span className="muted">{label}</span>
      <span>{tone ? <Tier text={tone} /> : value ?? '--'}</span>
    </div>
  )
}

export default function MarketCard({ signal, status }) {
  const mt5Age = status?.mt5?.age_seconds
  const bmAge = status?.bookmap?.age_seconds
  const updated = signal?.updated_at ? String(signal.updated_at).slice(11, 19) : '--'
  return (
    <div className="card">
      <Metric label="Symbol" value={signal?.symbol || 'XAUUSD'} />
      <Metric label="H1 Trend" tone={signal?.h1_trend || 'NEUTRAL'} />
      <Metric label="M15 Structure" tone={signal?.m15_structure || 'NEUTRAL'} />
      <Metric label="Bookmap Flow" tone={signal?.bookmap_flow || 'NEUTRAL'} />
      <Metric label="Delta" value={signal?.delta ?? 0} />
      <Metric label="Bid" value={signal?.price != null ? signal.price.toFixed(2) : '--'} />
      <Metric label="MT5 last seen" value={mt5Age != null ? `${mt5Age}s ago` : '--'} />
      <Metric label="Bookmap last seen" value={bmAge != null ? `${bmAge}s ago` : '--'} />
      <Metric label="Updated" value={updated} />
    </div>
  )
}