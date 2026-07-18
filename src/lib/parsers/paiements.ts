import * as XLSX from 'xlsx'
import { makeKey, cleanName } from '@/lib/crypto'

export interface PaiementRow {
  nom:           string
  prenom:        string
  montantTotal:  number     // Somme de toutes les lignes adhésion payées
  datesPaiement: string[]   // Toutes les dates trouvées
  key:           string
}

// Regex pour détecter une ligne d'adhésion :
//   "Adhésion 2025/2026", "Adhésion 25/26", "Adhésion 26/27"…
// Utilisé sur Produit/Événement ET sur Type de produit
const ADHESION_REGEX = /adh[eé]sion\s+\d{2,4}[\/-]\d{2,4}/i

// États de paiement à ignorer (lignes annulées, remboursées…)
const ETATS_IGNORES = new Set(['annulé', 'annule', 'remboursé', 'rembourse', 'cancelled', 'refunded'])

function normalizeEtat(val: unknown): string {
  return String(val ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function parseNomPrenom(membre: string): { nom: string; prenom: string } | null {
  if (!membre) return null
  const parts = membre.trim().split(/\s+/)
  if (parts.length < 2) return null

  // Identifier les mots en MAJUSCULES (= nom de famille dans VPdive)
  const upperParts = parts.filter(p => p === p.toUpperCase() && /[A-ZÀÂÄÉÈÊËÎÏÔÙÛÜ]/.test(p))
  const otherParts = parts.filter(p => !(p === p.toUpperCase() && /[A-ZÀÂÄÉÈÊËÎÏÔÙÛÜ]/.test(p)))

  if (upperParts.length > 0 && otherParts.length > 0) {
    return {
      nom:    upperParts.join(' '),
      prenom: otherParts.join(' '),
    }
  }

  // Fallback : prend le mot le plus long comme nom
  const sorted = [...parts].sort((a, b) => b.length - a.length)
  return {
    nom:    sorted[0].toUpperCase(),
    prenom: sorted.slice(1).join(' '),
  }
}

export function parsePaiements(buffer: ArrayBuffer, saisonLabel: string): {
  paiements: Map<string, PaiementRow>
  errors:    string[]
} {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet    = workbook.Sheets[workbook.SheetNames[0]]

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw:    false,
    dateNF: 'dd/mm/yyyy',
  })

  const errors:    string[]                  = []
  const paiements  = new Map<string, PaiementRow>()

  // Extraire les deux années depuis le label de saison
  // Compatible avec tous les formats : "2025-2026", "2025/2026", "25-26", "Saison 2025 2026"…
  const allYears   = saisonLabel.match(/\d{2,4}/g) ?? []
  const years4     = allYears.filter(y => y.length === 4)
  const anneeDebut = years4[0] ?? allYears[0] ?? ''
  const anneeFin   = years4[1] ?? years4[0] ?? allYears[allYears.length - 1] ?? anneeDebut
  const courtDebut = anneeDebut.slice(-2)  // ex: "25"
  const courtFin   = anneeFin.slice(-2)    // ex: "26"
  const saisonPatterns = [
    `${anneeDebut}/${anneeFin}`,   // 2025/2026
    `${anneeDebut}-${anneeFin}`,   // 2025-2026
    `${courtDebut}/${courtFin}`,   // 25/26
    `${courtDebut}-${courtFin}`,   // 25-26
  ]

  /**
   * Vérifie qu'une chaîne correspond à une adhésion de la bonne saison.
   * Testée sur "Adhésion 2026/2027" ET sur "Adhésion 26/27".
   */
  function matchSaison(s: string): boolean {
    if (!ADHESION_REGEX.test(s)) return false
    return saisonPatterns.some(p => s.includes(p))
  }

  for (const row of rows) {
    // ── 1. Ignorer les lignes annulées / remboursées ──────────────────────
    const etat = normalizeEtat(row['État'])
    if (ETATS_IGNORES.has(etat)) continue

    // ── 2. Vérifier que c'est une ligne d'adhésion de la bonne saison ─────
    //
    //   Cas standard (99% des lignes) :
    //     Produit/Événement = "Adhésion 2026/2027"  → match direct
    //
    //   Cas "Carte Club (Sans Licence)" et assimilés :
    //     Produit/Événement = "Carte Club (Sans Licence)"  → pas de match
    //     Type de produit   = "Adhésion 26/27"             → match en fallback
    //
    const produit     = String(row['Produit/Événement'] ?? '')
    const typeProduit = String(row['Type de produit']   ?? '')

    if (!matchSaison(produit) && !matchSaison(typeProduit)) continue

    // ── 3. Parser le membre ───────────────────────────────────────────────
    const membreStr = String(row['Membre'] ?? '').trim()
    const parsed    = parseNomPrenom(membreStr)
    if (!parsed) {
      errors.push(`Ligne ignorée — impossible de parser le membre : "${membreStr}"`)
      continue
    }

    // ── 4. Montant et date ────────────────────────────────────────────────
    const montantStr   = String(row['Montant paiement'] ?? '0').replace(',', '.')
    const montant      = parseFloat(montantStr) || 0
    const datePaiement = String(row['Date paiement'] ?? '').trim()

    const key = makeKey(cleanName(parsed.nom), cleanName(parsed.prenom))

    // ── 5. Accumuler (une personne peut avoir plusieurs lignes) ───────────
    if (paiements.has(key)) {
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
