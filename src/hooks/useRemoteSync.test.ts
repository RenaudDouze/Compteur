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
function useHost(workerUrl: string | undefined, initial: Counter[]) {
  const [counters, setCounters] = useState(initial)
  const sync = useRemoteSync(workerUrl, counters, setCounters)
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

    it('crée un code, pousse les compteurs actuels et se synchronise', async () => {
      vi.mocked(createSyncCode).mockResolvedValue('ABCDEFGH')
      vi.mocked(pushSyncState).mockResolvedValue({ accepted: true, state: { updatedAt: 1, counters: [] } })
      // Le code fraîchement défini déclenche aussitôt le sondage périodique
      // (effet séparé) : le mocker aussi pour ne pas fausser le statut final.
      vi.mocked(fetchSyncState).mockResolvedValue({ updatedAt: 1, counters: [] })
      const initial = [makeCounter()]
      const { result } = renderHook(() => useHost(WORKER_URL, initial))

      let outcome: boolean | undefined
      await act(async () => {
        outcome = await result.current.sync.createCode()
      })

      expect(outcome).toBe(true)
      expect(result.current.sync.code).toBe('ABCDEFGH')
      expect(result.current.sync.status).toBe('synced')
      expect(pushSyncState).toHaveBeenCalledWith(WORKER_URL, 'ABCDEFGH', {
        updatedAt: expect.any(Number),
        counters: initial,
      })
    })

    it('signale une erreur si la création échoue côté serveur', async () => {
      vi.mocked(createSyncCode).mockRejectedValue(new Error('boom'))
      const { result } = renderHook(() => useHost(WORKER_URL, []))

      let outcome: boolean | undefined
      await act(async () => {
        outcome = await result.current.sync.createCode()
      })

      expect(outcome).toBe(false)
      expect(result.current.sync.status).toBe('error')
      expect(result.current.sync.errorMessage).toContain('Impossible de créer')
      expect(result.current.sync.code).toBeNull()
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
      vi.mocked(fetchSyncState).mockResolvedValue({ updatedAt: 50, counters: remoteCounters })
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
      vi.mocked(fetchSyncState).mockResolvedValue({ updatedAt: 50, counters: remoteCounters })
      const { result } = renderHook(() => useHost(WORKER_URL, [makeCounter({ id: 'local' })]))

      await act(async () => {
        await result.current.sync.joinCode('ABCDEFGH')
      })

      expect(result.current.counters).toEqual(remoteCounters)
      expect(pushSyncState).not.toHaveBeenCalled()
    })

    it('fusionne (et repousse) les compteurs si la confirmation est refusée', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      const localCounter = makeCounter({ id: 'local' })
      const remoteCounter = makeCounter({ id: 'distant' })
      vi.mocked(fetchSyncState).mockResolvedValue({ updatedAt: 50, counters: [remoteCounter] })
      vi.mocked(pushSyncState).mockResolvedValue({
        accepted: true,
        state: { updatedAt: 60, counters: [localCounter, remoteCounter] },
      })
      const { result } = renderHook(() => useHost(WORKER_URL, [localCounter]))

      await act(async () => {
        await result.current.sync.joinCode('ABCDEFGH')
      })

      expect(result.current.counters).toEqual([localCounter, remoteCounter])
      expect(pushSyncState).toHaveBeenCalledWith(WORKER_URL, 'ABCDEFGH', {
        updatedAt: expect.any(Number),
        counters: [localCounter, remoteCounter],
      })
    })

    it('signale une erreur si la requête réseau échoue', async () => {
      vi.mocked(fetchSyncState).mockRejectedValue(new Error('boom'))
      const { result } = renderHook(() => useHost(WORKER_URL, []))
      let outcome: string | undefined
      await act(async () => {
        outcome = await result.current.sync.joinCode('ABCDEFGH')
      })
      expect(outcome).toBe('error')
      expect(result.current.sync.errorMessage).toContain('Impossible de rejoindre')
    })
  })

  describe('sondage périodique (pull)', () => {
    it('applique au montage une version distante plus récente pour un code déjà actif', async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      const remoteCounters = [makeCounter({ id: 'depuis-serveur' })]
      vi.mocked(fetchSyncState).mockResolvedValue({ updatedAt: 10, counters: remoteCounters })

      const { result } = renderHook(() => useHost(WORKER_URL, []))
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })

      expect(result.current.counters).toEqual(remoteCounters)
      expect(result.current.sync.status).toBe('synced')
    })

    it("n'applique rien de nouveau si le sondage suivant renvoie le même horodatage", async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      const remoteCounters = [makeCounter({ id: 'depuis-serveur' })]
      vi.mocked(fetchSyncState).mockResolvedValue({ updatedAt: 10, counters: remoteCounters })

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
      let resolvePoll!: (value: { updatedAt: number; counters: Counter[] }) => void
      vi.mocked(fetchSyncState).mockReturnValue(new Promise((resolve) => (resolvePoll = resolve)))

      const { unmount } = renderHook(() => useHost(WORKER_URL, []))
      unmount()
      await act(async () => {
        resolvePoll({ updatedAt: 1, counters: [makeCounter()] })
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

    it("n'interroge plus le serveur une fois le composant démonté", async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      vi.mocked(fetchSyncState).mockResolvedValue({ updatedAt: 1, counters: [] })

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
      vi.mocked(fetchSyncState).mockResolvedValue({ updatedAt: 0, counters: [] })
      renderHook(() => useHost(WORKER_URL, [makeCounter()]))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000)
      })

      expect(pushSyncState).not.toHaveBeenCalled()
    })

    it('pousse un changement local après le délai de regroupement', async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      vi.mocked(fetchSyncState).mockResolvedValue({ updatedAt: 0, counters: [] })
      vi.mocked(pushSyncState).mockResolvedValue({ accepted: true, state: { updatedAt: 1, counters: [] } })
      const { result } = renderHook(() => useHost(WORKER_URL, []))
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })

      const edited = [makeCounter({ count: 1 })]
      act(() => {
        result.current.setCounters(edited)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_500)
      })

      expect(pushSyncState).toHaveBeenCalledWith(WORKER_URL, 'ABCDEFGH', {
        updatedAt: expect.any(Number),
        counters: edited,
      })
      expect(result.current.sync.status).toBe('synced')
    })

    it('ne renvoie qu\'une seule requête pour plusieurs changements rapprochés', async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      vi.mocked(fetchSyncState).mockResolvedValue({ updatedAt: 0, counters: [] })
      vi.mocked(pushSyncState).mockResolvedValue({ accepted: true, state: { updatedAt: 1, counters: [] } })
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
        await vi.advanceTimersByTimeAsync(1_500)
      })

      expect(pushSyncState).toHaveBeenCalledTimes(1)
    })

    it('adopte la version serveur quand la poussée est refusée (409, version plus récente ailleurs)', async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      vi.mocked(fetchSyncState).mockResolvedValue({ updatedAt: 0, counters: [] })
      const serverCounters = [makeCounter({ id: 'depuis-un-autre-appareil' })]
      vi.mocked(pushSyncState).mockResolvedValue({
        accepted: false,
        state: { updatedAt: 999, counters: serverCounters },
      })
      const { result } = renderHook(() => useHost(WORKER_URL, []))
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })

      act(() => {
        result.current.setCounters([makeCounter({ count: 1 })])
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_500)
      })

      expect(result.current.counters).toEqual(serverCounters)
      // L'application de la version serveur ne doit pas elle-même redéclencher
      // une poussée (boucle infinie) : une seule requête au total.
      expect(pushSyncState).toHaveBeenCalledTimes(1)
    })

    it('signale une erreur si la poussée échoue', async () => {
      window.localStorage.setItem('+1.sync.code.v1', JSON.stringify('ABCDEFGH'))
      vi.mocked(fetchSyncState).mockResolvedValue({ updatedAt: 0, counters: [] })
      vi.mocked(pushSyncState).mockRejectedValue(new Error('boom'))
      const { result } = renderHook(() => useHost(WORKER_URL, []))
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })

      act(() => {
        result.current.setCounters([makeCounter({ count: 1 })])
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_500)
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
      vi.mocked(fetchSyncState).mockResolvedValue({ updatedAt: 0, counters: [] })
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
