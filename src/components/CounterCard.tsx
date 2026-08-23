import { useEffect, useRef, useState } from 'react'
import { motion, Reorder, useAnimationControls, useDragControls } from 'framer-motion'
import { Odometer } from './Odometer'
import { CounterSettingsPanel } from './CounterSettingsPanel'
import { cumulativeOdds, formatOdds, formatRemainingAttempts, formatConstantChanceReminder } from '../odds'
import type { Counter } from '../types'

// Délai avant qu'un appui maintenu sur +/- déclenche la répétition, puis
// intervalle entre chaque répétition (comptage en rafale).
const HOLD_DELAY_MS = 350
const HOLD_REPEAT_MS = 100

// Distance de tolérance (px) entre l'appui et le relâchement pour qu'un
// geste sur la carte compte comme un tap plutôt qu'un glissement/scroll.
const TAP_MOVE_THRESHOLD_PX = 10

interface CounterCardProps {
  counter: Counter
  fill?: boolean
  // Masque la poignée de glisser (ex: pendant une recherche, où `values` du
  // Reorder.Group ne porte que sur le sous-ensemble filtré affiché).
  draggable?: boolean
  colors: string[]
  onChange: (delta: number) => void
  onSetCount: (count: number) => void
  onRename: (name: string) => void
  onSetOdds: (denominator: number | undefined) => void
  onSetStartDate: (isoDate: string | undefined) => void
  onSetBackgroundImage: (url: string | undefined) => void
  onSetColor: (color: string) => void
  onSetStep: (step: number | undefined) => void
  onDelete: () => void
}

export function CounterCard({
  counter,
  fill = false,
  draggable = true,
  colors,
  onChange,
  onSetCount,
  onRename,
  onSetOdds,
  onSetStartDate,
  onSetBackgroundImage,
  onSetColor,
  onSetStep,
  onDelete,
}: CounterCardProps) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(counter.name)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editingCount, setEditingCount] = useState(false)
  const [draftCount, setDraftCount] = useState(counter.count.toString())
  const [direction, setDirection] = useState<1 | -1>(1)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const valueRef = useRef<HTMLDivElement>(null)
  const [fillFontSize, setFillFontSize] = useState<number | null>(null)
  const pulseControls = useAnimationControls()
  const isFirstCount = useRef(true)
  const dragControls = useDragControls()
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const holdInterval = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const longPressFired = useRef(false)
  const tapStart = useRef<{ x: number; y: number } | null>(null)
  const tapHandledByPointer = useRef(false)

  // `sign` indique juste le sens (+1/-1) : l'amplitude réelle appliquée est
  // le pas personnalisable du compteur (par défaut 1).
  const bump = (sign: 1 | -1) => {
    setDirection(sign)
    // Absent sur la plupart des navigateurs desktop et sur iOS Safari :
    // l'appel optionnel évite une erreur silencieuse, le retour haptique
    // est un bonus, pas un pré-requis.
    navigator.vibrate?.(15)
    onChange(sign * (counter.step ?? 1))
  }

  const stopHold = () => {
    clearTimeout(holdTimer.current)
    clearInterval(holdInterval.current)
  }

  // Un appui bref reste un simple tap (géré par le onClick du bouton, qui
  // continue de fonctionner normalement au clavier et au clic/tap
  // classique). Passé le délai, on bascule en répétition continue et on
  // marque `longPressFired` pour que le onClick qui suivra le relâchement
  // (toujours émis par le navigateur) n'applique pas un incrément en trop.
  const startHold = (sign: 1 | -1) => {
    stopHold()
    longPressFired.current = false
    holdTimer.current = setTimeout(() => {
      longPressFired.current = true
      bump(sign)
      holdInterval.current = setInterval(() => bump(sign), HOLD_REPEAT_MS)
    }, HOLD_DELAY_MS)
  }

  // Sur mobile, le clic natif émis par le navigateur après un touchend peut
  // occasionnellement ne pas se déclencher (ambiguïté tap/scroll, ou bug de
  // synthèse du clic pendant qu'un transform Framer Motion est encore
  // appliqué à la carte) : le compteur reste alors bloqué sans aucune
  // réaction. On suit donc nous-mêmes le tap via les évènements pointer
  // (fiables même quand le clic de compatibilité échoue), en secours du
  // onClick natif qui reste la voie principale pour la souris et le clavier.
  const handleCardPointerDown = (e: React.PointerEvent) => {
    // Ignore le clic droit/bouton secondaire (button !== 0) : seul un tap ou
    // un clic principal doit compter comme une intention d'incrémenter.
    if (e.button !== 0) return
    tapStart.current = { x: e.clientX, y: e.clientY }
  }

  const handleCardPointerUp = (e: React.PointerEvent) => {
    const start = tapStart.current
    tapStart.current = null
    if (!start) return
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y)
    if (moved <= TAP_MOVE_THRESHOLD_PX) {
      tapHandledByPointer.current = true
      bump(1)
    }
  }

  const handleCardPointerCancel = () => {
    tapStart.current = null
  }

  const handleCardClick = () => {
    // Le tap a déjà été compté via pointerup : ignore le clic natif qui
    // suit pour ne pas incrémenter deux fois.
    if (tapHandledByPointer.current) {
      tapHandledByPointer.current = false
      return
    }
    bump(1)
  }

  const commitName = () => {
    const trimmed = draftName.trim()
    onRename(trimmed || 'Sans nom')
    setEditing(false)
  }

  const commitCount = () => {
    const parsed = parseInt(draftCount.replace(/[^-\d]/g, ''), 10)
    setDirection(Number.isFinite(parsed) && parsed >= counter.count ? 1 : -1)
    onSetCount(Number.isFinite(parsed) ? parsed : counter.count)
    setEditingCount(false)
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

  const odds = counter.oddsDenominator ? cumulativeOdds(counter.oddsDenominator, counter.count) : null

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
      onClick={handleCardClick}
      onPointerDown={handleCardPointerDown}
      onPointerUp={handleCardPointerUp}
      onPointerCancel={handleCardPointerCancel}
      role="button"
      tabIndex={0}
      aria-label={`Incrémenter ${counter.name}`}
      onKeyDown={(e) => {
        // Ignore les touches qui bouillonnent depuis un enfant (bouton,
        // champ...) : seule une touche appuyée sur la carte elle-même doit
        // déclencher +1/-1, sinon un Entrée sur un bouton enfant doublerait
        // l'action déjà gérée par son propre onClick.
        if (e.target !== e.currentTarget) return
        if (['Enter', ' ', 'ArrowUp', '+', '='].includes(e.key)) {
          e.preventDefault()
          bump(1)
        } else if (['ArrowDown', '-'].includes(e.key)) {
          e.preventDefault()
          bump(-1)
        }
      }}
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
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Supprimer le compteur"
        title={confirmDelete ? 'Cliquer à nouveau pour confirmer' : 'Supprimer'}
      >
        {confirmDelete ? '✓' : '✕'}
      </button>

      {draggable && (
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
      )}

      <button
        className="counter-settings-btn"
        onClick={(e) => {
          e.stopPropagation()
          setSettingsOpen(true)
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Personnaliser le compteur"
        title="Couleur, image de fond, probabilité, date de début, partage"
      >
        ⚙
      </button>

      {editing ? (
        <input
          className="counter-name-input"
          autoFocus
          value={draftName}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
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
          onPointerDown={(e) => e.stopPropagation()}
          title="Toucher pour renommer"
        >
          {counter.name}
        </h2>
      )}

      {editingCount ? (
        <input
          className="counter-value-input"
          autoFocus
          inputMode="numeric"
          pattern="-?[0-9]*"
          value={draftCount}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
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
          aria-hidden="true"
        >
          <Odometer value={counter.count} direction={direction} />
        </motion.div>
      )}

      {/* Les chiffres de l'odomètre se montent/démontent en continu pour
          l'animation de défilement (visuellement clair, mais illisible pour
          un lecteur d'écran) : cette région annonce la valeur à jour sous
          une forme stable et silencieuse jusqu'au prochain changement. */}
      <span className="sr-only" aria-live="polite">
        {counter.name} : {counter.count}
      </span>

      {odds !== null && (
        <div className="counter-odds-stats">
          <p className="counter-odds-hint">{formatOdds(odds)} de chances de l'avoir obtenu avant ce stade</p>
          <p className="counter-odds-hint">{formatRemainingAttempts(counter.oddsDenominator!, counter.count)}</p>
          <p className="counter-chance-reminder">
            💡 {formatConstantChanceReminder(counter.oddsDenominator!)}
          </p>
        </div>
      )}

      <div className="counter-actions">
        <button
          className="counter-btn edit"
          onClick={(e) => {
            e.stopPropagation()
            setDraftCount(counter.count.toString())
            setEditingCount(true)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Définir la valeur du compteur"
          title="Définir la valeur du compteur"
        >
          ✎
        </button>
        <button
          className="counter-btn minus"
          onClick={(e) => {
            e.stopPropagation()
            if (longPressFired.current) {
              longPressFired.current = false
              return
            }
            bump(-1)
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
            startHold(-1)
          }}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          aria-label="Décrémenter"
        >
          −
        </button>
        <button
          className="counter-btn plus"
          onClick={(e) => {
            e.stopPropagation()
            if (longPressFired.current) {
              longPressFired.current = false
              return
            }
            bump(1)
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
            startHold(1)
          }}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          aria-label="Incrémenter"
        >
          +
        </button>
      </div>

      {settingsOpen && (
        <CounterSettingsPanel
          counter={counter}
          colors={colors}
          onClose={() => setSettingsOpen(false)}
          onSetOdds={onSetOdds}
          onSetStartDate={onSetStartDate}
          onSetBackgroundImage={onSetBackgroundImage}
          onSetColor={onSetColor}
          onSetStep={onSetStep}
        />
      )}
    </Reorder.Item>
  )
}
