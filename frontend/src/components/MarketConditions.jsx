import React from 'react'

function Row({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span
        className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
          tone ? `${tone} bg-white/5` : 'bg-card2 text-fg'
        }`}
      >
        {value}
      </span>
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
    <section className="rounded-2xl border border-line bg-gradient-to-b from-card to-card2 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Market Conditions</span>
        {i.candle_count ? (
          <span className="rounded-full border border-line bg-card2 px-2 py-0.5 text-[10px] text-muted">{i.candle_count} candles</span>
        ) : null}
      </div>

      <Row label="H1 Trend" value={(i.trend || '—').toUpperCase()} tone={tone(i.trend)} />
      <Row label="EMA 20" value={i.ema20 == null ? '—' : Number(i.ema20).toFixed(2)} />
      <Row label="EMA 50" value={i.ema50 == null ? '—' : Number(i.ema50).toFixed(2)} />
      <Row label="RSI (14)" value={rsi ?? '—'} tone={rsiTone} />
      <Row label="MACD Hist" value={macd ?? '—'} tone={macdTone} />
      <Row label="Support" value={i.support == null ? '—' : Number(i.support).toFixed(2)} />
      <Row label="Resistance" value={i.resistance == null ? '—' : Number(i.resistance).toFixed(2)} />
      {i.volume != null && i.volume > 0 ? <Row label="Volume" value={Number(i.volume).toLocaleString()} /> : null}
    </section>
  )
}