import React, { useCallback, useEffect, useState } from 'react'
import {
  PUSH_ENABLED,
  fetchPublicKey,
  getExistingSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from '../services/push'

export default function NotificationToggle({ compact = false }) {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [available, setAvailable] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    async function init() {
      if (!PUSH_ENABLED) {
        setAvailable(false)
        return
      }
      setAvailable(true)
      const key = await fetchPublicKey()
      if (!alive) return
      setConfigured(Boolean(key))
      const sub = await getExistingSubscription()
      if (alive) setEnabled(Boolean(sub))
    }
    init()
    return () => {
      alive = false
    }
  }, [])

  const toggle = useCallback(async () => {
    if (!available || !configured) return
    setLoading(true)
    setError('')
    try {
      if (enabled) {
        await unsubscribeFromPush()
        setEnabled(false)
      } else {
        await subscribeToPush()
        setEnabled(true)
      }
    } catch (e) {
      setError(e?.message || 'Could not update alerts.')
      if (enabled) setEnabled(false)
    } finally {
      setLoading(false)
    }
  }, [available, configured, enabled])

  if (!available) {
    return <p className="text-[10px] text-muted">Alerts need a newer browser.</p>
  }
  if (!configured) {
    return <p className="text-[10px] text-muted">Alerts not enabled.</p>
  }

  if (compact) {
    return (
      <label className="flex cursor-pointer items-center gap-1.5 select-none">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Alerts</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={loading}
          onClick={toggle}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            enabled ? 'bg-ok' : 'bg-line'
          } ${loading ? 'opacity-60' : ''}`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </label>
    )
  }

  return (
    <div className="flex flex-col">
      <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
        <span className="text-sm font-medium text-fg">Push alerts</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={loading}
          onClick={toggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? 'bg-ok' : 'bg-line'
          } ${loading ? 'opacity-60' : ''}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </label>
      <p className="mt-1 text-[11px] text-muted">
        {enabled
          ? 'Alerts on for new BUY / SELL signals.'
          : 'Get a phone alert on fresh BUY / SELL signals.'}
      </p>
      {error ? <p className="mt-1 text-[11px] text-bad">{error}</p> : null}
    </div>
  )
}
