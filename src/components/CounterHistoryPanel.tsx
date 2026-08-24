import { Sparkline } from './Sparkline'
import { Modal } from './Modal'
import { PanelNav } from './PanelNav'
import type { PanelKind } from './PanelNav'
import type { Counter } from '../types'

interface CounterHistoryPanelProps {
  counter: Counter
  onClose: () => void
  onNavigate: (panel: PanelKind) => void
}

export function CounterHistoryPanel({ counter, onClose, onNavigate }: CounterHistoryPanelProps) {
  return (
    <Modal title={`Historique « ${counter.name} »`} onClose={onClose} accentColor={counter.color}>
      <section className="modal-section">
        {counter.history && counter.history.length >= 2 ? (
          <>
            <Sparkline points={counter.history} color={counter.color} />
            <p className="modal-hint">
              Min : {Math.min(...counter.history.map((p) => p.v))} · Max :{' '}
              {Math.max(...counter.history.map((p) => p.v))}
            </p>
          </>
        ) : (
          <p className="modal-hint">
            Pas encore assez d'historique : incrémente ou décrémente le compteur pour le voir apparaître.
          </p>
        )}
      </section>

      <PanelNav current="historique" onNavigate={onNavigate} />
    </Modal>
  )
}
