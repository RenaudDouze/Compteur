import { useEffect, useRef, useState } from 'react'
import { motion, Reorder, useAnimationControls, useDragControls } from 'framer-motion'
import { CounterValueDisplay } from './CounterValueDisplay'
import { CounterSettingsPanel } from './CounterSettingsPanel'
import { CounterBehaviorSettingsPanel } from './CounterBehaviorSettingsPanel'
import { CounterHistoryPanel } from './CounterHistoryPanel'
import { CounterActionsPanel } from './CounterActionsPanel'
import type { PanelKind } from './PanelNav'
import { cumulativeOdds, formatOdds, progressRatio } from '../odds'
import { daysBetween, formatAveragePerDay, formatDuration, toIsoDate } from '../date'
import { playIncrementSound } from '../sound'
import type { Counter, DisplayStyle } from '../types'

// Délai avant qu'un appui maintenu sur +/- déclenche la répétition, puis
// intervalle entre chaque répétition (comptage en rafale).
const HOLD_DELAY_MS = 350
const HOLD_REPEAT_MS = 100

// Distance de tolérance (px) entre l'appui et le relâchement pour qu'un
// geste sur la carte compte comme un tap plutôt qu'un glissement/scroll.
const TAP_MOVE_THRESHOLD_PX = 10

// Durée d'affichage du confetti à l'atteinte de l'objectif.
const CELEBRATION_DURATION_MS = 1100
// Angles (en degrés) des particules du confetti, réparties en éventail sur
// un demi-cercle plutôt qu'un cercle complet : le bas de la carte contient
// souvent les boutons +/-, un confetti y retomberait dessus sans y être vu.
const CONFETTI_ANGLES = [-90, -65, -40, -15, 15, 40, 65, 90, -110, 110]
const CONFETTI_COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899']

interface CounterCardProps {
  counter: Counter
  fill?: boolean
  // Masque la poignée de glisser dès que la liste affichée ne porte que sur
  // un sous-ensemble filtré (recherche, vue archivés) : `values` du
  // Reorder.Group ne couvrirait alors plus tous les compteurs, et réordonner
  // remplacerait silencieusement la liste complète par ce sous-ensemble.
  draggable?: boolean
  colors: string[]
  onChange: (delta: number) => void
  onSetCount: (count: number) => void
  onRename: (name: string) => void
  onSetOdds: (denominator: number | undefined) => void
  onSetTarget: (target: number | undefined) => void
  onSetStartDate: (isoDate: string | undefined) => void
  onSetBackgroundImage: (url: string | undefined) => void
  onSetColor: (color: string) => void
  onSetStep: (step: number | undefined) => void
  onSetDisplayStyle: (style: DisplayStyle | undefined) => void
  onDuplicate: () => void
  onToggleArchive: () => void
  onTogglePin: () => void
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
  onSetTarget,
  onSetStartDate,
  onSetBackgroundImage,
  onSetColor,
  onSetStep,
  onSetDisplayStyle,
  onDuplicate,
  onToggleArchive,
  onTogglePin,
  onDelete,
}: CounterCardProps) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(counter.name)
  // 4 modales distinctes : la personnalisation de l'apparence (couleur,
  // style, image de fond), le comportement du compteur (pas d'incrément,
  // objectif, probabilité, date de début), son historique, et les actions
  // (partage, duplication). Chacune peut naviguer vers les 3 autres.
  const [openPanel, setOpenPanel] = useState<PanelKind | null>(null)
  const [editingCount, setEditingCount] = useState(false)
  const [draftCount, setDraftCount] = useState(counter.count.toString())
  const [countError, setCountError] = useState<string | null>(null)
  const [direction, setDirection] = useState<1 | -1>(1)
  const valueRef = useRef<HTMLDivElement>(null)
  const [fillFontSize, setFillFontSize] = useState<number | null>(null)
  const pulseControls = useAnimationControls()
  const isFirstCount = useRef(true)
  const [celebrating, setCelebrating] = useState(false)
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const prevCountForTarget = useRef(counter.count)
  const dragControls = useDragControls()
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const holdInterval = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const longPressFired = useRef(false)
  const tapStart = useRef<{ x: number; y: number } | null>(null)
  const tapHandledByPointer = useRef(false)

  // Un compteur archivé est en lecture seule : le comptage, le renommage et
  // le glisser-déposer sont bloqués (seuls désarchiver, dupliquer et
  // supprimer, dans la modale Actions, restent possibles).
  const locked = !!counter.archived

  // `sign` indique juste le sens (+1/-1) : l'amplitude réelle appliquée est
  // le pas personnalisable du compteur (par défaut 1). Unique point d'entrée
  // du comptage (tap, clic, +/-, clavier, rafale) : bloquer ici suffit à
  // verrouiller un compteur archivé partout à la fois.
  const bump = (sign: 1 | -1) => {
    if (locked) return
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
    const trimmed = draftCount.trim()
    // N'accepte que des chiffres (et un signe moins optionnel) : une saisie
    // comme "abd7" doit être rejetée, pas silencieusement réduite à "7".
    if (!/^-?\d+$/.test(trimmed)) {
      setCountError('Nombre entier requis.')
      return
    }
    const parsed = parseInt(trimmed, 10)
    setCountError(null)
    setDirection(parsed >= counter.count ? 1 : -1)
    onSetCount(parsed)
    setEditingCount(false)
  }

  // Quand il n'y a qu'1 ou 2 compteurs, on mesure l'espace réellement
  // disponible pour afficher le chiffre le plus grand possible, sans le
  // faire déborder ni en hauteur ni en largeur (nombre de chiffres compris).
  // Réglé spécifiquement pour les proportions de l'odomètre : les autres
  // styles s'appuient plutôt sur les tailles CSS par mode de grille (elles
  // s'expriment en `em`, donc elles suivent quand même l'espace disponible).
  const isDefaultStyle = !counter.displayStyle || counter.displayStyle === 'default'
  useEffect(() => {
    const el = valueRef.current
    if (!fill || !el || !isDefaultStyle) {
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
  }, [fill, counter.count, isDefaultStyle])

  // Petit rebond élastique à chaque incrément/décrément, en plus du
  // défilement des chiffres. N'anime que `scale` (accéléré par le
  // compositeur) : une version précédente animait aussi `filter`
  // (drop-shadow/brightness), qui force un repaint à chaque frame et
  // causait des lags visibles sur les appareils moins puissants, en plus
  // du texte à dégradé déjà coûteux à peindre.
  // Réservé au style par défaut : chaque autre style a sa propre animation
  // de changement (voir CounterValueDisplay), un rebond supplémentaire ici
  // se superposerait à la sienne au lieu de la remplacer. `isDefaultStyle`
  // est volontairement absent des dépendances : un changement de style seul
  // (sans changement de compteur) ne doit pas déclencher de rebond.
  //
  // Le son d'incrémentation, lui, se joue quel que soit le style : cet
  // effet ne se déclenche qu'après que React a posé la nouvelle valeur à
  // l'écran (jamais au clic lui-même), et uniquement en incrémentant.
  useEffect(() => {
    if (isFirstCount.current) {
      isFirstCount.current = false
      return
    }
    if (direction === 1) playIncrementSound()
    if (!isDefaultStyle) return
    pulseControls.start({
      scale: [1, 1.16, 0.97, 1],
      transition: { duration: 0.35, ease: 'easeOut', times: [0, 0.3, 0.7, 1] },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counter.count, pulseControls])

  // Célèbre le franchissement de l'objectif (d'en dessous vers au moins sa
  // valeur), pas juste le fait de s'y trouver : sinon toucher l'objectif au
  // montage (ex: après rechargement de la page) déclencherait la
  // célébration à chaque fois. Un pas d'incrément personnalisé peut sauter
  // par-dessus l'objectif sans tomber pile dessus (ex: pas de 3, objectif à
  // 10 : 9 → 12) : on compare donc à un dépassement, pas à une égalité.
  useEffect(() => {
    const previous = prevCountForTarget.current
    prevCountForTarget.current = counter.count
    if (counter.target === undefined) return
    if (previous < counter.target && counter.count >= counter.target) {
      setCelebrating(true)
      clearTimeout(celebrateTimer.current)
      celebrateTimer.current = setTimeout(() => setCelebrating(false), CELEBRATION_DURATION_MS)
    }
  }, [counter.count, counter.target])

  const odds = counter.oddsDenominator ? cumulativeOdds(counter.oddsDenominator, counter.count) : null
  // Durée figée et moyenne d'incrément par jour entre le début du comptage
  // et l'archivage. `archivedAt` absent (compteur archivé avant l'ajout de
  // ce champ) : pas de stats affichées plutôt que des valeurs devinées.
  const archivedStartIso = counter.startDate ?? toIsoDate(counter.createdAt)
  const archivedEndIso = counter.archivedAt !== undefined ? toIsoDate(counter.archivedAt) : null
  const archivedDuration =
    counter.archived && archivedEndIso !== null ? formatDuration(archivedStartIso, archivedEndIso) : null
  const archivedAveragePerDay =
    counter.archived && archivedEndIso !== null
      ? formatAveragePerDay(counter.count, daysBetween(archivedStartIso, archivedEndIso))
      : null
  // Progression pour le style "anneau" : vers l'objectif libre s'il est
  // défini (le plus explicite), sinon vers le nombre moyen de tentatives —
  // mêmes formules que les barres de progression du panneau de réglages.
  const targetProgress = progressRatio(counter.count, counter.target)
  const oddsProgress = progressRatio(counter.count, counter.oddsDenominator)
  const progress = targetProgress ?? oddsProgress

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
      aria-label={locked ? `${counter.name}, archivé, lecture seule` : `Incrémenter ${counter.name}`}
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

      {counter.pinned && (
        <span className="counter-pin-badge" aria-hidden="true">
          📌
        </span>
      )}

      {celebrating && (
        <div className="counter-celebration" aria-hidden="true">
          {CONFETTI_ANGLES.map((angle, i) => (
            <span
              key={angle}
              className="counter-confetti"
              style={
                {
                  '--angle': `${angle}deg`,
                  '--delay': `${i * 25}ms`,
                  '--color': CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      {celebrating && (
        <span className="sr-only" role="status">
          Objectif atteint
        </span>
      )}

      <div className="counter-options-row">
        {draggable && !locked && (
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
          className="counter-behavior-btn"
          onClick={(e) => {
            e.stopPropagation()
            setOpenPanel('comportement')
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Régler le comportement du compteur"
          title="Pas d'incrément, objectif, probabilité, date de début, partage, duplication"
        >
          ±
        </button>

        <button
          className="counter-settings-btn"
          onClick={(e) => {
            e.stopPropagation()
            setOpenPanel('personnalisation')
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Personnaliser le compteur"
          title="Nom, couleur, style d'affichage, image de fond"
        >
          ⚙
        </button>

        <button
          className="counter-history-btn"
          onClick={(e) => {
            e.stopPropagation()
            setOpenPanel('historique')
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Voir l'historique du compteur"
          title="Historique des valeurs"
        >
          ↗
        </button>

        <button
          className="counter-actions-btn"
          onClick={(e) => {
            e.stopPropagation()
            setOpenPanel('actions')
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Actions du compteur"
          title="Partager, dupliquer, supprimer"
        >
          ⋯
        </button>
      </div>

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
            if (locked) return
            setDraftName(counter.name)
            setEditing(true)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          title={locked ? 'Compteur archivé : lecture seule' : 'Toucher pour renommer'}
        >
          {counter.name}
        </h2>
      )}

      {editingCount ? (
        <>
          <input
            className="counter-value-input"
            autoFocus
            inputMode="numeric"
            pattern="-?[0-9]*"
            aria-invalid={countError !== null}
            value={draftCount}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              setDraftCount(e.target.value)
              setCountError(null)
            }}
            onBlur={commitCount}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitCount()
              if (e.key === 'Escape') {
                setDraftCount(counter.count.toString())
                setCountError(null)
                setEditingCount(false)
              }
            }}
          />
          {countError && (
            <p className="modal-error" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
              {countError}
            </p>
          )}
        </>
      ) : (
        <motion.div
          className={`counter-value${counter.displayStyle ? ` counter-value--${counter.displayStyle}` : ''}`}
          ref={valueRef}
          style={fillFontSize ? { fontSize: `${fillFontSize}px` } : undefined}
          animate={pulseControls}
          aria-hidden="true"
        >
          <CounterValueDisplay
            value={counter.count}
            direction={direction}
            style={counter.displayStyle}
            progress={progress}
          />
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
        </div>
      )}

      {archivedDuration !== null && (
        <div className="counter-odds-stats">
          <p className="counter-odds-hint">Durée totale : {archivedDuration}</p>
          <p className="counter-odds-hint">Moyenne : {archivedAveragePerDay}</p>
        </div>
      )}

      <div className="counter-actions">
        <button
          className="counter-btn edit"
          disabled={locked}
          onClick={(e) => {
            e.stopPropagation()
            setDraftCount(counter.count.toString())
            setCountError(null)
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
          disabled={locked}
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
          −{counter.step ?? 1}
        </button>
        <button
          className="counter-btn plus"
          disabled={locked}
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
          +{counter.step ?? 1}
        </button>
      </div>

      {openPanel === 'personnalisation' && (
        <CounterSettingsPanel
          counter={counter}
          colors={colors}
          onClose={() => setOpenPanel(null)}
          onRename={onRename}
          onSetBackgroundImage={onSetBackgroundImage}
          onSetColor={onSetColor}
          onSetDisplayStyle={onSetDisplayStyle}
          onNavigate={setOpenPanel}
        />
      )}

      {openPanel === 'comportement' && (
        <CounterBehaviorSettingsPanel
          counter={counter}
          onClose={() => setOpenPanel(null)}
          onSetOdds={onSetOdds}
          onSetTarget={onSetTarget}
          onSetStartDate={onSetStartDate}
          onSetStep={onSetStep}
          onNavigate={setOpenPanel}
        />
      )}

      {openPanel === 'historique' && (
        <CounterHistoryPanel counter={counter} onClose={() => setOpenPanel(null)} onNavigate={setOpenPanel} />
      )}

      {openPanel === 'actions' && (
        <CounterActionsPanel
          counter={counter}
          onClose={() => setOpenPanel(null)}
          onDuplicate={onDuplicate}
          onToggleArchive={onToggleArchive}
          onTogglePin={onTogglePin}
          onDelete={onDelete}
          onNavigate={setOpenPanel}
        />
      )}
    </Reorder.Item>
  )
}
