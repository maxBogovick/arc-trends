export function formatDistanceToNow(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatCurrency(amount: number): string {
  return `${Math.round(amount)} MDL`
}

let _counter = 0
export function uid(): string {
  return `${Date.now().toString(36)}-${(++_counter).toString(36)}`
}
