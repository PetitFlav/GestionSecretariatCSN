import * as XLSX from 'xlsx'
import { normalizeNom, formatDate } from '@/lib/crypto'

export interface FFESSMRow {
  nom: string
  prenom: string
  ffessmId: string | null         // "Identifiant"
  adresse: string | null          // "Adresse1"
  codePostal: string | null       // "Code Postal"
  ville: string | null            // "Commune"
  dateFinCaci: string | null      // "Date Fin Validité CACI"
  key: string
}

export function parseFFESSM(buffer: ArrayBuffer): {
  ffessm: Map<string, FFESSMRow>
  errors: string[]
} {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: false,
    dateNF: 'dd/mm/yyyy',
  })

  const errors: string[] = []
  const ffessm = new Map<string, FFESSMRow>()

  for (const row of rows) {
    const nom    = String(row['Nom'] ?? '').trim()
    const prenom = String(row['Prénom'] ?? '').trim()

    if (!nom || !prenom) continue

    const adresse1 = String(row['Adresse1'] ?? '').trim() || null
    const adresse2 = String(row['Adresse2'] ?? '').trim() || null
    // Combiner Adresse1 + Adresse2 si les deux existent
    const adresse = [adresse1, adresse2].filter(Boolean).join(', ') || null

    const cpRaw = row['Code Postal']
    const codePostal = cpRaw
      ? String(cpRaw).trim().padStart(5, '0')
      : null

    const dateFinRaw = row['Date Fin Validité CACI']
    const dateFinCaci = dateFinRaw instanceof Date
      ? formatDate(dateFinRaw)
      : dateFinRaw
        ? String(dateFinRaw).trim()
        : null

    const key = `${normalizeNom(nom)}|${normalizeNom(prenom)}`

    ffessm.set(key, {
      nom,
      prenom,
      ffessmId:    String(row['Identifiant'] ?? '').trim() || null,
      adresse,
      codePostal,
      ville:       String(row['Commune'] ?? '').trim() || null,
      dateFinCaci,
      key,
    })
  }

  return { ffessm, errors }
}

/**
 * Compare deux adresses normalisées — retourne true si elles sont différentes
 */
export function adressesDifferentes(
  adresseClub: { adresse: string | null; cp: string | null; ville: string | null },
  adresseFFESSM: { adresse: string | null; cp: string | null; ville: string | null }
): boolean {
  function norm(s: string | null): string {
    if (!s) return ''
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
  }

  return (
    norm(adresseClub.adresse) !== norm(adresseFFESSM.adresse) ||
    norm(adresseClub.cp)      !== norm(adresseFFESSM.cp) ||
    norm(adresseClub.ville)   !== norm(adresseFFESSM.ville)
  )
}
