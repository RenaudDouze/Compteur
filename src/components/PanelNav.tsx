/** Identifie l'une des 4 modales de personnalisation d'un compteur. */
export type PanelKind = 'personnalisation' | 'comportement' | 'historique' | 'actions'

const PANEL_ORDER: PanelKind[] = ['comportement', 'personnalisation', 'historique', 'actions']

const PANEL_LABELS: Record<PanelKind, string> = {
  personnalisation: 'Personnalisation',
  comportement: 'Valeur & réglages',
  historique: 'Historique',
  actions: 'Actions',
}

interface PanelNavProps {
  current: PanelKind
  onNavigate: (panel: PanelKind) => void
}

/** Liens discrets vers les 3 autres modales, affichés en bas de chacune sur
 * une seule ligne : permet de passer de l'une à l'autre sans repasser par la
 * carte, sans pour autant rivaliser visuellement avec les actions propres à
 * la modale (volontairement plus sobres que des `.modal-btn`). */
export function PanelNav({ current, onNavigate }: PanelNavProps) {
  const others = PANEL_ORDER.filter((panel) => panel !== current)
  return (
    <section className="modal-section">
      <nav className="panel-nav" aria-label="Autres réglages du compteur">
        {others.map((panel, i) => (
          <span key={panel} className="panel-nav-item">
            {i > 0 && (
              <span className="panel-nav-sep" aria-hidden="true">
                ·
              </span>
            )}
            <button type="button" className="panel-nav-link" onClick={() => onNavigate(panel)}>
              {PANEL_LABELS[panel]}
            </button>
          </span>
        ))}
      </nav>
    </section>
  )
}
