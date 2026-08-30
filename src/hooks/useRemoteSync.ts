import { useEffect, useRef, useState } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { createSyncCode, fetchSyncState, isValidSyncCode, normalizeSyncCode, pushSyncState } from '../remoteSync'
import type { Counter } from '../types'

export type RemoteSyncStatus = 'disabled' | 'syncing' | 'synced' | 'error'
export type JoinSyncCodeOutcome = 'invalid' | 'not-found' | 'error' | 'joined'

const POLL_INTERVAL_MS = 20_000
// Laisse le temps à plusieurs changements rapprochés (ex: quelques taps de
// suite) de se regrouper en une seule requête, plutôt que d'en envoyer une
// par changement.
const PUSH_DEBOUNCE_MS = 1_500

export interface UseRemoteSyncResult {
  code: string | null
  status: RemoteSyncStatus
  errorMessage: string | null
  createCode: () => Promise<boolean>
  joinCode: (rawCode: string) => Promise<JoinSyncCodeOutcome>
  disable: () => void
}

/** Synchronise `counters` avec le worker Cloudflare, tant qu'un code est actif
 * (voir worker/README.md pour le mécanisme côté serveur — dernier écrit
 * gagne). Sondage périodique pour récupérer les changements des autres
 * appareils, poussée différée des changements locaux. `workerUrl` absent
 * (fonctionnalité non configurée) désactive silencieusement toute action
 * réseau : le hook reste utilisable sans jamais rien synchroniser. */
export function useRemoteSync(
  workerUrl: string | undefined,
  counters: Counter[],
  setCounters: (updater: Counter[] | ((prev: Counter[]) => Counter[])) => void
): UseRemoteSyncResult {
  const [code, setCode] = useLocalStorage<string | null>('+1.sync.code.v1', null)
  const [status, setStatus] = useState<RemoteSyncStatus>(code ? 'syncing' : 'disabled')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Dernier horodatage connu comme reflétant à la fois l'état local et celui
  // du serveur : sert à décider si une réponse du sondage apporte vraiment du
  // neuf. En ref (pas en state) : lu depuis des callbacks différés, sans
  // avoir besoin de redéclencher un rendu quand il change.
  const lastSyncedAtRef = useRef(0)
  // Vrai le temps d'appliquer un `counters` reçu du serveur : évite que
  // l'effet de poussée ci-dessous ne le retransmette aussitôt comme s'il
  // s'agissait d'une modification locale (boucle infinie).
  const applyingRemoteRef = useRef(false)
  // Le tout premier passage de l'effet de poussée suit le montage du
  // composant (compteurs déjà chargés depuis le stockage local) : jamais une
  // vraie modification à transmettre, seulement l'état déjà en place.
  const isFirstPushEffectRunRef = useRef(true)
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const countersRef = useRef(counters)
  countersRef.current = counters

  useEffect(() => {
    if (!workerUrl || !code) return

    let cancelled = false
    const poll = async () => {
      try {
        const remote = await fetchSyncState(workerUrl, code)
        if (cancelled) return
        if (remote === null) {
          // Code expiré côté serveur (inactivité prolongée) ou jamais
          // existé : rien à synchroniser, on désactive plutôt que de
          // sonder indéfiniment un code mort.
          setStatus('error')
          setErrorMessage("Ce code de synchronisation n'existe plus.")
          setCode(null)
          return
        }
        if (remote.updatedAt > lastSyncedAtRef.current) {
          applyingRemoteRef.current = true
          lastSyncedAtRef.current = remote.updatedAt
          setCounters(remote.counters)
        }
        setStatus('synced')
        setErrorMessage(null)
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [workerUrl, code, setCounters, setCode])

  useEffect(() => {
    const isFirstRun = isFirstPushEffectRunRef.current
    isFirstPushEffectRunRef.current = false

    if (!workerUrl || !code || isFirstRun) return
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false
      return
    }

    clearTimeout(pushTimerRef.current)
    pushTimerRef.current = setTimeout(async () => {
      const updatedAt = Date.now()
      try {
        const result = await pushSyncState(workerUrl, code, { updatedAt, counters: countersRef.current })
        if (result.accepted) {
          lastSyncedAtRef.current = updatedAt
        } else {
          // Un autre appareil a poussé une version plus récente entre-temps :
          // on l'adopte plutôt que de perdre ses changements.
          applyingRemoteRef.current = true
          lastSyncedAtRef.current = result.state.updatedAt
          setCounters(result.state.counters)
        }
        setStatus('synced')
        setErrorMessage(null)
      } catch {
        setStatus('error')
      }
    }, PUSH_DEBOUNCE_MS)

    return () => clearTimeout(pushTimerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counters])

  const createCode = async (): Promise<boolean> => {
    if (!workerUrl) return false
    setStatus('syncing')
    setErrorMessage(null)
    try {
      const newCode = await createSyncCode(workerUrl)
      let updatedAt = Date.now()
      let result = await pushSyncState(workerUrl, newCode, { updatedAt, counters: countersRef.current })
      if (!result.accepted) {
        // Horloge de l'appareil en retard sur celle du serveur : l'horodatage
        // de création (posé côté serveur) l'emporterait sinon sur le nôtre, et
        // le prochain sondage remplacerait nos compteurs par l'état vide créé
        // par handleCreate. Le code vient d'être créé à l'instant (aucun autre
        // appareil ne peut encore l'avoir modifié) : on repousse avec un
        // horodatage garanti postérieur, qui aboutit forcément cette fois.
        updatedAt = result.state.updatedAt + 1
        result = await pushSyncState(workerUrl, newCode, { updatedAt, counters: countersRef.current })
      }
      lastSyncedAtRef.current = updatedAt
      setCode(newCode)
      setStatus('synced')
      return true
    } catch {
      setStatus('error')
      setErrorMessage('Impossible de créer un code de synchronisation.')
      return false
    }
  }

  const joinCode = async (rawCode: string): Promise<JoinSyncCodeOutcome> => {
    const normalized = normalizeSyncCode(rawCode)
    if (!isValidSyncCode(normalized)) return 'invalid'
    if (!workerUrl) return 'error'

    setStatus('syncing')
    setErrorMessage(null)
    try {
      const remote = await fetchSyncState(workerUrl, normalized)
      if (remote === null) {
        setStatus('error')
        return 'not-found'
      }

      const current = countersRef.current
      const shouldReplace =
        current.length === 0 ||
        window.confirm(
          `Remplacer tes ${current.length} compteur(s) actuel(s) par ceux du code ?\n\nAnnuler pour les ajouter à la suite.`
        )

      if (shouldReplace) {
        applyingRemoteRef.current = true
        lastSyncedAtRef.current = remote.updatedAt
        setCounters(remote.counters)
      } else {
        // La fusion crée un état qui n'existe encore nulle part ailleurs :
        // on le pousse explicitement plutôt que d'attendre le prochain
        // changement local.
        const merged = [...current, ...remote.counters]
        const updatedAt = Date.now()
        await pushSyncState(workerUrl, normalized, { updatedAt, counters: merged })
        applyingRemoteRef.current = true
        lastSyncedAtRef.current = updatedAt
        setCounters(merged)
      }

      setCode(normalized)
      setStatus('synced')
      return 'joined'
    } catch {
      setStatus('error')
      setErrorMessage('Impossible de rejoindre ce code.')
      return 'error'
    }
  }

  const disable = () => {
    clearTimeout(pushTimerRef.current)
    lastSyncedAtRef.current = 0
    setCode(null)
    setStatus('disabled')
    setErrorMessage(null)
  }

  return { code, status, errorMessage, createCode, joinCode, disable }
}
