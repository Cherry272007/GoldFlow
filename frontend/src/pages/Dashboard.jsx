import { useEffect, useState } from 'react'
import { fetchHistory, fetchSignal, fetchStatus } from '../services/api'
import SignalCard from '../components/SignalCard'
import ConnectionCard from '../components/ConnectionCard'
import MarketCard from '../components/MarketCard'
import HistoryCard from '../components/HistoryCard'

export default function Dashboard() {
  const [signal, setSignal] = useState(null)
  const [status, setStatus] = useState(null)
  const [history, setHistory] = useState([])
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [s, st, h] = await Promise.all([
          fetchSignal(),
          fetchStatus(),
          fetchHistory(),
        ])
        setSignal(s)
        setStatus(st)
        setHistory(h.history || [])
        setOnline(true)
      } catch {
        setOnline(false)
      }
    }
    loadAll()
    const fast = setInterval(loadAll, 1000)
    return () => clearInterval(fast)
  }, [])

  return (
    <div className="wrap">
      <div className="app-title">GOLDFLOW</div>
      {!online && (
        <div className="card badge">
          <span className="wait">&#9679; Server unreachable</span>
        </div>
      )}
      <SignalCard signal={signal} />
      <ConnectionCard status={status} />
      <MarketCard signal={signal} status={status} />
      <HistoryCard history={history} />
      <div className="footer">Alert-only. GoldFlow does not place orders.</div>
    </div>
  )
}