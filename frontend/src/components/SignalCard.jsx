import Tier, { ProgressBar } from './Tier'

export default function SignalCard({ signal }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: 56,
          fontWeight: 800,
          lineHeight: 1.1,
          margin: '4px 0',
        }}
      >
        <Tier text={signal?.signal || 'WAIT'} />
      </div>
      <div className="muted" style={{ fontSize: 18 }}>
        Signal Strength <b>{signal?.confidence ?? 0}%</b>
      </div>
      <ProgressBar value={signal?.confidence} />
      {signal?.reason ? (
        <div className="wait" style={{ marginTop: 10, fontSize: 14 }}>
          {signal.reason}
        </div>
      ) : null}
      <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>
        BUY {signal?.buy_score ?? 0} &nbsp;|&nbsp; SELL {signal?.sell_score ?? 0}
      </div>
    </div>
  )
}