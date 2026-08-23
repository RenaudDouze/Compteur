/**
 * Probabilité cumulée d'avoir obtenu au moins une fois un événement de
 * probabilité 1/denominator après `attempts` essais indépendants.
 * (ex: chasse aux shasses/loot rares : 1 - (1 - 1/N)^n)
 */
export function cumulativeOdds(denominator: number, attempts: number): number {
  if (!(denominator > 0)) return 0
  const n = Math.max(attempts, 0)
  const p = 1 / denominator
  return 1 - Math.pow(1 - p, n)
}

/** Formate une probabilité (0..1) en pourcentage lisible, avec plus de
 * décimales quand la valeur est très petite pour rester informatif. */
export function formatOdds(ratio: number): string {
  const pct = ratio * 100
  if (pct <= 0) return '0 %'
  if (pct >= 99.995) return '> 99,99 %'

  const decimals = pct < 0.1 ? 4 : pct < 1 ? 3 : pct < 10 ? 2 : 1
  return `${pct.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} %`
}

/** Message sur le nombre de tentatives restantes en moyenne avant d'avoir
 * obtenu l'événement, ou un message positif une fois la moyenne dépassée
 * (la chance cumulée compense, plutôt que d'afficher un nombre négatif). */
export function formatRemainingAttempts(denominator: number, count: number): string {
  const remaining = denominator - count
  if (remaining > 0) {
    return `Encore ~${remaining.toLocaleString('fr-FR')} ${remaining === 1 ? 'tentative' : 'tentatives'} en moyenne (moyenne : ${denominator.toLocaleString('fr-FR')})`
  }
  return `Moyenne dépassée (${count.toLocaleString('fr-FR')} / ${denominator.toLocaleString('fr-FR')}) — la chance cumulée compense`
}

/** Rappel que chaque tentative garde une chance constante, indépendamment
 * des précédentes (pas de notion de "malchance qui s'accumule"). */
export function formatConstantChanceReminder(denominator: number): string {
  return `Chaque tentative garde exactement 1 chance sur ${denominator.toLocaleString('fr-FR')}, quel que soit le nombre de tentatives précédentes.`
}
