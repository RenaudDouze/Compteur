// Alphabet volontairement privé des caractères ambigus à l'oral/à l'écran
// (0/O, 1/I/L, U/V) : un code se lit et se retape à la main sur un autre
// appareil, la moindre confusion oblige à tout recommencer.
const ALPHABET = 'ABCDEFGHJKMNPQRSTWXYZ23456789'
const CODE_LENGTH = 8

// Plus grand multiple de la taille de l'alphabet sous 256 : rejeter les
// octets au-delà (échantillonnage par rejet) évite le léger biais qu'un
// simple modulo introduirait (256 n'est pas un multiple de 29).
const REJECTION_THRESHOLD = 256 - (256 % ALPHABET.length)

/** Génère un code de synchronisation aléatoire (8 caractères, sans tiret).
 * Ce code est le seul secret protégeant les compteurs d'un utilisateur
 * (aucune autre authentification, voir index.ts) : `crypto.getRandomValues`
 * plutôt que `Math.random`, qui n'offre aucune garantie cryptographique. */
export function generateSyncCode(): string {
  let code = ''
  const byte = new Uint8Array(1)
  while (code.length < CODE_LENGTH) {
    crypto.getRandomValues(byte)
    if (byte[0] >= REJECTION_THRESHOLD) continue
    code += ALPHABET[byte[0] % ALPHABET.length]
  }
  return code
}

/** Met un code saisi à la main (espaces, tirets, minuscules) au format
 * canonique utilisé comme clé de stockage. */
export function normalizeSyncCode(raw: string): string {
  // Un remplacement global retire déjà les espaces/tirets en tête et en
  // queue : un `.trim()` préalable n'apporterait rien d'observable.
  return raw.toUpperCase().replace(/[\s-]/g, '')
}

/** Un code normalisé valide fait exactement 8 caractères de l'alphabet
 * autorisé (après normalisation, donc lettres majuscules et chiffres). */
export function isValidSyncCode(code: string): boolean {
  return new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`).test(code)
}
