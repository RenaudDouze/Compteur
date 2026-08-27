import { useState } from 'react'
import { cumulativeOdds, formatOdds, formatRemainingAttempts, formatConstantChanceReminder, progressRatio } from '../odds'
import { daysBetween, formatAveragePerDay, formatDuration, formatStartDate, toIsoDate, todayIsoDate } from '../date'
import { usePositiveIntField } from '../hooks/usePositiveIntField'
import { Modal } from './Modal'
import { PanelNav } from './PanelNav'
import type { PanelKind } from './PanelNav'
import type { Counter } from '../types'

interface CounterBehaviorSettingsPanelProps {
  counter: Counter
  onClose: () => void
  onUpdate: (patch: Partial<Counter>) => void
  onNavigate: (panel: PanelKind) => void
}

export function CounterBehaviorSettingsPanel({
  counter,
  onClose,
  onUpdate,
  onNavigate,
}: CounterBehaviorSettingsPanelProps) {
  const startDate = counter.behavior.startDate ?? toIsoDate(counter.createdAt)

  const stepField = usePositiveIntField(counter.behavior.step, (step) =>
    onUpdate({ behavior: { ...counter.behavior, step } })
  )
  const targetField = usePositiveIntField(counter.behavior.target, (target) =>
    onUpdate({ behavior: { ...counter.behavior, target } })
  )
  const oddsField = usePositiveIntField(counter.behavior.oddsDenominator, (oddsDenominator) =>
    onUpdate({ behavior: { ...counter.behavior, oddsDenominator } })
  )
  const [draftStartDate, setDraftStartDate] = useState(startDate)
  const [startDateError, setStartDateError] = useState<string | null>(null)

  const handleStartDateChange = (value: string) => {
    setDraftStartDate(value)
    if (value === '') {
      setStartDateError(null)
      onUpdate({ behavior: { ...counter.behavior, startDate: undefined } })
    } else if (value > todayIsoDate()) {
      // Bloqué en pratique par `max` sur le sélecteur natif, mais gardé en
      // filet de sécurité (saisie clavier manuelle selon le navigateur).
      setStartDateError('La date ne peut pas être dans le futur.')
    } else {
      setStartDateError(null)
      onUpdate({ behavior: { ...counter.behavior, startDate: value } })
    }
  }

  const denominator = counter.behavior.oddsDenominator
  const odds = denominator ? cumulativeOdds(denominator, counter.count) : null
  const target = counter.behavior.target
  const targetProgress = progressRatio(counter.count, target)
  const oddsProgress = progressRatio(counter.count, denominator)
  const locked = !!counter.archived

  return (
    <Modal title={`Comportement « ${counter.name} »`} onClose={onClose} accentColor={counter.appearance.color}>
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
          aria-invalid={stepField.error !== null}
          value={stepField.value}
          placeholder="1"
          onChange={stepField.onChange}
          onBlur={stepField.onBlur}
          onKeyDown={stepField.onKeyDown}
        />
        {stepField.error && <p className="modal-error">{stepField.error}</p>}
        <p className="modal-hint">
          +{counter.behavior.step ?? 1} / −{counter.behavior.step ?? 1} à chaque appui
        </p>
      </section>

      <section className="modal-section">
        <h3>Objectif</h3>
        <input
          className="modal-input modal-input--odds"
          inputMode="numeric"
          pattern="[0-9]*"
          disabled={locked}
          aria-invalid={targetField.error !== null}
          value={targetField.value}
          placeholder="ex : 50"
          onChange={targetField.onChange}
          onBlur={targetField.onBlur}
          onKeyDown={targetField.onKeyDown}
        />
        {targetField.error && <p className="modal-error">{targetField.error}</p>}
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
            aria-invalid={oddsField.error !== null}
            value={oddsField.value}
            placeholder="4096"
            onChange={oddsField.onChange}
            onBlur={oddsField.onBlur}
            onKeyDown={oddsField.onKeyDown}
          />
        </div>
        {oddsField.error && <p className="modal-error">{oddsField.error}</p>}
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
        {locked && counter.archivedAt !== undefined ? (
          <>
            <p className="modal-hint">{formatDuration(startDate, toIsoDate(counter.archivedAt))}</p>
            <p className="modal-hint">
              Moyenne : {formatAveragePerDay(counter.count, daysBetween(startDate, toIsoDate(counter.archivedAt)))}
            </p>
          </>
        ) : (
          <p className="modal-hint">{formatStartDate(startDate)}</p>
        )}
      </section>

      <PanelNav current="comportement" onNavigate={onNavigate} />
    </Modal>
  )
}
