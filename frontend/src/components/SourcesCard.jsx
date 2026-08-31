import React from 'react'
import { fmtPrice, fmtTime, fmtAge } from '../services/format'

const style = (status) => {
  switch (status) {
    case 'LIVE':
      return 'bg-ok/15 text-ok border-ok/30'
    case 'STALE':
      return 'bg-wait/15 text-wait border-wait/30'
    default:
      return 'bg-bad/15 text-bad border-bad/30'
  }
}
const dot = (status) => {
  if (status === 'LIVE') return '#10b981'
  if (status === 'STALE') return '#d4a017'
  return '#c0392b'
}

function Source({ s, active }) {
  return (
    <div
      className={`rounded-xl border p-3 transition ${
        active ? 'border-gold/40 bg-gold/5' : 'border-line bg-card/40'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md text-[9px] font-black text-black">
            {s?.short === 'MT5' ? (
              <span className="grid h-6 w-6 place-items-center rounded-md bg-gold text-[9px] font-black text-black">
                M5
              </span>
            ) : (
              <span className="grid h-6 w-6 place-items-center rounded-md bg-sky-400/90 text-[9px] font-black text-black">
                LSE
              </span>
            )}
          </span>
          <div className="leading-tight">
            <div className="text-[11px] font-bold">{s?.short}</div>
            <div className="max-w-[10rem] truncate text-[9px] text-muted">{s?.name}</div>
            <div className="text-[8px] uppercase tracking-wide text-muted/70">{s?.role}</div>
          </div>
        </div>
        <span
          className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${style(s?.status)}`}
        >
          {s?.status || 'CONNECTING'}
        </span>
      </div>

      <div className="mt-2.5 text-xl font-extrabold tabular-nums">
        {fmtPrice(s?.price)}
      </div>

      <div className="mt-1.5 grid grid-cols-3 gap-1 border-t border-line/50 pt-1.5 text-center">
        <div>
          <div className="text-[8px] uppercase text-muted">Bid</div>
          <div className="text-[11px] font-semibold tabular-nums text-ok">{fmtPrice(s?.bid)}</div>
        </div>
        <div>
          <div className="text-[8px] uppercase text-muted">Ask</div>
          <div className="text-[11px] font-semibold tabular-nums text-bad">{fmtPrice(s?.ask)}</div>
        </div>
        <div>
          <div className="text-[8px] uppercase text-muted">Time</div>
          <div className="text-[11px] font-semibold tabular-nums">{fmtTime(s?.timestamp)}</div>
        </div>
      </div>
    </div>
  )
}

export default function SourcesCard({ market }) {
  const sources = market?.sources
  const mt5 = sources?.mt5
  const lse = sources?.lse
  const active = sources?.active
  const lastTs = market?.timestamp

  return (
    <section className="rounded-2xl border border-line bg-gradient-to-b from-card to-card2 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Live Feeds</div>
        <span className="text-[10px] text-muted">
          Updated {fmtAge(lastTs)}
          {active ? <span className="text-gold"> · {active === 'mt5' ? 'MT5 primary' : 'LSE primary'}</span> : null}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Source s={mt5} active={active === 'mt5'} />
        <Source s={lse} active={active === 'lse'} />
      </div>
    </section>
  )
}
