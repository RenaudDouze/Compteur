import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, Reorder } from 'framer-motion'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useSystemDarkMode } from './hooks/useSystemDarkMode'
import { CounterCard } from './components/CounterCard'
import { SyncPanel } from './components/SyncPanel'
import { decodeCountersFromParam } from './sync'
import { makeId } from './id'
import { COLORS, pickColor } from './colors'
import type { Counter } from './types'
import './App.css'

const UNDO_TIMEOUT_MS = 5000

type ThemePreference = 'system' | 'light' | 'dark'

const THEME_ICON: Record<ThemePreference, string> = { system: '🌓', light: '☀️', dark: '🌙' }
const THEME_LABEL: Record<ThemePreference, string> = { system: 'Auto', light: 'Clair', dark: 'Sombre' }
const NEXT_THEME: Record<ThemePreference, ThemePreference> = { system: 'light', light: 'dark', dark: 'system' }

export default function App() {
  const [counters, setCounters] = useLocalStorage<Counter[]>('compteur.counters.v1', [])
  const [syncOpen, setSyncOpen] = useState(false)
  const [undo, setUndo] = useState<{ label: string; counters: Counter[] } | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const [themePreference, setThemePreference] = useLocalStorage<ThemePreference>('compteur.theme.v1', 'system')
  const systemDark = useSystemDarkMode()
  const activeTheme = themePreference === 'system' ? (systemDark ? 'dark' : 'light') : themePreference

  // Applique le thème au document (déjà posé une première fois par le script
  // inline de index.html, pour éviter un flash) et adapte la couleur de la
  // barre de statut du navigateur/PWA en conséquence.
  useEffect(() => {
    document.documentElement.dataset.theme = activeTheme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', activeTheme === 'dark' ? '#0f172a' : '#f8fafc')
  }, [activeTheme])

  // Garde un instantané des compteurs avant une action destructrice (ou
  // difficile à corriger à la main), pour permettre de l'annuler pendant
  // quelques secondes via le message qui apparaît en bas d'écran.
  const pushUndo = (label: string) => {
    setUndo({ label, counters })
    clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_TIMEOUT_MS)
  }

  // N'est rendu accessible que via le bouton du message d'annulation, qui
  // n'existe dans le DOM que lorsque `undo` est déjà défini.
  const handleUndo = () => {
    setCounters(undo!.counters)
    setUndo(null)
    clearTimeout(undoTimer.current)
  }

  // Import automatique si l'app est ouverte via un lien de partage (?import=...).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const payload = params.get('import')
    if (!payload) return

    const imported = decodeCountersFromParam(payload)
    const url = new URL(window.location.href)
    url.searchParams.delete('import')
    window.history.replaceState({}, '', url.toString())

    if (!imported || imported.length === 0) return

    setCounters((prev) => {
      if (prev.length === 0) return imported
      const replace = window.confirm(
        `Importer ${imported.length} compteur(s) partagé(s) ?\n\nOK pour remplacer tes ${prev.length} compteur(s) actuel(s), Annuler pour les ajouter à la suite.`
      )
      return replace ? imported : [...prev, ...imported]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addCounter = () => {
    const newCounter: Counter = {
      id: makeId(),
      name: `Compteur ${counters.length + 1}`,
      count: 0,
      color: pickColor(counters.length),
      createdAt: Date.now(),
    }
    setCounters((prev) => [...prev, newCounter])
  }

  // Action rapide depuis un raccourci de l'app installée (?action=new|sync),
  // déclarés dans le manifest PWA (voir vite.config.ts).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const action = params.get('action')
    if (!action) return

    const url = new URL(window.location.href)
    url.searchParams.delete('action')
    window.history.replaceState({}, '', url.toString())

    if (action === 'new') addCounter()
    if (action === 'sync') setSyncOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateCount = (id: string, delta: number) => {
    setCounters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, count: c.count + delta } : c))
    )
  }

  const setCount = (id: string, count: number) => {
    const target = counters.find((c) => c.id === id)!
    if (target.count !== count) pushUndo(`Valeur de « ${target.name} » modifiée`)
    setCounters((prev) => prev.map((c) => (c.id === id ? { ...c, count } : c)))
  }

  const renameCounter = (id: string, name: string) => {
    setCounters((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)))
  }

  const setOdds = (id: string, oddsDenominator: number | undefined) => {
    setCounters((prev) => prev.map((c) => (c.id === id ? { ...c, oddsDenominator } : c)))
  }

  const setStartDate = (id: string, startDate: string | undefined) => {
    setCounters((prev) => prev.map((c) => (c.id === id ? { ...c, startDate } : c)))
  }

  const setBackgroundImage = (id: string, backgroundImageUrl: string | undefined) => {
    setCounters((prev) => prev.map((c) => (c.id === id ? { ...c, backgroundImageUrl } : c)))
  }

  const setColor = (id: string, color: string) => {
    setCounters((prev) => prev.map((c) => (c.id === id ? { ...c, color } : c)))
  }

  const setStep = (id: string, step: number | undefined) => {
    setCounters((prev) => prev.map((c) => (c.id === id ? { ...c, step } : c)))
  }

  const deleteCounter = (id: string) => {
    const target = counters.find((c) => c.id === id)!
    pushUndo(`Compteur « ${target.name} » supprimé`)
    setCounters((prev) => prev.filter((c) => c.id !== id))
  }

  const handleImport = (imported: Counter[], mode: 'replace' | 'merge') => {
    setCounters((prev) => (mode === 'replace' ? imported : [...prev, ...imported]))
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Compteur</h1>
        <div className="app-header-actions">
          <button
            className="add-btn icon-btn"
            onClick={() => setThemePreference(NEXT_THEME[themePreference])}
            aria-label={`Thème : ${THEME_LABEL[themePreference]}`}
          >
            {THEME_ICON[themePreference]}
          </button>
          <button className="add-btn icon-btn" onClick={() => setSyncOpen(true)} aria-label="Synchroniser">
            ⇄
          </button>
          <button className="add-btn" onClick={addCounter}>
            + Nouveau compteur
          </button>
        </div>
      </header>

      {counters.length === 0 ? (
        <div className="empty-state">
          <p>Aucun compteur pour l'instant.</p>
          <button className="add-btn large" onClick={addCounter}>
            Créer mon premier compteur
          </button>
        </div>
      ) : (
        <Reorder.Group
          as="div"
          axis="y"
          values={counters}
          onReorder={setCounters}
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
                colors={COLORS}
                onChange={(delta) => updateCount(counter.id, delta)}
                onSetCount={(count) => setCount(counter.id, count)}
                onRename={(name) => renameCounter(counter.id, name)}
                onSetOdds={(denominator) => setOdds(counter.id, denominator)}
                onSetStartDate={(date) => setStartDate(counter.id, date)}
                onSetBackgroundImage={(url) => setBackgroundImage(counter.id, url)}
                onSetColor={(color) => setColor(counter.id, color)}
                onSetStep={(step) => setStep(counter.id, step)}
                onDelete={() => deleteCounter(counter.id)}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>
      )}

      {syncOpen && (
        <SyncPanel counters={counters} onClose={() => setSyncOpen(false)} onImport={handleImport} />
      )}

      {undo && (
        <div className="undo-toast" role="status">
          <span>{undo.label}</span>
          <button onClick={handleUndo}>Annuler</button>
        </div>
      )}
    </div>
  )
}
