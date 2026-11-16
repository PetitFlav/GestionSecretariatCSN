// ⚠️ PAS de 'use server' : module INTERNE (voir statistiques-serveur.ts).
// Contrôle d'accès fait par l'appelant (requireAuth ou jeton d'AG).

import { prisma } from '@/lib/db'

// ── Diplômes (brevets FFESSM) pour les statistiques ──────────────────────────

export interface DiplomesSaison {
  saison:    string   // « 2025-2026 »
  total:     number
  importeLe: string   // JJ/MM/AAAA
}

export interface DiplomesData {
  saisons: DiplomesSaison[]                                   // plus récente d'abord
  lignes:  { saison: string; niveau: string; count: number }[] // niveau = libellé FFESSM brut
}

function dateFr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** Comptages par (saison, niveau). Aucune licence ne quitte le serveur. */
export async function calculerDiplomes(): Promise<DiplomesData> {
  const brevets = await prisma.brevet.findMany({
    select: { saison: true, niveau: true, createdAt: true },
  })

  // Agrégation en mémoire (pas de groupBy Prisma — cf. soucis de build Vercel)
  const compteurs = new Map<string, { saison: string; niveau: string; count: number }>()
  const parSaison = new Map<string, { total: number; importe: Date }>()
  for (const b of brevets) {
    const k = `${b.saison}|${b.niveau}`
    const l = compteurs.get(k)
    if (l) l.count++
    else compteurs.set(k, { saison: b.saison, niveau: b.niveau, count: 1 })

    const s = parSaison.get(b.saison)
    if (s) { s.total++; if (b.createdAt > s.importe) s.importe = b.createdAt }
    else parSaison.set(b.saison, { total: 1, importe: b.createdAt })
  }

  return {
    saisons: Array.from(parSaison.entries())
      .map(([saison, s]) => ({ saison, total: s.total, importeLe: dateFr(s.importe) }))
      .sort((a, b) => b.saison.localeCompare(a.saison)),   // « AAAA-AAAA » : tri texte = tri chronologique
    lignes: Array.from(compteurs.values()),
  }
}
