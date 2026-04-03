import * as XLSX from 'xlsx'
import { normalizeNom, formatDate } from '@/lib/crypto'

export interface MembreRow {
  nom: string
  prenom: string
  civilite: string | null
  licence: string | null
  dateExpiration: string | null
  email: string | null
  dateNaissance: string | null
  adresse: string | null
  codePostal: string | null
  ville: string | null
  caci: string | null
  key: string
}

// Index de colonnes fixes du fichier VPdive Membres (0-based)
// Indépendant de la présence ou non d'une ligne d'entête
const COL = {
  numero:         0,
  licence:        2,
  dateExpiration: 3,
  civilite:       4,
  nom:            5,
  prenom:         6,
  dateNaissance:  8,
  email:          9,
  adresse:        10,
  codePostal:     11,
  ville:          12,
  caci:           15,
} as const

function isHeaderRow(row: unknown[]): boolean {
  // Détecter une ligne d'entête : la cellule "Nom" (index 5) vaut "Nom" ou "nom"
  const val = String(row[COL.nom] ?? '').trim().toLowerCase()
  return val === 'nom'
}

function toStr(val: unknown): string | null {
  if (val === null || val === undefined || val === '' || String(val).trim() === 'nan') return null
  return String(val).trim()
}

function toDate(val: unknown): string | null {
  if (!val || String(val).trim() === 'nan') return null
  if (val instanceof Date) return formatDate(val)
  const s = String(val).trim()
  // Format ISO yyyy-mm-dd
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  // Déjà JJ/MM/AAAA
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s
  return null
}

export function parseMembres(buffer: ArrayBuffer): {
  membres: MembreRow[]
  errors: string[]
} {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    dateNF: 'dd/mm/yyyy',
  })

  if (rows.length === 0) {
    return { membres: [], errors: ['Fichier Membres vide'] }
  }

  const errors: string[] = []
  const membres: MembreRow[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    if (!row || row.length === 0) continue

    // Ignorer les lignes d'entête ou lignes vides
    if (isHeaderRow(row)) continue

    // Ignorer si pas de nom
    const nom    = toStr(row[COL.nom])
    const prenom = toStr(row[COL.prenom])
    if (!nom || !prenom) continue

    // Normaliser la civilité
    let civilite: string | null = toStr(row[COL.civilite])
    if (civilite) {
      const c = civilite.toLowerCase()
      if (c.includes('mademoiselle') || c.includes('melle')) civilite = 'Mademoiselle'
      else if (c.includes('madame') || c.includes('mme'))    civilite = 'Madame'
      else                                                    civilite = 'Monsieur'
    }

    // Code postal — padStart pour les 0 manquants
    const cpRaw = toStr(row[COL.codePostal])
    const codePostal = cpRaw
      ? String(cpRaw).replace('.0', '').padStart(5, '0')
      : null

    membres.push({
      nom,
      prenom,
      civilite,
      licence:        toStr(row[COL.licence]),
      dateExpiration: toDate(row[COL.dateExpiration]),
      email:          toStr(row[COL.email]),
      dateNaissance:  toDate(row[COL.dateNaissance]),
      adresse:        toStr(row[COL.adresse]),
      codePostal,
      ville:          toStr(row[COL.ville]),
      caci:           toDate(row[COL.caci]),
      key:            `${normalizeNom(nom)}|${normalizeNom(prenom)}`,
    })
  }

  return { membres, errors }
}
