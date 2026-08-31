import React from 'react'

// Show, per uploaded screenshot, whether the AI could read it and a short
// note. Screenshots are analysed generically as chart context — no platform
// labelling (MT5 / Bookmap, etc.).
export default function ScreenshotAnalysis({ images = [], analysis = null }) {
  if (!images.length || !analysis) return null

  const statusFor = (img) =>
    (analysis.images || []).find((x) => x && x.name === img.name) || null

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        Screenshot Analysis
      </div>
      <div className="space-y-2">
        {images.map((img) => {
          const item = statusFor(img)
          const used = Boolean(item && item.usable)
          return (
            <div
              key={img.id}
              className={
                used
                  ? 'flex items-start gap-3 rounded-xl border border-ok/30 bg-ok/5 p-2.5'
                  : 'flex items-start gap-3 rounded-xl border border-line/60 bg-card2 p-2.5'
              }
            >
              <img
                src={img.dataUrl}
                alt={img.name}
                className="h-12 w-14 rounded-lg border border-line object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-fg">{img.name}</span>
                  <span
                    className={`shrink-0 text-[10px] font-semibold uppercase ${
                      used ? 'text-ok' : 'text-wait'
                    }`}
                  >
                    {used ? 'Analysed' : 'Could not read'}
                  </span>
                </div>
                {item && item.note ? (
                  <div className="mt-1 text-[11px] leading-snug text-muted">{item.note}</div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
      {analysis.ai_error ? (
        <div className="mt-2 text-[11px] text-wait">
          AI was unavailable for these screenshots — uploads were not analysed.
        </div>
      ) : null}
    </section>
  )
}