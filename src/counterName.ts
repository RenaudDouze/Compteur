/** Nom d'affichage d'un compteur : un espace blanc seul ne compte pas comme
 * un nom, retombe alors sur un texte par défaut plutôt que de laisser la
 * carte sans titre. Partagé entre l'édition inline sur la carte
 * (CounterCard.tsx) et le champ de la modale Personnalisation
 * (CounterSettingsPanel.tsx). */
export function sanitizeCounterName(raw: string): string {
  return raw.trim() || 'Sans nom'
}
