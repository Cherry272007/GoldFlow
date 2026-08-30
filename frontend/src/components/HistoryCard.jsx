import Tier from './Tier'

export default function HistoryCard({ history }) {
  if (!history || history.length === 0) {
    return (
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>History</div>
        <div className="muted">No signals yet</div>
      </div>
    )
  }
  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 8 }}>History</div>
      {history.map((row, i) => (
        <div key={row.ts || i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
          <span className="muted">{(row.ts || '').slice(11, 19) || '--'}</span>
          <span>
            <Tier text={row.signal} />{' '}
            <b>{row.strength}%</b>
          </span>
        </div>
      ))}
    </div>
  )
}