import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, Reorder } from 'framer-motion'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useSystemDarkMode } from './hooks/useSystemDarkMode'
import { CounterCard } from './components/CounterCard'
import { SyncPanel } from './components/SyncPanel'
import { decodeCountersFromParam } from './sync'
import { appendHistoryPoint } from './history'
import { makeId } from './id'
import { COLORS, pickColor } from './colors'
import type { Counter, DisplayStyle } from './types'
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

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const closeSearch = () => {
    setSearchOpen(false)
    setSearchQuery('')
  }
  const matchesSearch = (c: Counter) => {
    const query = searchQuery.trim().toLowerCase()
    return query === '' || c.name.toLowerCase().includes(query)
  }

  // Bascule l'ensemble de la liste (archivés masqués par défaut) ; la
  // recherche filtre ensuite par nom à l'intérieur de la vue active.
  const [archiveView, setArchiveView] = useState<'active' | 'archived'>('active')
  const archivedCount = counters.filter((c) => c.archived).length
  const filteredCounters = counters.filter(
    (c) => (archiveView === 'archived' ? !!c.archived : !c.archived) && matchesSearch(c)
  )

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
      history: appendHistoryPoint(undefined, 0),
    }
    setCounters((prev) => [...prev, newCounter])
    // Sinon le nouveau compteur atterrit hors champ si on était sur l'onglet
    // Archivés, sans indice visible pour l'utilisateur.
    setArchiveView('active')
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
      prev.map((c) =>
        c.id === id ? { ...c, count: c.count + delta, history: appendHistoryPoint(c.history, c.count + delta) } : c
      )
    )
  }

  const setCount = (id: string, count: number) => {
    const target = counters.find((c) => c.id === id)!
    if (target.count !== count) pushUndo(`Valeur de « ${target.name} » modifiée`)
    setCounters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, count, history: appendHistoryPoint(c.history, count) } : c))
    )
  }

  const renameCounter = (id: string, name: string) => {
    setCounters((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)))
  }

  const setOdds = (id: string, oddsDenominator: number | undefined) => {
    setCounters((prev) => prev.map((c) => (c.id === id ? { ...c, oddsDenominator } : c)))
  }

  const setTarget = (id: string, target: number | undefined) => {
    setCounters((prev) => prev.map((c) => (c.id === id ? { ...c, target } : c)))
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

  const setDisplayStyle = (id: string, displayStyle: DisplayStyle | undefined) => {
    setCounters((prev) => prev.map((c) => (c.id === id ? { ...c, displayStyle } : c)))
  }

  const deleteCounter = (id: string) => {
    const target = counters.find((c) => c.id === id)!
    pushUndo(`Compteur « ${target.name} » supprimé`)
    setCounters((prev) => prev.filter((c) => c.id !== id))
  }

  // Reprend l'apparence et la configuration du compteur source (couleur,
  // style, pas, probabilité, objectif, image de fond), mais repart de zéro :
  // nouvel id, compte et historique vierges, pas de date de début figée. Un
  // compteur archivé ne doit pas produire une copie elle-même déjà archivée.
  const duplicateCounter = (id: string) => {
    const source = counters.find((c) => c.id === id)!
    const copy: Counter = {
      ...source,
      id: makeId(),
      name: `${source.name} (copie)`,
      count: 0,
      createdAt: Date.now(),
      startDate: undefined,
      history: appendHistoryPoint(undefined, 0),
      archived: undefined,
    }
    setCounters((prev) => [...prev, copy])
  }

  const toggleArchive = (id: string) => {
    setCounters((prev) => prev.map((c) => (c.id === id ? { ...c, archived: !c.archived } : c)))
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
          {counters.length > 0 && (
            <button
              className="add-btn icon-btn"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Rechercher"
            >
              🔍
            </button>
          )}
          <button className="add-btn icon-btn" onClick={() => setSyncOpen(true)} aria-label="Synchroniser">
            ⇄
          </button>
          <button className="add-btn" onClick={addCounter}>
            + Nouveau compteur
          </button>
        </div>
      </header>

      {counters.length > 0 && (
        <div className="archive-toggle" role="tablist" aria-label="Filtrer par statut">
          <button
            role="tab"
            aria-selected={archiveView === 'active'}
            className={`archive-toggle-btn${archiveView === 'active' ? ' active' : ''}`}
            onClick={() => setArchiveView('active')}
          >
            Actifs
          </button>
          <button
            role="tab"
            aria-selected={archiveView === 'archived'}
            className={`archive-toggle-btn${archiveView === 'archived' ? ' active' : ''}`}
            onClick={() => setArchiveView('archived')}
          >
            Archivés{archivedCount > 0 ? ` (${archivedCount})` : ''}
          </button>
        </div>
      )}

      {searchOpen && counters.length > 0 && (
        <div className="search-bar">
          <input
            autoFocus
            type="text"
            className="modal-input search-input"
            placeholder="Rechercher un compteur…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeSearch()
            }}
          />
          <button className="modal-close" onClick={closeSearch} aria-label="Fermer la recherche">
            ✕
          </button>
        </div>
      )}

      {filteredCounters.length === 0 ? (
        <div className="empty-state">
          {counters.length === 0 ? (
            <>
              <p>Aucun compteur pour l'instant.</p>
              <button className="add-btn large" onClick={addCounter}>
                Créer mon premier compteur
              </button>
            </>
          ) : searchQuery.trim() !== '' ? (
            <p>Aucun compteur ne correspond à « {searchQuery.trim()} ».</p>
          ) : archiveView === 'archived' ? (
            <p>Aucun compteur archivé.</p>
          ) : (
            <p>Tous tes compteurs sont archivés.</p>
          )}
        </div>
      ) : (
        <Reorder.Group
          as="div"
          axis="y"
          values={filteredCounters}
          onReorder={setCounters}
          className={`counter-grid ${
            filteredCounters.length === 1
              ? 'counter-grid--solo'
              : filteredCounters.length === 2
                ? 'counter-grid--duo'
                : 'counter-grid--pack'
          }`}
        >
          <AnimatePresence mode="popLayout">
            {filteredCounters.map((counter) => (
              <CounterCard
                key={counter.id}
                counter={counter}
                fill={filteredCounters.length <= 2}
                draggable={searchQuery.trim() === '' && filteredCounters.length === counters.length}
                colors={COLORS}
                onChange={(delta) => updateCount(counter.id, delta)}
                onSetCount={(count) => setCount(counter.id, count)}
                onRename={(name) => renameCounter(counter.id, name)}
                onSetOdds={(denominator) => setOdds(counter.id, denominator)}
                onSetTarget={(target) => setTarget(counter.id, target)}
                onSetStartDate={(date) => setStartDate(counter.id, date)}
                onSetBackgroundImage={(url) => setBackgroundImage(counter.id, url)}
                onSetColor={(color) => setColor(counter.id, color)}
                onSetStep={(step) => setStep(counter.id, step)}
                onSetDisplayStyle={(style) => setDisplayStyle(counter.id, style)}
                onDuplicate={() => duplicateCounter(counter.id)}
                onToggleArchive={() => toggleArchive(counter.id)}
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
