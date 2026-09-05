import { daysBetween, formatAveragePerDay, toIsoDate } from './date'
import type { Counter } from './types'

export interface ArchiveStats {
  count: number
  totalValue: number
  // Valeur moyenne et médiane par compteur archivé, tous compteurs
  // confondus (contrairement à `averagePerDay`/`averageDurationDays`
  // ci-dessous, elles ne dépendent pas d'une date d'archivage connue, donc
  // jamais `null` — juste `'0'` quand `count` est 0).
  averageValue: string
  medianValue: string
  // `null` quand aucun compteur archivé n'a de date d'archivage connue
  // (`archivedAt`, absent pour les compteurs archivés avant l'ajout de ce
  // champ) : pas de moyenne devinée plutôt qu'une valeur fausse.
  averagePerDay: string | null
  // Durée moyenne (en jours) passée sur un compteur avant archivage, sur ce
  // même sous-ensemble à durée connue. `null` dans les mêmes conditions que
  // `averagePerDay` ci-dessus.
  averageDurationDays: string | null
}

/** Même arrondi (une décimale, via `toLocaleString`) que `formatAveragePerDay`
 * et `formatAverageDurationDays` ci-dessous, mais sans unité — pour une
 * valeur brute de compteur (moyenne, médiane). */
function formatNumber(value: number): string {
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
}

/** Médiane d'un tableau non vide de valeurs (moyenne des deux valeurs
 * centrales si la longueur est paire). */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/** Nombre de jours moyen, au singulier/pluriel correct — `days` (division de
 * deux entiers) n'est jamais 0 (chaque compteur qui y contribue compte pour
 * au moins 1 jour, voir plus bas), donc seul le cas `=== 1` (tous les
 * compteurs contributeurs ont duré exactement 1 jour) réclame le singulier.
 * Arrondi à une décimale par `toLocaleString` directement, comme
 * `formatAveragePerDay` (date.ts) pour la même moyenne au format "X / jour" —
 * pas de pré-arrondi séparé, qui rendrait `maximumFractionDigits` inerte. */
function formatAverageDurationDays(days: number): string {
  const formatted = days.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
  return `${formatted} ${days === 1 ? 'jour' : 'jours'}`
}

/** Statistiques cumulées sur l'ensemble des compteurs archivés, pour la vue
 * Archivés (par opposition aux stats par carte, propres à un seul compteur —
 * voir CounterCard.tsx). Le total cumulé inclut tous les compteurs archivés
 * (une somme n'a pas besoin de connaître une durée) ; la moyenne par jour et
 * la durée moyenne, en revanche, ne portent que sur ceux dont la durée est
 * connue — chacun compté pour au moins 1 jour (comme `formatAveragePerDay`
 * pour une seule carte), pour éviter qu'un archivage le jour même n'annule
 * sa contribution. */
export function computeArchiveStats(counters: Counter[]): ArchiveStats {
  const archived = counters.filter((c) => c.archived)
  const totalValue = archived.reduce((sum, c) => sum + c.count, 0)

  let totalDays = 0
  let totalValueWithDuration = 0
  let countWithDuration = 0
  for (const c of archived) {
    if (c.archivedAt === undefined) continue
    const start = c.behavior.startDate ?? toIsoDate(c.createdAt)
    const end = toIsoDate(c.archivedAt)
    totalDays += Math.max(daysBetween(start, end), 1)
    totalValueWithDuration += c.count
    countWithDuration += 1
  }

  return {
    count: archived.length,
    totalValue,
    averageValue: archived.length > 0 ? formatNumber(totalValue / archived.length) : '0',
    medianValue: archived.length > 0 ? formatNumber(median(archived.map((c) => c.count))) : '0',
    averagePerDay: totalDays > 0 ? formatAveragePerDay(totalValueWithDuration, totalDays) : null,
    averageDurationDays: countWithDuration > 0 ? formatAverageDurationDays(totalDays / countWithDuration) : null,
  }
}
