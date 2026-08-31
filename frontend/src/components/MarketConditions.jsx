import React from 'react'

function Row({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between border-b border-line/50 py-1.5 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${tone || ''}`}>{value}</span>
    </div>
  )
}

const tone = (v) => {
  const s = String(v).toUpperCase()
  if (s.includes('BULL')) return 'text-ok'
  if (s.includes('BEAR')) return 'text-bad'
  return 'text-wait'
}

export default function MarketConditions({ indicators = null }) {
  const i = indicators || {}
  const rsi = i.rsi == null ? null : Number(i.rsi).toFixed(1)
  const rsiTone = rsi == null ? '' : i.rsi > 55 ? 'text-ok' : i.rsi < 45 ? 'text-bad' : 'text-wait'
  const macd = i.macd_histogram == null ? null : Number(i.macd_histogram).toFixed(2)
  const macdTone = macd == null ? '' : i.macd_histogram > 0 ? 'text-ok' : i.macd_histogram < 0 ? 'text-bad' : 'text-wait'

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Market Conditions</div>

      <Row label="H1 Trend" value={(i.trend || '—').toUpperCase()} tone={tone(i.trend)} />
      <Row label="EMA 20" value={i.ema20 == null ? '—' : Number(i.ema20).toFixed(2)} />
      <Row label="EMA 50" value={i.ema50 == null ? '—' : Number(i.ema50).toFixed(2)} />
      <Row label="RSI (14)" value={rsi ?? '—'} tone={rsiTone} />
      <Row label="MACD Hist" value={macd ?? '—'} tone={macdTone} />
      <Row label="Support" value={i.support == null ? '—' : Number(i.support).toFixed(2)} />
      <Row label="Resistance" value={i.resistance == null ? '—' : Number(i.resistance).toFixed(2)} />
      <Row label="Candles" value={i.candle_count ?? (i.candles || '—')} />
      {i.volume != null && i.volume > 0 ? <Row label="Volume" value={Number(i.volume).toLocaleString()} /> : null}
    </section>
  )
}