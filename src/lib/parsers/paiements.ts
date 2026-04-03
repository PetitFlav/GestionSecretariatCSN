import * as XLSX from 'xlsx'
import { makeKey, cleanName } from '@/lib/crypto'

export interface PaiementRow {
  nom: string
  prenom: string
  montantTotal: number          // Somme de toutes les lignes adhésion
  datesPaiement: string[]       // Toutes les dates trouvées
  key: string
}

// Regex pour détecter "Adhésion 2025/2026" ou "Adhésion 25/26"
const ADHESION_REGEX = /adh[eé]sion\s+\d{2,4}[\/-]\d{2,4}/i

function parseNomPrenom(membre: string): { nom: string; prenom: string } | null {
  if (!membre) return null
  const parts = membre.trim().split(/\s+/)
  if (parts.length < 2) return null

  // Identifier les mots en MAJUSCULES (= nom de famille dans VPdive)
  const upperParts = parts.filter(p => p === p.toUpperCase() && /[A-ZÀÂÄÉÈÊËÎÏÔÙÛÜ]/.test(p))
  const otherParts = parts.filter(p => !(p === p.toUpperCase() && /[A-ZÀÂÄÉÈÊËÎÏÔÙÛÜ]/.test(p)))

  if (upperParts.length > 0 && otherParts.length > 0) {
    // Cas clair : certains mots sont en majuscules = nom, les autres = prénom
    return {
      nom:    upperParts.join(' '),
      prenom: otherParts.join(' '),
    }
  }

  // Fallback : tout en majuscules ou tout en mixte
  // On prend le dernier mot comme prénom, le reste comme nom
  // (convention VPdive : "NOM Prénom" ou "Prénom NOM")
  // On normalise : le mot le plus long sans accent = nom
  const sorted = [...parts].sort((a, b) => b.length - a.length)
  return {
    nom:    sorted[0].toUpperCase(),
    prenom: sorted.slice(1).join(' '),
  }
}

export function parsePaiements(buffer: ArrayBuffer, saisonLabel: string): {
  paiements: Map<string, PaiementRow>
  errors: string[]
} {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: false,
    dateNF: 'dd/mm/yyyy',
  })

  const errors: string[] = []
  const paiements = new Map<string, PaiementRow>()

  // Extraire les deux années depuis le label — fonctionne avec n'importe quel format :
  // "2025-2026", "2025/2026", "Saison 2025 2026", "25-26", etc.
  const allYears = saisonLabel.match(/\d{2,4}/g) ?? []
  const years4 = allYears.filter(y => y.length === 4)
  const anneeDebut = years4[0] ?? allYears[0] ?? ''
  const anneeFin   = years4[1] ?? years4[0] ?? allYears[allYears.length - 1] ?? anneeDebut
  const courtDebut = anneeDebut.slice(-2)  // "25"
  const courtFin   = anneeFin.slice(-2)    // "26"
  const saisonPatterns = [
    `${anneeDebut}/${anneeFin}`,   // 2025/2026
    `${anneeDebut}-${anneeFin}`,   // 2025-2026
    `${courtDebut}/${courtFin}`,   // 25/26
    `${courtDebut}-${courtFin}`,   // 25-26
  ]

  function matchSaison(produit: string): boolean {
    if (!ADHESION_REGEX.test(produit)) return false
    return saisonPatterns.some(p => produit.includes(p))
  }

  for (const row of rows) {
    const produit = String(row['Produit/Événement'] ?? '')
    if (!matchSaison(produit)) continue

    const membreStr = String(row['Membre'] ?? '').trim()
    const parsed = parseNomPrenom(membreStr)
    if (!parsed) {
      errors.push(`Ligne ignorée — impossible de parser le membre : "${membreStr}"`)
      continue
    }

    const montantStr = String(row['Montant paiement'] ?? '0').replace(',', '.')
    const montant = parseFloat(montantStr) || 0

    const datePaiement = String(row['Date paiement'] ?? '').trim()
    const key = makeKey(cleanName(parsed.nom), cleanName(parsed.prenom))

    if (paiements.has(key)) {
      // Additionner les montants, concaténer les dates
      const existing = paiements.get(key)!
      existing.montantTotal += montant
      if (datePaiement && !existing.datesPaiement.includes(datePaiement)) {
        existing.datesPaiement.push(datePaiement)
      }
    } else {
      paiements.set(key, {
        nom:           cleanName(parsed.nom),
        prenom:        cleanName(parsed.prenom),
        montantTotal:  montant,
        datesPaiement: datePaiement ? [datePaiement] : [],
        key,
      })
    }
  }

  return { paiements, errors }
}
