import React from 'react'
import { fmtAge } from '../services/format'
import NotificationToggle from './NotificationToggle'

function Item({ label, sub, connected, tone }) {
  const color = tone || (connected ? '#10b981' : '#c0392b')
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {connected ? (
          <span
            className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full opacity-40"
            style={{ backgroundColor: color }}
          />
        ) : null}
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-fg">{label}</span>
          {sub ? <span className="truncate text-[11px] text-muted">{sub}</span> : null}
        </div>
        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide">
          <span className={connected ? 'text-ok' : 'text-bad'}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
    </div>
  )
}

function Divider() {
  return <div className="my-2 hidden w-px self-stretch bg-line/60 sm:block" />
}

export default function ConnectionStatus({ status = null }) {
  const s = status || {}
  const market = s.market || {}
  const ai = s.ai || {}
  const server = s.server || {}
  const aiConnected = Boolean(ai.configured) && !ai.error

  const aiSub =
    `${ai.provider || 'OpenRouter'}${ai.model ? ' · ' + ai.model : ''}`

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-card to-card2">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Connections</div>
        <div className="text-[10px] text-muted/80">Live feed · AI · Server health</div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-stretch">
        <Item
          label="Market Data"
          sub={market.source?.name}
          connected={market.connected}
          tone={market.status === 'RESTRICTED' ? '#d4a017' : undefined}
        />
        <Divider />
        <Item
          label="AI Engine"
          sub={aiSub}
          connected={aiConnected}
          tone={aiConnected ? undefined : ai.configured ? '#d4a017' : '#c0392b'}
        />
        <Divider />
        <Item
          label="GoldFlow Server"
          sub={`last tick ${fmtAge(market.last_updated)}`}
          connected={server.connected}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line bg-card2/40 px-4 py-3">
        <p className="text-[11px] leading-snug text-muted">
          Get an alert on your phone whenever a fresh <span className="text-ok">BUY</span> or{' '}
          <span className="text-bad">SELL</span> signal fires.
        </p>
        <div className="shrink-0">
          <NotificationToggle />
        </div>
      </div>
    </section>
  )
}
