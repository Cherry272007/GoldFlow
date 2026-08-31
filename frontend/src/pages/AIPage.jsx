import React, { useCallback, useRef, useState } from 'react'
import Header from '../components/Header'
import AIAnalysis from '../components/AIAnalysis'
import Chat from '../components/Chat'
import ScreenshotUploader from '../components/ScreenshotUploader'
import ScreenshotPreview from '../components/ScreenshotPreview'
import ScreenshotAnalysis from '../components/ScreenshotAnalysis'
import ConnectionStatus from '../components/ConnectionStatus'
import * as api from '../services/api'

function SectionHeading({ icon, children, right }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">{icon}{children}</div>
      {right}
    </div>
  )
}

export default function AIPage({ market, status, onBack }) {
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState(null)
  const [images, setImages] = useState([])
  const runningRef = useRef(false)

  const addImages = useCallback((imgs) => setImages((prev) => [...prev, ...imgs]), [])
  const removeImage = useCallback((id) => setImages((prev) => prev.filter((i) => i.id !== id)), [])

  const handleAnalyze = async () => {
    if (runningRef.current) return
    runningRef.current = true
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const res = await api.runAnalysis(images)
      setAnalysis(res)
      setImages([])
    } catch (e) {
      setAnalyzeError(e.message || 'Analysis failed')
    } finally {
      runningRef.current = false
      setAnalyzing(false)
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 pb-24">
      <Header market={market} status={status} />

      <button
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold hover:underline"
      >
        ← Back to Dashboard
      </button>

      {/* AI Gold Analyze */}
      <section className="mb-3 rounded-2xl border border-line bg-gradient-to-b from-card to-card2 p-4">
        <SectionHeading
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 L13.4 8.6 L20 10 L13.4 11.4 L12 18 L10.6 11.4 L4 10 L10.6 8.6 Z" fill="#c9a45c" />
            </svg>
          }
        >
          AI Gold Analyze
        </SectionHeading>

        <ScreenshotAnalysis images={images} analysis={analysis} />

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
          {analyzing ? 'Analysing…' : images.length ? `Analyse ${images.length} screenshot${images.length > 1 ? 's' : ''}` : 'Analyse current market'}
        </button>

        {analyzeError ? (
          <div className="mt-2 rounded-xl border border-bad/30 bg-bad/10 p-2.5 text-xs text-bad">{analyzeError}</div>
        ) : null}

        <div className="mt-3">
          <AIAnalysis analysis={analysis} loading={analyzing} />
        </div>
      </section>

      {/* Ask the AI */}
      <Chat />

      <footer className="sticky bottom-0 z-10 mt-4 bg-gradient-to-b from-transparent via-bg/95 to-bg pb-3">
        <ConnectionStatus status={status} />
        <p className="pt-2 text-center text-[10px] text-muted/70">
          GoldFlow — alert-only gold analysis. Not financial advice. Market data via London Strategic Edge.
        </p>
      </footer>
    </div>
  )
}
