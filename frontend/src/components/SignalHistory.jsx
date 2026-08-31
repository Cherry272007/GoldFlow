import React from 'react'
import { fmtTime } from '../services/format'

const S = {
  BUY: 'text-ok',
  SELL: 'text-bad',
  WAIT: 'text-wait',
}

export default function SignalHistory({ rows = [], expanded = false }) {
  if (!rows.length) {
    return (
      <section className="rounded-2xl border border-line bg-card p-4 text-center text-sm text-muted">
        No signals yet — run an analysis to begin building history.
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Signal History</div>
      <div className="space-y-1.5">
        {(expanded ? rows : rows.slice(0, 8)).map((r, i) => (
          <div
            key={`${r.ts}-${i}`}
            className="flex items-center justify-between rounded-xl border border-line/60 bg-card2 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className={`text-sm font-black ${S[r.signal] || 'text-wait'}`}>
                {(r.signal || 'WAIT').slice(0, 4)}
              </span>
              <span className="text-xs tabular-nums text-muted">{fmtTime(r.ts)}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted tabular-nums">
              {r.price != null ? <span>{Number(r.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span> : null}
              <span className={S[r.signal] || 'text-wait'}>{Math.round(Number(r.confidence) || 0)}%</span>
              <span className="opacity-60">{r.provider || 'signal-engine'}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}