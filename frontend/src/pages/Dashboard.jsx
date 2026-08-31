import React, { useCallback, useEffect, useRef, useState } from 'react'
import Header from '../components/Header'
import PriceCard from '../components/PriceCard'
import SignalCard from '../components/SignalCard'
import MarketConditions from '../components/MarketConditions'
import ScreenshotUploader from '../components/ScreenshotUploader'
import ScreenshotPreview from '../components/ScreenshotPreview'
import ScreenshotAnalysis from '../components/ScreenshotAnalysis'
import AIAnalysis from '../components/AIAnalysis'
import SignalHistory from '../components/SignalHistory'
import ConnectionStatus from '../components/ConnectionStatus'
import * as api from '../services/api'

export default function Dashboard() {
  const [market, setMarket] = useState(null)
  const [indicators, setIndicators] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [history, setHistory] = useState([])
  const [status, setStatus] = useState(null)
  const [authRequired, setAuthRequired] = useState(false)
  const [images, setImages] = useState([])

  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState(null)
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [view, setView] = useState('main') // 'main' | 'analysis' (mobile page)

  const runningRef = useRef(false)
  const imagesRef = useRef(images)
  imagesRef.current = images

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
      // Socket may still bring live data; do not block the dashboard.
    }
  }, [])

  useEffect(() => {
    let socket = null
    let cancelled = false
    loadInit()
    api
      .connectSocket()
      .then((sock) => {
        if (cancelled) {
          sock.close()
          return
        }
        socket = sock
        const onMarket = (d) => applySnapshot(d)
        const onAnalysis = (d) => {
          if (d.analysis) setAnalysis(d.analysis)
        }
        sock.on('market_update', onMarket)
        sock.on('analysis_update', onAnalysis)
        sock.emit('refresh')
      })
      .catch(() => {
        /* polling fallback below */
      })

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
      } catch {
        /* ignore transient */
      }
    }, 6000)

    return () => {
      cancelled = true
      if (socket) socket.close()
      clearInterval(poll)
    }
  }, [loadInit, applySnapshot])

  const addImages = useCallback((imgs) => setImages((prev) => [...prev, ...imgs]), [])
  const removeImage = useCallback((id) => setImages((prev) => prev.filter((i) => i.id !== id)), [])

  const handleAnalyze = async () => {
    if (runningRef.current) return
    runningRef.current = true
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const res = await api.runAnalysis(imagesRef.current)
      setAnalysis(res)
      setImages([])
      try {
        const his = await api.fetchHistory()
        setHistory(his.history || [])
      } catch {
        /* history refresh best-effort */
      }
    } catch (e) {
      setAnalyzeError(e.message || 'Analysis failed')
    } finally {
      runningRef.current = false
      setAnalyzing(false)
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-8">
      <Header market={market} status={status} />

      {authRequired && !import.meta.env.VITE_GOLDFLOW_API_KEY ? (
        <div className="mb-3 rounded-2xl border border-wait/30 bg-wait/10 p-3 text-xs text-wait">
          This dashboard requires a GoldFlow API key. Set <code>VITE_GOLDFLOW_API_KEY</code> at build time to enable analysis.
        </div>
      ) : null}

      {view === 'analysis' ? (
        <div className="mb-3">
          <button
            onClick={() => setView('main')}
            className="mb-3 text-xs font-semibold text-gold underline-offset-2 hover:underline"
          >
            ← Back to dashboard
          </button>
          <AIAnalysis analysis={analysis} loading={analyzing} />
          {analysis ? <div className="mt-3"><ScreenshotAnalysis images={images} analysis={analysis} /></div> : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <PriceCard market={market} />
            <SignalCard analysis={analysis} loading={analyzing} />
            <MarketConditions indicators={indicators} />

            <div className="space-y-2">
              <ScreenshotUploader onAdd={addImages} disabled={analyzing} />
              <ScreenshotPreview images={images} onRemove={removeImage} />
            </div>

            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="w-full rounded-2xl border border-gold/50 bg-gold py-3.5 text-sm font-bold uppercase tracking-wide text-black shadow-lg shadow-gold/20 transition disabled:opacity-50"
            >
              {analyzing ? 'Analysing…' : images.length ? `Analyse ${images.length} screenshot${images.length > 1 ? 's' : ''}` : 'Analyse Now'}
            </button>

            {analyzeError ? (
              <div className="rounded-xl border border-bad/30 bg-bad/10 p-3 text-xs text-bad">{analyzeError}</div>
            ) : null}
          </div>

          <div className="space-y-3">
            <AIAnalysis analysis={analysis} loading={analyzing} />
            {analysis ? <ScreenshotAnalysis images={images} analysis={analysis} /> : null}
            <ConnectionStatus status={status} />
          </div>
        </div>
      )}

      {view !== 'analysis' ? (
        <button
          onClick={() => setView('analysis')}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-gold to-yellow-500 px-5 py-3.5 text-sm font-extrabold uppercase tracking-wider text-black shadow-xl shadow-gold/30 ring-1 ring-gold/60 transition active:scale-95 lg:hidden"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 2 L13.4 8.6 L20 10 L13.4 11.4 L12 18 L10.6 11.4 L4 10 L10.6 8.6 Z" fill="currentColor" />
          </svg>
          AI Analyze
        </button>
      ) : null}

      <SignalHistory rows={history} expanded={historyExpanded} />
      {history.length > 8 ? (
        <button
          onClick={() => setHistoryExpanded((v) => !v)}
          className="mt-1 text-center text-xs font-semibold text-gold underline-offset-2 hover:underline"
        >
          {historyExpanded ? 'Show less' : 'Show all history'}
        </button>
      ) : null}

      <footer className="pt-2 text-center text-[10px] text-muted/70">
        GoldFlow — alert-only gold analysis. Not financial advice. Market data via London Strategic Edge.
      </footer>
    </div>
  )
}