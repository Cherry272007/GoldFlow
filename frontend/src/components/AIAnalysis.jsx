import React from 'react'

function Chip({ label, value, tone }) {
  if (value == null || value === '') return null
  return (
    <div className="rounded-lg border border-line/70 bg-card2/70 px-2.5 py-2 text-center">
      <div className="text-[9px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-0.5 text-sm font-bold ${tone || 'text-fg'}`}>{String(value).toUpperCase()}</div>
    </div>
  )
}

export default function AIAnalysis({ analysis = null, loading = false }) {
  if (!analysis) {
    return (
      <section className="rounded-2xl border border-line bg-gradient-to-b from-card to-card2 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 L13.4 8.6 L20 10 L13.4 11.4 L12 18 L10.6 11.4 L4 10 L10.6 8.6 Z" fill="#f5c542" />
            </svg>
            Gold Analysis
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted">openrouter</span>
        </div>
        <div className="grid place-items-center rounded-xl border border-dashed border-line bg-card2/60 py-12 text-center">
          <div className="px-6">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full border border-gold/30 bg-gold/10">
              {loading ? (
                <svg className="h-5 w-5 animate-spin text-gold" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                  <path d="M12 2 a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : (
                <span className="text-gold text-lg">✦</span>
              )}
            </div>
            <div className="text-sm font-semibold text-fg">
              {loading ? 'Analysing market…' : 'No analysis yet'}
            </div>
            <div className="mt-1 text-xs leading-relaxed text-muted">
              {loading ? 'Combining market data, indicators and your screenshots.' : 'Run an analysis above to see the AI signal here.'}
            </div>
          </div>
        </div>
      </section>
    )
  }

  const trendTone =
    analysis.trend === 'BULLISH'
      ? 'text-ok'
      : analysis.trend === 'BEARISH'
        ? 'text-bad'
        : 'text-wait'
  const riskTone =
    analysis.risk === 'LOW' ? 'text-ok' : analysis.risk === 'HIGH' ? 'text-bad' : 'text-wait'

  return (
    <section className="rounded-2xl border border-line bg-gradient-to-b from-card to-card2 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 2 L13.4 8.6 L20 10 L13.4 11.4 L12 18 L10.6 11.4 L4 10 L10.6 8.6 Z" fill="#f5c542" />
          </svg>
          Gold Analysis
        </span>
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
        <div className="mt-4 rounded-xl border-l-2 border-gold/60 bg-card2/50 p-3 text-sm leading-snug text-fg/95">
          {analysis.market_summary}
        </div>
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