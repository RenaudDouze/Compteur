import { useState } from 'react'
import { isValidImageUrl } from '../url'
import { CounterValueDisplay } from './CounterValueDisplay'
import { DISPLAY_STYLES } from '../displayStyles'
import { Modal } from './Modal'
import { PanelNav } from './PanelNav'
import type { PanelKind } from './PanelNav'
import type { Counter, DisplayStyle } from '../types'

interface CounterSettingsPanelProps {
  counter: Counter
  colors: string[]
  onClose: () => void
  onUpdate: (patch: Partial<Counter>) => void
  onNavigate: (panel: PanelKind) => void
}

export function CounterSettingsPanel({ counter, colors, onClose, onUpdate, onNavigate }: CounterSettingsPanelProps) {
  const [draftName, setDraftName] = useState(counter.name)
  const [draftBackground, setDraftBackground] = useState(counter.backgroundImageUrl ?? '')
  const [backgroundError, setBackgroundError] = useState<string | null>(null)

  const commitName = () => {
    const trimmed = draftName.trim() || 'Sans nom'
    setDraftName(trimmed)
    onUpdate({ name: trimmed })
  }

  const commitBackground = () => {
    const trimmed = draftBackground.trim()
    if (!trimmed) {
      setBackgroundError(null)
      onUpdate({ backgroundImageUrl: undefined })
    } else if (isValidImageUrl(trimmed)) {
      setBackgroundError(null)
      onUpdate({ backgroundImageUrl: trimmed })
    } else {
      setBackgroundError('URL http(s) invalide.')
    }
  }

  const clearBackground = () => {
    setDraftBackground('')
    setBackgroundError(null)
    onUpdate({ backgroundImageUrl: undefined })
  }

  const activeStyle: DisplayStyle = counter.displayStyle ?? 'default'
  const locked = !!counter.archived

  return (
    <Modal title={`Personnaliser « ${counter.name} »`} onClose={onClose} accentColor={counter.color}>
      {locked && (
        <p className="modal-hint modal-hint--locked">
          🔒 Compteur archivé : lecture seule. Désarchive-le pour le modifier.
        </p>
      )}

      <section className="modal-section">
        <h3>Nom</h3>
        <input
          type="text"
          className="modal-input"
          disabled={locked}
          value={draftName}
          maxLength={40}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName()
          }}
        />
      </section>

      <section className="modal-section">
        <h3>Couleur</h3>
        <div className="settings-color-grid">
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              disabled={locked}
              className={`counter-color-option${c === counter.color ? ' selected' : ''}`}
              style={{ background: c }}
              aria-label={`Choisir la couleur ${c}`}
              onClick={() => onUpdate({ color: c })}
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
              disabled={locked}
              className={`display-style-option${opt.id === activeStyle ? ' selected' : ''}`}
              aria-label={`Choisir le style ${opt.label}`}
              onClick={() => onUpdate({ displayStyle: opt.id === 'default' ? undefined : opt.id })}
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
        <h3>Image de fond</h3>
        <div className="modal-row">
          <input
            type="url"
            inputMode="url"
            className="modal-input"
            disabled={locked}
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
            <button
              className="modal-close"
              disabled={locked}
              onClick={clearBackground}
              aria-label="Vider l'image de fond"
            >
              ✕
            </button>
          )}
        </div>
        {backgroundError && <p className="modal-error">{backgroundError}</p>}
      </section>

      <PanelNav current="personnalisation" onNavigate={onNavigate} />
    </Modal>
  )
}
