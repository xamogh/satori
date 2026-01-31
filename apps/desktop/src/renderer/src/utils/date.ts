export const formatDateTime = (timestampMs: number): string =>
  new Date(timestampMs).toLocaleString()

