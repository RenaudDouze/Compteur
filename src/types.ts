export interface HistoryPoint {
  t: number
  v: number
}

/** Style d'affichage du chiffre sur la carte. Absent = 'default' (odomètre actuel). */
export type DisplayStyle = 'default' | 'flap' | 'segment7' | 'ring' | 'editorial' | 'badge'

/** Réglages qui gouvernent le comptage lui-même (indépendants de l'apparence). */
export interface CounterBehavior {
  /** Dénominateur N d'une probabilité "1 chance sur N" (ex: 4096). Absent = fonctionnalité désactivée pour ce compteur. */
  oddsDenominator?: number
  /** Date de début du comptage (YYYY-MM-DD). Absent = utiliser createdAt par défaut. */
  startDate?: string
  /** Incrément appliqué à chaque +/- ou clic sur la carte. Absent = 1. */
  step?: number
  /** Objectif libre (valeur à atteindre). Absent = pas d'objectif défini. */
  target?: number
}

/** Réglages purement visuels de la carte. */
export interface CounterAppearance {
  color: string
  /** Style d'affichage du chiffre. Absent = style par défaut (odomètre). */
  displayStyle?: DisplayStyle
  /** URL d'une image de fond pour la carte du compteur. Absent = pas d'image. */
  backgroundImageUrl?: string
}

export interface Counter {
  id: string
  name: string
  count: number
  createdAt: number
  /** Historique des valeurs dans le temps, pour l'aperçu (sparkline). Absent = pas encore suivi. */
  history?: HistoryPoint[]
  /** Compteur archivé : masqué de la liste par défaut. Absent = actif. */
  archived?: boolean
  /** Horodatage de l'archivage, pour figer la durée totale affichée sur la
   * carte et dans la modale Valeur & réglages. Absent tant que non archivé, ou
   * pour un compteur archivé avant l'ajout de ce champ. */
  archivedAt?: number
  /** Épinglé en tête de liste, devant les compteurs non épinglés. Absent = non épinglé. */
  pinned?: boolean
  behavior: CounterBehavior
  appearance: CounterAppearance
}
