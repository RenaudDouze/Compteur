import { useRef, useState } from 'react'
import { buildShareText } from '../share'
import { counterShareImageBlob } from '../shareCard'
import { triggerDownload } from '../sync'
import { Modal } from './Modal'
import { PanelNav } from './PanelNav'
import type { PanelKind } from './PanelNav'
import type { Counter } from '../types'

interface CounterActionsPanelProps {
  counter: Counter
  onClose: () => void
  onDuplicate: () => void
  onToggleArchive: () => void
  onTogglePin: () => void
  onDelete: () => void
  onNavigate: (panel: PanelKind) => void
}

export function CounterActionsPanel({
  counter,
  onClose,
  onDuplicate,
  onToggleArchive,
  onTogglePin,
  onDelete,
  onNavigate,
}: CounterActionsPanelProps) {
  const [shared, setShared] = useState(false)
  const shareTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [sharingImage, setSharingImage] = useState(false)
  const [imageShareError, setImageShareError] = useState(false)
  const imageShareErrorTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

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

  const handleShareImage = async () => {
    setSharingImage(true)
    try {
      const blob = await counterShareImageBlob(counter)
      if (!blob) {
        setImageShareError(true)
        clearTimeout(imageShareErrorTimer.current)
        imageShareErrorTimer.current = setTimeout(() => setImageShareError(false), 2500)
        return
      }
      const filename = `${counter.name.replace(/[^a-zA-Z0-9-_]+/g, '-') || 'compteur'}.png`
      const file = new File([blob], filename, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] })
        } catch {
          // partage annulé par l'utilisateur : rien à faire
        }
        return
      }
      triggerDownload(blob, filename)
    } finally {
      setSharingImage(false)
    }
  }

  const handleDuplicate = () => {
    onDuplicate()
    onClose()
  }

  const handleToggleArchive = () => {
    onToggleArchive()
    onClose()
  }

  const handleTogglePin = () => {
    onTogglePin()
    onClose()
  }

  const handleDeleteClick = () => {
    if (confirmDelete) {
      clearTimeout(confirmTimer.current)
      onDelete()
      return
    }
    setConfirmDelete(true)
    confirmTimer.current = setTimeout(() => setConfirmDelete(false), 2500)
  }

  return (
    <Modal title={`Actions « ${counter.name} »`} onClose={onClose} accentColor={counter.appearance.color}>
      <section className="modal-section">
        <button className="modal-btn" onClick={handleShare}>
          {shared ? 'Copié ✓' : '⇪ Partager ce compteur'}
        </button>
        <button className="modal-btn" onClick={handleShareImage} disabled={sharingImage}>
          {imageShareError ? 'Erreur ✗' : sharingImage ? 'Génération…' : '🖼 Partager en image'}
        </button>
        <button className="modal-btn" onClick={handleDuplicate}>
          ⧉ Dupliquer ce compteur
        </button>
        <button className="modal-btn" onClick={handleTogglePin}>
          {counter.pinned ? '📌 Détacher ce compteur' : '📌 Épingler en haut'}
        </button>
        <button className="modal-btn" onClick={handleToggleArchive}>
          {counter.archived ? '📤 Désarchiver ce compteur' : '📦 Archiver ce compteur'}
        </button>
      </section>

      <section className="modal-section modal-section--danger">
        <h3>Zone de danger</h3>
        <button type="button" className="modal-btn modal-btn--danger" onClick={handleDeleteClick}>
          {confirmDelete ? '✓ Confirmer la suppression' : '🗑 Supprimer ce compteur'}
        </button>
      </section>

      <PanelNav current="actions" onNavigate={onNavigate} />
    </Modal>
  )
}
