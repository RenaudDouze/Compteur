import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cumulativeOdds, formatOdds, formatRemainingAttempts, formatConstantChanceReminder, progressRatio } from '../odds'
import { formatStartDate, toIsoDate, todayIsoDate } from '../date'
import { buildShareText } from '../share'
import { isValidImageUrl } from '../url'
import { Sparkline } from './Sparkline'
import { CounterValueDisplay } from './CounterValueDisplay'
import { DISPLAY_STYLES } from '../displayStyles'
import type { Counter, DisplayStyle } from '../types'

const POSITIVE_INT_ERROR = 'Nombre entier positif requis.'

// N'accepte que des chiffres (contrairement à un simple filtrage des
// caractères non numériques) : une saisie comme "abd7" doit être rejetée,
// pas silencieusement réduite à "7".
function parsePositiveInt(trimmed: string): number | undefined {
  if (!/^\d+$/.test(trimmed)) return undefined
  const value = parseInt(trimmed, 10)
  return value > 0 ? value : undefined
}

interface CounterSettingsPanelProps {
  counter: Counter
  colors: string[]
  onClose: () => void
  onSetOdds: (denominator: number | undefined) => void
  onSetTarget: (target: number | undefined) => void
  onSetStartDate: (isoDate: string | undefined) => void
  onSetBackgroundImage: (url: string | undefined) => void
  onSetColor: (color: string) => void
  onSetStep: (step: number | undefined) => void
  onSetDisplayStyle: (style: DisplayStyle | undefined) => void
  onDuplicate: () => void
}

export function CounterSettingsPanel({
  counter,
  colors,
  onClose,
  onSetOdds,
  onSetTarget,
  onSetStartDate,
  onSetBackgroundImage,
  onSetColor,
  onSetStep,
  onSetDisplayStyle,
  onDuplicate,
}: CounterSettingsPanelProps) {
  const startDate = counter.startDate ?? toIsoDate(counter.createdAt)

  const [draftOdds, setDraftOdds] = useState(counter.oddsDenominator?.toString() ?? '')
  const [oddsError, setOddsError] = useState<string | null>(null)
  const [draftTarget, setDraftTarget] = useState(counter.target?.toString() ?? '')
  const [targetError, setTargetError] = useState<string | null>(null)
  const [draftBackground, setDraftBackground] = useState(counter.backgroundImageUrl ?? '')
  const [backgroundError, setBackgroundError] = useState<string | null>(null)
  const [draftStep, setDraftStep] = useState(counter.step?.toString() ?? '')
  const [stepError, setStepError] = useState<string | null>(null)
  const [draftStartDate, setDraftStartDate] = useState(startDate)
  const [startDateError, setStartDateError] = useState<string | null>(null)
  const [shared, setShared] = useState(false)
  const shareTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const commitOdds = () => {
    const trimmed = draftOdds.trim()
    if (trimmed === '') {
      setOddsError(null)
      onSetOdds(undefined)
      return
    }
    const parsed = parsePositiveInt(trimmed)
    if (parsed !== undefined) {
      setOddsError(null)
      onSetOdds(parsed)
    } else {
      // Laisse la saisie invalide affichée (plutôt que de revenir à la
      // valeur précédente) : sinon un blur qui reperd le focus sur ce champ
      // (ex: en cliquant ailleurs) recommetterait un brouillon déjà vidé, et
      // ferait silencieusement disparaître le message d'erreur.
      setOddsError(POSITIVE_INT_ERROR)
    }
  }

  const commitTarget = () => {
    const trimmed = draftTarget.trim()
    if (trimmed === '') {
      setTargetError(null)
      onSetTarget(undefined)
      return
    }
    const parsed = parsePositiveInt(trimmed)
    if (parsed !== undefined) {
      setTargetError(null)
      onSetTarget(parsed)
    } else {
      setTargetError(POSITIVE_INT_ERROR)
    }
  }

  const commitStep = () => {
    const trimmed = draftStep.trim()
    if (trimmed === '') {
      setStepError(null)
      onSetStep(undefined)
      return
    }
    const parsed = parsePositiveInt(trimmed)
    if (parsed !== undefined) {
      setStepError(null)
      onSetStep(parsed)
    } else {
      setStepError(POSITIVE_INT_ERROR)
    }
  }

  const commitBackground = () => {
    const trimmed = draftBackground.trim()
    if (!trimmed) {
      setBackgroundError(null)
      onSetBackgroundImage(undefined)
    } else if (isValidImageUrl(trimmed)) {
      setBackgroundError(null)
      onSetBackgroundImage(trimmed)
    } else {
      setBackgroundError('URL http(s) invalide.')
    }
  }

  const clearBackground = () => {
    setDraftBackground('')
    setBackgroundError(null)
    onSetBackgroundImage(undefined)
  }

  const handleStartDateChange = (value: string) => {
    setDraftStartDate(value)
    if (value === '') {
      setStartDateError(null)
      onSetStartDate(undefined)
    } else if (value > todayIsoDate()) {
      // Bloqué en pratique par `max` sur le sélecteur natif, mais gardé en
      // filet de sécurité (saisie clavier manuelle selon le navigateur).
      setStartDateError('La date ne peut pas être dans le futur.')
    } else {
      setStartDateError(null)
      onSetStartDate(value)
    }
  }

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

  const denominator = counter.oddsDenominator
  const odds = denominator ? cumulativeOdds(denominator, counter.count) : null
  const activeStyle: DisplayStyle = counter.displayStyle ?? 'default'
  const target = counter.target
  const targetProgress = progressRatio(counter.count, target)
  const oddsProgress = progressRatio(counter.count, denominator)

  const handleDuplicate = () => {
    onDuplicate()
    onClose()
  }

  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Le panneau est monté dans un portail (document.body), donc en
          dehors de la carte dans le DOM réel : mais React fait toujours
          remonter les évènements le long de l'arbre React (pas du DOM), donc
          sans ce blocage, un pointerdown/up sur un bouton du panneau (ex:
          "Fermer") atteindrait quand même le suivi de tap de la carte et
          l'incrémenterait à tort. */}
      <div
        className="modal-panel"
        // Le panneau est un portail hors de la carte : il n'hérite pas de la
        // variable --accent posée sur `.counter-card`. Les aperçus de style
        // (anneau, pastille) et le pourcentage en dépendent pour refléter la
        // couleur réelle de ce compteur.
        style={{ '--accent': counter.color } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="modal-panel-header">
          <h2>Personnaliser « {counter.name} »</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <section className="modal-section">
          <h3>Couleur</h3>
          <div className="settings-color-grid">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                className={`counter-color-option${c === counter.color ? ' selected' : ''}`}
                style={{ background: c }}
                aria-label={`Choisir la couleur ${c}`}
                onClick={() => onSetColor(c)}
              />
            ))}
          </div>
        </section>

        <section className="modal-section">
          <h3>Style d'affichage</h3>
          <div className="display-style-grid">
            {DISPLAY_STYLES.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`display-style-option${opt.id === activeStyle ? ' selected' : ''}`}
                aria-label={`Choisir le style ${opt.label}`}
                onClick={() => onSetDisplayStyle(opt.id === 'default' ? undefined : opt.id)}
              >
                <span className="display-style-preview">
                  <CounterValueDisplay value={8} direction={1} style={opt.id} progress={opt.id === 'ring' ? 0.6 : null} />
                </span>
                <span className="display-style-name">{opt.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="modal-section">
          <h3>Pas d'incrément</h3>
          <input
            className="modal-input modal-input--odds"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-invalid={stepError !== null}
            value={draftStep}
            placeholder="1"
            onChange={(e) => {
              setDraftStep(e.target.value)
              setStepError(null)
            }}
            onBlur={commitStep}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitStep()
            }}
          />
          {stepError && <p className="modal-error">{stepError}</p>}
          <p className="modal-hint">
            +{counter.step ?? 1} / −{counter.step ?? 1} à chaque appui
          </p>
        </section>

        <section className="modal-section">
          <h3>Image de fond</h3>
          <div className="modal-row">
            <input
              type="url"
              inputMode="url"
              className="modal-input"
              aria-invalid={backgroundError !== null}
              value={draftBackground}
              placeholder="https://exemple.com/image.jpg"
              onChange={(e) => {
                setDraftBackground(e.target.value)
                setBackgroundError(null)
              }}
              onBlur={commitBackground}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitBackground()
              }}
            />
            {draftBackground !== '' && (
              <button className="modal-close" onClick={clearBackground} aria-label="Vider l'image de fond">
                ✕
              </button>
            )}
          </div>
          {backgroundError && <p className="modal-error">{backgroundError}</p>}
        </section>

        <section className="modal-section">
          <h3>Objectif</h3>
          <input
            className="modal-input modal-input--odds"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-invalid={targetError !== null}
            value={draftTarget}
            placeholder="ex : 50"
            onChange={(e) => {
              setDraftTarget(e.target.value)
              setTargetError(null)
            }}
            onBlur={commitTarget}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTarget()
            }}
          />
          {targetError && <p className="modal-error">{targetError}</p>}
          {target !== undefined && (
            <>
              <div
                className="odds-progress"
                role="progressbar"
                aria-valuenow={Math.round(targetProgress! * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progression vers l'objectif"
              >
                <div className="odds-progress-fill" style={{ width: `${targetProgress! * 100}%` }} />
              </div>
              <p className="modal-hint">
                {counter.count.toLocaleString('fr-FR')} / {target.toLocaleString('fr-FR')} (
                {Math.round(targetProgress! * 100)} %)
              </p>
            </>
          )}
        </section>

        <section className="modal-section">
          <h3>Probabilité</h3>
          <div className="modal-row">
            <span>1 chance sur</span>
            <input
              className="modal-input modal-input--odds"
              inputMode="numeric"
              pattern="[0-9]*"
              aria-invalid={oddsError !== null}
              value={draftOdds}
              placeholder="4096"
              onChange={(e) => {
                setDraftOdds(e.target.value)
                setOddsError(null)
              }}
              onBlur={commitOdds}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitOdds()
              }}
            />
          </div>
          {oddsError && <p className="modal-error">{oddsError}</p>}
          {denominator !== undefined && (
            <>
              <p className="modal-hint">{formatOdds(odds!)} de chances de l'avoir obtenu avant ce stade</p>
              <div
                className="odds-progress"
                role="progressbar"
                aria-valuenow={Math.round(oddsProgress! * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progression vers le nombre moyen de tentatives"
              >
                <div className="odds-progress-fill" style={{ width: `${oddsProgress! * 100}%` }} />
              </div>
              <p className="modal-hint">{formatRemainingAttempts(denominator, counter.count)}</p>
              <p className="modal-hint modal-hint--reminder">💡 {formatConstantChanceReminder(denominator)}</p>
            </>
          )}
        </section>

        <section className="modal-section">
          <h3>Date de début</h3>
          <input
            type="date"
            className="modal-input"
            aria-invalid={startDateError !== null}
            value={draftStartDate}
            max={todayIsoDate()}
            onChange={(e) => handleStartDateChange(e.target.value)}
          />
          {startDateError && <p className="modal-error">{startDateError}</p>}
          <p className="modal-hint">{formatStartDate(startDate)}</p>
        </section>

        <section className="modal-section">
          <h3>Historique</h3>
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

        <section className="modal-section">
          <button className="modal-btn" onClick={handleShare}>
            {shared ? 'Copié ✓' : '⇪ Partager ce compteur'}
          </button>
          <button className="modal-btn" onClick={handleDuplicate}>
            ⧉ Dupliquer ce compteur
          </button>
        </section>
      </div>
    </div>,
    document.body
  )
}
