import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { buildShareUrl, downloadBackup, parseBackupJson } from '../sync'
import { formatSyncCode } from '../remoteSync'
import type { UseRemoteSyncResult } from '../hooks/useRemoteSync'
import type { Counter } from '../types'

interface SyncPanelProps {
  counters: Counter[]
  onClose: () => void
  onImport: (counters: Counter[], mode: 'replace' | 'merge') => void
  remoteSync: UseRemoteSyncResult
}

const REMOTE_STATUS_LABEL: Record<UseRemoteSyncResult['status'], string> = {
  disabled: '',
  syncing: 'Synchronisation…',
  synced: 'Synchronisé ✓',
  error: 'Erreur de synchronisation',
}

const JOIN_OUTCOME_ERROR: Record<'invalid' | 'not-found' | 'error', string> = {
  invalid: 'Code invalide (8 caractères attendus).',
  'not-found': 'Ce code de synchronisation est introuvable.',
  error: 'Impossible de rejoindre ce code, réessaie.',
}

export function SyncPanel({ counters, onClose, onImport, remoteSync }: SyncPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joinOpen, setJoinOpen] = useState(false)
  const [joinInput, setJoinInput] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)

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

  const handleJoinCode = async () => {
    setJoinError(null)
    const outcome = await remoteSync.joinCode(joinInput)
    if (outcome === 'joined') {
      setJoinOpen(false)
      setJoinInput('')
      return
    }
    setJoinError(JOIN_OUTCOME_ERROR[outcome])
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-panel-header">
          <h2>Synchroniser mes compteurs</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fermer" title="Fermer">
            ✕
          </button>
        </div>

        {import.meta.env.VITE_SYNC_WORKER_URL && (
          <section className="modal-section">
            <h3>Code de synchro</h3>
            {remoteSync.code ? (
              <>
                <p className="sync-code">{formatSyncCode(remoteSync.code)}</p>
                <p className={`sync-status sync-status--${remoteSync.status}`}>
                  {remoteSync.status === 'error' && remoteSync.errorMessage
                    ? remoteSync.errorMessage
                    : REMOTE_STATUS_LABEL[remoteSync.status]}
                </p>
                <button className="modal-btn" onClick={remoteSync.disable}>
                  Se déconnecter
                </button>
              </>
            ) : joinOpen ? (
              <div className="modal-row">
                <input
                  autoFocus
                  className="modal-input"
                  placeholder="XXXX XXXX"
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleJoinCode()
                    if (e.key === 'Escape') setJoinOpen(false)
                  }}
                />
                <button className="modal-btn" onClick={handleJoinCode} disabled={joinInput.trim() === ''}>
                  Rejoindre
                </button>
              </div>
            ) : (
              <>
                <p className="modal-hint">
                  Synchronise automatiquement tes compteurs avec un autre appareil, sans compte : génère un code sur
                  le premier, saisis-le sur le second.
                </p>
                <div className="modal-row">
                  <button className="modal-btn" onClick={() => remoteSync.createCode()}>
                    Nouveau code
                  </button>
                  <button className="modal-btn" onClick={() => setJoinOpen(true)}>
                    Saisir un code
                  </button>
                </div>
              </>
            )}
            {joinError && <p className="modal-error">{joinError}</p>}
          </section>
        )}

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
