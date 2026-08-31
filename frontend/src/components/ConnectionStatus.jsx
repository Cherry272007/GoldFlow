import React from 'react'
import NotificationToggle from './NotificationToggle'

function Dot({ connected, tone }) {
  const color = tone || (connected ? '#10b981' : '#c0392b')
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
    </span>
  )
}

export default function ConnectionStatus({ status = null }) {
  const s = status || {}
  const market = s.market || {}
  const ai = s.ai || {}
  const server = s.server || {}
  const aiConnected = Boolean(ai.configured) && !ai.error
  const marketTone = market.status === 'RESTRICTED' ? '#d4a017' : undefined

  const item = (label, connected, tone) => (
    <span className="flex items-center gap-1.5">
      <Dot connected={connected} tone={tone} />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</span>
    </span>
  )

  return (
    <section className="flex items-center justify-between gap-2 rounded-xl border border-line bg-card px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {item('Market', market.connected, marketTone)}
        {item('AI', aiConnected, ai.configured && !aiConnected ? '#d4a017' : undefined)}
        {item('Server', server.connected)}
      </div>
      <NotificationToggle compact />
    </section>
  )
}
