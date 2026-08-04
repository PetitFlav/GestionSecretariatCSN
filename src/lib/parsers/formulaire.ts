import * as XLSX from 'xlsx'
import { makeKey, cleanName } from '@/lib/crypto'

export interface FormulaireRow {
  nom: string
  prenom: string
  sectionPrincipale: string | null      // ActivitePrincipale — canonicalisée
  sectionsSecondaires: string[]          // ActiviteSecondaire — peut être multi-lignes
  key: string
}

// ── Canonicalisation des libellés de section ─────────────────────────────────
// N'UNIFIE que casse/accents/variantes ; ne renomme pas. Un intitulé inconnu
// est conservé tel quel (trimé). Édite ce tableau si le club change ses libellés.
const SECTION_CANON: { re: RegExp; label: string }[] = [
  { re: /apn[ée]e/i,      label: 'Apnée' },
  { re: /plong[ée]e/i,    label: 'Plongée' },
  { re: /hockey/i,        label: 'Hockey subaquatique' },
  { re: /nage.*palme/i,   label: 'Nage avec palmes' },
  { re: /chasse/i,        label: 'Chasse' },
]

function canonSection(value: unknown): string | null {
  if (!value) return null
  const s = String(value).trim()
  if (!s || s === '-' || s.toLowerCase() === 'nan') return null
  for (const { re, label } of SECTION_CANON) {
    if (re.test(s)) return label
  }
  return s
}

export function parseFormulaire(buffer: ArrayBuffer): {
  formulaire: Map<string, FormulaireRow>
  errors: string[]
} {
  const errors: string[] = []
  const formulaire = new Map<string, FormulaireRow>()

  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) {
    return { formulaire, errors: ['Fichier formulaire d\'adhésions vide ou illisible'] }
  }

  // header: 1 → tableau de tableaux. Le fichier VPdive commence par une ligne
  // de titre ("Adhésions 26/27") + lignes vides, donc on repère dynamiquement
  // la ligne d'entête au lieu de supposer un offset fixe.
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: null,
  })

  let hdr = -1
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as unknown[]
    if (r && r.some(c => String(c ?? '').trim() === 'ActivitePrincipale')) {
      hdr = i
      break
    }
  }
  if (hdr === -1) {
    return {
      formulaire,
      errors: ['Colonne "ActivitePrincipale" introuvable — fichier formulaire non reconnu'],
    }
  }

  const header = (rows[hdr] as unknown[]).map(c => String(c ?? '').trim())
  const idx = (name: string) => header.indexOf(name)
  const iNom = idx('NOM')
  const iPrenom = idx('PRENOM')
  const iPrincipale = idx('ActivitePrincipale')
  const iSecondaire = idx('ActiviteSecondaire')

  if (iNom === -1 || iPrenom === -1) {
    return { formulaire, errors: ['Colonnes NOM/PRENOM introuvables dans le formulaire'] }
  }

  for (let i = hdr + 1; i < rows.length; i++) {
    const r = rows[i] as unknown[]
    if (!r) continue

    const nom = cleanName(String(r[iNom] ?? '').trim())
    const prenom = cleanName(String(r[iPrenom] ?? '').trim())
    if (!nom || !prenom) continue

    const sectionPrincipale = canonSection(r[iPrincipale])

    // ActiviteSecondaire : plusieurs activités séparées par \n (ou ; ,)
    const sectionsSecondaires = iSecondaire === -1
      ? []
      : String(r[iSecondaire] ?? '')
          .split(/[\n;,]/)
          .map(canonSection)
          .filter((x): x is string => Boolean(x))

    formulaire.set(makeKey(nom, prenom), {
      nom,
      prenom,
      sectionPrincipale,
      sectionsSecondaires,
      key: makeKey(nom, prenom),
    })
  }

  return { formulaire, errors }
}
