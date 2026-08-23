import { useState } from 'react'
import { isValidImageUrl } from '../url'
import { CounterValueDisplay } from './CounterValueDisplay'
import { DISPLAY_STYLES } from '../displayStyles'
import { Modal } from './Modal'
import type { Counter, DisplayStyle } from '../types'

interface CounterSettingsPanelProps {
  counter: Counter
  colors: string[]
  onClose: () => void
  onSetBackgroundImage: (url: string | undefined) => void
  onSetColor: (color: string) => void
  onSetDisplayStyle: (style: DisplayStyle | undefined) => void
  // Bascule vers les deux autres modales, chacune dans son propre panneau :
  // le comportement du compteur (pas d'incrément, objectif, probabilité,
  // date de début, partage, duplication) et son historique.
  onOpenBehavior: () => void
  onOpenHistory: () => void
}

export function CounterSettingsPanel({
  counter,
  colors,
  onClose,
  onSetBackgroundImage,
  onSetColor,
  onSetDisplayStyle,
  onOpenBehavior,
  onOpenHistory,
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

  return (
    <Modal title={`Personnaliser « ${counter.name} »`} onClose={onClose} accentColor={counter.color}>
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
        <button className="modal-btn" onClick={onOpenBehavior}>
          → Comportement
        </button>
        <button className="modal-btn" onClick={onOpenHistory}>
          → Historique
        </button>
      </section>
    </Modal>
  )
}
