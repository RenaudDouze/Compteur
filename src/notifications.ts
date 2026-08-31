// Notifications système (API Notification du navigateur), en complément du
// toast in-app existant : utiles surtout quand l'onglet n'est pas au premier
// plan, là où le toast reste invisible. Ne fonctionnent que tant que l'app
// est ouverte quelque part (un onglet, même en arrière-plan) — pas de vrai
// push serveur qui réveillerait un appareil où l'app est totalement fermée
// (ça demanderait des clés VAPID et un endpoint d'abonnement côté worker,
// hors périmètre ici).

export type NotificationPermissionState = 'unsupported' | NotificationPermission

/** L'API Notification n'existe pas partout (ex: contexte non sécurisé,
 * certains navigateurs) : centralise la détection plutôt que de la répéter
 * à chaque appelant. */
export function isNotificationSupported(): boolean {
  return typeof window.Notification !== 'undefined'
}

export function getNotificationPermission(): NotificationPermissionState {
  if (!isNotificationSupported()) return 'unsupported'
  return Notification.permission
}

/** Demande la permission — n'a d'effet que si elle n'a encore jamais été
 * tranchée ('default') : la redemander après un refus ('denied') ne
 * re-déclenche pas la boîte de dialogue native (comportement navigateur),
 * autant l'expliciter ici plutôt que de laisser croire à l'appelant qu'un
 * nouveau clic pourrait changer quelque chose. */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isNotificationSupported()) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

/** Affiche une notification système, seulement si la permission est déjà
 * accordée et que l'onglet n'est pas déjà au premier plan (sinon le toast
 * in-app suffit, une notification système en plus ferait doublon). Passe par
 * le service worker déjà enregistré (PWA installée) quand il est disponible
 * — certains navigateurs mobiles (Chrome/Android notamment) refusent le
 * constructeur `Notification` direct en contexte PWA installée et exigent
 * `ServiceWorkerRegistration.showNotification`. Échoue silencieusement dans
 * tous les cas : jamais un pré-requis pour le reste de l'app. */
export async function showLocalNotification(title: string, options?: NotificationOptions): Promise<void> {
  if (!isNotificationSupported()) return
  if (Notification.permission !== 'granted') return
  if (document.visibilityState === 'visible') return
  const finalOptions: NotificationOptions = { icon: '/pwa-192x192.png', ...options }
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        await registration.showNotification(title, finalOptions)
        return
      }
    }
    new Notification(title, finalOptions)
  } catch {
    // Notification système indisponible/refusée à l'exécution (rare une
    // fois la permission déjà accordée) : le toast in-app reste le canal
    // principal, celle-ci n'est qu'un bonus.
  }
}
