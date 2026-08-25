import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { buildShareUrl, downloadBackup, parseBackupJson } from '../sync'
import type { Counter } from '../types'

interface SyncPanelProps {
  counters: Counter[]
  onClose: () => void
  onImport: (counters: Counter[], mode: 'replace' | 'merge') => void
}

export function SyncPanel({ counters, onClose, onImport }: SyncPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // oxlint-disable react/set-state-in-effect -- synchronise avec la
  // génération asynchrone du QR code (dépend de `counters`, ne peut pas être
  // dérivé pendant le rendu).
  useEffect(() => {
    if (counters.length === 0) {
      setQrDataUrl(null)
      return
    }
    const url = buildShareUrl(counters)
    setShareUrl(url)
    QRCode.toDataURL(url, { width: 240, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [counters])
  // oxlint-enable react/set-state-in-effect

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const handleFileChosen = async (file: File) => {
    setError(null)
    const text = await file.text()
    const imported = parseBackupJson(text)
    if (!imported) {
      setError('Fichier illisible ou invalide.')
      return
    }
    const mode =
      counters.length === 0 || window.confirm(`Remplacer les ${counters.length} compteur(s) actuel(s) par les ${imported.length} importé(s) ?\n\nAnnuler pour les ajouter à la place.`)
        ? 'replace'
        : 'merge'
    onImport(imported, mode)
    onClose()
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Impossible de copier automatiquement, sélectionne le lien manuellement.")
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-panel-header">
          <h2>Synchroniser mes compteurs</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <section className="modal-section">
          <h3>Vers un autre appareil</h3>
          <p className="modal-hint">
            Scanne ce QR code depuis l'autre appareil (appareil photo ou navigateur), ou copie le lien.
          </p>
          {qrDataUrl ? (
            <img className="sync-qr" src={qrDataUrl} alt="QR code de tes compteurs" width={200} height={200} />
          ) : (
            <p className="modal-hint">Ajoute au moins un compteur pour générer un QR code.</p>
          )}
          {shareUrl && (
            <button className="modal-btn" onClick={copyLink}>
              {copied ? 'Lien copié ✓' : 'Copier le lien'}
            </button>
          )}
        </section>

        <section className="modal-section">
          <h3>Fichier de sauvegarde</h3>
          <div className="modal-row">
            <button className="modal-btn" onClick={() => downloadBackup(counters)} disabled={counters.length === 0}>
              Exporter
            </button>
            <button className="modal-btn" onClick={() => fileInputRef.current?.click()}>
              Importer
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileChosen(file)
                e.target.value = ''
              }}
            />
          </div>
        </section>

        {error && <p className="modal-error">{error}</p>}

        <p className="sync-version">Version {__APP_VERSION__}</p>
      </div>
    </div>
  )
}
