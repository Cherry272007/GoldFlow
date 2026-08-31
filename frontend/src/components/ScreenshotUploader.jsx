import React, { useRef, useState } from 'react'

export default function ScreenshotUploader({ onAdd, disabled = false }) {
  const inputRef = useRef(null)
  const [drag, setDrag] = useState(false)

  const read = (file) =>
    new Promise((resolve) => {
      const r = new FileReader()
      r.onload = () =>
        resolve({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name || 'screenshot.png',
          mime: file.type || 'image/png',
          dataUrl: r.result,
        })
      r.readAsDataURL(file)
    })

  const handleFiles = async (list) => {
    const files = Array.from(list || []).filter((f) => f.type.startsWith('image/'))
    if (!files.length) return
    const imgs = await Promise.all(files.map(read))
    onAdd(imgs)
  }

  return (
    <div>
      <div
        className={`flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition-all ${
          drag ? 'scale-[0.99] border-gold/80 bg-gold/10' : 'border-line bg-gradient-to-b from-card to-card2'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          handleFiles(e.dataTransfer.files)
        }}
      >
        <div className={`grid h-11 w-11 place-items-center rounded-full border transition-colors ${drag ? 'border-gold/60 bg-gold/15' : 'border-gold/40 bg-gold/10'}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 4 V16 M6 22 H18 M12 16 L7 10 M12 16 L17 10 M4 12 H2 M22 12 H20"
              stroke="#f5c542"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="text-sm font-semibold">Upload chart screenshots</div>
        <div className="text-[11px] leading-relaxed text-muted">
          Tap, or drag & drop a photo of your chart to give the AI extra context
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}