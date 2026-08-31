import React, { useCallback, useEffect, useRef, useState } from 'react'
import Header from '../components/Header'
import PriceCard from '../components/PriceCard'
import SignalCard from '../components/SignalCard'
import SignalCompare from '../components/SignalCompare'
import SourcesCard from '../components/SourcesCard'
import MarketConditions from '../components/MarketConditions'
import AIAnalysis from '../components/AIAnalysis'
import Chat from '../components/Chat'
import ScreenshotUploader from '../components/ScreenshotUploader'
import ScreenshotPreview from '../components/ScreenshotPreview'
import ScreenshotAnalysis from '../components/ScreenshotAnalysis'
import SignalHistory from '../components/SignalHistory'
import ConnectionStatus from '../components/ConnectionStatus'
import * as api from '../services/api'

function AnalyzeButton({ busy, disabled, idleLabel, disabledLabel, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-yellow-500 py-3 text-sm font-extrabold uppercase tracking-wider text-black shadow-lg shadow-gold/20 ring-1 ring-gold/40 transition hover:shadow-gold/40 active:scale-[0.99] disabled:opacity-50 disabled:shadow-none"
    >
      {busy ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
          <path d="M12 2 a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
          <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      {busy ? 'Analysing…' : disabled ? disabledLabel : idleLabel}
    </button>
  )
}

function CardTitle({ children, right }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M12 2 L13.4 8.6 L20 10 L13.4 11.4 L12 18 L10.6 11.4 L4 10 L10.6 8.6 Z" fill="#c9a45c" />
        </svg>
        {children}
      </span>
      {right}
    </div>
  )
}

export default function Dashboard() {
  const [market, setMarket] = useState(null)
  const [indicators, setIndicators] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [compare, setCompare] = useState(null)
  const [history, setHistory] = useState([])
  const [status, setStatus] = useState(null)
  const [authRequired, setAuthRequired] = useState(false)
  const [historyExpanded, setHistoryExpanded] = useState(false)

  const [goldAnalysis, setGoldAnalysis] = useState(null)
  const [goldBusy, setGoldBusy] = useState(false)
  const [goldError, setGoldError] = useState(null)
  const goldRunningRef = useRef(false)

  const [imageAnalysis, setImageAnalysis] = useState(null)
  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState(null)
  const [images, setImages] = useState([])
  const imageRunningRef = useRef(false)

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
      const [m, ind, sig, cmp, his, st, cfg] = await Promise.all([
        api.fetchMarket(),
        api.fetchIndicators(),
        api.fetchSignal(),
        api.fetchCompare(),
        api.fetchHistory(),
        api.fetchStatus(),
        api.fetchConfig(),
      ])
      setMarket(m)
      setIndicators(ind)
      setAnalysis(sig)
      setCompare(cmp)
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
        const [sig, cmp] = await Promise.all([api.fetchSignal(), api.fetchCompare()])
        setCompare(cmp)
        setAnalysis((prev) => {
          if (!prev) return sig
          const newTs = sig.ts || sig.generated_at
          const prevTs = prev.ts || prev.generated_at
          if (!newTs || !prevTs) return sig
          return newTs !== prevTs ? sig : prev
        })
      } catch {}
    }, 8000)

    return () => { cancelled = true; if (socket) socket.close(); clearInterval(poll) }
  }, [loadInit, applySnapshot])

  const addImages = useCallback((imgs) => setImages((prev) => [...prev, ...imgs]), [])
  const removeImage = useCallback((id) => setImages((prev) => prev.filter((i) => i.id !== id)), [])

  const refreshAfterAnalysis = useCallback(async () => {
    try {
      const [cmp, his] = await Promise.all([api.fetchCompare(), api.fetchHistory()])
      setCompare(cmp)
      setHistory(his.history || [])
    } catch {}
  }, [])

  const handleGoldAnalyze = async () => {
    if (goldRunningRef.current) return
    goldRunningRef.current = true
    setGoldBusy(true)
    setGoldError(null)
    try {
      const res = await api.runAnalysis([])
      setGoldAnalysis(res)
      setAnalysis(res)
      await refreshAfterAnalysis()
    } catch (e) {
      setGoldError(e.message || 'Analysis failed')
    } finally {
      goldRunningRef.current = false
      setGoldBusy(false)
    }
  }

  const handleImageAnalyze = async () => {
    if (imageRunningRef.current || !images.length) return
    imageRunningRef.current = true
    setImageBusy(true)
    setImageError(null)
    try {
      const res = await api.runAnalysis(images)
      setImageAnalysis(res)
      setAnalysis(res)
      await refreshAfterAnalysis()
    } catch (e) {
      setImageError(e.message || 'Analysis failed')
    } finally {
      imageRunningRef.current = false
      setImageBusy(false)
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-[100vw] px-4 pb-44">
      <Header market={market} status={status} />

      {authRequired && !import.meta.env.VITE_GOLDFLOW_API_KEY ? (
        <div className="mb-3 rounded-2xl border border-wait/30 bg-wait/10 p-3 text-xs text-wait">
          This dashboard requires a GoldFlow API key. Set <code>VITE_GOLDFLOW_API_KEY</code> at build time to enable analysis.
        </div>
      ) : null}

      {/* Prices + feeds */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <PriceCard market={market} />
        <SourcesCard market={market} />
        <SignalCard analysis={analysis} loading={goldBusy || imageBusy} />
      </div>

      {/* Technical vs AI comparison */}
      <div className="mt-3">
        <SignalCompare compare={compare} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Indicators */}
        <MarketConditions indicators={indicators} />

        {/* AI Gold Analyze */}
        <section className="rounded-2xl border border-line bg-gradient-to-b from-card to-card2 p-4">
          <CardTitle right={<span className="text-[10px] uppercase tracking-wider text-muted">market + indicators</span>}>
            AI Gold Analyze
          </CardTitle>
          <p className="mb-2 text-xs leading-relaxed text-muted">
            AI verdict on the current live market — no screenshots needed.
          </p>
          <AnalyzeButton
            busy={goldBusy}
            disabled={false}
            idleLabel="Analyse current market"
            disabledLabel="Analysing…"
            onClick={handleGoldAnalyze}
          />
          {goldError ? (
            <div className="mt-2 rounded-xl border border-bad/30 bg-bad/10 p-2.5 text-xs text-bad">{goldError}</div>
          ) : null}
          <div className="mt-3">
            <AIAnalysis analysis={goldAnalysis} loading={goldBusy} />
          </div>
        </section>

        {/* AI Image Analyze */}
        <section className="rounded-2xl border border-line bg-gradient-to-b from-card to-card2 p-4">
          <CardTitle right={<span className="text-[10px] uppercase tracking-wider text-muted">charts</span>}>
            AI Image Analyze
          </CardTitle>
          <p className="mb-2 text-xs leading-relaxed text-muted">
            Upload chart screenshots and the AI folds them into its analysis.
          </p>
          <ScreenshotUploader onAdd={addImages} disabled={imageBusy} />
          <ScreenshotPreview images={images} onRemove={removeImage} />
          <AnalyzeButton
            busy={imageBusy}
            disabled={!images.length}
            idleLabel={images.length ? `Analyse ${images.length} screenshot${images.length > 1 ? 's' : ''}` : 'Upload a screenshot to analyse'}
            disabledLabel="Upload a screenshot to analyse"
            onClick={handleImageAnalyze}
          />
          {imageError ? (
            <div className="mt-2 rounded-xl border border-bad/30 bg-bad/10 p-2.5 text-xs text-bad">{imageError}</div>
          ) : null}
          <div className="mt-3">
            <ScreenshotAnalysis images={images} analysis={imageAnalysis} />
            <AIAnalysis analysis={imageAnalysis} loading={imageBusy} />
          </div>
        </section>
      </div>

      {/* Ask the AI */}
      <div className="mt-3">
        <Chat />
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
