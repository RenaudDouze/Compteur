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

/** Nombre de jours entre deux dates ISO (YYYY-MM-DD), à l'heure du jour près. */
export function daysBetween(startIsoDate: string, endIsoDate: string): number {
  const start = new Date(`${startIsoDate}T00:00:00`)
  const end = new Date(`${endIsoDate}T00:00:00`)
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const endMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  const diffMs = endMidnight.getTime() - startMidnight.getTime()
  return Math.max(0, Math.round(diffMs / 86_400_000))
}

/** Nombre de jours écoulés entre une date ISO (YYYY-MM-DD) et aujourd'hui. */
export function daysSince(isoDate: string): number {
  return daysBetween(isoDate, todayIsoDate())
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

/** Durée totale figée entre deux dates ISO (YYYY-MM-DD), ex: pour un
 * compteur archivé (contrairement à `formatStartDate`, qui compte les jours
 * écoulés jusqu'à aujourd'hui pour un compteur toujours actif). */
export function formatDuration(startIsoDate: string, endIsoDate: string, compact = false): string {
  const days = daysBetween(startIsoDate, endIsoDate)
  const start = new Date(`${startIsoDate}T00:00:00`)
  const end = new Date(`${endIsoDate}T00:00:00`)

  if (compact) {
    const fmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' })
    return `${fmt.format(start)} → ${fmt.format(end)} · ${days} j`
  }

  const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  const suffix = days === 0 ? "aujourd'hui" : days === 1 ? '1 jour' : `${days} jours`
  return `${fmt.format(start)} → ${fmt.format(end)} · ${suffix}`
}

/** Moyenne d'incrément par jour sur une durée figée (compte total divisé par
 * le nombre de jours écoulés), pour les stats d'un compteur archivé. Un
 * intervalle de moins d'une journée compte comme 1 jour, pour éviter une
 * division par zéro qui produirait une moyenne infinie. */
export function formatAveragePerDay(count: number, days: number): string {
  const average = count / Math.max(days, 1)
  return `${average.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} / jour`
}
