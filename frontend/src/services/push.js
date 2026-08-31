const BASE = ''
const KEY = import.meta.env.VITE_GOLDFLOW_API_KEY || ''

function headers(json = false) {
  const h = {}
  if (KEY) h['X-GoldFlow-Key'] = KEY
  if (json) h['Content-Type'] = 'application/json'
  return h
}

export const PUSH_ENABLED = 'serviceWorker' in navigator && 'PushManager' in window

export async function fetchPublicKey() {
  const r = await fetch(BASE + '/api/push/public-key')
  if (!r.ok) return null
  const data = await r.json()
  return data.public_key || null
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.register(BASE + '/sw.js', { scope: '/' })
}

export async function getExistingSubscription() {
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return null
  return reg.pushManager.getSubscription()
}

export async function subscribeToPush() {
  if (!PUSH_ENABLED) {
    throw new Error('Web Push is not supported in this browser.')
  }

  const publicKey = await fetchPublicKey()
  if (!publicKey) {
    throw new Error('Push is not configured on this server.')
  }

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }

  const data = sub.toJSON()
  const r = await fetch(BASE + '/api/push/subscribe', {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify({
      endpoint: data.endpoint,
      p256dh: data.keys.p256dh,
      auth: data.keys.auth,
    }),
  })
  if (!r.ok) {
    throw new Error('Could not register for alerts.')
  }
  return sub
}

export async function unsubscribeFromPush() {
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return true
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return true
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  try {
    await fetch(BASE + '/api/push/unsubscribe', {
      method: 'POST',
      headers: headers(true),
      body: JSON.stringify({ endpoint }),
    })
  } catch {
    /* best-effort */
  }
  return true
}

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const raw = window.atob(base64)
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0)))
}
