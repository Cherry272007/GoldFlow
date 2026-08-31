import React from 'react'

export default function ScreenshotPreview({ images = [], onRemove }) {
  if (!images.length) return null
  return (
    <div className="grid grid-cols-4 gap-2">
      {images.map((img) => (
        <div key={img.id} className="relative overflow-hidden rounded-xl border border-line bg-card2">
          <img src={img.dataUrl} alt={img.name} className="h-20 w-full object-cover" />
          <button
            className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-xs text-white"
            onClick={() => onRemove(img.id)}
            aria-label="Remove screenshot"
          >
            ×
          </button>
          <div className="truncate px-1 py-0.5 text-[9px] text-muted">{img.name}</div>
        </div>
      ))}
    </div>
  )
}