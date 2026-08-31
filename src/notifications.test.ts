import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class FakeNotification {
  static permission: NotificationPermission = 'default'
  static requestPermission = vi.fn<() => Promise<NotificationPermission>>()
  static instances: FakeNotification[] = []
  title: string
  options?: NotificationOptions
  constructor(title: string, options?: NotificationOptions) {
    this.title = title
    this.options = options
    FakeNotification.instances.push(this)
  }
}

function setVisibilityState(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value, configurable: true })
}

function stubServiceWorker(showNotification: ReturnType<typeof vi.fn> | null, hasRegistration = true) {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      getRegistration: vi.fn().mockResolvedValue(hasRegistration ? { showNotification } : undefined),
    },
    configurable: true,
  })
}

describe('notifications', () => {
  const originalVisibilityState = document.visibilityState
  const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker')

  beforeEach(() => {
    FakeNotification.permission = 'default'
    FakeNotification.requestPermission = vi.fn().mockResolvedValue('granted')
    FakeNotification.instances = []
    vi.stubGlobal('Notification', FakeNotification)
    setVisibilityState('hidden')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setVisibilityState(originalVisibilityState)
    if (originalServiceWorker) {
      Object.defineProperty(navigator, 'serviceWorker', originalServiceWorker)
    } else {
      Reflect.deleteProperty(navigator, 'serviceWorker')
    }
  })

  describe('isNotificationSupported / getNotificationPermission', () => {
    it('supporté : reflète Notification.permission', async () => {
      FakeNotification.permission = 'denied'
      const { isNotificationSupported, getNotificationPermission } = await import('./notifications')
      expect(isNotificationSupported()).toBe(true)
      expect(getNotificationPermission()).toBe('denied')
    })

    it("non supporté : 'unsupported' sans planter", async () => {
      vi.stubGlobal('Notification', undefined)
      const { isNotificationSupported, getNotificationPermission } = await import('./notifications')
      expect(isNotificationSupported()).toBe(false)
      expect(getNotificationPermission()).toBe('unsupported')
    })
  })

  describe('requestNotificationPermission', () => {
    it("retourne 'unsupported' sans appeler l'API si Notification est absent", async () => {
      vi.stubGlobal('Notification', undefined)
      const { requestNotificationPermission } = await import('./notifications')
      expect(await requestNotificationPermission()).toBe('unsupported')
    })

    it("ne redemande pas si déjà tranchée (granted) : retourne l'état actuel", async () => {
      FakeNotification.permission = 'granted'
      const { requestNotificationPermission } = await import('./notifications')
      expect(await requestNotificationPermission()).toBe('granted')
      expect(FakeNotification.requestPermission).not.toHaveBeenCalled()
    })

    it("ne redemande pas si déjà tranchée (denied) : retourne l'état actuel", async () => {
      FakeNotification.permission = 'denied'
      const { requestNotificationPermission } = await import('./notifications')
      expect(await requestNotificationPermission()).toBe('denied')
      expect(FakeNotification.requestPermission).not.toHaveBeenCalled()
    })

    it("demande la permission si elle n'a pas encore été tranchée", async () => {
      FakeNotification.permission = 'default'
      FakeNotification.requestPermission = vi.fn().mockResolvedValue('granted')
      const { requestNotificationPermission } = await import('./notifications')
      expect(await requestNotificationPermission()).toBe('granted')
      expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1)
    })

    it("retombe sur l'état courant si la demande échoue", async () => {
      FakeNotification.permission = 'default'
      FakeNotification.requestPermission = vi.fn().mockRejectedValue(new Error('boom'))
      const { requestNotificationPermission } = await import('./notifications')
      const result = await requestNotificationPermission()
      expect(result).toBe('default')
    })
  })

  describe('showLocalNotification', () => {
    it('ne fait rien si Notification est absent', async () => {
      vi.stubGlobal('Notification', undefined)
      const { showLocalNotification } = await import('./notifications')
      await expect(showLocalNotification('Titre')).resolves.toBeUndefined()
    })

    it("ne fait rien si la permission n'est pas accordée", async () => {
      FakeNotification.permission = 'default'
      const showNotification = vi.fn()
      stubServiceWorker(showNotification)
      const { showLocalNotification } = await import('./notifications')
      await showLocalNotification('Titre')
      expect(FakeNotification.instances).toHaveLength(0)
      expect(showNotification).not.toHaveBeenCalled()
    })

    it("ne fait rien si l'onglet est déjà au premier plan (le toast in-app suffit)", async () => {
      FakeNotification.permission = 'granted'
      setVisibilityState('visible')
      const showNotification = vi.fn()
      stubServiceWorker(showNotification)
      const { showLocalNotification } = await import('./notifications')
      await showLocalNotification('Titre')
      expect(FakeNotification.instances).toHaveLength(0)
      expect(showNotification).not.toHaveBeenCalled()
    })

    it('passe par le service worker enregistré quand il est disponible', async () => {
      FakeNotification.permission = 'granted'
      const showNotification = vi.fn().mockResolvedValue(undefined)
      stubServiceWorker(showNotification)
      const { showLocalNotification } = await import('./notifications')
      await showLocalNotification('Objectif atteint', { body: 'Bravo' })
      expect(showNotification).toHaveBeenCalledWith('Objectif atteint', {
        icon: '/pwa-192x192.png',
        body: 'Bravo',
      })
      expect(FakeNotification.instances).toHaveLength(0)
    })

    it("l'icône par défaut ne remplace pas une icône fournie par l'appelant", async () => {
      FakeNotification.permission = 'granted'
      const showNotification = vi.fn().mockResolvedValue(undefined)
      stubServiceWorker(showNotification)
      const { showLocalNotification } = await import('./notifications')
      await showLocalNotification('Titre', { icon: '/autre-icone.png' })
      expect(showNotification).toHaveBeenCalledWith('Titre', { icon: '/autre-icone.png' })
    })

    it("retombe sur le constructeur Notification si aucun service worker n'est enregistré", async () => {
      FakeNotification.permission = 'granted'
      stubServiceWorker(vi.fn(), false)
      const { showLocalNotification } = await import('./notifications')
      await showLocalNotification('Titre')
      expect(FakeNotification.instances).toHaveLength(1)
      expect(FakeNotification.instances[0].title).toBe('Titre')
    })

    it("retombe sur le constructeur Notification si l'API service worker est absente", async () => {
      FakeNotification.permission = 'granted'
      Reflect.deleteProperty(navigator, 'serviceWorker')
      const { showLocalNotification } = await import('./notifications')
      await showLocalNotification('Titre')
      expect(FakeNotification.instances).toHaveLength(1)
    })

    it('échoue silencieusement si la notification système lève une erreur', async () => {
      FakeNotification.permission = 'granted'
      Reflect.deleteProperty(navigator, 'serviceWorker')
      vi.stubGlobal(
        'Notification',
        class {
          static permission: NotificationPermission = 'granted'
          constructor() {
            throw new Error('boom')
          }
        }
      )
      const { showLocalNotification } = await import('./notifications')
      await expect(showLocalNotification('Titre')).resolves.toBeUndefined()
    })
  })
})
