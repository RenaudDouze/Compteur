import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import QRCode from 'qrcode'
import { SyncPanel } from './SyncPanel'
import type { UseRemoteSyncResult } from '../hooks/useRemoteSync'
import type { Counter } from '../types'

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(),
  },
}))

function makeCounter(overrides: Partial<Counter> = {}): Counter {
  return {
    id: 'id-1',
    name: 'Compteur 1',
    count: 3,
    createdAt: Date.now(),
    behavior: {},
    appearance: { color: '#2563eb' },
    ...overrides,
  }
}

// La section « Code de synchro » elle-même est testée dans une describe
// dédiée plus bas (avec VITE_SYNC_WORKER_URL simulée) : ce fixture ne sert
// qu'à satisfaire la prop requise des autres tests, qui ne l'exercent pas.
function makeRemoteSync(overrides: Partial<UseRemoteSyncResult> = {}): UseRemoteSyncResult {
  return {
    code: null,
    status: 'disabled',
    errorMessage: null,
    createCode: vi.fn(),
    joinCode: vi.fn(),
    disable: vi.fn(),
    ...overrides,
  }
}

describe('SyncPanel', () => {
  const toDataURLMock = QRCode.toDataURL as unknown as ReturnType<
    typeof vi.fn<(text: string, opts?: unknown) => Promise<string>>
  >

  beforeEach(() => {
    toDataURLMock.mockReset()
    toDataURLMock.mockResolvedValue('data:image/png;base64,fake')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("affiche la version de l'application", () => {
    render(<SyncPanel counters={[]} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
    expect(screen.getByText('Version test')).toBeInTheDocument()
  })

  it('affiche un message quand aucun compteur ne permet de générer de QR code', () => {
    render(<SyncPanel counters={[]} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
    expect(screen.getByText('Ajoute au moins un compteur pour générer un QR code.')).toBeInTheDocument()
    expect(toDataURLMock).not.toHaveBeenCalled()
  })

  it("n'affiche pas le bouton copier le lien sans compteur", () => {
    render(<SyncPanel counters={[]} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
    expect(screen.queryByText('Copier le lien')).not.toBeInTheDocument()
  })

  it('génère et affiche le QR code quand il y a des compteurs', async () => {
    render(<SyncPanel counters={[makeCounter()]} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
    await waitFor(() => {
      expect(screen.getByAltText('QR code de tes compteurs')).toBeInTheDocument()
    })
    const img = screen.getByAltText('QR code de tes compteurs') as HTMLImageElement
    expect(img.src).toBe('data:image/png;base64,fake')
  })

  it('affiche un message explicite si la génération du QR code échoue (trop de données)', async () => {
    toDataURLMock.mockRejectedValue(new Error('code length overflow'))
    render(<SyncPanel counters={[makeCounter()]} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
    await waitFor(() => {
      expect(
        screen.getByText('Trop de compteurs pour un QR code : utilise le code de synchro ou le fichier de sauvegarde.')
      ).toBeInTheDocument()
    })
  })

  it('affiche le bouton copier le lien quand il y a des compteurs', async () => {
    render(<SyncPanel counters={[makeCounter()]} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
    await waitFor(() => expect(screen.getByText('Copier le lien')).toBeInTheDocument())
  })

  it('ferme le panneau avec la touche Échap', () => {
    const onClose = vi.fn()
    render(<SyncPanel counters={[]} onClose={onClose} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("ignore les autres touches que Échap", () => {
    const onClose = vi.fn()
    render(<SyncPanel counters={[]} onClose={onClose} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('se désabonne des touches au démontage', () => {
    const onClose = vi.fn()
    const { unmount } = render(<SyncPanel counters={[]} onClose={onClose} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
    unmount()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it("ferme le panneau au clic sur l'arrière-plan", () => {
    const onClose = vi.fn()
    const { container } = render(<SyncPanel counters={[]} onClose={onClose} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
    fireEvent.click(container.querySelector('.modal-overlay')!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("ne ferme pas le panneau au clic à l'intérieur", () => {
    const onClose = vi.fn()
    const { container } = render(<SyncPanel counters={[]} onClose={onClose} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
    fireEvent.click(container.querySelector('.modal-panel')!)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('ferme le panneau au clic sur la croix', () => {
    const onClose = vi.fn()
    render(<SyncPanel counters={[]} onClose={onClose} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  describe('export', () => {
    it('désactive le bouton exporter sans compteur', () => {
      render(<SyncPanel counters={[]} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
      expect(screen.getByRole('button', { name: 'Exporter' })).toBeDisabled()
    })

    it('exporte les compteurs au clic', async () => {
      const counters = [makeCounter()]
      render(<SyncPanel counters={counters} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
      fireEvent.click(screen.getByRole('button', { name: 'Exporter' }))
      expect(clickSpy).toHaveBeenCalledTimes(1)
      clickSpy.mockRestore()
      createObjectURLSpy.mockRestore()
      revokeObjectURLSpy.mockRestore()
    })
  })

  describe('import', () => {
    it('ouvre le sélecteur de fichier au clic sur Importer', () => {
      render(<SyncPanel counters={[]} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {})
      fireEvent.click(screen.getByRole('button', { name: 'Importer' }))
      expect(clickSpy).toHaveBeenCalledTimes(1)
    })

    it("ne fait rien si aucun fichier n'est sélectionné", async () => {
      const onImport = vi.fn()
      render(<SyncPanel counters={[]} onClose={vi.fn()} onImport={onImport} remoteSync={makeRemoteSync()} />)
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await act(async () => {
        fireEvent.change(input, { target: { files: [] } })
      })
      expect(onImport).not.toHaveBeenCalled()
    })

    it('remplace directement quand il n\'y a aucun compteur existant (sans confirmation)', async () => {
      const onImport = vi.fn()
      const onClose = vi.fn()
      const confirmSpy = vi.spyOn(window, 'confirm')
      render(<SyncPanel counters={[]} onClose={onClose} onImport={onImport} remoteSync={makeRemoteSync()} />)
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File([JSON.stringify([{ name: 'Importé', count: 5 }])], 'backup.json', {
        type: 'application/json',
      })
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } })
      })
      expect(confirmSpy).not.toHaveBeenCalled()
      expect(onImport).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: 'Importé' })]), 'replace')
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('remplace après confirmation quand des compteurs existent déjà', async () => {
      const onImport = vi.fn()
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<SyncPanel counters={[makeCounter()]} onClose={vi.fn()} onImport={onImport} remoteSync={makeRemoteSync()} />)
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File([JSON.stringify([{ name: 'Importé', count: 5 }])], 'backup.json', {
        type: 'application/json',
      })
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } })
      })
      expect(onImport).toHaveBeenCalledWith(expect.any(Array), 'replace')
    })

    it('fusionne quand la confirmation est refusée', async () => {
      const onImport = vi.fn()
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(<SyncPanel counters={[makeCounter()]} onClose={vi.fn()} onImport={onImport} remoteSync={makeRemoteSync()} />)
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File([JSON.stringify([{ name: 'Importé', count: 5 }])], 'backup.json', {
        type: 'application/json',
      })
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } })
      })
      expect(onImport).toHaveBeenCalledWith(expect.any(Array), 'merge')
    })

    it('affiche une erreur pour un fichier invalide', async () => {
      const onImport = vi.fn()
      const onClose = vi.fn()
      render(<SyncPanel counters={[]} onClose={onClose} onImport={onImport} remoteSync={makeRemoteSync()} />)
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['{invalide'], 'backup.json', { type: 'application/json' })
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } })
      })
      expect(screen.getByText('Fichier illisible ou invalide.')).toBeInTheDocument()
      expect(onImport).not.toHaveBeenCalled()
      expect(onClose).not.toHaveBeenCalled()
    })

    it("réinitialise la valeur de l'input après sélection", async () => {
      render(<SyncPanel counters={[]} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File([JSON.stringify([{ name: 'A', count: 1 }])], 'backup.json', {
        type: 'application/json',
      })
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } })
      })
      expect(input.value).toBe('')
    })
  })

  describe('copie du lien', () => {
    it('copie le lien de partage dans le presse-papiers', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: writeTextMock } })
      render(<SyncPanel counters={[makeCounter()]} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
      await waitFor(() => expect(screen.getByText('Copier le lien')).toBeInTheDocument())
      await act(async () => {
        fireEvent.click(screen.getByText('Copier le lien'))
      })
      expect(writeTextMock).toHaveBeenCalledTimes(1)
      expect(screen.getByText('Lien copié ✓')).toBeInTheDocument()
      vi.unstubAllGlobals()
    })

    it('revient au libellé initial après le délai', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const writeTextMock = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: writeTextMock } })
      render(<SyncPanel counters={[makeCounter()]} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
      await waitFor(() => expect(screen.getByText('Copier le lien')).toBeInTheDocument())
      await act(async () => {
        fireEvent.click(screen.getByText('Copier le lien'))
      })
      expect(screen.getByText('Lien copié ✓')).toBeInTheDocument()
      await act(async () => {
        vi.advanceTimersByTime(2100)
      })
      expect(screen.getByText('Copier le lien')).toBeInTheDocument()
      vi.unstubAllGlobals()
      vi.useRealTimers()
    })

    it('affiche une erreur si la copie échoue', async () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error('refusé'))
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: writeTextMock } })
      render(<SyncPanel counters={[makeCounter()]} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
      await waitFor(() => expect(screen.getByText('Copier le lien')).toBeInTheDocument())
      await act(async () => {
        fireEvent.click(screen.getByText('Copier le lien'))
      })
      expect(
        screen.getByText("Impossible de copier automatiquement, sélectionne le lien manuellement.")
      ).toBeInTheDocument()
      vi.unstubAllGlobals()
    })
  })

  describe('code de synchro', () => {
    it("n'affiche pas la section sans worker de synchro configuré", () => {
      render(<SyncPanel counters={[]} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
      expect(screen.queryByText('Code de synchro')).not.toBeInTheDocument()
    })

    describe('avec un worker configuré (VITE_SYNC_WORKER_URL)', () => {
      beforeEach(() => {
        vi.stubEnv('VITE_SYNC_WORKER_URL', 'https://sync.example.workers.dev')
      })

      afterEach(() => {
        vi.unstubAllEnvs()
      })

      it('propose de créer ou rejoindre un code quand la synchro est inactive', () => {
        render(<SyncPanel counters={[]} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
        expect(screen.getByText('Code de synchro')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Nouveau code' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Saisir un code' })).toBeInTheDocument()
      })

      it('déclenche la création au clic sur "Nouveau code"', () => {
        const createCode = vi.fn()
        render(
          <SyncPanel counters={[]} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync({ createCode })} />
        )
        fireEvent.click(screen.getByRole('button', { name: 'Nouveau code' }))
        expect(createCode).toHaveBeenCalledTimes(1)
      })

      it('révèle un champ de saisie au clic sur "Saisir un code"', () => {
        render(<SyncPanel counters={[]} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
        fireEvent.click(screen.getByRole('button', { name: 'Saisir un code' }))
        expect(screen.getByPlaceholderText('XXXX XXXX')).toBeInTheDocument()
      })

      it('désactive "Rejoindre" tant que le champ est vide', () => {
        render(<SyncPanel counters={[]} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
        fireEvent.click(screen.getByRole('button', { name: 'Saisir un code' }))
        expect(screen.getByRole('button', { name: 'Rejoindre' })).toBeDisabled()
      })

      it('rejoint le code saisi au clic sur "Rejoindre"', async () => {
        const joinCode = vi.fn().mockResolvedValue('joined')
        render(
          <SyncPanel counters={[]} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync({ joinCode })} />
        )
        fireEvent.click(screen.getByRole('button', { name: 'Saisir un code' }))
        fireEvent.change(screen.getByPlaceholderText('XXXX XXXX'), { target: { value: 'abcd efgh' } })
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Rejoindre' }))
        })
        expect(joinCode).toHaveBeenCalledWith('abcd efgh')
        // Le champ se referme une fois rejoint avec succès.
        expect(screen.queryByPlaceholderText('XXXX XXXX')).not.toBeInTheDocument()
      })

      it('rejoint aussi via la touche Entrée', async () => {
        const joinCode = vi.fn().mockResolvedValue('joined')
        render(
          <SyncPanel counters={[]} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync({ joinCode })} />
        )
        fireEvent.click(screen.getByRole('button', { name: 'Saisir un code' }))
        const input = screen.getByPlaceholderText('XXXX XXXX')
        fireEvent.change(input, { target: { value: 'ABCDEFGH' } })
        await act(async () => {
          fireEvent.keyDown(input, { key: 'Enter' })
        })
        expect(joinCode).toHaveBeenCalledWith('ABCDEFGH')
      })

      it('referme le champ de saisie sur Échap', () => {
        render(<SyncPanel counters={[]} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
        fireEvent.click(screen.getByRole('button', { name: 'Saisir un code' }))
        const input = screen.getByPlaceholderText('XXXX XXXX')
        fireEvent.keyDown(input, { key: 'Escape' })
        expect(screen.queryByPlaceholderText('XXXX XXXX')).not.toBeInTheDocument()
      })

      it.each([
        ['invalid', 'Code invalide (8 caractères attendus).'],
        ['not-found', 'Ce code de synchronisation est introuvable.'],
        ['error', 'Impossible de rejoindre ce code, réessaie.'],
      ] as const)('affiche une erreur adaptée pour l\'issue "%s"', async (outcome, message) => {
        const joinCode = vi.fn().mockResolvedValue(outcome)
        render(
          <SyncPanel counters={[]} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync({ joinCode })} />
        )
        fireEvent.click(screen.getByRole('button', { name: 'Saisir un code' }))
        fireEvent.change(screen.getByPlaceholderText('XXXX XXXX'), { target: { value: 'ABCDEFGH' } })
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Rejoindre' }))
        })
        expect(screen.getByText(message)).toBeInTheDocument()
        // Le champ reste ouvert pour corriger la saisie.
        expect(screen.getByPlaceholderText('XXXX XXXX')).toBeInTheDocument()
      })

      it('affiche le code actif, son état "en cours" et permet de se déconnecter', () => {
        const disable = vi.fn()
        render(
          <SyncPanel
            counters={[]}
            onClose={vi.fn()}
            onImport={vi.fn()}
            remoteSync={makeRemoteSync({ code: 'ABCDEFGH', status: 'syncing', disable })}
          />
        )
        expect(screen.getByText('ABCD EFGH')).toBeInTheDocument()
        expect(screen.getByText('Synchronisation…')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))
        expect(disable).toHaveBeenCalledTimes(1)
      })

      it('affiche "Synchronisé" une fois à jour', () => {
        render(
          <SyncPanel
            counters={[]}
            onClose={vi.fn()}
            onImport={vi.fn()}
            remoteSync={makeRemoteSync({ code: 'ABCDEFGH', status: 'synced' })}
          />
        )
        expect(screen.getByText('Synchronisé ✓')).toBeInTheDocument()
      })

      it("affiche le message d'erreur précis quand il y en a un", () => {
        render(
          <SyncPanel
            counters={[]}
            onClose={vi.fn()}
            onImport={vi.fn()}
            remoteSync={makeRemoteSync({ code: 'ABCDEFGH', status: 'error', errorMessage: 'Panne réseau' })}
          />
        )
        expect(screen.getByText('Panne réseau')).toBeInTheDocument()
      })

      it("retombe sur un message générique en erreur sans détail", () => {
        render(
          <SyncPanel
            counters={[]}
            onClose={vi.fn()}
            onImport={vi.fn()}
            remoteSync={makeRemoteSync({ code: 'ABCDEFGH', status: 'error', errorMessage: null })}
          />
        )
        expect(screen.getByText('Erreur de synchronisation')).toBeInTheDocument()
      })

      describe('suggestion du code de synchro pour un lien long', () => {
        const manyCounters = Array.from({ length: 20 }, (_, i) => makeCounter({ id: `c${i}`, name: `Compteur ${i}` }))

        it('suggère le code de synchro quand le lien devient long et la synchro est inactive', async () => {
          render(<SyncPanel counters={manyCounters} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
          await waitFor(() => expect(screen.getByAltText('QR code de tes compteurs')).toBeInTheDocument())
          expect(
            screen.getByText('Beaucoup de compteurs : le code de synchro (ci-dessus) reste pratique même quand ce lien devient long.')
          ).toBeInTheDocument()
        })

        it("ne suggère rien pour un lien court (peu de compteurs)", async () => {
          render(<SyncPanel counters={[makeCounter()]} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
          await waitFor(() => expect(screen.getByAltText('QR code de tes compteurs')).toBeInTheDocument())
          expect(screen.queryByText(/reste pratique même quand ce lien devient long/)).not.toBeInTheDocument()
        })

        it('ne suggère rien si un code de synchro est déjà actif (rien à suggérer)', async () => {
          render(
            <SyncPanel
              counters={manyCounters}
              onClose={vi.fn()}
              onImport={vi.fn()}
              remoteSync={makeRemoteSync({ code: 'ABCDEFGH' })}
            />
          )
          await waitFor(() => expect(screen.getByAltText('QR code de tes compteurs')).toBeInTheDocument())
          expect(screen.queryByText(/reste pratique même quand ce lien devient long/)).not.toBeInTheDocument()
        })
      })
    })

    it('ne suggère jamais le code de synchro sans worker configuré (rien à proposer)', async () => {
      const manyCounters = Array.from({ length: 20 }, (_, i) => makeCounter({ id: `c${i}`, name: `Compteur ${i}` }))
      render(<SyncPanel counters={manyCounters} onClose={vi.fn()} onImport={vi.fn()} remoteSync={makeRemoteSync()} />)
      await waitFor(() => expect(screen.getByAltText('QR code de tes compteurs')).toBeInTheDocument())
      expect(screen.queryByText(/reste pratique même quand ce lien devient long/)).not.toBeInTheDocument()
    })
  })
})
