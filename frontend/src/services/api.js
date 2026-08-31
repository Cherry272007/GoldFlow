const BASE = ''

// Optional GoldFlow API key, injected at build time for private deployments.
// Leave unset for the public no-auth dashboard.
const KEY = import.meta.env.VITE_GOLDFLOW_API_KEY || ''

function headers(json) {
  const h = {}
  if (KEY) h['X-GoldFlow-Key'] = KEY
  if (json) h['Content-Type'] = 'application/json'
  return h
}

async function get(path) {
  const r = await fetch(BASE + path, { headers: headers(false) })
  if (!r.ok) {
    let msg = `Request failed (${r.status})`
    try {
      const body = await r.json()
      if (body.error) msg = body.error
    } catch {
      /* keep default */
    }
    throw new Error(msg)
  }
  return r.json()
}

async function post(path, body) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    let msg = `Request failed (${r.status})`
    try {
      const data = await r.json()
      if (data.error) msg = data.error
    } catch {
      /* keep default */
    }
    throw new Error(msg)
  }
  return r.json()
}

export const fetchMarket = () => get('/api/market')
export const fetchIndicators = () => get('/api/indicators')
export const fetchSignal = () => get('/api/signal')
export const fetchAnalysis = () => get('/api/analysis')
export const fetchHistory = () => get('/api/history')
export const fetchStatus = () => get('/api/status')
export const fetchConfig = () => get('/api/config')

export function runAnalysis(images) {
  const payload = (images || []).map((img) => ({
    name: img.name,
    mime: img.mime,
    data: img.dataUrl,
  }))
  return post('/api/analyze', { images: payload, force_ai: true })
}

export function analyzeImage(image) {
  return post('/api/analyze-image', {
    name: image.name,
    mime: image.mime,
    data: image.dataUrl,
  })
}

export function connectSocket() {
  return import('socket.io-client').then(({ io }) =>
    io({ path: '/socket.io', transports: ['websocket', 'polling'], reconnection: true }),
  )
}