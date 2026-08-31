import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRemoteSync } from './useRemoteSync'
import { createSyncCode, fetchSyncState, pushSyncState } from '../remoteSync'
import type { Counter } from '../types'

vi.mock('../remoteSync', async () => {
  const actual = await vi.importActual<typeof import('../remoteSync')>('../remoteSync')
  return {
    ...actual,
    createSyncCode: vi.fn(),
    fetchSyncState: vi.fn(),
    pushSyncState: vi.fn(),
  }
})

const WORKER_URL = 'https://sync.example.workers.dev'

function makeCounter(overrides: Partial<Counter> = {}): Counter {
  return {
    id: 'a',
    name: 'Compteur',
    count: 0,
    createdAt: 1_700_000_000_000,
    behavior: {},
    appearance: { color: '#2563eb' },
    ...overrides,
  }
}

/** Composant hôte minimal : un hook seul ne peut pas gérer son propre état
 * `counters` entre les rendus (`renderHook` ne le fait pas à sa place), donc
 * on le porte ici comme le ferait App.tsx. */
function useHost(workerUrl: string | undefined, initial: Counter[], onRemoteUpdate?: () => void) {
  const [counters, setCounters] = useState(initial)
  const sync = useRemoteSync(workerUrl, counters, setCounters, onRemoteUpdate)
  return { counters, setCounters, sync }
}

describe('useRemoteSync', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(createSyncCode).mockReset()
    vi.mocked(fetchSyncState).mockReset()
    vi.mocked(pushSyncState).mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('état initial', () => {
    it('démarre désactivé sans code stocké', () => {
      const { result } = renderHook(() => useHost(WORKER_URL, []))
      expect(result.current.sync.code).toBeNull()
      expect(result.current.sync.status).toBe('disabled')
    })
  })

  describe('createCode', () => {
    it('ne fait rien sans workerUrl configuré', async () => {
      const { result } = renderHook(() => useHost(undefined, []))
      let outcome: boolean | undefined
      await act(async () => {
        outcome = await result.current.sync.createCode()
      })
      expect(outcome).toBe(false)
      expect(createSyncCode).not.toHaveBeenCalled()
    })

    it('crée un code, pousse les compteurs actuels avec baseVersion 0 et se synchronise', async () => {
      vi.mocked(createSyncCode).mockResolvedValue('ABCDEFGH')
      vi.mocked(pushSyncState).mockResolvedValue({ accepted: true, state: { version: 1, counters: [] } })
      // Le code fraîchement défini déclenche aussitôt le sondage périodique
      // (effet séparé) : le mocker aussi pour ne pas fausser le statut final.
      vi.mocked(fetchSyncState).mockResolvedValue({ version: 1, counters: [] })
      const initial = [makeCounter()]
      const { result } = renderHook(() => useHost(WORKER_URL, initial))

      let outcome: boolean | undefined
      await act(async () => {
        outcome = await result.current.sync.createCode()
      })

      expect(outcome).toBe(true)
      expect(result.current.sync.code).toBe('ABCDEFGH')
      expect(result.current.sync.status).toBe('synced')
      // Un code fraîchement créé démarre à la version 0 côté serveur (voir
      // handleCreate) : la première poussée part toujours de là, un seul
      // appel suffit (pas de retry — voir worker/README.md pour pourquoi
      // un numéro de version élimine le besoin d'en gérer un ici).
      expect(pushSyncState).toHaveBeenCalledTimes(1)
      expect(pushSyncState).toHaveBeenCalledWith(WORKER_URL, 'ABCDEFGH', {
        baseVersion: 0,
        counters: initial,
      })
    })

    it('signale une erreur si la création échoue côté serveur, avec le détail de la cause', async () => {
      vi.mocked(createSyncCode).mockRejectedValue(new Error('boom'))
      const { result } = renderHook(() => useHost(WORKER_URL, []))

      let outcome: boolean | undefined
      await act(async () => {
        outcome = await result.current.sync.createCode()
      })

      expect(outcome).toBe(false)
      expect(result.current.sync.status).toBe('error')
      // Le message de l'erreur d'origine est préservé (pas un texte
      // générique) : c'est la seule information de diagnostic disponible sur
      // un appareil sans accès à la console (ex : mobile).
      expect(result.current.sync.errorMessage).toBe('boom')
      expect(result.current.sync.code).toBeNull()
    })

    it("retombe sur un message générique si l'échec n'est pas une Error", async () => {
      vi.mocked(createSyncCode).mockRejectedValue('boom')
      const { result } = renderHook(() => useHost(WORKER_URL, []))

      await act(async () => {
        await result.current.sync.createCode()
      })

      expect(result.current.sync.errorMessage).toBe('Impossible de créer un code de synchronisation.')
    })
  })

  describe('joinCode', () => {
    it('refuse un code au mauvais format sans appel réseau', async () => {
      const { result } = renderHook(() => useHost(WORKER_URL, []))
      let outcome: string | undefined
      await act(async () => {
        outcome = await result.current.sync.joinCode('trop-court')
      })
      expect(outcome).toBe('invalid')
      expect(fetchSyncState).not.toHaveBeenCalled()
    })

    it('renvoie une erreur si le format est valide mais sans workerUrl configuré', async () => {
      const { result } = renderHook(() => useHost(undefined, []))
      let outcome: string | undefined
      await act(async () => {
        outcome = await result.current.sync.joinCode('ABCDEFGH')
      })
      expect(outcome).toBe('error')
    })

    it('signale "not-found" pour un code inconnu du serveur', async () => {
      vi.mocked(fetchSyncState).mockResolvedValue(null)
      const { result } = renderHook(() => useHost(WORKER_URL, []))
      let outcome: string | undefined
      await act(async () => {
        outcome = await result.current.sync.joinCode('ABCDEFGH')
      })
      expect(outcome).toBe('not-found')
      expect(result.current.sync.status).toBe('error')
    })

    it('adopte directement la version distante quand aucun compteur local (pas de confirmation demandée)', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm')
      const remoteCounters = [makeCounter({ id: 'distant' })]
      vi.mocked(fetchSyncState).mockResolvedValue({ version: 50, counters: remoteCounters })
      const { result } = renderHook(() => useHost(WORKER_URL, []))

      let outcome: string | undefined
      await act(async () => {
        outcome = await result.current.sync.joinCode('abcd-efgh')
      })

      expect(outcome).toBe('joined')
      expect(confirmSpy).not.toHaveBeenCalled()
      expect(result.current.counters).toEqual(remoteCounters)
      expect(result.current.sync.code).toBe('ABCDEFGH')
    })

    it('remplace les compteurs locaux si la confirmation est acceptée', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const remoteCounters = [makeCounter({ id: 'distant' })]
      vi.mocked(fetchSyncState).mockResolvedValue({ version: 50, counters: remoteCounters })
      const { result } = renderHook(() => useHost(WORKER_URL, [makeCounter({ id: 'local' })]))

      await act(async () => {
        await result.current.sync.joinCode('ABCDEFGH')
      })

      expect(result.current.counters).toEqual(remoteCounters)
      expect(pushSyncState).not.toHaveBeenCalled()
    })

    it('fusionne (et repousse depuis la version lue) les compteurs si la confirmation est refusée', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      const localCounter = makeCounter({ id: 'local' })
      const remoteCounter = makeCounter({ id: 'distant' })
      vi.mocked(fetchSyncState).mockResolvedValue({ version: 50, counters: [remoteCounter] })
      vi.mocked(pushSyncState).mockResolvedValue({
        accepted: true,
        state: { version: 51, counters: [localCounter, remoteCounter] },
      })
      const { result } = renderHook(() => useHost(WORKER_URL, [localCounter]))

      await act(async () => {
        await result.current.sync.joinCode('ABCDEFGH')
      })

      expect(result.current.counters).toEqual([localCounter, remoteCounter])
      expect(pushSyncState).toHaveBeenCalledWith(WORKER_URL, 'ABCDEFGH', {
        baseVersion: 50,
        counters: [localCounter, remoteCounter],
      })
    })

    it('adopte la version serveur si la poussée de fusion est refusée (un autre appareil a poussé entre-temps)', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      const localCounter = makeCounter({ id: 'local' })
      const remoteCounter = makeCounter({ id: 'distant' })
      const serverCounters = [makeCounter({ id: 'depuis-un-autre-appareil' })]
      vi.mocked(fetchSyncState).mockResolvedValue({ version: 50, counters: [remoteCounter] })
      vi.mocked(pushSyncState).mockResolvedValue({ accepted: false, state: { version: 51, counters: serverCounters } })
      const { result } = renderHook(() => useHost(WORKER_URL, [localCounter]))

      await act(async () => {
        await result.current.sync.joinCode('ABCDEFGH')
      })

      // La fusion calculée localement est devenue périmée : on adopte l'état
      // serveur renvoyé plutôt que de l'écraser avec.
      expect(result.current.counters).toEqual(serverCounters)
    })

    it('signale une erreur si la requête réseau échoue, avec le détail de la cause', async () => {
      vi.mocked(fetchSyncState).mockRejectedValue(new Error('boom'))
      const { result } = renderHook(() => useHost(WORKER_URL, []))
      let outcome: string | undefined
      await act(async () => {
        outcome = await result.current.sync.joinCode('ABCDEFGH')
      })
      expect(outcome).toBe('error')
      expect(result.current.sync.errorMessage).toBe('boom')
    })

    it("retombe sur un message générique si l'échec n'est pas une Error", async () => {
      vi.mocked(fetchSyncState).mockRejectedValue('boom')
      const { result } = renderHook(() => useHost(WORKER_URL, []))
      await act(async () => {
        await result.current.sync.joinCode('ABCDEFGH')
      })
      expect(result.current.sync.errorMessage).toBe('Impossible de rejoindre ce code.')
    })
  })

  describe('sondage périodique (pull)', () => {
    it('applique au montage une version distante plus récente pour un code déjà actif', async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      const remoteCounters = [makeCounter({ id: 'depuis-serveur' })]
      vi.mocked(fetchSyncState).mockResolvedValue({ version: 10, counters: remoteCounters })

      const { result } = renderHook(() => useHost(WORKER_URL, []))
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })

      expect(result.current.counters).toEqual(remoteCounters)
      expect(result.current.sync.status).toBe('synced')
    })

    it("n'applique rien de nouveau si le sondage suivant renvoie le même numéro de version", async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      const remoteCounters = [makeCounter({ id: 'depuis-serveur' })]
      vi.mocked(fetchSyncState).mockResolvedValue({ version: 10, counters: remoteCounters })

      const { result } = renderHook(() => useHost(WORKER_URL, []))
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })
      const countersAfterFirstPoll = result.current.counters

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000)
      })

      expect(result.current.counters).toBe(countersAfterFirstPoll)
    })

    it('désactive la synchro si le code a expiré côté serveur (404)', async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      vi.mocked(fetchSyncState).mockResolvedValue(null)

      const { result } = renderHook(() => useHost(WORKER_URL, []))
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })

      expect(result.current.sync.code).toBeNull()
      expect(result.current.sync.status).toBe('error')
      expect(result.current.sync.errorMessage).toContain("n'existe plus")
    })

    it('signale une erreur si le sondage échoue, sans toucher aux compteurs', async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      vi.mocked(fetchSyncState).mockRejectedValue(new Error('réseau coupé'))
      const initial = [makeCounter()]

      const { result } = renderHook(() => useHost(WORKER_URL, initial))
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })

      expect(result.current.sync.status).toBe('error')
      expect(result.current.counters).toEqual(initial)
    })

    it('ignore une réponse de succès qui arrive après le démontage', async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      let resolvePoll!: (value: { version: number; counters: Counter[] }) => void
      vi.mocked(fetchSyncState).mockReturnValue(new Promise((resolve) => (resolvePoll = resolve)))

      const { unmount } = renderHook(() => useHost(WORKER_URL, []))
      unmount()
      await act(async () => {
        resolvePoll({ version: 1, counters: [makeCounter()] })
        await vi.runAllTimersAsync()
      })
      // N'aurait de toute façon rien à vérifier de visible (démonté) : le
      // test couvre surtout que la résolution tardive ne lève aucune erreur.
    })

    it('ignore un échec de sondage qui arrive après le démontage', async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      let rejectPoll!: (reason: unknown) => void
      vi.mocked(fetchSyncState).mockReturnValue(new Promise((_resolve, reject) => (rejectPoll = reject)))

      const { unmount } = renderHook(() => useHost(WORKER_URL, []))
      unmount()
      await act(async () => {
        rejectPoll(new Error('trop tard'))
        await vi.runAllTimersAsync()
      })
    })

    it("n'appelle pas onRemoteUpdate au premier sondage si la version distante correspond déjà à la dernière connue de cet appareil (recharger la page sur l'appareil qui a poussé en dernier)", async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      window.localStorage.setItem('+1.sync.version.v1', JSON.stringify(7))
      const counters = [makeCounter()]
      vi.mocked(fetchSyncState).mockResolvedValue({ version: 7, counters })
      const onRemoteUpdate = vi.fn()

      const { result } = renderHook(() => useHost(WORKER_URL, counters, onRemoteUpdate))
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })

      expect(onRemoteUpdate).not.toHaveBeenCalled()
      // Pas de ré-application inutile des compteurs déjà en place.
      expect(result.current.counters).toBe(counters)
    })

    it("appelle onRemoteUpdate au premier sondage si la version distante dépasse la dernière connue de cet appareil (un autre appareil a poussé pendant que celui-ci était fermé)", async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      window.localStorage.setItem('+1.sync.version.v1', JSON.stringify(7))
      const remoteCounters = [makeCounter({ id: 'depuis-un-autre-appareil' })]
      vi.mocked(fetchSyncState).mockResolvedValue({ version: 9, counters: remoteCounters })
      const onRemoteUpdate = vi.fn()

      const { result } = renderHook(() => useHost(WORKER_URL, [], onRemoteUpdate))
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })

      expect(onRemoteUpdate).toHaveBeenCalledTimes(1)
      expect(result.current.counters).toEqual(remoteCounters)
    })

    it('persiste la version reçue, pour rester silencieux après un rechargement de page tant que rien de neuf', async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      vi.mocked(fetchSyncState).mockResolvedValue({ version: 10, counters: [] })

      renderHook(() => useHost(WORKER_URL, []))
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })

      expect(window.localStorage.getItem('+1.sync.version.v1')).toBe(JSON.stringify(10))
    })

    it("appelle onRemoteUpdate dès le tout premier sondage au montage (ex : rouvrir l'app sur un appareil déjà relié à un code)", async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      vi.mocked(fetchSyncState).mockResolvedValue({ version: 10, counters: [makeCounter()] })
      const onRemoteUpdate = vi.fn()

      renderHook(() => useHost(WORKER_URL, [], onRemoteUpdate))
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })

      expect(onRemoteUpdate).toHaveBeenCalledTimes(1)
    })

    it('appelle de nouveau onRemoteUpdate quand un sondage suivant apporte une version plus récente', async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      vi.mocked(fetchSyncState).mockResolvedValue({ version: 10, counters: [] })
      const onRemoteUpdate = vi.fn()

      renderHook(() => useHost(WORKER_URL, [], onRemoteUpdate))
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })
      expect(onRemoteUpdate).toHaveBeenCalledTimes(1)

      const remoteCounters = [makeCounter({ id: 'depuis-un-autre-appareil' })]
      vi.mocked(fetchSyncState).mockResolvedValue({ version: 11, counters: remoteCounters })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000)
      })

      expect(onRemoteUpdate).toHaveBeenCalledTimes(2)
    })

    it("n'appelle plus onRemoteUpdate quand un sondage suivant ne renvoie rien de nouveau", async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      vi.mocked(fetchSyncState).mockResolvedValue({ version: 10, counters: [] })
      const onRemoteUpdate = vi.fn()

      renderHook(() => useHost(WORKER_URL, [], onRemoteUpdate))
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })
      expect(onRemoteUpdate).toHaveBeenCalledTimes(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000)
      })

      // Toujours 1 : le sondage suivant renvoie la même version, rien à
      // signaler de plus.
      expect(onRemoteUpdate).toHaveBeenCalledTimes(1)
    })

    it("n'interroge plus le serveur une fois le composant démonté", async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      vi.mocked(fetchSyncState).mockResolvedValue({ version: 1, counters: [] })

      const { unmount } = renderHook(() => useHost(WORKER_URL, []))
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })
      const callsBeforeUnmount = vi.mocked(fetchSyncState).mock.calls.length
      unmount()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })
      expect(vi.mocked(fetchSyncState).mock.calls.length).toBe(callsBeforeUnmount)
    })
  })

  describe('poussée différée (push) des changements locaux', () => {
    it("ne pousse rien pour l'état déjà en place au montage (hydratation, pas une vraie modification)", async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      vi.mocked(fetchSyncState).mockResolvedValue({ version: 0, counters: [] })
      renderHook(() => useHost(WORKER_URL, [makeCounter()]))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000)
      })

      expect(pushSyncState).not.toHaveBeenCalled()
    })

    it('pousse un changement local après le délai de regroupement, depuis la dernière version connue', async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      vi.mocked(fetchSyncState).mockResolvedValue({ version: 0, counters: [] })
      vi.mocked(pushSyncState).mockResolvedValue({ accepted: true, state: { version: 1, counters: [] } })
      const { result } = renderHook(() => useHost(WORKER_URL, []))
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })

      const edited = [makeCounter({ count: 1 })]
      act(() => {
        result.current.setCounters(edited)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000)
      })

      expect(pushSyncState).toHaveBeenCalledWith(WORKER_URL, 'ABCDEFGH', {
        baseVersion: 0,
        counters: edited,
      })
      expect(result.current.sync.status).toBe('synced')
      // Persistée : un rechargement juste après ne redéclenchera pas la
      // notification de mise à jour distante pour cette même version.
      expect(window.localStorage.getItem('+1.sync.version.v1')).toBe(JSON.stringify(1))
    })

    it('ne renvoie qu\'une seule requête pour plusieurs changements rapprochés', async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      vi.mocked(fetchSyncState).mockResolvedValue({ version: 0, counters: [] })
      vi.mocked(pushSyncState).mockResolvedValue({ accepted: true, state: { version: 1, counters: [] } })
      const { result } = renderHook(() => useHost(WORKER_URL, []))
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })

      act(() => {
        result.current.setCounters([makeCounter({ count: 1 })])
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
      act(() => {
        result.current.setCounters([makeCounter({ count: 2 })])
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000)
      })

      expect(pushSyncState).toHaveBeenCalledTimes(1)
    })

    it('adopte la version serveur quand la poussée est refusée (409, un autre appareil a poussé entre-temps)', async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      vi.mocked(fetchSyncState).mockResolvedValue({ version: 0, counters: [] })
      const serverCounters = [makeCounter({ id: 'depuis-un-autre-appareil' })]
      vi.mocked(pushSyncState).mockResolvedValue({
        accepted: false,
        state: { version: 999, counters: serverCounters },
      })
      const { result } = renderHook(() => useHost(WORKER_URL, []))
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })

      act(() => {
        result.current.setCounters([makeCounter({ count: 1 })])
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000)
      })

      expect(result.current.counters).toEqual(serverCounters)
      // L'application de la version serveur ne doit pas elle-même redéclencher
      // une poussée (boucle infinie) : une seule requête au total.
      expect(pushSyncState).toHaveBeenCalledTimes(1)
    })

    it('appelle onRemoteUpdate quand la poussée est refusée et que la version serveur est adoptée', async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      vi.mocked(fetchSyncState).mockResolvedValue({ version: 0, counters: [] })
      vi.mocked(pushSyncState).mockResolvedValue({
        accepted: false,
        state: { version: 999, counters: [makeCounter({ id: 'depuis-un-autre-appareil' })] },
      })
      const onRemoteUpdate = vi.fn()
      const { result } = renderHook(() => useHost(WORKER_URL, [], onRemoteUpdate))
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })
      expect(onRemoteUpdate).not.toHaveBeenCalled()

      act(() => {
        result.current.setCounters([makeCounter({ count: 1 })])
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000)
      })

      expect(onRemoteUpdate).toHaveBeenCalledTimes(1)
    })

    it('signale une erreur si la poussée échoue', async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      vi.mocked(fetchSyncState).mockResolvedValue({ version: 0, counters: [] })
      vi.mocked(pushSyncState).mockRejectedValue(new Error('boom'))
      const { result } = renderHook(() => useHost(WORKER_URL, []))
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })

      act(() => {
        result.current.setCounters([makeCounter({ count: 1 })])
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000)
      })

      expect(result.current.sync.status).toBe('error')
    })

    it("ne pousse rien tant qu'aucun code n'est actif", async () => {
      const { result } = renderHook(() => useHost(WORKER_URL, []))
      act(() => {
        result.current.setCounters([makeCounter({ count: 1 })])
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000)
      })
      expect(pushSyncState).not.toHaveBeenCalled()
    })
  })

  describe('disable', () => {
    it('efface le code, repasse en désactivé et annule une poussée en attente', async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      vi.mocked(fetchSyncState).mockResolvedValue({ version: 0, counters: [] })
      const { result } = renderHook(() => useHost(WORKER_URL, []))
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })

      act(() => {
        result.current.setCounters([makeCounter({ count: 1 })])
      })
      act(() => {
        result.current.sync.disable()
      })

      expect(result.current.sync.code).toBeNull()
      expect(result.current.sync.status).toBe('disabled')

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000)
      })
      expect(pushSyncState).not.toHaveBeenCalled()
    })
  })
})
