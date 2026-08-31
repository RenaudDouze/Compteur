// Petit "tick" de confirmation à l'incrémentation, synthétisé via Web Audio
// (pas de fichier audio à charger/héberger). Un seul AudioContext est créé
// et réutilisé : en créer un par appel est coûteux et certains navigateurs
// limitent le nombre de contextes simultanés.
let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (audioContext) return audioContext
  // `Ctor` peut être `undefined` si Web Audio n'est pas supporté (aucun des
  // deux constructeurs n'existe) : volontairement non gardé ici, le
  // `try/catch` de l'appelant traite cette absence exactement comme
  // n'importe quel autre échec de l'API Web Audio, sans dupliquer la logique.
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  audioContext = new (Ctor as typeof AudioContext)()
  return audioContext
}

/** Joue un bref "tock" mécanique (comme un compteur à main) à une hauteur
 * fixe — pas de montée de fréquence, pour ne pas évoquer un bip de
 * notification. Échoue silencieusement si l'API Web Audio est indisponible
 * ou bloquée (ex: contexte encore suspendu faute d'interaction
 * utilisateur) : le son est un agrément, jamais un pré-requis. */
function playTone(frequency: number) {
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') void ctx.resume()

    const now = ctx.currentTime
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(frequency, now)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.6, now + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.06)
  } catch {
    // API Web Audio indisponible/bloquée : pas de son, pas d'erreur bloquante.
  }
}

export function playIncrementSound() {
  playTone(220)
}

/** Une quarte juste plus bas que l'incrément (220 * 3/4 = 165) : un
 * intervalle musical net, assez distinct à l'oreille pour se reconnaître
 * comme "l'inverse" du tock d'incrément plutôt qu'une simple redite. */
export function playDecrementSound() {
  playTone(165)
}
