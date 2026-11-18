// ⚠️ PAS de 'use server' : module INTERNE (voir statistiques-serveur.ts).
// Contrôle d'accès fait par l'appelant (requireAuth ou jeton d'AG).

import { prisma } from '@/lib/db'

// ── Diplômes (brevets FFESSM) pour les statistiques ──────────────────────────

export interface DiplomesSaison {
  saison:    string          // « 2025-2026 »
  total:     number          // importés + saisis
  importeLe: string | null   // JJ/MM/AAAA du dernier import FFESSM (null = aucun)
  saisis:    number          // dont ajoutés à la main (Gestion des diplômes)
}

export interface DiplomesData {
  saisons: DiplomesSaison[]                                   // plus récente d'abord
  // niveau = libellé brut ; famille = catégorie choisie à la saisie (null =
  // classement automatique par les règles de lib/brevets.ts)
  lignes:  { saison: string; niveau: string; famille: string | null; count: number }[]
}

function dateFr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

/**
 * Comptages par (saison, niveau), brevets importés ET saisis.
 * Aucune licence ni aucun nom ne quitte le serveur.
 */
export async function calculerDiplomes(): Promise<DiplomesData> {
  const brevets = await prisma.brevet.findMany({
    select: { saison: true, niveau: true, famille: true, createdAt: true, source: true },
  })

  // Agrégation en mémoire (pas de groupBy Prisma — cf. soucis de build Vercel)
  const compteurs = new Map<string, { saison: string; niveau: string; famille: string | null; count: number }>()
  const parSaison = new Map<string, { total: number; importe: Date | null; saisis: number }>()
  for (const b of brevets) {
    const k = `${b.saison}|${b.niveau}|${b.famille ?? ''}`
    const l = compteurs.get(k)
    if (l) l.count++
    else compteurs.set(k, { saison: b.saison, niveau: b.niveau, famille: b.famille, count: 1 })

    const s = parSaison.get(b.saison) ?? { total: 0, importe: null, saisis: 0 }
    parSaison.set(b.saison, s)
    s.total++
    // Date d'import = celle des brevets IMPORT : une saisie ne la change pas
    if (b.source === 'SAISIE') s.saisis++
    else if (!s.importe || b.createdAt > s.importe) s.importe = b.createdAt
  }

  return {
    saisons: Array.from(parSaison.entries())
      .map(([saison, s]) => ({
        saison, total: s.total, saisis: s.saisis,
        importeLe: s.importe ? dateFr(s.importe) : null,
      }))
      .sort((a, b) => b.saison.localeCompare(a.saison)),   // « AAAA-AAAA » : tri texte = tri chronologique
    lignes: Array.from(compteurs.values()),
  }
}
