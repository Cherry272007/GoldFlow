const fmtTime = (iso) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return '—'
  }
}

const fmtAge = (iso) => {
  if (!iso) return '—'
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (diff < 60) return `${diff}s ago`
  return `${Math.floor(diff / 60)}m ${diff % 60}s ago`
}

const fmtPrice = (v) => (v == null ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

const fmtPct = (v) => (v == null ? '—' : `${v}%`)

const cap = (s) => (typeof s === 'string' && s.length ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '—')

export { fmtTime, fmtAge, fmtPrice, fmtPct, cap }