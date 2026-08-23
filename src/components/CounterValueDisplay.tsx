import { AnimatePresence, motion } from 'framer-motion'
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

// Chaque volet bascule indépendamment (comme un vrai panneau à volets) :
// l'ancien chiffre pivote vers le haut en sortant, le nouveau arrive du bas.
function FlapValue({ value }: { value: number }) {
  return (
    <div className="value-flap">
      {value
        .toString()
        .split('')
        .map((char, i) => (
          <span className="value-flap-tile" key={i}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={char}
                className="value-flap-char"
                initial={{ rotateX: -90, opacity: 0 }}
                animate={{ rotateX: 0, opacity: 1 }}
                exit={{ rotateX: 90, opacity: 0 }}
                transition={{ duration: 0.26, ease: 'easeInOut' }}
              >
                {char}
              </motion.span>
            </AnimatePresence>
            <span className="value-flap-hinge" aria-hidden="true" />
          </span>
        ))}
    </div>
  )
}

// Léger flash de luminosité à chaque changement, comme un rafraîchissement
// d'écran à cristaux liquides.
function LcdValue({ value }: { value: number }) {
  const text = value.toString()
  return (
    <div className="value-lcd">
      <span className="value-lcd-led" aria-hidden="true" />
      <span className="value-lcd-ghost" aria-hidden="true">
        {'8'.repeat(text.length)}
      </span>
      <motion.span
        key={text}
        className="value-lcd-digits"
        initial={{ opacity: 0.15, filter: 'brightness(2.4)' }}
        animate={{ opacity: 1, filter: 'brightness(1)' }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        {text}
      </motion.span>
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
  // Un caractère hors table (ex: notation exponentielle "1e+21" pour une
  // très grande valeur saisie manuellement) ne doit jamais planter l'affichage :
  // il s'affiche simplement comme un chiffre éteint plutôt que de faire
  // planter le rendu.
  const on = SEGMENTS[char] ?? ''
  return (
    <span className="value-segment-digit">
      {SEGMENT_KEYS.map((s) => (
        <i key={s} className={`value-segment value-segment--${s}${on.includes(s) ? ' is-on' : ''}`} />
      ))}
    </span>
  )
}

// Chaque chiffre qui change reçoit un bref sursaut de luminosité, comme un
// afficheur électronique qui se réactualise (le remontage par `key` ne se
// déclenche que sur les positions dont le caractère a réellement changé).
function Segment7Value({ value }: { value: number }) {
  return (
    <div className="value-segment7">
      {value
        .toString()
        .split('')
        .map((char, i) => (
          <motion.span
            key={`${i}-${char}`}
            className="value-segment7-flash"
            initial={{ filter: 'brightness(2.6)' }}
            animate={{ filter: 'brightness(1)' }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <SegmentDigit char={char} />
          </motion.span>
        ))}
    </div>
  )
}

// L'arc suit la progression avec un léger ressort, et le chiffre central
// fait un petit "pop" plutôt que le rebond générique des autres styles.
function RingValue({ value, progress }: { value: number; progress: number | null }) {
  const circumference = 2 * Math.PI * 54
  return (
    <div className="value-ring">
      <svg viewBox="0 0 120 120" className="value-ring-svg" aria-hidden="true">
        <circle className="value-ring-track" cx="60" cy="60" r="54" />
        {progress !== null && (
          <motion.circle
            className="value-ring-fill"
            cx="60"
            cy="60"
            r="54"
            strokeDasharray={circumference}
            initial={false}
            animate={{ strokeDashoffset: circumference * (1 - progress) }}
            transition={{ type: 'spring', stiffness: 120, damping: 22 }}
          />
        )}
      </svg>
      <div className="value-ring-center">
        <motion.span
          key={value}
          className="value-ring-number"
          initial={{ scale: 0.8, opacity: 0.3 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {value}
        </motion.span>
        {progress !== null && <span className="value-ring-pct">{Math.round(progress * 100)} %</span>}
      </div>
    </div>
  )
}

// Fondu discret avec un léger glissement vertical : pas de rebond ni
// d'ombre, pour rester fidèle au parti pris épuré de ce style.
function EditorialValue({ value }: { value: number }) {
  return (
    <div className="value-editorial">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          className="value-editorial-number"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.32, ease: 'easeOut' }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
      <span className="value-editorial-rule" aria-hidden="true" />
    </div>
  )
}

// Rebond élastique plus prononcé que le style par défaut, avec une légère
// rotation : assume le ton ludique de la pastille.
function BadgeValue({ value }: { value: number }) {
  return (
    <div className="value-badge">
      <motion.span
        key={value}
        className="value-badge-pill"
        initial={{ scale: 0.6, rotate: -8 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 12 }}
      >
        {value}
      </motion.span>
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
