import type { HistoryPoint } from '../types'

const WIDTH = 240
const HEIGHT = 56
const PADDING = 6

interface SparklineProps {
  // Au moins 2 points : c'est à l'appelant de ne pas monter ce composant en
  // dessous (sinon rien à relier, division par zéro sur l'axe X).
  points: HistoryPoint[]
  color: string
}

export function Sparkline({ points, color }: SparklineProps) {
  const values = points.map((p) => p.v)
  const min = Math.min(...values)
  const max = Math.max(...values)
  // Évite une division par zéro quand la valeur n'a pas bougé (ligne plate).
  const range = max - min || 1

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (WIDTH - PADDING * 2) + PADDING
    const y = HEIGHT - PADDING - ((p.v - min) / range) * (HEIGHT - PADDING * 2)
    return [x, y] as const
  })

  const linePath = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
  const [firstX] = coords[0]
  const [lastX, lastY] = coords[coords.length - 1]
  const areaPath = `${linePath} L${lastX},${HEIGHT} L${firstX},${HEIGHT} Z`

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Évolution du compteur : de ${points[0].v} à ${points[points.length - 1].v}`}
    >
      <path d={areaPath} fill={color} fillOpacity={0.1} stroke="none" />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />
    </svg>
  )
}
