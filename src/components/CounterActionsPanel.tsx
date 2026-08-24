import { useRef, useState } from 'react'
import { buildShareText } from '../share'
import { Modal } from './Modal'
import { PanelNav } from './PanelNav'
import type { PanelKind } from './PanelNav'
import type { Counter } from '../types'

interface CounterActionsPanelProps {
  counter: Counter
  onClose: () => void
  onDuplicate: () => void
  onNavigate: (panel: PanelKind) => void
}

export function CounterActionsPanel({ counter, onClose, onDuplicate, onNavigate }: CounterActionsPanelProps) {
  const [shared, setShared] = useState(false)
  const shareTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const handleShare = async () => {
    const text = buildShareText(counter)
    if (navigator.share) {
      try {
        await navigator.share({ text })
      } catch {
        // partage annulé par l'utilisateur : rien à faire
      }
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setShared(true)
      clearTimeout(shareTimer.current)
      shareTimer.current = setTimeout(() => setShared(false), 2000)
    } catch {
      // copie impossible (permissions navigateur) : on ignore silencieusement
    }
  }

  const handleDuplicate = () => {
    onDuplicate()
    onClose()
  }

  return (
    <Modal title={`Actions « ${counter.name} »`} onClose={onClose} accentColor={counter.color}>
      <section className="modal-section">
        <button className="modal-btn" onClick={handleShare}>
          {shared ? 'Copié ✓' : '⇪ Partager ce compteur'}
        </button>
        <button className="modal-btn" onClick={handleDuplicate}>
          ⧉ Dupliquer ce compteur
        </button>
      </section>

      <PanelNav current="actions" onNavigate={onNavigate} />
    </Modal>
  )
}
