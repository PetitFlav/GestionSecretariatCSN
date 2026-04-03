import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16
const PREFIX = 'enc:'

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error('ENCRYPTION_KEY manquante dans les variables d\'environnement')
  // La clé doit faire 32 bytes — on hash en SHA-256 pour normaliser
  return crypto.createHash('sha256').update(key).digest()
}

/**
 * Chiffre une valeur string → retourne "enc:<iv>:<tag>:<ciphertext>" en base64
 * Retourne null si la valeur est null/undefined/vide
 */
export function encrypt(value: string | null | undefined): string | null {
  if (!value) return null

  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  // Format : enc:<iv_hex>:<tag_hex>:<data_base64>
  return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('base64')}`
}

/**
 * Déchiffre une valeur "enc:<iv>:<tag>:<ciphertext>" → string original
 * Retourne null si la valeur est null ou non chiffrée
 */
export function decrypt(value: string | null | undefined): string | null {
  if (!value) return null
  if (!value.startsWith(PREFIX)) return value // valeur non chiffrée, retour direct

  const key = getKey()
  const parts = value.slice(PREFIX.length).split(':')
  if (parts.length !== 3) return null

  try {
    const iv = Buffer.from(parts[0], 'hex')
    const tag = Buffer.from(parts[1], 'hex')
    const encrypted = Buffer.from(parts[2], 'base64')

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    return decipher.update(encrypted).toString('utf8') + decipher.final('utf8')
  } catch {
    return null
  }
}

/**
 * Nettoie un nom/prénom/ville pour le STOCKAGE en base :
 * - Supprime les diacritiques (é→E, ç→C, à→A, ë→E, etc.)
 * - Majuscules
 * - Tirets et apostrophes → espace
 * - Espaces multiples → un seul
 * Utilisé à l'import pour normaliser les données avant insertion.
 */
export function cleanName(value: string): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')    // diacritiques
    .toUpperCase()
    .replace(/[-'\u2019\u2018\u02bc]/g, ' ') // tirets et apostrophes → espace
    .replace(/[^A-Z ]/g, '')              // garder seulement lettres et espaces
    .replace(/\s+/g, ' ')                // espaces multiples → un seul
    .trim()
}

/**
 * Normalise un nom/prénom pour la comparaison :
 * - Supprime les diacritiques (é→e, ç→c, à→a, etc.)
 * - Minuscules
 * - Remplace tirets et apostrophes (toutes variantes) par espace
 * - Supprime tout sauf lettres et espaces
 * - Normalise les espaces multiples
 */
export function normalizeNom(value: string): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // diacritiques
    .toLowerCase()
    .replace(/[-'\u2019\u2018\u02bc]/g, ' ') // tirets et apostrophes → espace
    .replace(/[^a-z ]/g, '')             // garder seulement lettres et espaces
    .replace(/\s+/g, ' ')               // espaces multiples → un seul
    .trim()
}

/**
 * Génère toutes les variantes d'une clé "nom|prenom" :
 * - Variantes tiret/espace (JEAN-PAUL ↔ JEAN PAUL)
 */
function variantesKey(key: string): Set<string> {
  const result = new Set<string>([key])
  const parts = key.split('|')

  for (let pi = 0; pi < parts.length; pi++) {
    const words = parts[pi].split(' ')
    const n = words.length
    if (n < 2) continue

    const totalMasks = Math.pow(2, n - 1)
    for (let mask = 1; mask < totalMasks; mask++) {
      let newPart = words[0]
      for (let bit = 0; bit < n - 1; bit++) {
        const sep = (mask >> bit) & 1 ? '-' : ' '
        newPart += sep + words[bit + 1]
      }
      const newParts = [...parts]
      newParts[pi] = newPart
      result.add(newParts.join('|'))
    }
  }
  return result
}

/**
 * Clé avec les mots de chaque partie triés alphabétiquement.
 * Permet de matcher CORMIER COURBET ↔ COURBET CORMIER.
 */
function sortedKey(key: string): string {
  return key.split('|')
    .map(part => part.split(' ').sort().join(' '))
    .join('|')
}

/**
 * Variantes avec mots concaténés : LA TOUR ↔ LATOUR
 */
function concatVariants(key: string): Set<string> {
  const result = new Set<string>([key])
  const parts = key.split('|')
  for (let pi = 0; pi < parts.length; pi++) {
    const words = parts[pi].split(' ')
    const n = words.length
    if (n < 2) continue
    for (let i = 0; i < n - 1; i++) {
      const newWords = [...words.slice(0, i), words[i] + words[i + 1], ...words.slice(i + 2)]
      const newParts = [...parts]
      newParts[pi] = newWords.join(' ')
      result.add(newParts.join('|'))
    }
  }
  return result
}

/**
 * Compare deux clés normalisées avec plusieurs stratégies :
 * 1. Égalité directe
 * 2. Variantes tiret/espace (JEAN-PAUL ↔ JEAN PAUL)
 * 3. Ordre des mots du nom inversé (CORMIER COURBET ↔ COURBET CORMIER)
 * 4. Mots concaténés (LA TOUR ↔ LATOUR, CONTAMINE DE LATOUR ↔ CONTAMINE DE LA TOUR)
 */
export function keysMatch(key1: string, key2: string): boolean {
  if (key1 === key2) return true

  // 1. Variantes tiret/espace
  const v1 = variantesKey(key1)
  const v2 = variantesKey(key2)
  for (const k of v1) { if (v2.has(k)) return true }

  // 2. Ordre des mots du nom inversé
  if (sortedKey(key1) === sortedKey(key2)) return true

  // 3. Mots concaténés (LA TOUR ↔ LATOUR)
  const c1 = concatVariants(key1)
  const c2 = concatVariants(key2)
  for (const k of c1) { if (c2.has(k) || v2.has(k)) return true }
  for (const k of c2) { if (v1.has(k)) return true }

  return false
}

/**
 * Crée la clé de jointure normalisée pour un nom+prénom
 */
export function makeKey(nom: string, prenom: string): string {
  return `${normalizeNom(nom)}|${normalizeNom(prenom)}`
}

/**
 * Formate une date Excel (datetime ou string) en JJ/MM/AAAA
 */
export function formatDate(value: unknown): string | null {
  if (!value) return null

  if (value instanceof Date) {
    const d = value.getDate().toString().padStart(2, '0')
    const m = (value.getMonth() + 1).toString().padStart(2, '0')
    const y = value.getFullYear()
    return `${d}/${m}/${y}`
  }

  if (typeof value === 'string') {
    // Déjà au format JJ/MM/AAAA
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value
    // Format AAAA-MM-JJ
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  }

  return null
}
