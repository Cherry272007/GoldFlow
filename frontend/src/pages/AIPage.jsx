import React, { useRef, useState } from 'react'
import Header from '../components/Header'
import AIAnalysis from '../components/AIAnalysis'
import Chat from '../components/Chat'
import ScreenshotUploader from '../components/ScreenshotUploader'
import ScreenshotPreview from '../components/ScreenshotPreview'
import ScreenshotAnalysis from '../components/ScreenshotAnalysis'
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

function Card({ title, sub, children }) {
  return (
    <section className="rounded-2xl border border-line bg-gradient-to-b from-card to-card2 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{title}</span>
        {sub ? <span className="text-[10px] uppercase tracking-wider text-muted">{sub}</span> : null}
      </div>
      {children}
    </section>
  )
}

export default function AIPage({ market, status, onNavigate }) {
  const [goldAnalysis, setGoldAnalysis] = useState(null)
  const [goldBusy, setGoldBusy] = useState(false)
  const [goldError, setGoldError] = useState(null)
  const goldRunningRef = useRef(false)

  const [imageAnalysis, setImageAnalysis] = useState(null)
  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState(null)
  const [images, setImages] = useState([])
  const imageRunningRef = useRef(false)

  const addImagesFn = (imgs) => setImages((prev) => [...prev, ...imgs])
  const removeImage = (id) => setImages((prev) => prev.filter((i) => i.id !== id))

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

  const handleImage = async () => {
    if (imageRunningRef.current || !images.length) return
    imageRunningRef.current = true
    setImageBusy(true)
    setImageError(null)
    try {
      setImageAnalysis(await api.runAnalysis(images))
    } catch (e) {
      setImageError(e.message || 'Analysis failed')
    } finally {
      imageRunningRef.current = false
      setImageBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-44 lg:px-8">
      <Header market={market} status={status} variant="ai" onNavigate={onNavigate} />

      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
        <Card title="AI Gold Analyze" sub="market + indicators">
          <p className="mb-2 text-xs leading-relaxed text-muted">AI verdict on the current live market.</p>
          <AnalyzeButton busy={goldBusy} idleLabel="Analyse current market" onClick={handleGold} />
          {goldError ? (
            <div className="mt-2 rounded-xl border border-bad/30 bg-bad/10 p-2.5 text-xs text-bad">{goldError}</div>
          ) : null}
          <div className="mt-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
              Analyse current market · Result
            </div>
            <AIAnalysis analysis={goldAnalysis} loading={goldBusy} />
          </div>
        </Card>

        <Card title="AI Image Analyze" sub="charts">
          <p className="mb-2 text-xs leading-relaxed text-muted">Upload chart screenshots for the AI to read.</p>
          <ScreenshotUploader onAdd={addImagesFn} disabled={imageBusy} />
          <ScreenshotPreview images={images} onRemove={removeImage} />
          <AnalyzeButton
            busy={imageBusy}
            disabled={!images.length}
            idleLabel={images.length ? `Analyse ${images.length} screenshot${images.length > 1 ? 's' : ''}` : 'Upload a screenshot to analyse'}
            disabledLabel="Upload a screenshot to analyse"
            onClick={handleImage}
          />
          {imageError ? (
            <div className="mt-2 rounded-xl border border-bad/30 bg-bad/10 p-2.5 text-xs text-bad">{imageError}</div>
          ) : null}
          <div className="mt-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
              AI image analyze · Result
            </div>
            <ScreenshotAnalysis images={images} analysis={imageAnalysis} />
            <div className="mt-3"><AIAnalysis analysis={imageAnalysis} loading={imageBusy} /></div>
          </div>
        </Card>
      </div>

      <div className="mt-3"><Chat /></div>

      <footer className="sticky bottom-0 z-10 mt-4 bg-gradient-to-b from-transparent via-bg/95 to-bg pb-3">
        <ConnectionStatus status={status} />
      </footer>
    </div>
  )
}
