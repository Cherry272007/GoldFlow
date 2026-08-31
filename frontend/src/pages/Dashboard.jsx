import React, { useCallback, useEffect, useRef, useState } from 'react'
import Header from '../components/Header'
import PriceCard from '../components/PriceCard'
import SignalCard from '../components/SignalCard'
import SourcesCard from '../components/SourcesCard'
import MarketConditions from '../components/MarketConditions'
import SignalHistory from '../components/SignalHistory'
import ConnectionStatus from '../components/ConnectionStatus'
import * as api from '../services/api'

export default function Dashboard({ market: liveMarket, status: liveStatus, onOpenAI }) {
  const [market, setMarket] = useState(liveMarket || null)
  const [indicators, setIndicators] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [history, setHistory] = useState([])
  const [status, setStatus] = useState(liveStatus || null)
  const [authRequired, setAuthRequired] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const runningRef = useRef(false)

  // Keep live props in sync (App owns the source of truth for market/status).
  useEffect(() => { if (liveMarket) setMarket(liveMarket) }, [liveMarket])
  useEffect(() => { if (liveStatus) setStatus(liveStatus) }, [liveStatus])

  const applySnapshot = useCallback((snap) => {
    if (snap.market) setMarket(snap.market)
    if (snap.indicators) setIndicators(snap.indicators)
    if (snap.signal) {
      setAnalysis((prev) => {
        if (!prev) return snap.signal
        const newTs = snap.signal.ts || snap.signal.generated_at
        const prevTs = prev.ts || prev.generated_at
        if (!newTs || !prevTs) return snap.signal
        return newTs !== prevTs ? snap.signal : prev
      })
    }
  }, [])

  const loadInit = useCallback(async () => {
    try {
      const [m, ind, sig, his, st, cfg] = await Promise.all([
        api.fetchMarket(),
        api.fetchIndicators(),
        api.fetchSignal(),
        api.fetchHistory(),
        api.fetchStatus(),
        api.fetchConfig(),
      ])
      setMarket(m)
      setIndicators(ind)
      setAnalysis(sig)
      setHistory(his.history || [])
      setStatus(st)
      setAuthRequired(cfg.auth_required)
    } catch (e) {
      /* Socket may still bring live data */
    }
  }, [])

  useEffect(() => {
    let socket = null
    let cancelled = false
    loadInit()
    api
      .connectSocket()
      .then((sock) => {
        if (cancelled) { sock.close(); return }
        socket = sock
        sock.on('market_update', (d) => applySnapshot(d))
        sock.on('analysis_update', (d) => { if (d.analysis) setAnalysis(d.analysis) })
        sock.emit('refresh')
      })
      .catch(() => {})

    const poll = setInterval(async () => {
      try {
        const sig = await api.fetchSignal()
        setAnalysis((prev) => {
          if (!prev) return sig
          const newTs = sig.ts || sig.generated_at
          const prevTs = prev.ts || prev.generated_at
          if (!newTs || !prevTs) return sig
          return newTs !== prevTs ? sig : prev
        })
      } catch {}
    }, 6000)

    return () => { cancelled = true; if (socket) socket.close(); clearInterval(poll) }
  }, [loadInit, applySnapshot])

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-44">
      <Header market={market} status={status} />

      {authRequired && !import.meta.env.VITE_GOLDFLOW_API_KEY ? (
        <div className="mb-3 rounded-2xl border border-wait/30 bg-wait/10 p-3 text-xs text-wait">
          This dashboard requires a GoldFlow API key. Set <code>VITE_GOLDFLOW_API_KEY</code> at build time to enable analysis.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <PriceCard market={market} />
          <SourcesCard market={market} />
          <SignalCard analysis={analysis} loading={analyzing} />
        </div>

        <div className="space-y-3">
          <MarketConditions indicators={indicators} />

          <button
            onClick={onOpenAI}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gold/40 bg-gradient-to-r from-gold/20 to-yellow-500/10 py-4 text-sm font-extrabold uppercase tracking-wider text-gold transition hover:shadow-lg hover:shadow-gold/20 active:scale-[0.99]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 L13.4 8.6 L20 10 L13.4 11.4 L12 18 L10.6 11.4 L4 10 L10.6 8.6 Z" fill="currentColor" />
            </svg>
            AI Gold Analyze
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <SignalHistory rows={history} expanded={historyExpanded} />
      {history.length > 8 ? (
        <button
          onClick={() => setHistoryExpanded((v) => !v)}
          className="mt-1 text-center text-xs font-semibold text-gold underline-offset-2 hover:underline"
        >
          {historyExpanded ? 'Show less' : 'Show all history'}
        </button>
      ) : null}

      <footer className="sticky bottom-0 z-10 mt-4 bg-gradient-to-b from-transparent via-bg/95 to-bg pb-3">
        <ConnectionStatus status={status} />
        <p className="pt-2 text-center text-[10px] text-muted/70">
          GoldFlow — alert-only gold analysis. Not financial advice. Market data via London Strategic Edge.
        </p>
      </footer>
    </div>
  )
}
