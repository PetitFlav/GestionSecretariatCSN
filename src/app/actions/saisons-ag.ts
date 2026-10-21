'use server'

import { prisma } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/session'
import { estInvite } from '@/lib/invite'

// ── Assemblée générale & photo « inscrits pré-AG » ───────────────────────────
// But : comparer les saisons À L'AG d'une année sur l'autre (et non une saison
// complète à une saison qui commence). La veille de l'AG, après un import
// VPdive frais, on « fige » les membres actifs : Adherent.inscritPreAG = true.
// L'import ne touche jamais ce champ → la photo reste telle quelle.
//
// Première comparaison possible : AG 2027 (2027-2028) vs AG 2026 (2026-2027).

/** Date ISO « AAAA-MM-JJ » (input type=date) → « JJ/MM/AAAA » (format de la base). */
function isoVersFr(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null
}

export async function definirDateAG(
  saisonId: string,
  dateIso: string,          // '' pour effacer
): Promise<{ ok: boolean; error?: string; dateAG?: string | null }> {
  try {
    await requireAuth()
    const dateAG = dateIso ? isoVersFr(dateIso) : null
    if (dateIso && !dateAG) return { ok: false, error: 'Date invalide' }
    await prisma.saison.update({ where: { id: saisonId }, data: { dateAG } })
    return { ok: true, dateAG }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export interface InfoPhotoAG {
  ok:           boolean
  error?:       string
  actifs?:      number        // fiches qui seront figées (actives, hors invités)
  derniereMaj?: string | null // dernière mise à jour des fiches ≈ dernier import
}

// Membres actifs de la saison = même règle que les listes et les stats :
// dateExpiration de la fiche = dateExpireLicence de la saison. Invités exclus.
async function idsActifs(saisonId: string): Promise<{ ids: string[]; derniereMaj: Date | null }> {
  const saison = await prisma.saison.findUnique({
    where: { id: saisonId }, select: { dateExpireLicence: true },
  })
  if (!saison) throw new Error('Saison introuvable')

  const expire = saison.dateExpireLicence?.trim() || null
  const fiches = await prisma.adherent.findMany({
    where:  { saisonId, ...(expire ? { dateExpiration: expire } : {}) },
    select: { id: true, licence: true, updatedAt: true },
  })
  let derniereMaj: Date | null = null
  const ids: string[] = []
  for (const f of fiches) {
    if (!derniereMaj || f.updatedAt > derniereMaj) derniereMaj = f.updatedAt
    if (!estInvite(f.licence)) ids.push(f.id)
  }
  return { ids, derniereMaj }
}

function dateHeureFr(d: Date): string {
  return d.toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** Aperçu avant de figer : combien de fiches, et de quand date le dernier import. */
export async function getInfoPhotoAG(saisonId: string): Promise<InfoPhotoAG> {
  try {
    await requireAdmin()
    const { ids, derniereMaj } = await idsActifs(saisonId)
    return { ok: true, actifs: ids.length, derniereMaj: derniereMaj ? dateHeureFr(derniereMaj) : null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Fige les inscrits pré-AG de la saison. Relancer = refaire la photo
 * (les fiches qui ne sont plus actives repassent à false).
 *
 * SQL brut volontaire : un updateMany Prisma mettrait à jour `updatedAt` de
 * toutes les fiches, ce qui fausserait la « date des données » (dernier
 * import) affichée dans les statistiques.
 */
export async function prendrePhotoAG(
  saisonId: string,
): Promise<{ ok: boolean; error?: string; nb?: number; date?: string }> {
  try {
    await requireAdmin()
    const { ids } = await idsActifs(saisonId)
    if (ids.length === 0) return { ok: false, error: 'Aucun membre actif dans cette saison' }

    const maintenant = new Date()
    await prisma.$transaction([
      prisma.$executeRaw`
        UPDATE "adherents"
        SET    "inscritPreAG" = ("id" = ANY(${ids}::text[]))
        WHERE  "saisonId" = ${saisonId}`,
      prisma.saison.update({
        where: { id: saisonId },
        data:  { datePhotoAG: maintenant, nbPhotoAG: ids.length },
      }),
    ])
    return { ok: true, nb: ids.length, date: dateHeureFr(maintenant) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
