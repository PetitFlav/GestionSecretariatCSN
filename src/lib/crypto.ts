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
 * Normalise un nom/prénom pour la comparaison (sans accents, minuscules, sans espaces multiples)
 */
export function normalizeNom(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // supprime les diacritiques
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
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
