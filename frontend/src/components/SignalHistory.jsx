import React from 'react'
import { fmtTime } from '../services/format'

const S = {
  BUY: { text: 'text-ok', bg: 'bg-ok/10', border: 'border-ok/30' },
  SELL: { text: 'text-bad', bg: 'bg-bad/10', border: 'border-bad/30' },
  WAIT: { text: 'text-wait', bg: 'bg-wait/10', border: 'border-wait/30' },
}

export default function SignalHistory({ rows = [], expanded = false }) {
  if (!rows.length) {
    return (
      <section className="rounded-2xl border border-line bg-gradient-to-b from-card to-card2 p-4 text-center text-sm text-muted">
        No signals yet — run an analysis to begin building history.
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-line bg-gradient-to-b from-card to-card2 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Signal History</span>
        <span className="rounded-full border border-line bg-card2 px-2 py-0.5 text-[10px] text-muted">{rows.length} recorded</span>
      </div>
      <div className="space-y-1.5">
        {(expanded ? rows : rows.slice(0, 8)).map((r, i) => {
          const c = S[r.signal] || S.WAIT
          return (
            <div
              key={`${r.ts}-${i}`}
              className="flex items-center justify-between rounded-xl border border-line/60 bg-card2/70 px-3 py-2"
            >
              <div className="flex items-center gap-2.5">
                <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${c.bg} ${c.border} ${c.text}`}>
                  {(r.signal || 'WAIT').slice(0, 4)}
                </span>
                <span className="text-xs tabular-nums text-muted">{fmtTime(r.ts)}</span>
              </div>
              <div className="flex items-center gap-3 text-xs tabular-nums">
                {r.price != null ? (
                  <span className="font-semibold text-fg">
                    {Number(r.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                ) : null}
                <span className={c.text}>
                  {Math.round(Number(r.confidence) || 0)}%
                </span>
                <span className="hidden rounded-full bg-black/30 px-2 py-0.5 text-[10px] uppercase text-muted sm:inline">
                  {r.provider || 'signal-engine'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}