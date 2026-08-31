import React from 'react'

function Chip({ label, value, tone }) {
  if (value == null || value === '') return null
  return (
    <div className="rounded-lg border border-line bg-card2 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`text-sm font-semibold ${tone || ''}`}>{String(value).toUpperCase()}</div>
    </div>
  )
}

export default function AIAnalysis({ analysis = null }) {
  if (!analysis) return null

  const trendTone =
    analysis.trend === 'BULLISH'
      ? 'text-ok'
      : analysis.trend === 'BEARISH'
        ? 'text-bad'
        : 'text-wait'
  const riskTone =
    analysis.risk === 'LOW' ? 'text-ok' : analysis.risk === 'HIGH' ? 'text-bad' : 'text-wait'

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Gold Analysis</span>
        <span className="text-[10px] uppercase tracking-wider text-muted">
          {analysis.provider || 'signal-engine'} · {analysis.model || 'technical'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Chip label="Trend" value={analysis.trend} tone={trendTone} />
        <Chip label="Risk" value={analysis.risk} tone={riskTone} />
        <Chip
          label="Relation"
          value={analysis.relation === 'in-line' ? 'Price vs MAs' : analysis.relation}
          tone="text-muted"
        />
      </div>

      {analysis.market_summary ? (
        <div className="mt-3 text-sm leading-snug text-fg/90">{analysis.market_summary}</div>
      ) : null}

      {analysis.reason ? (
        <div className="mt-3 rounded-xl border border-line/50 bg-card2 p-3 text-xs leading-relaxed text-muted">
          {analysis.reason}
        </div>
      ) : null}

      {analysis.observations?.length ? (
        <ul className="mt-3 space-y-1 text-xs text-muted">
          {analysis.observations.map((o, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold/70" />
              {o}
            </li>
          ))}
        </ul>
      ) : null}

      {analysis.confirmation_needed ? (
        <div className="mt-3 border-t border-line pt-2 text-[11px] text-muted">
          <span className="font-semibold text-wait">Watch for: </span>
          {analysis.confirmation_needed}
        </div>
      ) : null}
    </section>
  )
}