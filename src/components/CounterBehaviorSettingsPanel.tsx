import { useState } from 'react'
import { cumulativeOdds, formatOdds, formatRemainingAttempts, formatConstantChanceReminder, progressRatio } from '../odds'
import { formatStartDate, toIsoDate, todayIsoDate } from '../date'
import { Modal } from './Modal'
import { PanelNav } from './PanelNav'
import type { PanelKind } from './PanelNav'
import type { Counter } from '../types'

const POSITIVE_INT_ERROR = 'Nombre entier positif requis.'

// N'accepte que des chiffres (contrairement à un simple filtrage des
// caractères non numériques) : une saisie comme "abd7" doit être rejetée,
// pas silencieusement réduite à "7".
function parsePositiveInt(trimmed: string): number | undefined {
  if (!/^\d+$/.test(trimmed)) return undefined
  const value = parseInt(trimmed, 10)
  return value > 0 ? value : undefined
}

interface CounterBehaviorSettingsPanelProps {
  counter: Counter
  onClose: () => void
  onSetOdds: (denominator: number | undefined) => void
  onSetTarget: (target: number | undefined) => void
  onSetStartDate: (isoDate: string | undefined) => void
  onSetStep: (step: number | undefined) => void
  onNavigate: (panel: PanelKind) => void
}

export function CounterBehaviorSettingsPanel({
  counter,
  onClose,
  onSetOdds,
  onSetTarget,
  onSetStartDate,
  onSetStep,
  onNavigate,
}: CounterBehaviorSettingsPanelProps) {
  const startDate = counter.startDate ?? toIsoDate(counter.createdAt)

  const [draftOdds, setDraftOdds] = useState(counter.oddsDenominator?.toString() ?? '')
  const [oddsError, setOddsError] = useState<string | null>(null)
  const [draftTarget, setDraftTarget] = useState(counter.target?.toString() ?? '')
  const [targetError, setTargetError] = useState<string | null>(null)
  const [draftStep, setDraftStep] = useState(counter.step?.toString() ?? '')
  const [stepError, setStepError] = useState<string | null>(null)
  const [draftStartDate, setDraftStartDate] = useState(startDate)
  const [startDateError, setStartDateError] = useState<string | null>(null)

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

  const denominator = counter.oddsDenominator
  const odds = denominator ? cumulativeOdds(denominator, counter.count) : null
  const target = counter.target
  const targetProgress = progressRatio(counter.count, target)
  const oddsProgress = progressRatio(counter.count, denominator)
  const locked = !!counter.archived

  return (
    <Modal title={`Comportement « ${counter.name} »`} onClose={onClose} accentColor={counter.color}>
      {locked && (
        <p className="modal-hint modal-hint--locked">
          🔒 Compteur archivé : lecture seule. Désarchive-le pour le modifier.
        </p>
      )}

      <section className="modal-section">
        <h3>Pas d'incrément</h3>
        <input
          className="modal-input modal-input--odds"
          inputMode="numeric"
          pattern="[0-9]*"
          disabled={locked}
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
        <h3>Objectif</h3>
        <input
          className="modal-input modal-input--odds"
          inputMode="numeric"
          pattern="[0-9]*"
          disabled={locked}
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
            disabled={locked}
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
            <p className="modal-hint">
              {formatOdds(1 - odds!)} de chances de ne toujours pas l'avoir obtenu (autant d'échecs d'affilée)
            </p>
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
          disabled={locked}
          aria-invalid={startDateError !== null}
          value={draftStartDate}
          max={todayIsoDate()}
          onChange={(e) => handleStartDateChange(e.target.value)}
        />
        {startDateError && <p className="modal-error">{startDateError}</p>}
        <p className="modal-hint">{formatStartDate(startDate)}</p>
      </section>

      <PanelNav current="comportement" onNavigate={onNavigate} />
    </Modal>
  )
}
