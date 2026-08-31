import React from 'react'
import { fmtTime } from '../services/format'

const COLORS = {
  BUY: { text: 'text-ok', border: 'border-ok/40', bg: 'bg-ok/10', bar: '#10b981', glyph: '▲' },
  SELL: { text: 'text-bad', border: 'border-bad/40', bg: 'bg-bad/10', bar: '#c0392b', glyph: '▼' },
  WAIT: { text: 'text-wait', border: 'border-wait/40', bg: 'bg-wait/10', bar: '#d4a017', glyph: '◆' },
}

function Column({ title, subtitle, data, empty }) {
  const signal = (data?.signal || 'WAIT').toUpperCase()
  const confidence = Math.max(0, Math.min(100, Number(data?.confidence) || 0))
  const c = COLORS[signal] || COLORS.WAIT
  const provider = data?.provider === 'signal-engine' ? 'Technical' : data?.provider || 'AI'

  return (
    <div className={`rounded-2xl border p-4 ${c.border} ${c.bg}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{title}</span>
        {subtitle ? (
          <span className="text-[9px] uppercase tracking-wider text-muted">{subtitle}</span>
        ) : null}
      </div>

      {empty ? (
        <div className="mt-3 grid place-items-center rounded-xl border border-dashed border-line bg-black/20 py-8 text-xs text-muted">
          {empty}
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-end gap-2">
            <span className={`${c.text} text-5xl font-black leading-none tracking-tight`}>
              {c.glyph} {signal}
            </span>
            <span className="mb-0.5 text-xl font-bold tabular-nums">{confidence}%</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/30">
            <div className="h-full rounded-full" style={{ width: `${confidence}%`, backgroundColor: c.bar }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted">
            <span>{provider}</span>
            {data?.ts ? <span>{fmtTime(data.ts)}</span> : null}
          </div>
          {data?.ai_error ? (
            <div className="mt-2 rounded-lg border border-wait/30 bg-wait/10 p-2 text-[11px] text-wait">
              {data.ai_error}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default function SignalCompare({ compare = null }) {
  const technical = compare?.technical
  const ai = compare?.ai
  const aiConfigured = compare?.ai_configured

  return (
    <section className="rounded-2xl border border-line bg-gradient-to-b from-card to-card2 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Signal Comparison</span>
        <span className="text-[10px] text-muted/80">Technical vs AI</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Column
          title="Technical"
          subtitle="Indicators only"
          data={technical}
          empty={technical ? null : 'No technical signal yet'}
        />
        <Column
          title="AI Verdict"
          subtitle={aiConfigured ? 'OpenRouter' : 'AI unavailable'}
          data={ai}
          empty={
            aiConfigured
              ? 'Run an AI analysis to see its verdict here'
              : 'AI is not configured — showing the technical signal'
          }
        />
      </div>
    </section>
  )
}
