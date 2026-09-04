import { daysBetween, formatAveragePerDay, toIsoDate } from './date'
import type { Counter } from './types'

export interface ArchiveStats {
  count: number
  totalValue: number
  // `null` quand aucun compteur archivé n'a de date d'archivage connue
  // (`archivedAt`, absent pour les compteurs archivés avant l'ajout de ce
  // champ) : pas de moyenne devinée plutôt qu'une valeur fausse.
  averagePerDay: string | null
}

/** Statistiques cumulées sur l'ensemble des compteurs archivés, pour la vue
 * Archivés (par opposition aux stats par carte, propres à un seul compteur —
 * voir CounterCard.tsx). Le total cumulé inclut tous les compteurs archivés
 * (une somme n'a pas besoin de connaître une durée) ; la moyenne par jour, en
 * revanche, ne porte que sur ceux dont la durée est connue — chacun compté
 * pour au moins 1 jour (comme `formatAveragePerDay` pour une seule carte),
 * pour éviter qu'un archivage le jour même n'annule sa contribution. */
export function computeArchiveStats(counters: Counter[]): ArchiveStats {
  const archived = counters.filter((c) => c.archived)
  const totalValue = archived.reduce((sum, c) => sum + c.count, 0)

  let totalDays = 0
  let totalValueWithDuration = 0
  for (const c of archived) {
    if (c.archivedAt === undefined) continue
    const start = c.behavior.startDate ?? toIsoDate(c.createdAt)
    const end = toIsoDate(c.archivedAt)
    totalDays += Math.max(daysBetween(start, end), 1)
    totalValueWithDuration += c.count
  }

  return {
    count: archived.length,
    totalValue,
    averagePerDay: totalDays > 0 ? formatAveragePerDay(totalValueWithDuration, totalDays) : null,
  }
}
