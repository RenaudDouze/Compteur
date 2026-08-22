import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Odometer } from './Odometer'
import type { Counter } from '../types'

interface CounterCardProps {
  counter: Counter
  onChange: (delta: number) => void
  onRename: (name: string) => void
  onDelete: () => void
}

export function CounterCard({ counter, onChange, onRename, onDelete }: CounterCardProps) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(counter.name)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const bump = (delta: number) => {
    setDirection(delta > 0 ? 1 : -1)
    onChange(delta)
  }

  const commitName = () => {
    const trimmed = draftName.trim()
    onRename(trimmed || 'Sans nom')
    setEditing(false)
  }

  const handleDeleteClick = () => {
    if (confirmDelete) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
      onDelete()
      return
    }
    setConfirmDelete(true)
    confirmTimer.current = setTimeout(() => setConfirmDelete(false), 2500)
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.9, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: -8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="counter-card"
      style={{ '--accent': counter.color } as React.CSSProperties}
    >
      <button
        className="counter-delete"
        onClick={handleDeleteClick}
        aria-label="Supprimer le compteur"
        title={confirmDelete ? 'Cliquer à nouveau pour confirmer' : 'Supprimer'}
      >
        {confirmDelete ? '✓' : '✕'}
      </button>

      {editing ? (
        <input
          className="counter-name-input"
          autoFocus
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName()
            if (e.key === 'Escape') {
              setDraftName(counter.name)
              setEditing(false)
            }
          }}
          maxLength={40}
        />
      ) : (
        <h2
          className="counter-name"
          onClick={() => {
            setDraftName(counter.name)
            setEditing(true)
          }}
          title="Toucher pour renommer"
        >
          {counter.name}
        </h2>
      )}

      <div className="counter-value">
        <Odometer value={counter.count} direction={direction} />
      </div>

      <div className="counter-actions">
        <button
          className="counter-btn minus"
          onClick={() => bump(-1)}
          aria-label="Décrémenter"
        >
          −
        </button>
        <button
          className="counter-btn plus"
          onClick={() => bump(1)}
          aria-label="Incrémenter"
        >
          +
        </button>
      </div>
    </motion.article>
  )
}
