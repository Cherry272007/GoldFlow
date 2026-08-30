const BASE = ''

async function get(path) {
  const response = await fetch(BASE + path)
  if (!response.ok) throw new Error(`GET ${path} failed`)
  return response.json()
}

export const fetchSignal = () => get('/api/signal')
export const fetchStatus = () => get('/api/status')
export const fetchHistory = () => get('/api/history')
export const fetchState = () => get('/api/state')