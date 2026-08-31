import type { Counter } from './types'

// Dimensions du visuel exporté (avant le doublement de résolution appliqué
// au rendu, voir `counterShareImageBlob`) : format proche d'une story
// (portrait), pratique à partager tel quel sur les réseaux.
const CARD_WIDTH = 640
const CARD_HEIGHT = 800
const ACCENT_HEIGHT = 10
const SPARKLINE_WIDTH = CARD_WIDTH - 160
const SPARKLINE_HEIGHT = 140
const SPARKLINE_X = 80
const SPARKLINE_Y = CARD_HEIGHT - 220

/** Échappe le texte inséré dans les nœuds/attributs du SVG généré : `name`
 * vient de l'utilisateur, un caractère `&`/`<` non échappé casserait le
 * XML et ferait échouer le chargement de toute l'image (pas un risque de
 * script — un SVG chargé comme image, jamais inséré dans le DOM, n'exécute
 * aucun script qu'il contiendrait). */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Chemin SVG (`<path>` d) d'une ligne brisée reliant `values` (au moins deux
 * points — voir l'appelant), mise à l'échelle dans un cadre `width`×`height`
 * (min → bas, max → haut). Values constantes (min === max) : ligne plate
 * plutôt qu'une division par zéro. */
function polylinePath(values: number[], width: number, height: number): string {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - ((v - min) / range) * height
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

/** Construit le visuel exporté sous forme de balisage SVG autonome (pas de
 * dépendance à l'affichage de l'app — le rendu doit rester identique quel
 * que soit le thème courant de qui l'exporte). Fonction pure : testable sans
 * navigateur, contrairement à `counterShareImageBlob` qui la rasterise. */
export function buildShareCardSvg(counter: Counter): string {
  const accent = counter.appearance.color
  const name = escapeXml(counter.name)
  const value = counter.count.toLocaleString('fr-FR')
  const target = counter.behavior.target
  const targetLine =
    target !== undefined
      ? `<text x="${CARD_WIDTH / 2}" y="440" text-anchor="middle" font-family="system-ui, sans-serif" font-size="28" fill="#64748b">objectif ${target.toLocaleString('fr-FR')}</text>`
      : ''

  const history = counter.history ?? []
  const sparkline =
    history.length >= 2
      ? `<g transform="translate(${SPARKLINE_X},${SPARKLINE_Y})">
           <path d="${polylinePath(
             history.map((p) => p.v),
             SPARKLINE_WIDTH,
             SPARKLINE_HEIGHT
           )}" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
         </g>`
      : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
    <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="#ffffff" />
    <rect width="${CARD_WIDTH}" height="${ACCENT_HEIGHT}" fill="${accent}" />
    <text x="${CARD_WIDTH / 2}" y="120" text-anchor="middle" font-family="system-ui, sans-serif" font-size="36" font-weight="700" fill="#0f172a">${name}</text>
    <text x="${CARD_WIDTH / 2}" y="330" text-anchor="middle" font-family="system-ui, sans-serif" font-size="220" font-weight="800" fill="${accent}">${value}</text>
    ${targetLine}
    ${sparkline}
    <text x="${CARD_WIDTH / 2}" y="${CARD_HEIGHT - 40}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="24" fill="#94a3b8">+1</text>
  </svg>`
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error())
    image.src = src
  })
}

// Rendu à 2x la résolution logique de la carte : un export net sur les
// écrans à forte densité de pixels (la plupart des téléphones), plutôt
// qu'un visuel flou une fois zoomé.
const EXPORT_SCALE = 2

/** Génère le visuel partageable d'un compteur en PNG. `null` si le canvas ou
 * le chargement de l'image intermédiaire échoue (contexte 2D indisponible,
 * SVG malformé...) — l'appelant doit alors renoncer au partage plutôt que de
 * planter. */
export async function counterShareImageBlob(counter: Counter): Promise<Blob | null> {
  const svg = buildShareCardSvg(counter)
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  try {
    const image = await loadImage(svgUrl)
    const canvas = document.createElement('canvas')
    canvas.width = CARD_WIDTH * EXPORT_SCALE
    canvas.height = CARD_HEIGHT * EXPORT_SCALE
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.scale(EXPORT_SCALE, EXPORT_SCALE)
    ctx.drawImage(image, 0, 0)
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  } catch {
    return null
  }
}
