import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Odometer } from './Odometer'
import type { Counter } from '../types'

interface CounterCardProps {
  counter: Counter
  fill?: boolean
  onChange: (delta: number) => void
  onRename: (name: string) => void
  onDelete: () => void
}

export function CounterCard({ counter, fill = false, onChange, onRename, onDelete }: CounterCardProps) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(counter.name)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const valueRef = useRef<HTMLDivElement>(null)
  const [fillFontSize, setFillFontSize] = useState<number | null>(null)

  const bump = (delta: number) => {
    setDirection(delta > 0 ? 1 : -1)
    onChange(delta)
  }

  const commitName = () => {
    const trimmed = draftName.trim()
    onRename(trimmed || 'Sans nom')
    setEditing(false)
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirmDelete) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
      onDelete()
      return
    }
    setConfirmDelete(true)
    confirmTimer.current = setTimeout(() => setConfirmDelete(false), 2500)
  }

  // Quand il n'y a qu'1 ou 2 compteurs, on mesure l'espace réellement
  // disponible pour afficher le chiffre le plus grand possible, sans le
  // faire déborder ni en hauteur ni en largeur (nombre de chiffres compris).
  useEffect(() => {
    const el = valueRef.current
    if (!fill || !el) {
      setFillFontSize(null)
      return
    }

    const digits = Math.max(counter.count.toString().length, 1)

    const compute = () => {
      // offsetWidth/offsetHeight ignorent les transforms CSS (contrairement à
      // getBoundingClientRect), ce qui évite de mesurer une taille faussée
      // pendant les animations de réagencement de Framer Motion.
      const width = el.offsetWidth
      const height = el.offsetHeight
      if (width === 0 || height === 0) return
      const byHeight = height * 0.85
      const byWidth = width / (digits * 0.62)
      setFillFontSize(Math.max(48, Math.min(byHeight, byWidth)))
    }

    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fill, counter.count])

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.9, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: -8 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="counter-card"
      style={{ '--accent': counter.color } as React.CSSProperties}
      onClick={() => bump(1)}
      role="button"
      aria-label={`Incrémenter ${counter.name}`}
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
          onClick={(e) => e.stopPropagation()}
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
          onClick={(e) => {
            e.stopPropagation()
            setDraftName(counter.name)
            setEditing(true)
          }}
          title="Toucher pour renommer"
        >
          {counter.name}
        </h2>
      )}

      <div
        className="counter-value"
        ref={valueRef}
        style={fillFontSize ? { fontSize: `${fillFontSize}px` } : undefined}
      >
        <Odometer value={counter.count} direction={direction} />
      </div>

      <div className="counter-actions">
        <button
          className="counter-btn minus"
          onClick={(e) => {
            e.stopPropagation()
            bump(-1)
          }}
          aria-label="Décrémenter"
        >
          −
        </button>
        <button
          className="counter-btn plus"
          onClick={(e) => {
            e.stopPropagation()
            bump(1)
          }}
          aria-label="Incrémenter"
        >
          +
        </button>
      </div>
    </motion.article>
  )
}
