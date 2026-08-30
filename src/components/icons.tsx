// Icônes de l'en-tête/menu : SVG dessinés à la main (comme le badge d'épingle
// dans CounterCard), plutôt qu'une bibliothèque externe — voir la discussion
// dans la session : un CDN casserait le fonctionnement hors-ligne (PWA), et
// pour ce volume d'icônes une dépendance npm n'apporterait rien qu'un SVG
// direct n'apporte déjà (déjà tree-shaké par construction, zéro Ko de trop).
// `aria-hidden` : le libellé accessible vit déjà sur le bouton parent
// (aria-label/title), l'icône ne doit pas être annoncée une seconde fois.

interface IconProps {
  className?: string
}

const BASE = { viewBox: '0 0 24 24', width: 18, height: 18, 'aria-hidden': true } as const
const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...BASE} {...STROKE} {...props}>
      <circle cx="10" cy="10" r="6.5" />
      <line x1="15" y1="15" x2="20.5" y2="20.5" />
    </svg>
  )
}

export function SunIcon(props: IconProps) {
  return (
    <svg {...BASE} {...STROKE} {...props}>
      <circle cx="12" cy="12" r="4.5" />
      <line x1="12" y1="2" x2="12" y2="4.5" />
      <line x1="12" y1="19.5" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4.5" y2="12" />
      <line x1="19.5" y1="12" x2="22" y2="12" />
      <line x1="4.9" y1="4.9" x2="6.6" y2="6.6" />
      <line x1="17.4" y1="17.4" x2="19.1" y2="19.1" />
      <line x1="4.9" y1="19.1" x2="6.6" y2="17.4" />
      <line x1="17.4" y1="6.6" x2="19.1" y2="4.9" />
    </svg>
  )
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props} fill="currentColor" stroke="none">
      <path d="M12.5 3a9 9 0 1 0 8.5 12.1A7 7 0 0 1 12.5 3z" />
    </svg>
  )
}

/** Thème "Auto" : un demi-disque plein sur un cercle, pour évoquer clair/sombre
 * à la fois plutôt qu'un choix précis. */
export function ThemeAutoIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth={1.8} />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function SyncIcon(props: IconProps) {
  return (
    <svg {...BASE} {...STROKE} {...props}>
      <path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.6" />
      <path d="M4 4v4.6h4.6" />
      <path d="M4 13a8 8 0 0 0 13.7 4.7L20 15.4" />
      <path d="M20 20v-4.6h-4.6" />
    </svg>
  )
}

export function FullscreenIcon(props: IconProps) {
  return (
    <svg {...BASE} {...STROKE} {...props}>
      <path d="M4 9V5a1 1 0 0 1 1-1h4" />
      <path d="M15 4h4a1 1 0 0 1 1 1v4" />
      <path d="M20 15v4a1 1 0 0 1-1 1h-4" />
      <path d="M9 20H5a1 1 0 0 1-1-1v-4" />
    </svg>
  )
}

/** Bac de réception ouvert : fait la paire avec ArchiveIcon (boîte fermée,
 * couvercle scellé) — en circulation vs rangé, plutôt qu'un dossier plus
 * abstrait. */
export function InboxIcon(props: IconProps) {
  return (
    <svg {...BASE} {...STROKE} {...props}>
      <path d="M5 12 6.6 5.3A1 1 0 0 1 7.57 4.5h8.86a1 1 0 0 1 .97.8L19 12" />
      <path d="M4 12h4.5l1.7 2.5h3.6L15.5 12H20" />
      <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
    </svg>
  )
}

export function ArchiveIcon(props: IconProps) {
  return (
    <svg {...BASE} {...STROKE} {...props}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M4 8v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <line x1="10" y1="13" x2="14" y2="13" />
    </svg>
  )
}

export function MoreIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props} fill="currentColor" stroke="none">
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </svg>
  )
}
