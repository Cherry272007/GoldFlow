import React, { useEffect, useState } from 'react'
import Header from '../components/Header'
import SignalHistory from '../components/SignalHistory'
import ConnectionStatus from '../components/ConnectionStatus'
import * as api from '../services/api'

export default function HistoryPage({ market, status, onNavigate }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = React.useCallback(async () => {
    try {
      const his = await api.fetchHistory()
      setHistory((his && his.history) || [])
    } catch {} finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    let sock
    api
      .connectSocket()
      .then((s) => {
        sock = s
        s.on('analysis_update', refresh)
        s.emit('refresh')
      })
      .catch(() => {})
    const poll = setInterval(refresh, 8000)
    return () => { if (sock) sock.close(); clearInterval(poll) }
  }, [refresh])

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-44 lg:px-8">
      <Header market={market} status={status} variant="history" onNavigate={onNavigate} />

      <div className="mb-3">
        <div className="text-sm font-bold uppercase tracking-[0.18em] text-gold">Signal History</div>
        <p className="text-xs text-muted">Every analysis this session recorded by GoldFlow.</p>
      </div>

      {loading && !history.length ? (
        <div className="animate-pulse rounded-2xl border border-line bg-gradient-to-b from-card to-card2 p-6 text-center text-sm text-muted">
          Loading history…
        </div>
      ) : (
        <SignalHistory rows={history} expanded />
      )}

      <footer className="sticky bottom-0 z-10 mt-4 bg-gradient-to-b from-transparent via-bg/95 to-bg pb-3">
        <ConnectionStatus status={status} />
      </footer>
    </div>
  )
}
