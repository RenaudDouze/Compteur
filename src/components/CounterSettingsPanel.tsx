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
  onSetBackgroundImage: (url: string | undefined) => void
  onSetColor: (color: string) => void
  onSetDisplayStyle: (style: DisplayStyle | undefined) => void
  onNavigate: (panel: PanelKind) => void
}

export function CounterSettingsPanel({
  counter,
  colors,
  onClose,
  onSetBackgroundImage,
  onSetColor,
  onSetDisplayStyle,
  onNavigate,
}: CounterSettingsPanelProps) {
  const [draftBackground, setDraftBackground] = useState(counter.backgroundImageUrl ?? '')
  const [backgroundError, setBackgroundError] = useState<string | null>(null)

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
              disabled={locked}
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
