export const formatDateTime = (timestampMs: number): string =>
  new Date(timestampMs).toLocaleString()

export const formatRelativeTime = (timestampMs: number): string => {
  const now = Date.now()
  const diffMs = now - timestampMs
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) {
    return 'Just now'
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`
  }

  return new Date(timestampMs).toLocaleDateString()
}

export const formatDate = (timestampMs: number): string =>
  new Date(timestampMs).toLocaleDateString()

export const formatTime = (timestampMs: number): string =>
  new Date(timestampMs).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })

export const parseDateTimeLocalMs = (raw: string): number | null => {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return null
  }

  const ms = Date.parse(trimmed)
  return Number.isFinite(ms) ? ms : null
}
