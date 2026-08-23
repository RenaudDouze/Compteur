import type { DisplayStyle } from './types'

/** Styles d'affichage proposés pour le chiffre du compteur, dans l'ordre de sélection. */
export const DISPLAY_STYLES: { id: DisplayStyle; label: string }[] = [
  { id: 'default', label: 'Actuel' },
  { id: 'flap', label: 'Volets' },
  { id: 'lcd', label: 'LCD rétro' },
  { id: 'segment7', label: '7 segments' },
  { id: 'ring', label: 'Anneau' },
  { id: 'editorial', label: 'Éditorial' },
  { id: 'badge', label: 'Pastille' },
]
