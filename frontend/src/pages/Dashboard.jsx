import React, { useCallback, useEffect, useRef, useState } from 'react'
import Header from '../components/Header'
import PriceCard from '../components/PriceCard'
import SignalCard from '../components/SignalCard'
import SourcesCard from '../components/SourcesCard'
import MarketConditions from '../components/MarketConditions'
import AIAnalysis from '../components/AIAnalysis'
import AISignalResult from '../components/AISignalResult'
import ConnectionStatus from '../components/ConnectionStatus'
import * as api from '../services/api'

export default function Dashboard({ status: liveStatus, onNavigate }) {
  const [goldAnalysis, setGoldAnalysis] = useState(null)
  const [goldBusy, setGoldBusy] = useState(false)
  const [goldError, setGoldError] = useState(null)
  const goldRunningRef = useRef(false)
  const [market, setMarket] = useState(null)
  const [indicators, setIndicators] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [status, setStatus] = useState(liveStatus || null)
  const socketRef = useRef(null)

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
      const [m, ind, sig, st] = await Promise.all([
        api.fetchMarket(),
        api.fetchIndicators(),
        api.fetchSignal(),
        api.fetchStatus(),
      ])
      setMarket(m)
      setIndicators(ind)
      setAnalysis(sig)
      setStatus(st)
    } catch (e) {}
  }, [])

  useEffect(() => {
    let cancelled = false
    loadInit()
    api
      .connectSocket()
      .then((sock) => {
        if (cancelled) { sock.close(); return }
        socketRef.current = sock
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
    }, 8000)

    return () => { cancelled = true; if (socketRef.current) socketRef.current.close(); clearInterval(poll) }
  }, [loadInit, applySnapshot])

  const handleGold = async () => {
    if (goldRunningRef.current) return
    goldRunningRef.current = true
    setGoldBusy(true)
    setGoldError(null)
    try {
      setGoldAnalysis(await api.runAnalysis([]))
    } catch (e) {
      setGoldError(e.message || 'Analysis failed')
    } finally {
      goldRunningRef.current = false
      setGoldBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-44 lg:px-8">
      <Header market={market} status={status} variant="dashboard" onNavigate={onNavigate} />

      <SignalCard analysis={analysis} />

      <div className="mt-3">
        <section className="rounded-2xl border border-line bg-gradient-to-b from-card to-card2 p-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted">AI Gold Analyze</div>
          <p className="mb-3 text-xs leading-relaxed text-muted">AI verdict on the current live market.</p>
          <button
            onClick={handleGold}
            disabled={goldBusy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-yellow-500 py-2.5 text-sm font-extrabold uppercase tracking-wider text-black shadow-lg shadow-gold/20 ring-1 ring-gold/40 transition hover:shadow-gold/40 active:scale-[0.99] disabled:opacity-50"
          >
            {goldBusy ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                <path d="M12 2 a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : null}
            {goldBusy ? 'Analysing…' : 'Analyse current market'}
          </button>
          {goldError ? (
            <div className="mt-2 rounded-xl border border-bad/30 bg-bad/10 p-2.5 text-xs text-bad">{goldError}</div>
          ) : null}

          <div className="mt-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
              AI Gold Analyze · Result
            </div>
            <AISignalResult analysis={goldAnalysis} loading={goldBusy} />
          </div>

          {goldAnalysis ? (
            <div className="mt-3"><AIAnalysis analysis={goldAnalysis} loading={goldBusy} /></div>
          ) : null}
        </section>
      </div>

      <div className="mt-3"><PriceCard market={market} /></div>
      <div className="mt-3"><SourcesCard market={market} /></div>

      <div className="mt-3">
        <MarketConditions indicators={indicators} />
      </div>

      <footer className="sticky bottom-0 z-10 mt-4 bg-gradient-to-b from-transparent via-bg/95 to-bg pb-3">
        <ConnectionStatus status={status} />
      </footer>
    </div>
  )
}
