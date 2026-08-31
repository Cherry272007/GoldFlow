import React from 'react'
import { fmtAge } from '../services/format'

const statusStyle = (status) => {
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
  if (status === 'LIVE') return '#21d07a'
  if (status === 'STALE') return '#ffb224'
  return '#ff4d5e'
}

export default function Header({ market, status }) {
  const s = market?.status || status?.market?.status || 'CONNECTING'
  return (
    <header className="flex items-center justify-between px-4 pt-4 pb-2">
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gold/15 border border-gold/30">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2 L20 6 V12 C20 17 16.5 20.5 12 22 C7.5 20.5 4 17 4 12 V6 Z"
              stroke="#f5c542"
              strokeWidth="1.8"
            />
            <text x="12" y="15" textAnchor="middle" fontSize="8" fontWeight="700" fill="#f5c542">
              G
            </text>
          </svg>
        </div>
        <div>
          <div className="text-lg font-bold leading-none tracking-wide">GOLDFLOW</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted">AI Gold Analyst</div>
        </div>
      </div>
      <div
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusStyle(s)}`}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: dot(s), boxShadow: `0 0 8px ${dot(s)}` }}
        />
        {s}
        {market?.timestamp ? <span className="opacity-70">· {fmtAge(market.timestamp)}</span> : null}
      </div>
    </header>
  )
}