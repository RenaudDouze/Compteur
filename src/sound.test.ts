import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class FakeParam {
  calls: Array<{ method: string; value: number; time: number }> = []
  setValueAtTime(value: number, time: number) {
    this.calls.push({ method: 'setValueAtTime', value, time })
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.calls.push({ method: 'exponentialRampToValueAtTime', value, time })
  }
}

class FakeOscillator {
  type = ''
  frequency = new FakeParam()
  connectedTo: unknown[] = []
  started = false
  stopped = false
  startTime: number | null = null
  stopTime: number | null = null
  connect(node: unknown) {
    this.connectedTo.push(node)
  }
  start(time: number) {
    this.started = true
    this.startTime = time
  }
  stop(time: number) {
    this.stopped = true
    this.stopTime = time
  }
}

class FakeGain {
  gain = new FakeParam()
  connectedTo: unknown[] = []
  connect(node: unknown) {
    this.connectedTo.push(node)
  }
}

// Enregistrée comme une vraie classe (et non `vi.fn(() => ...)`) : le module
// testé fait `new Ctor()`, et un mock vitest utilisé comme constructeur ne
// se comporte pas de façon fiable selon l'implémentation — l'erreur qui en
// résulterait serait de toute façon avalée silencieusement par le
// `try/catch` du module, masquant le vrai problème.
class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  state: 'running' | 'suspended' = 'running'
  currentTime = 0
  destination = { id: 'destination' }
  resumeCalls = 0
  oscillators: FakeOscillator[] = []
  gains: FakeGain[] = []

  constructor() {
    FakeAudioContext.instances.push(this)
  }

  createOscillator() {
    const osc = new FakeOscillator()
    this.oscillators.push(osc)
    return osc
  }

  createGain() {
    const gain = new FakeGain()
    this.gains.push(gain)
    return gain
  }

  resume() {
    this.resumeCalls++
    this.state = 'running'
    return Promise.resolve()
  }
}

// Le module garde un AudioContext en singleton (variable de module) : on le
// recharge à neuf à chaque test pour ne pas laisser un contexte simulé d'un
// test précédent fausser l'assertion "un seul contexte créé" d'un autre.
async function loadPlayIncrementSound() {
  const mod = await import('./sound')
  return mod.playIncrementSound
}

describe('playIncrementSound', () => {
  beforeEach(() => {
    vi.resetModules()
    FakeAudioContext.instances = []
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ne plante pas si Web Audio est indisponible', async () => {
    vi.stubGlobal('AudioContext', undefined)
    const playIncrementSound = await loadPlayIncrementSound()
    expect(() => playIncrementSound()).not.toThrow()
  })

  it('crée un oscillateur relié à un gain relié à la sortie', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const playIncrementSound = await loadPlayIncrementSound()
    playIncrementSound()
    const fake = FakeAudioContext.instances[0]
    expect(fake.oscillators).toHaveLength(1)
    expect(fake.gains).toHaveLength(1)
    expect(fake.oscillators[0].connectedTo).toEqual([fake.gains[0]])
    expect(fake.gains[0].connectedTo).toEqual([fake.destination])
  })

  it("démarre puis arrête l'oscillateur", async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const playIncrementSound = await loadPlayIncrementSound()
    playIncrementSound()
    const fake = FakeAudioContext.instances[0]
    expect(fake.oscillators[0].started).toBe(true)
    expect(fake.oscillators[0].stopped).toBe(true)
  })

  it("programme un tock triangulaire à hauteur fixe, avec une enveloppe de volume qui s'éteint avant l'arrêt", async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const playIncrementSound = await loadPlayIncrementSound()
    playIncrementSound()
    const fake = FakeAudioContext.instances[0]
    const osc = fake.oscillators[0]
    const gain = fake.gains[0]

    expect(osc.type).toBe('triangle')
    // Pas de rampe de fréquence : une hauteur fixe évite l'effet "bip de
    // notification" d'un son qui monte en pitch.
    expect(osc.frequency.calls).toEqual([{ method: 'setValueAtTime', value: 220, time: 0 }])
    expect(gain.gain.calls).toEqual([
      { method: 'setValueAtTime', value: 0.0001, time: 0 },
      { method: 'exponentialRampToValueAtTime', value: 0.6, time: 0.002 },
      { method: 'exponentialRampToValueAtTime', value: 0.0001, time: 0.05 },
    ])
    expect(osc.startTime).toBe(0)
    // L'oscillateur s'arrête après que le volume soit déjà retombé à
    // (quasi) zéro, pour ne pas couper le son sec en pleine émission.
    expect(osc.stopTime).toBeGreaterThan(gain.gain.calls[2].time)
    expect(osc.stopTime).toBe(0.06)
  })

  it("reprend le contexte s'il est suspendu", async () => {
    class SuspendedAudioContext extends FakeAudioContext {
      state: 'running' | 'suspended' = 'suspended'
    }
    vi.stubGlobal('AudioContext', SuspendedAudioContext)
    const playIncrementSound = await loadPlayIncrementSound()
    playIncrementSound()
    const fake = FakeAudioContext.instances[0]
    expect(fake.resumeCalls).toBe(1)
  })

  it("ne tente pas de reprendre le contexte s'il tourne déjà", async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const playIncrementSound = await loadPlayIncrementSound()
    playIncrementSound()
    const fake = FakeAudioContext.instances[0]
    expect(fake.resumeCalls).toBe(0)
  })

  it('réutilise le même contexte audio entre deux appels', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const playIncrementSound = await loadPlayIncrementSound()
    playIncrementSound()
    playIncrementSound()
    expect(FakeAudioContext.instances).toHaveLength(1)
  })

  it('se rabat sur webkitAudioContext si AudioContext est indisponible', async () => {
    vi.stubGlobal('AudioContext', undefined)
    vi.stubGlobal('webkitAudioContext', FakeAudioContext)
    const playIncrementSound = await loadPlayIncrementSound()
    playIncrementSound()
    expect(FakeAudioContext.instances[0].oscillators).toHaveLength(1)
  })

  it('échoue silencieusement si une erreur survient pendant la lecture', async () => {
    const original = FakeAudioContext.prototype.createOscillator
    FakeAudioContext.prototype.createOscillator = () => {
      throw new Error('boom')
    }
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const playIncrementSound = await loadPlayIncrementSound()
    try {
      expect(() => playIncrementSound()).not.toThrow()
    } finally {
      FakeAudioContext.prototype.createOscillator = original
    }
  })
})
