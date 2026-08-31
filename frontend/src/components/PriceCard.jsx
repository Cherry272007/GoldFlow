import React from 'react'
import { fmtPrice, fmtTime } from '../services/format'

export default function PriceCard({ market }) {
  const bid = market?.bid
  const ask = market?.ask
  const mid = market?.price ?? (bid != null && ask != null ? (bid + ask) / 2 : null)
  const spread = market?.spread ?? (bid != null && ask != null ? ask - bid : null)

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Gold Spot</div>
          <div className="text-3xl font-extrabold tabular-nums tracking-tight">{fmtPrice(mid)}</div>
        </div>
        <div className="grid h-14 w-14 place-items-center rounded-full border border-gold/40 bg-gold/10">
          <span className="text-gold text-xs font-black">Au</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted">Bid</div>
          <div className="text-sm font-semibold tabular-nums text-ok">{fmtPrice(bid)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted">Ask</div>
          <div className="text-sm font-semibold tabular-nums text-bad">{fmtPrice(ask)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted">Spread</div>
          <div className="text-sm font-semibold tabular-nums">{spread == null ? '—' : Number(spread).toFixed(2)}</div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-muted">
        <span>Source: {market?.source?.name || 'LSE'}</span>
        <span>Updated {fmtTime(market?.timestamp)}</span>
      </div>
    </section>
  )
}