import './styles.css'

function Tier({ text }) {
  const cls =
    text === 'BUY' || text === 'BULLISH' || text === 'BUYING'
      ? 'ok'
      : text === 'SELL' || text === 'BEARISH' || text === 'SELLING'
        ? 'bad'
        : 'wait'
  return <span className={cls}>{text}</span>
}

export default Tier
export { Tier }

export function ProgressBar({ value }) {
  const cls = value > 0 ? (value >= 60 ? 'ok' : 'wait') : 'muted'
  const width = Math.max(0, Math.min(100, value || 0))
  return (
    <div>
      <div
        style={{
          background: '#0a111c',
          borderRadius: 8,
          height: 14,
          border: '1px solid var(--line)',
          marginTop: 10,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${width}%`,
            background: 'var(--' + (cls === 'ok' ? 'ok' : 'wait') + ')',
            borderRadius: 8,
            transition: 'width .4s ease',
          }}
        />
      </div>
    </div>
  )
}