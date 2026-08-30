function Row({ label, connected }) {
  return (
    <div>
      <span className="muted">{label}</span>{' '}
      {connected ? <span className="ok">&#9679; Connected</span> : <span className="bad">&#9679; Disconnected</span>}
    </div>
  )
}

export default function ConnectionCard({ status }) {
  return (
    <div className="card">
      <Row label="MT5" connected={status?.mt5?.connected} />
      <Row label="Bookmap" connected={status?.bookmap?.connected} />
      <Row label="GoldFlow Server" connected={!!status?.server?.connected} />
    </div>
  )
}