import { Odometer } from './Odometer'
import type { DisplayStyle } from '../types'

interface CounterValueDisplayProps {
  value: number
  direction: 1 | -1
  style?: DisplayStyle
  // Progression vers la moyenne (count / oddsDenominator, plafonnée à 1) pour
  // le style "anneau". null quand aucune probabilité n'est définie.
  progress: number | null
}

function FlapValue({ value }: { value: number }) {
  return (
    <div className="value-flap">
      {value
        .toString()
        .split('')
        .map((char, i) => (
          <span className="value-flap-tile" key={i}>
            <span className="value-flap-char">{char}</span>
            <span className="value-flap-hinge" aria-hidden="true" />
          </span>
        ))}
    </div>
  )
}

function LcdValue({ value }: { value: number }) {
  const text = value.toString()
  return (
    <div className="value-lcd">
      <span className="value-lcd-led" aria-hidden="true" />
      <span className="value-lcd-ghost" aria-hidden="true">
        {'8'.repeat(text.length)}
      </span>
      <span className="value-lcd-digits">{text}</span>
    </div>
  )
}

// Segments allumés (a-g, cadran horaire classique) par caractère possible
// dans la valeur d'un compteur (chiffres et signe moins).
const SEGMENTS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgecd',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
}
const SEGMENT_KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g']

function SegmentDigit({ char }: { char: string }) {
  const on = SEGMENTS[char]
  return (
    <span className="value-segment-digit">
      {SEGMENT_KEYS.map((s) => (
        <i key={s} className={`value-segment value-segment--${s}${on.includes(s) ? ' is-on' : ''}`} />
      ))}
    </span>
  )
}

function Segment7Value({ value }: { value: number }) {
  return (
    <div className="value-segment7">
      {value
        .toString()
        .split('')
        .map((char, i) => (
          <SegmentDigit key={i} char={char} />
        ))}
    </div>
  )
}

function RingValue({ value, progress }: { value: number; progress: number | null }) {
  const circumference = 2 * Math.PI * 54
  return (
    <div className="value-ring">
      <svg viewBox="0 0 120 120" className="value-ring-svg" aria-hidden="true">
        <circle className="value-ring-track" cx="60" cy="60" r="54" />
        {progress !== null && (
          <circle
            className="value-ring-fill"
            cx="60"
            cy="60"
            r="54"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
          />
        )}
      </svg>
      <div className="value-ring-center">
        <span className="value-ring-number">{value}</span>
        {progress !== null && <span className="value-ring-pct">{Math.round(progress * 100)} %</span>}
      </div>
    </div>
  )
}

function EditorialValue({ value }: { value: number }) {
  return (
    <div className="value-editorial">
      <span className="value-editorial-number">{value}</span>
      <span className="value-editorial-rule" aria-hidden="true" />
    </div>
  )
}

function BadgeValue({ value }: { value: number }) {
  return (
    <div className="value-badge">
      <span className="value-badge-pill">{value}</span>
    </div>
  )
}

export function CounterValueDisplay({ value, direction, style, progress }: CounterValueDisplayProps) {
  switch (style) {
    case 'flap':
      return <FlapValue value={value} />
    case 'lcd':
      return <LcdValue value={value} />
    case 'segment7':
      return <Segment7Value value={value} />
    case 'ring':
      return <RingValue value={value} progress={progress} />
    case 'editorial':
      return <EditorialValue value={value} />
    case 'badge':
      return <BadgeValue value={value} />
    default:
      return <Odometer value={value} direction={direction} />
  }
}
