import type { HistoryPoint } from './types'

// Assez de points pour un aperçu utile sur la durée sans faire grossir
// indéfiniment le stockage local.
const MAX_HISTORY_POINTS = 200
// Un appui long (rafale) peut déclencher un changement toutes les 100ms :
// on regroupe ces changements rapprochés en un seul point, pour que
// l'historique reflète une tendance dans le temps plutôt qu'une rafale isolée.
const MIN_INTERVAL_MS = 2000

/** Ajoute un point à l'historique d'un compteur, en le capant et en fusionnant
 * les changements trop rapprochés dans le temps. */
export function appendHistoryPoint(
  history: HistoryPoint[] | undefined,
  value: number,
  now = Date.now()
): HistoryPoint[] {
  const points = history ?? []
  const last = points[points.length - 1]
  const next =
    last && now - last.t < MIN_INTERVAL_MS
      ? [...points.slice(0, -1), { t: now, v: value }]
      : [...points, { t: now, v: value }]
  // `slice(-N)` sur un tableau plus court que N le retourne inchangé (start
  // négatif borné à 0) : pas besoin de comparer la longueur au plafond.
  return next.slice(-MAX_HISTORY_POINTS)
}
