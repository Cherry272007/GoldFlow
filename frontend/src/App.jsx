import React, { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import AIPage from './pages/AIPage'
import * as api from './services/api'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [market, setMarket] = useState(null)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    let live = true
    api.fetchMarket().then((m) => live && setMarket(m)).catch(() => {})
    api.fetchStatus().then((s) => live && setStatus(s)).catch(() => {})
    api
      .connectSocket()
      .then((sock) => {
        sock.on('market_update', (d) => { if (d.market) setMarket(d.market) })
        sock.emit('refresh')
        if (!live) sock.close()
      })
      .catch(() => {})
    return () => { live = false }
  }, [])

  const nav = (id) => setPage(id)
  const common = { market, status, onNavigate: nav }

  return page === 'ai' ? <AIPage {...common} /> : <Dashboard {...common} />
}
