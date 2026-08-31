import React from 'react'
import { fmtAge } from '../services/format'
import NotificationToggle from './NotificationToggle'

function Lane({ label, connected, sub, tone }) {
  const color = tone || (connected ? '#21d07a' : '#ff4d5e')
  return (
    <div className="flex items-center justify-between border-b border-line/50 py-2.5 last:border-0">
      <div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {connected ? (
              <span
                className="absolute inline-flex h-2 w-2 animate-ping rounded-full opacity-40"
                style={{ backgroundColor: color }}
              />
            ) : null}
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          </span>
          <span className="text-sm font-semibold">{label}</span>
        </div>
        {sub ? <div className="mt-0.5 pl-4 text-[11px] text-muted">{sub}</div> : null}
      </div>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
          connected ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad'
        }`}
      >
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
    <section className="rounded-2xl border border-line bg-gradient-to-b from-card to-card2 p-4">
      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Connections</div>
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
      <div className="mt-3 border-t border-line/50 pt-3">
        <NotificationToggle />
      </div>
    </section>
  )
}