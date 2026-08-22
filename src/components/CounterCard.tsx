import { useEffect, useRef, useState } from 'react'
import { motion, Reorder, useAnimationControls, useDragControls } from 'framer-motion'
import { Odometer } from './Odometer'
import { cumulativeOdds, formatOdds } from '../odds'
import { formatStartDate, toIsoDate, todayIsoDate } from '../date'
import { buildShareText } from '../share'
import { isValidImageUrl } from '../url'
import { useNarrowScreen } from '../hooks/useNarrowScreen'
import type { Counter } from '../types'

interface CounterCardProps {
  counter: Counter
  fill?: boolean
  colors: string[]
  onChange: (delta: number) => void
  onSetCount: (count: number) => void
  onRename: (name: string) => void
  onSetOdds: (denominator: number | undefined) => void
  onSetStartDate: (isoDate: string | undefined) => void
  onSetBackgroundImage: (url: string | undefined) => void
  onSetColor: (color: string) => void
  onDelete: () => void
}

export function CounterCard({
  counter,
  fill = false,
  colors,
  onChange,
  onSetCount,
  onRename,
  onSetOdds,
  onSetStartDate,
  onSetBackgroundImage,
  onSetColor,
  onDelete,
}: CounterCardProps) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(counter.name)
  const [editingOdds, setEditingOdds] = useState(false)
  const [draftOdds, setDraftOdds] = useState(counter.oddsDenominator?.toString() ?? '')
  const [editingDate, setEditingDate] = useState(false)
  const [editingBackground, setEditingBackground] = useState(false)
  const [draftBackground, setDraftBackground] = useState(counter.backgroundImageUrl ?? '')
  const [editingColor, setEditingColor] = useState(false)
  const [editingCount, setEditingCount] = useState(false)
  const [draftCount, setDraftCount] = useState(counter.count.toString())
  const [direction, setDirection] = useState<1 | -1>(1)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [shared, setShared] = useState(false)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const shareTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const valueRef = useRef<HTMLDivElement>(null)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  const [fillFontSize, setFillFontSize] = useState<number | null>(null)
  const pulseControls = useAnimationControls()
  const isFirstCount = useRef(true)
  const dragControls = useDragControls()

  const bump = (delta: number) => {
    setDirection(delta > 0 ? 1 : -1)
    onChange(delta)
  }

  const commitName = () => {
    const trimmed = draftName.trim()
    onRename(trimmed || 'Sans nom')
    setEditing(false)
  }

  const commitOdds = () => {
    const parsed = parseInt(draftOdds.replace(/[^\d]/g, ''), 10)
    onSetOdds(Number.isFinite(parsed) && parsed > 0 ? parsed : undefined)
    setEditingOdds(false)
  }

  const commitBackground = () => {
    const trimmed = draftBackground.trim()
    if (!trimmed) {
      onSetBackgroundImage(undefined)
    } else if (isValidImageUrl(trimmed)) {
      onSetBackgroundImage(trimmed)
    } else {
      // URL invalide : on ignore la saisie et on revient à la valeur actuelle
      // plutôt que d'effacer une image déjà définie sur une simple faute de frappe.
      setDraftBackground(counter.backgroundImageUrl ?? '')
    }
    setEditingBackground(false)
  }

  const commitCount = () => {
    const parsed = parseInt(draftCount.replace(/[^-\d]/g, ''), 10)
    setDirection(Number.isFinite(parsed) && parsed >= counter.count ? 1 : -1)
    onSetCount(Number.isFinite(parsed) ? parsed : counter.count)
    setEditingCount(false)
  }

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation()
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

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirmDelete) {
      clearTimeout(confirmTimer.current)
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

  // Petit rebond élastique à chaque incrément/décrément, en plus du
  // défilement des chiffres. N'anime que `scale` (accéléré par le
  // compositeur) : une version précédente animait aussi `filter`
  // (drop-shadow/brightness), qui force un repaint à chaque frame et
  // causait des lags visibles sur les appareils moins puissants, en plus
  // du texte à dégradé déjà coûteux à peindre.
  useEffect(() => {
    if (isFirstCount.current) {
      isFirstCount.current = false
      return
    }
    pulseControls.start({
      scale: [1, 1.16, 0.97, 1],
      transition: { duration: 0.35, ease: 'easeOut', times: [0, 0.3, 0.7, 1] },
    })
  }, [counter.count, pulseControls])

  // Ferme le sélecteur de couleur au clic en dehors (le sélecteur n'a pas de
  // champ à "blur" comme les autres éditeurs, contrairement à un <input>).
  useEffect(() => {
    if (!editingColor) return
    // Le conteneur du sélecteur est toujours monté (contrairement à valueRef,
    // absent en mode édition) : `.current` est garanti non nul ici.
    const handleClickOutside = (e: MouseEvent) => {
      if (!colorPickerRef.current!.contains(e.target as Node)) {
        setEditingColor(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editingColor])

  const odds = counter.oddsDenominator ? cumulativeOdds(counter.oddsDenominator, counter.count) : null
  const startDate = counter.startDate ?? toIsoDate(counter.createdAt)
  // Sur un petit écran, on garde le format compact même en affichage géant
  // (1-2 compteurs) pour laisser plus de place au chiffre lui-même.
  const isNarrowScreen = useNarrowScreen()
  const compactMeta = !fill || isNarrowScreen

  return (
    <Reorder.Item
      as="article"
      value={counter}
      id={counter.id}
      dragListener={false}
      dragControls={dragControls}
      layout
      initial={{ opacity: 0, scale: 0.9, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: -8 }}
      whileTap={{ scale: 0.98 }}
      whileDrag={{ scale: 1.03, boxShadow: '0 12px 32px rgba(15, 23, 42, 0.25)', zIndex: 10 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="counter-card"
      style={{ '--accent': counter.color } as React.CSSProperties}
      onClick={() => bump(1)}
      role="button"
      aria-label={`Incrémenter ${counter.name}`}
    >
      {counter.backgroundImageUrl && (
        <div
          className="counter-bg"
          style={{ backgroundImage: `url("${counter.backgroundImageUrl}")` }}
          aria-hidden="true"
        />
      )}

      <button
        className="counter-delete"
        onClick={handleDeleteClick}
        aria-label="Supprimer le compteur"
        title={confirmDelete ? 'Cliquer à nouveau pour confirmer' : 'Supprimer'}
      >
        {confirmDelete ? '✓' : '✕'}
      </button>

      <button
        className="counter-drag-handle"
        onPointerDown={(e) => {
          e.stopPropagation()
          dragControls.start(e)
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label="Réordonner le compteur"
        title="Glisser pour réordonner"
      >
        ⠿
      </button>

      <div className="counter-color-picker" ref={colorPickerRef} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="counter-color-swatch"
          style={{ background: counter.color }}
          onClick={() => setEditingColor((prev) => !prev)}
          aria-label="Changer la couleur du compteur"
          title="Toucher pour changer la couleur"
        />
        {editingColor && (
          <div className="counter-color-options">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                className={`counter-color-option${c === counter.color ? ' selected' : ''}`}
                style={{ background: c }}
                aria-label={`Choisir la couleur ${c}`}
                onClick={() => {
                  onSetColor(c)
                  setEditingColor(false)
                }}
              />
            ))}
          </div>
        )}
      </div>

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

      <div className="counter-meta">
        {editingOdds ? (
          <div className="counter-odds-edit" onClick={(e) => e.stopPropagation()}>
            <span>1 chance sur</span>
            <input
              className="counter-odds-input"
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              value={draftOdds}
              placeholder="4096"
              onChange={(e) => setDraftOdds(e.target.value)}
              onBlur={commitOdds}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitOdds()
                if (e.key === 'Escape') {
                  setDraftOdds(counter.oddsDenominator?.toString() ?? '')
                  setEditingOdds(false)
                }
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            className="counter-meta-label"
            onClick={(e) => {
              e.stopPropagation()
              setDraftOdds(counter.oddsDenominator?.toString() ?? '')
              setEditingOdds(true)
            }}
          >
            {counter.oddsDenominator
              ? compactMeta
                ? `1/${counter.oddsDenominator.toLocaleString('fr-FR')}`
                : `1 chance sur ${counter.oddsDenominator.toLocaleString('fr-FR')}`
              : '+ probabilité'}
          </button>
        )}

        {editingDate ? (
          <input
            type="date"
            className="counter-date-input"
            autoFocus
            defaultValue={startDate}
            max={todayIsoDate()}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              onSetStartDate(e.target.value || undefined)
              setEditingDate(false)
            }}
            onBlur={() => setEditingDate(false)}
          />
        ) : (
          <button
            type="button"
            className="counter-meta-label"
            onClick={(e) => {
              e.stopPropagation()
              setEditingDate(true)
            }}
            title="Toucher pour changer la date de début"
          >
            {formatStartDate(startDate, compactMeta)}
          </button>
        )}

        <button
          type="button"
          className="counter-meta-label"
          onClick={handleShare}
          title="Copier ou partager ce compteur (texte, sans lien)"
        >
          {shared ? 'Copié ✓' : compactMeta ? '⇪' : '⇪ Partager'}
        </button>

        {editingBackground ? (
          <div className="counter-bg-edit" onClick={(e) => e.stopPropagation()}>
            <input
              type="url"
              inputMode="url"
              className="counter-bg-input"
              autoFocus
              value={draftBackground}
              placeholder="https://exemple.com/image.jpg"
              onChange={(e) => setDraftBackground(e.target.value)}
              onBlur={commitBackground}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitBackground()
                if (e.key === 'Escape') {
                  setDraftBackground(counter.backgroundImageUrl ?? '')
                  setEditingBackground(false)
                }
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            className="counter-meta-label"
            onClick={(e) => {
              e.stopPropagation()
              setDraftBackground(counter.backgroundImageUrl ?? '')
              setEditingBackground(true)
            }}
            title="Toucher pour définir une image de fond (URL)"
          >
            {counter.backgroundImageUrl
              ? compactMeta
                ? '🖼'
                : 'Image de fond ✓'
              : '+ image de fond'}
          </button>
        )}
      </div>

      {editingCount ? (
        <input
          className="counter-value-input"
          autoFocus
          inputMode="numeric"
          pattern="-?[0-9]*"
          value={draftCount}
          onClick={(e) => e.stopPropagation()}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraftCount(e.target.value)}
          onBlur={commitCount}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitCount()
            if (e.key === 'Escape') {
              setDraftCount(counter.count.toString())
              setEditingCount(false)
            }
          }}
        />
      ) : (
        <motion.div
          className="counter-value"
          ref={valueRef}
          style={fillFontSize ? { fontSize: `${fillFontSize}px` } : undefined}
          animate={pulseControls}
        >
          <Odometer value={counter.count} direction={direction} />
        </motion.div>
      )}

      {odds !== null && (
        <p className="counter-odds-result">{formatOdds(odds)} de chances de l'avoir obtenu avant ce stade</p>
      )}

      <div className="counter-actions">
        <button
          className="counter-btn edit"
          onClick={(e) => {
            e.stopPropagation()
            setDraftCount(counter.count.toString())
            setEditingCount(true)
          }}
          aria-label="Définir la valeur du compteur"
          title="Définir la valeur du compteur"
        >
          ✎
        </button>
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
    </Reorder.Item>
  )
}
