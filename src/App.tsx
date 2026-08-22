import { AnimatePresence, motion } from 'framer-motion'
import { useLocalStorage } from './hooks/useLocalStorage'
import { CounterCard } from './components/CounterCard'
import type { Counter } from './types'
import './App.css'

const COLORS = [
  '#2563eb', // bleu
  '#7c3aed', // violet
  '#0d9488', // sarcelle
  '#db2777', // fuchsia
  '#16a34a', // vert
  '#4f46e5', // indigo
  '#0891b2', // cyan
  '#9333ea', // pourpre
]

function pickColor(existing: Counter[]) {
  return COLORS[existing.length % COLORS.length]
}

function makeId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function App() {
  const [counters, setCounters] = useLocalStorage<Counter[]>('compteur.counters.v1', [])

  const addCounter = () => {
    const newCounter: Counter = {
      id: makeId(),
      name: `Compteur ${counters.length + 1}`,
      count: 0,
      color: pickColor(counters),
      createdAt: Date.now(),
    }
    setCounters((prev) => [...prev, newCounter])
  }

  const updateCount = (id: string, delta: number) => {
    setCounters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, count: c.count + delta } : c))
    )
  }

  const renameCounter = (id: string, name: string) => {
    setCounters((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)))
  }

  const setOdds = (id: string, oddsDenominator: number | undefined) => {
    setCounters((prev) => prev.map((c) => (c.id === id ? { ...c, oddsDenominator } : c)))
  }

  const deleteCounter = (id: string) => {
    setCounters((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Compteur</h1>
        <button className="add-btn" onClick={addCounter}>
          + Nouveau compteur
        </button>
      </header>

      {counters.length === 0 ? (
        <div className="empty-state">
          <p>Aucun compteur pour l'instant.</p>
          <button className="add-btn large" onClick={addCounter}>
            Créer mon premier compteur
          </button>
        </div>
      ) : (
        <motion.div
          layout
          className={`counter-grid ${
            counters.length === 1
              ? 'counter-grid--solo'
              : counters.length === 2
                ? 'counter-grid--duo'
                : 'counter-grid--pack'
          }`}
        >
          <AnimatePresence mode="popLayout">
            {counters.map((counter) => (
              <CounterCard
                key={counter.id}
                counter={counter}
                fill={counters.length <= 2}
                onChange={(delta) => updateCount(counter.id, delta)}
                onRename={(name) => renameCounter(counter.id, name)}
                onSetOdds={(denominator) => setOdds(counter.id, denominator)}
                onDelete={() => deleteCounter(counter.id)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
