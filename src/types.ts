export interface Counter {
  id: string
  name: string
  count: number
  color: string
  createdAt: number
  /** Dénominateur N d'une probabilité "1 chance sur N" (ex: 4096). Absent = fonctionnalité désactivée pour ce compteur. */
  oddsDenominator?: number
}
