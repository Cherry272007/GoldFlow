import React, { useEffect, useRef, useState } from 'react'
import * as api from '../services/api'

const SUGGESTIONS = [
  'What is the current trend?',
  'Is it a good time to buy or sell gold?',
  'What are the key support and resistance levels?',
  'Explain the latest signal.',
]

export default function Chat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  const send = async (text) => {
    const message = (text ?? input).trim()
    if (!message || busy) return
    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    setMessages((m) => [...m, { role: 'user', content: message }])
    setInput('')
    setBusy(true)
    setError(null)
    try {
      const res = await api.chat(message, history)
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }])
    } catch (e) {
      setError(e.message || 'The AI could not answer right now.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-card to-card2">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6l-4 4v-4H6a2 2 0 0 1-2-2V6z"
              stroke="#c9a45c"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
          Ask GoldFlow AI
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted">Live market context</span>
      </div>

      {messages.length === 0 ? (
        <div className="px-4 py-6">
          <p className="text-xs leading-relaxed text-muted">
            Ask anything about the current gold market — trend, signals, price levels. Answers use
            your live market data and indicators.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={busy}
                className="rounded-full border border-line bg-card2 px-3 py-1.5 text-[11px] text-muted transition hover:border-gold/40 hover:text-fg disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 py-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'self-end bg-gold/20 text-fg'
                  : 'self-start border border-line/60 bg-card2 text-fg/90'
              }`}
            >
              {m.content}
            </div>
          ))}
          {busy ? (
            <div className="self-start rounded-2xl border border-line/60 bg-card2 px-3 py-2 text-sm text-muted">
              Thinking…
            </div>
          ) : null}
          <div ref={endRef} />
        </div>
      )}

      {error ? (
        <div className="mx-4 mb-2 rounded-lg border border-bad/30 bg-bad/10 p-2 text-xs text-bad">{error}</div>
      ) : null}

      <div className="flex items-center gap-2 border-t border-line bg-card2/40 px-3 py-2.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask about the gold market…"
          className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-gold/50 focus:outline-none"
        />
        <button
          onClick={() => send()}
          disabled={busy || !input.trim()}
          className="shrink-0 rounded-xl bg-gradient-to-r from-gold to-yellow-500 px-4 py-2.5 text-sm font-bold text-black transition hover:shadow-lg hover:shadow-gold/30 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </section>
  )
}
