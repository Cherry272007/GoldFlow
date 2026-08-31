import React, { useCallback, useEffect, useRef, useState } from 'react'
import Header from '../components/Header'
import PriceCard from '../components/PriceCard'
import SignalCard from '../components/SignalCard'
import SourcesCard from '../components/SourcesCard'
import MarketConditions from '../components/MarketConditions'
import ScreenshotUploader from '../components/ScreenshotUploader'
import ScreenshotPreview from '../components/ScreenshotPreview'
import ScreenshotAnalysis from '../components/ScreenshotAnalysis'
import AIAnalysis from '../components/AIAnalysis'
import SignalHistory from '../components/SignalHistory'
import ConnectionStatus from '../components/ConnectionStatus'
import * as api from '../services/api'

const TABS = [
  { id: 'gold', label: 'Gold Analysis', icon: 'G' },
  { id: 'ai', label: 'AI Analyze', icon: '✦' },
  { id: 'image', label: 'Image Analyze', icon: '🖼' },
]

function TabBar({ active, onChange }) {
  return (
    <div className="mb-3 flex gap-2 lg:hidden">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex-1 rounded-xl border px-2 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide transition ${
            active === t.id
              ? 'border-gold/50 bg-gold/15 text-gold'
              : 'border-line bg-card text-muted'
          }`}
        >
          <span className="block text-sm leading-none">{t.icon}</span>
          <span className="mt-1 block">{t.label}</span>
        </button>
      ))}
    </div>
  )
}

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
  const [activeTab, setActiveTab] = useState('gold')

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
      try { const his = await api.fetchHistory(); setHistory(his.history || []) } catch {}
    } catch (e) {
      setAnalyzeError(e.message || 'Analysis failed')
    } finally {
      runningRef.current = false
      setAnalyzing(false)
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-24">
      <Header market={market} status={status} />

      {authRequired && !import.meta.env.VITE_GOLDFLOW_API_KEY ? (
        <div className="mb-3 rounded-2xl border border-wait/30 bg-wait/10 p-3 text-xs text-wait">
          This dashboard requires a GoldFlow API key. Set <code>VITE_GOLDFLOW_API_KEY</code> at build time to enable analysis.
        </div>
      ) : null}

      {/* Mobile tab bar */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* ── Left column: price + signal + connection ── */}
        <div className="space-y-3 lg:col-span-2">
          <PriceCard market={market} />
          <SourcesCard market={market} />
          <SignalCard analysis={analysis} loading={analyzing} />
          <ConnectionStatus status={status} />

          {/* On mobile: show only the active tab's section below the main cards */}
          <div className="lg:hidden">
            {activeTab === 'gold' && (
              <MarketConditions indicators={indicators} />
            )}
            {activeTab === 'ai' && (
              <AIAnalysis analysis={analysis} loading={analyzing} />
            )}
            {activeTab === 'image' && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-line bg-gradient-to-b from-card to-card2 p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="18" height="18" rx="3" stroke="#f5c542" strokeWidth="1.5" />
                      <circle cx="8.5" cy="8.5" r="1.5" fill="#f5c542" />
                      <path d="M3 16 L8 12 L13 16 L17 13 L21 16" stroke="#f5c542" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    Image Analyze
                  </div>
                  <ScreenshotUploader onAdd={addImages} disabled={analyzing} />
                  <ScreenshotPreview images={images} onRemove={removeImage} />

                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-gold to-yellow-500 py-3.5 text-sm font-extrabold uppercase tracking-wider text-black shadow-lg shadow-gold/20 ring-1 ring-gold/40 transition hover:shadow-gold/40 active:scale-[0.99] disabled:opacity-50 disabled:shadow-none"
                  >
                    {analyzing ? (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                        <path d="M12 2 a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
                        <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    )}
                    {analyzing ? 'Analysing…' : images.length ? `Analyse ${images.length} screenshot${images.length > 1 ? 's' : ''}` : 'Upload & Analyse'}
                  </button>

                  {analyzeError ? (
                    <div className="mt-2 rounded-xl border border-bad/30 bg-bad/10 p-2.5 text-xs text-bad">{analyzeError}</div>
                  ) : null}
                </div>
                <ScreenshotAnalysis images={images} analysis={analysis} />
              </div>
            )}
          </div>
        </div>

        {/* ── Right column: all three cards stacked (desktop only) ── */}
        <div className="hidden space-y-3 lg:block">
          {/* Gold Analysis */}
          <MarketConditions indicators={indicators} />

          {/* AI Analyze */}
          <AIAnalysis analysis={analysis} loading={analyzing} />

          {/* Image Analyze */}
          <div className="rounded-2xl border border-line bg-gradient-to-b from-card to-card2 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="3" stroke="#f5c542" strokeWidth="1.5" />
                <circle cx="8.5" cy="8.5" r="1.5" fill="#f5c542" />
                <path d="M3 16 L8 12 L13 16 L17 13 L21 16" stroke="#f5c542" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Image Analyze
            </div>
            <ScreenshotUploader onAdd={addImages} disabled={analyzing} />
            <ScreenshotPreview images={images} onRemove={removeImage} />

            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-gold to-yellow-500 py-3.5 text-sm font-extrabold uppercase tracking-wider text-black shadow-lg shadow-gold/20 ring-1 ring-gold/40 transition hover:shadow-gold/40 active:scale-[0.99] disabled:opacity-50 disabled:shadow-none"
            >
              {analyzing ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                  <path d="M12 2 a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
              {analyzing ? 'Analysing…' : images.length ? `Analyse ${images.length} screenshot${images.length > 1 ? 's' : ''}` : 'Upload & Analyse'}
            </button>

            {analyzeError ? (
              <div className="mt-2 rounded-xl border border-bad/30 bg-bad/10 p-2.5 text-xs text-bad">{analyzeError}</div>
            ) : null}
          </div>
          <ScreenshotAnalysis images={images} analysis={analysis} />
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

      <footer className="pt-4 text-center text-[10px] text-muted/70">
        GoldFlow — alert-only gold analysis. Not financial advice. Market data via London Strategic Edge.
      </footer>
    </div>
  )
}
