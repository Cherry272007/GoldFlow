import React from 'react'
import { fmtAge } from '../services/format'

function Lane({ label, connected, sub, tone }) {
  const color = tone || (connected ? '#21d07a' : '#ff4d5e')
  return (
    <div className="flex items-center justify-between py-2.5">
      <div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
          <span className="text-sm font-semibold">{label}</span>
        </div>
        {sub ? <div className="mt-0.5 pl-4 text-[11px] text-muted">{sub}</div> : null}
      </div>
      <span className="text-xs font-semibold uppercase" style={{ color }}>
        {connected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  )
}

export default function ConnectionStatus({ status = null }) {
  const s = status || {}
  const market = s.market || {}
  const ai = s.ai || {}
  const server = s.server || {}
  const aiConnected = Boolean(ai.configured) && !ai.error

  return (
    <section className="rounded-2xl border border-line bg-card px-4 py-2">
      <Lane
        label="Market Data"
        connected={market.connected}
        tone={market.status === 'RESTRICTED' ? '#ffb224' : undefined}
        sub={market.source?.name}
      />
      <Lane
        label="AI Engine"
        connected={aiConnected}
        tone={aiConnected ? undefined : ai.configured ? '#ffb224' : '#ff4d5e'}
        sub={`${ai.provider || 'OpenRouter'}${ai.model ? ' · ' + ai.model : ''}`}
      />
      <Lane
        label="GoldFlow Server"
        connected={server.connected}
        sub={`last tick ${fmtAge(market.last_updated)}`}
      />
    </section>
  )
}