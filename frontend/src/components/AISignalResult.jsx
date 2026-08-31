import React from 'react'
import { fmtTime } from '../services/format'

const COLORS = {
  BUY: { text: 'text-ok', border: 'border-ok/40', bg: 'bg-ok/10', bar: '#10b981', glyph: '▲' },
  SELL: { text: 'text-bad', border: 'border-bad/40', bg: 'bg-bad/10', bar: '#c0392b', glyph: '▼' },
  WAIT: { text: 'text-wait', border: 'border-wait/40', bg: 'bg-wait/10', bar: '#d4a017', glyph: '◆' },
}

export default function AISignalResult({ analysis = null, loading = false }) {
  if (!analysis) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-line bg-card2/60 py-8 text-center">
        <div className="px-6">
          <div className="text-sm font-semibold text-fg">
            {loading ? 'Analysing market…' : 'No AI result yet'}
          </div>
          <div className="mt-1 text-xs leading-relaxed text-muted">
            {loading ? 'Combining market data and indicators.' : 'Press “Analyse current market” to get an AI signal.'}
          </div>
        </div>
      </div>
    )
  }

  const signal = (analysis.signal || 'WAIT').toUpperCase()
  const confidence = Math.max(0, Math.min(100, Number(analysis.confidence) || 0))
  const c = COLORS[signal] || COLORS.WAIT
  const isEngine = !analysis.provider || analysis.provider === 'signal-engine'
  const provider = isEngine ? 'Technical engine (AI unavailable)' : `${analysis.provider}${analysis.model ? ' · ' + analysis.model : ''}`

  return (
    <section className={`relative overflow-hidden rounded-2xl border p-4 ${c.border} ${c.bg}`}>
      <div
        className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full opacity-20 blur-3xl"
        style={{ backgroundColor: c.bar, transform: 'translate(30%, -40%)' }}
      />
      <div className="relative flex items-center justify-between">
        <span className="rounded-md bg-black/30 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.18em]">
          <span className="text-gold">AI</span> <span className="text-muted">Result</span>
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted">
          {provider} · {fmtTime(analysis.generated_at || analysis.ts)}
        </span>
      </div>

      <div className="relative mt-3 flex items-center gap-3">
        <span className={`${c.text} text-5xl font-black leading-none tracking-tight`}>{c.glyph} {signal}</span>
        <span className="mb-1 flex items-end gap-1">
          <span className="text-2xl font-bold tabular-nums">{confidence}%</span>
          <span className="pb-0.5 text-[11px] uppercase text-muted">confidence</span>
        </span>
      </div>

      <div className="relative mt-4 h-2 w-full overflow-hidden rounded-full bg-black/30">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${confidence}%`, backgroundColor: c.bar }} />
      </div>

      {analysis.ai_error ? (
        <div className="relative mt-3 rounded-lg border border-bad/30 bg-bad/10 p-2 text-xs text-bad">
          AI analysis failed: {analysis.ai_error}
        </div>
      ) : analysis.market_summary ? (
        <div className="relative mt-3 text-sm leading-snug text-muted">{analysis.market_summary}</div>
      ) : analysis.reason ? (
        <div className="relative mt-3 text-sm leading-snug text-muted">{analysis.reason}</div>
      ) : null}
    </section>
  )
}
