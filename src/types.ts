export interface HistoryPoint {
  t: number
  v: number
}

/** Style d'affichage du chiffre sur la carte. Absent = 'default' (odomètre actuel). */
export type DisplayStyle = 'default' | 'flap' | 'lcd' | 'segment7' | 'ring' | 'editorial' | 'badge'

export interface Counter {
  id: string
  name: string
  count: number
  color: string
  createdAt: number
  /** Dénominateur N d'une probabilité "1 chance sur N" (ex: 4096). Absent = fonctionnalité désactivée pour ce compteur. */
  oddsDenominator?: number
  /** Date de début du comptage (YYYY-MM-DD). Absent = utiliser createdAt par défaut. */
  startDate?: string
  /** URL d'une image de fond pour la carte du compteur. Absent = pas d'image. */
  backgroundImageUrl?: string
  /** Incrément appliqué à chaque +/- ou clic sur la carte. Absent = 1. */
  step?: number
  /** Historique des valeurs dans le temps, pour l'aperçu (sparkline). Absent = pas encore suivi. */
  history?: HistoryPoint[]
  /** Style d'affichage du chiffre. Absent = style par défaut (odomètre). */
  displayStyle?: DisplayStyle
  /** Objectif libre (valeur à atteindre). Absent = pas d'objectif défini. */
  target?: number
}
