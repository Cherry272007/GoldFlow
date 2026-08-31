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
  if (status === 'LIVE') return '#10b981'
  if (status === 'STALE') return '#d4a017'
  return '#c0392b'
}

export default function Header({ market, status }) {
  const s = market?.status || status?.market?.status || 'CONNECTING'
  return (
    <header className="sticky top-0 z-40 mb-3 -mx-4 flex items-center justify-between border-b border-line/60 bg-bg/80 px-4 py-3 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-gold/25 to-gold/5 border border-gold/40 shadow-lg shadow-gold/10">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2 L20 6 V12 C20 17 16.5 20.5 12 22 C7.5 20.5 4 17 4 12 V6 Z"
              stroke="#c9a45c"
              strokeWidth="1.8"
            />
            <text x="12" y="15" textAnchor="middle" fontSize="8" fontWeight="700" fill="#c9a45c">
              G
            </text>
          </svg>
        </div>
        <div>
          <div className="text-lg font-extrabold leading-none tracking-wider">GOLDFLOW</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted">AI Gold Analyst</div>
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