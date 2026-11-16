import * as XLSX from 'xlsx'
import { formatDate } from '@/lib/crypto'

// ── Export FFESSM « Liste des brevets » ──────────────────────────────────────
// Structure observée (saisons 2024/2025 et 2025/2026) :
//   ligne 3 : « Liste des brevets - 03-44-0034 - CENTRE SUBAQUATIQUE NANTAIS »
//   ligne 4 : « Saison 2025/2026 »
//   ligne 8 : en-têtes — Date Obtention | Date Enregistrement | Lieu | Niveau |
//             Type | Comité | Structure | (nom club) | Plongeur | (civ.) |
//             (nom) | Moniteur | (nom moniteur)
// Les colonnes sont retrouvées par leur EN-TÊTE (pas par position) pour
// résister à un léger changement de l'export.
// La saison est celle annoncée par la FFESSM dans l'en-tête : un brevet obtenu
// en février mais enregistré l'année suivante est compté dans la saison du
// fichier (même règle que la présentation d'AG).
// Seuls niveau, date et n° de licence sont retenus : aucun nom n'est lu.

export interface BrevetRow {
  niveau:        string
  dateObtention: string | null   // JJ/MM/AAAA
  licence:       string | null
}

export function parseBrevets(buffer: ArrayBuffer): {
  saison:  string | null          // « 2025-2026 »
  brevets: Map<string, BrevetRow> // clé : licence|niveau (ou n° de ligne sans licence)
  errors:  string[]
} {
  const errors: string[] = []
  const brevets = new Map<string, BrevetRow>()

  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true })

  const texte = (v: unknown) => (v instanceof Date ? '' : String(v ?? '')).trim()

  // 1) Saison, dans les premières lignes
  let saison: string | null = null
  for (const r of rows.slice(0, 10)) {
    for (const c of r) {
      const m = /saison\s+(\d{4})\s*[/-]\s*(\d{4})/i.exec(texte(c))
      if (m && parseInt(m[2]) === parseInt(m[1]) + 1) { saison = `${m[1]}-${m[2]}`; break }
    }
    if (saison) break
  }
  if (!saison) {
    errors.push('Saison introuvable dans l\'en-tête (ligne « Saison AAAA/AAAA » attendue). Est-ce bien l\'export FFESSM « Liste des brevets » ?')
    return { saison, brevets, errors }
  }

  // 2) Ligne d'en-têtes : celle qui contient « Niveau » et « Date Obtention »
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const iEntete = rows.findIndex(r =>
    r.some(c => norm(texte(c)) === 'niveau') && r.some(c => norm(texte(c)).startsWith('date obtention')))
  if (iEntete < 0) {
    errors.push('Colonnes « Niveau » / « Date Obtention » introuvables : format de fichier inattendu.')
    return { saison, brevets, errors }
  }
  const entete = rows[iEntete].map(c => norm(texte(c)))
  const colNiveau  = entete.indexOf('niveau')
  const colDate    = entete.findIndex(h => h.startsWith('date obtention'))
  const colLicence = entete.indexOf('plongeur')   // n° de licence du plongeur
  if (colLicence < 0) errors.push('Colonne « Plongeur » (n° de licence) introuvable : brevets importés sans licence.')

  // 3) Lignes de données
  rows.slice(iEntete + 1).forEach((r, i) => {
    const niveau = texte(r[colNiveau]).replace(/\s+/g, ' ')
    if (!niveau) return                      // ligne vide / pied de tableau
    const licence = colLicence >= 0
      ? texte(r[colLicence]).toUpperCase().replace(/\s+/g, '') || null
      : null
    const brut = r[colDate]
    const dateObtention = formatDate(brut instanceof Date ? brut : texte(brut))
    const ligne = iEntete + i + 2           // n° de ligne Excel (1-indexé)

    const cle = licence ? `${licence}|${niveau}` : `ligne${ligne}`
    if (brevets.has(cle)) {
      errors.push(`Ligne ${ligne} : brevet « ${niveau} » en double pour la licence ${licence}, ignoré.`)
      return
    }
    brevets.set(cle, { niveau, dateObtention, licence })
  })

  if (brevets.size === 0) errors.push('Aucun brevet trouvé dans le fichier.')
  return { saison, brevets, errors }
}
