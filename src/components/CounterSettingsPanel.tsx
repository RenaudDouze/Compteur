import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cumulativeOdds, formatOdds, formatRemainingAttempts, formatConstantChanceReminder } from '../odds'
import { formatStartDate, toIsoDate, todayIsoDate } from '../date'
import { buildShareText } from '../share'
import { isValidImageUrl } from '../url'
import { Sparkline } from './Sparkline'
import { CounterValueDisplay } from './CounterValueDisplay'
import { DISPLAY_STYLES } from '../displayStyles'
import type { Counter, DisplayStyle } from '../types'

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
  const [draftOdds, setDraftOdds] = useState(counter.oddsDenominator?.toString() ?? '')
  const [draftTarget, setDraftTarget] = useState(counter.target?.toString() ?? '')
  const [draftBackground, setDraftBackground] = useState(counter.backgroundImageUrl ?? '')
  const [draftStep, setDraftStep] = useState(counter.step?.toString() ?? '')
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
    const parsed = parseInt(draftOdds.replace(/[^\d]/g, ''), 10)
    onSetOdds(Number.isFinite(parsed) && parsed > 0 ? parsed : undefined)
  }

  const commitTarget = () => {
    const parsed = parseInt(draftTarget.replace(/[^\d]/g, ''), 10)
    onSetTarget(Number.isFinite(parsed) && parsed > 0 ? parsed : undefined)
  }

  const commitStep = () => {
    const parsed = parseInt(draftStep.replace(/[^\d]/g, ''), 10)
    onSetStep(Number.isFinite(parsed) && parsed > 0 ? parsed : undefined)
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
  const startDate = counter.startDate ?? toIsoDate(counter.createdAt)
  const activeStyle: DisplayStyle = counter.displayStyle ?? 'default'
  const target = counter.target
  const targetProgress = target ? Math.max(0, Math.min(counter.count / target, 1)) : null

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
            value={draftStep}
            placeholder="1"
            onChange={(e) => setDraftStep(e.target.value)}
            onBlur={commitStep}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitStep()
            }}
          />
          <p className="modal-hint">
            +{counter.step ?? 1} / −{counter.step ?? 1} à chaque appui
          </p>
        </section>

        <section className="modal-section">
          <h3>Image de fond</h3>
          <input
            type="url"
            inputMode="url"
            className="modal-input"
            value={draftBackground}
            placeholder="https://exemple.com/image.jpg"
            onChange={(e) => setDraftBackground(e.target.value)}
            onBlur={commitBackground}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitBackground()
            }}
          />
        </section>

        <section className="modal-section">
          <h3>Objectif</h3>
          <input
            className="modal-input modal-input--odds"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draftTarget}
            placeholder="ex : 50"
            onChange={(e) => setDraftTarget(e.target.value)}
            onBlur={commitTarget}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTarget()
            }}
          />
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
              value={draftOdds}
              placeholder="4096"
              onChange={(e) => setDraftOdds(e.target.value)}
              onBlur={commitOdds}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitOdds()
              }}
            />
          </div>
          {denominator !== undefined && (
            <>
              <p className="modal-hint">{formatOdds(odds!)} de chances de l'avoir obtenu avant ce stade</p>
              <div
                className="odds-progress"
                role="progressbar"
                aria-valuenow={Math.round(Math.min(counter.count / denominator, 1) * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progression vers le nombre moyen de tentatives"
              >
                <div
                  className="odds-progress-fill"
                  style={{ width: `${Math.min(counter.count / denominator, 1) * 100}%` }}
                />
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
            defaultValue={startDate}
            max={todayIsoDate()}
            onChange={(e) => onSetStartDate(e.target.value || undefined)}
          />
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
