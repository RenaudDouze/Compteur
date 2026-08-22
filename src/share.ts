import { cumulativeOdds, formatOdds } from './odds'
import { formatStartDate, toIsoDate } from './date'
import type { Counter } from './types'

/** Texte brut décrivant un compteur, pensé pour être copié/partagé sans lien vers l'app. */
export function buildShareText(counter: Counter): string {
  const lines = [`${counter.name} : ${counter.count}`]

  if (counter.oddsDenominator) {
    const odds = cumulativeOdds(counter.oddsDenominator, counter.count)
    lines.push(
      `1 chance sur ${counter.oddsDenominator.toLocaleString('fr-FR')} · ${formatOdds(odds)} d'avoir déjà eu l'événement`
    )
  }

  const startDate = counter.startDate ?? toIsoDate(counter.createdAt)
  lines.push(formatStartDate(startDate))

  return lines.join('\n')
}
