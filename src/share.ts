import { cumulativeOdds, formatOdds } from './odds'
import { formatStartDate, toIsoDate } from './date'
import type { Counter } from './types'

/** Texte brut décrivant un compteur, pensé pour être copié/partagé sans lien vers l'app. */
export function buildShareText(counter: Counter): string {
  const lines = [`${counter.name} : ${counter.count}`]

  if (counter.behavior.oddsDenominator) {
    const odds = cumulativeOdds(counter.behavior.oddsDenominator, counter.count)
    lines.push(
      `1 chance sur ${counter.behavior.oddsDenominator.toLocaleString('fr-FR')} · ${formatOdds(odds)} de chances de l'avoir obtenu avant ce stade`
    )
  }

  const startDate = counter.behavior.startDate ?? toIsoDate(counter.createdAt)
  lines.push(formatStartDate(startDate))

  return lines.join('\n')
}
