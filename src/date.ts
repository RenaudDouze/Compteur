export function toIsoDate(timestamp: number): string {
  const d = new Date(timestamp)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayIsoDate(): string {
  return toIsoDate(Date.now())
}

/** Nombre de jours écoulés entre une date ISO (YYYY-MM-DD) et aujourd'hui. */
export function daysSince(isoDate: string): number {
  const start = new Date(`${isoDate}T00:00:00`)
  const now = new Date()
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffMs = nowMidnight.getTime() - startMidnight.getTime()
  return Math.max(0, Math.round(diffMs / 86_400_000))
}

export function formatStartDate(isoDate: string, compact = false): string {
  const days = daysSince(isoDate)
  const date = new Date(`${isoDate}T00:00:00`)

  if (compact) {
    const label = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' }).format(date)
    const suffix = days === 0 ? 'auj.' : `${days} j`
    return `${label} · ${suffix}`
  }

  const label = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
  const suffix = days === 0 ? "aujourd'hui" : days === 1 ? '1 jour' : `${days} jours`
  return `${label} · ${suffix}`
}
