import { useEffect, useRef, useState } from 'react'
import { motion, Reorder, useAnimationControls, useDragControls } from 'framer-motion'
import { CounterValueDisplay } from './CounterValueDisplay'
import { CounterSettingsPanel } from './CounterSettingsPanel'
import { CounterBehaviorSettingsPanel } from './CounterBehaviorSettingsPanel'
import { CounterHistoryPanel } from './CounterHistoryPanel'
import { CounterActionsPanel } from './CounterActionsPanel'
import type { PanelKind } from './PanelNav'
import { useHoldToRepeat } from '../hooks/useHoldToRepeat'
import { useTapGesture } from '../hooks/useTapGesture'
import { useFillFontSize } from '../hooks/useFillFontSize'
import { useCelebration } from '../hooks/useCelebration'
import { cumulativeOdds, formatOdds, progressRatio } from '../odds'
import { daysBetween, formatAveragePerDay, formatDuration, toIsoDate } from '../date'
import { playIncrementSound } from '../sound'
import type { Counter } from '../types'

// Angles (en degrés) des particules du confetti, réparties en éventail sur
// un demi-cercle plutôt qu'un cercle complet : le bas de la carte contient
// souvent les boutons +/-, un confetti y retomberait dessus sans y être vu.
const CONFETTI_ANGLES = [-90, -65, -40, -15, 15, 40, 65, 90, -110, 110]
const CONFETTI_COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899']

// Icônes d'accès direct aux 4 modales, dans leur ordre d'affichage.
const PANEL_BUTTONS: { panel: PanelKind; className: string; label: string; title: string; icon: string }[] = [
  {
    panel: 'comportement',
    className: 'counter-behavior-btn',
    label: 'Régler le comportement du compteur',
    title: "Pas d'incrément, objectif, probabilité, date de début, partage, duplication",
    icon: '±',
  },
  {
    panel: 'personnalisation',
    className: 'counter-settings-btn',
    label: 'Personnaliser le compteur',
    title: "Nom, couleur, style d'affichage, image de fond",
    icon: '⚙',
  },
  {
    panel: 'historique',
    className: 'counter-history-btn',
    label: "Voir l'historique du compteur",
    title: 'Historique des valeurs',
    icon: '↗',
  },
  {
    panel: 'actions',
    className: 'counter-actions-btn',
    label: 'Actions du compteur',
    title: 'Partager, dupliquer, supprimer',
    icon: '⋯',
  },
]

interface CounterCardProps {
  counter: Counter
  fill?: boolean
  // Ouvre directement le champ de nom en édition : pour le compteur qui
  // vient d'être créé, dont le nom par défaut ("Compteur N") n'est sinon pas
  // évident à renommer sans découvrir qu'on peut toucher le titre.
  autoEdit?: boolean
  colors: string[]
  onChange: (delta: number) => void
  onSetCount: (count: number) => void
  // Point d'entrée commun à tous les réglages simples qui ne font que
  // remplacer un ou plusieurs champs (nom, couleur, pas, objectif...),
  // relayé tel quel aux panneaux de réglages qui en ont besoin.
  onUpdate: (patch: Partial<Counter>) => void
  onDuplicate: () => void
  onToggleArchive: () => void
  onTogglePin: () => void
  onDelete: () => void
}

export function CounterCard({
  counter,
  fill = false,
  autoEdit = false,
  colors,
  onChange,
  onSetCount,
  onUpdate,
  onDuplicate,
  onToggleArchive,
  onTogglePin,
  onDelete,
}: CounterCardProps) {
  const [editing, setEditing] = useState(autoEdit)
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
  const pulseControls = useAnimationControls()
  const isFirstCount = useRef(true)
  const dragControls = useDragControls()

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
    onChange(sign * (counter.behavior.step ?? 1))
  }

  const { startHold, stopHold, longPressFired } = useHoldToRepeat(bump)
  const {
    onPointerDown: handleCardPointerDown,
    onPointerUp: handleCardPointerUp,
    onPointerCancel: handleCardPointerCancel,
    onClick: handleCardClick,
  } = useTapGesture(bump)

  const commitName = () => {
    const trimmed = draftName.trim()
    onUpdate({ name: trimmed || 'Sans nom' })
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
  const isDefaultStyle = !counter.appearance.displayStyle || counter.appearance.displayStyle === 'default'
  const { ref: valueRef, fontSize: fillFontSize } = useFillFontSize(fill && isDefaultStyle, counter.count)

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

  const celebrating = useCelebration(counter.count, counter.behavior.target)

  const odds = counter.behavior.oddsDenominator ? cumulativeOdds(counter.behavior.oddsDenominator, counter.count) : null
  // Durée figée et moyenne d'incrément par jour entre le début du comptage
  // et l'archivage. `archivedAt` absent (compteur archivé avant l'ajout de
  // ce champ) : pas de stats affichées plutôt que des valeurs devinées.
  const archivedStartIso = counter.behavior.startDate ?? toIsoDate(counter.createdAt)
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
  const targetProgress = progressRatio(counter.count, counter.behavior.target)
  const oddsProgress = progressRatio(counter.count, counter.behavior.oddsDenominator)
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
      style={{ '--accent': counter.appearance.color } as React.CSSProperties}
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
      {counter.appearance.backgroundImageUrl && (
        <div
          className="counter-bg"
          style={{ backgroundImage: `url("${counter.appearance.backgroundImageUrl}")` }}
          aria-hidden="true"
        />
      )}

      {counter.pinned && (
        <span className="counter-pin-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <circle cx="12" cy="7" r="5" />
            <path d="M10.5 11.5h3L13 22h-2z" />
          </svg>
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
        {!locked && (
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

        {PANEL_BUTTONS.map(({ panel, className, label, title, icon }) => (
          <button
            key={panel}
            className={className}
            onClick={(e) => {
              e.stopPropagation()
              setOpenPanel(panel)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={label}
            title={title}
          >
            {icon}
          </button>
        ))}
      </div>

      {editing ? (
        <input
          className="counter-name-input"
          autoFocus
          value={draftName}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onFocus={(e) => e.currentTarget.select()}
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
          className={`counter-value${counter.appearance.displayStyle ? ` counter-value--${counter.appearance.displayStyle}` : ''}`}
          ref={valueRef}
          style={fillFontSize ? { fontSize: `${fillFontSize}px` } : undefined}
          animate={pulseControls}
          aria-hidden="true"
        >
          <CounterValueDisplay
            value={counter.count}
            direction={direction}
            style={counter.appearance.displayStyle}
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
          −{counter.behavior.step ?? 1}
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
          +{counter.behavior.step ?? 1}
        </button>
      </div>

      {openPanel === 'personnalisation' && (
        <CounterSettingsPanel
          counter={counter}
          colors={colors}
          onClose={() => setOpenPanel(null)}
          onUpdate={onUpdate}
          onNavigate={setOpenPanel}
        />
      )}

      {openPanel === 'comportement' && (
        <CounterBehaviorSettingsPanel
          counter={counter}
          onClose={() => setOpenPanel(null)}
          onUpdate={onUpdate}
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
