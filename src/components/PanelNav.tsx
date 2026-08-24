/** Identifie l'une des 4 modales de personnalisation d'un compteur. */
export type PanelKind = 'personnalisation' | 'comportement' | 'historique' | 'actions'

const PANEL_ORDER: PanelKind[] = ['personnalisation', 'comportement', 'historique', 'actions']

const PANEL_LABELS: Record<PanelKind, string> = {
  personnalisation: 'Personnalisation',
  comportement: 'Comportement',
  historique: 'Historique',
  actions: 'Actions',
}

interface PanelNavProps {
  current: PanelKind
  onNavigate: (panel: PanelKind) => void
}

/** Liens vers les 3 autres modales, affichés en bas de chacune : permet de
 * passer de l'une à l'autre sans repasser par la carte. */
export function PanelNav({ current, onNavigate }: PanelNavProps) {
  return (
    <section className="modal-section">
      {PANEL_ORDER.filter((panel) => panel !== current).map((panel) => (
        <button key={panel} className="modal-btn" onClick={() => onNavigate(panel)}>
          → {PANEL_LABELS[panel]}
        </button>
      ))}
    </section>
  )
}
