import React from 'react'
import { fmtTime } from '../services/format'

const COLORS = {
  BUY: { text: 'text-ok', border: 'border-ok/40', bg: 'bg-ok/10', bar: '#21d07a', glyph: '▲' },
  SELL: { text: 'text-bad', border: 'border-bad/40', bg: 'bg-bad/10', bar: '#ff4d5e', glyph: '▼' },
  WAIT: { text: 'text-wait', border: 'border-wait/40', bg: 'bg-wait/10', bar: '#ffb224', glyph: '◆' },
}

export default function SignalCard({ analysis = null, loading = false }) {
  const signal = (analysis?.signal || 'WAIT').toUpperCase()
  const confidence = Math.max(0, Math.min(100, Number(analysis?.confidence) || 0))
  const c = COLORS[signal] || COLORS.WAIT
  const provider = analysis?.provider
  const gated = provider === 'signal-engine'

  return (
    <section className={`rounded-2xl border border-line p-4 ${c.bg} ${c.border}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Signal</span>
        <span className="text-[10px] uppercase tracking-wider text-muted">
          {gated ? 'Technical engine' : provider || 'GoldFlow AI'} · {fmtTime(analysis?.generated_at || analysis?.ts)}
        </span>
      </div>

      <div className="mt-2 flex items-end gap-3">
        <span className={`text-6xl font-black leading-none tracking-tight ${c.text}`}>{signal}</span>
        <span className="mb-1 text-2xl font-bold tabular-nums">{confidence}%</span>
      </div>

      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-black/30">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${confidence}%`, backgroundColor: c.bar }}
        />
      </div>

      {loading ? (
        <div className="mt-3 animate-pulse text-sm text-muted">Analysing market + charts…</div>
      ) : analysis?.ai_error ? (
        <div className="mt-3 rounded-lg border border-bad/30 bg-bad/10 p-2 text-xs text-bad">
          AI analysis failed: {analysis.ai_error}
        </div>
      ) : analysis?.market_summary ? (
        <div className="mt-3 text-sm leading-snug text-muted">{analysis.market_summary}</div>
      ) : analysis?.reason ? (
        <div className="mt-3 text-sm leading-snug text-muted">{analysis.reason}</div>
      ) : null}

      {analysis?.error ? (
        <div className="mt-3 rounded-lg border border-wait/30 bg-wait/10 p-2 text-xs text-wait">
          {analysis.error}
        </div>
      ) : null}
    </section>
  )
}