'use server'

import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/session'
import { makeKey } from '@/lib/crypto'
import { getSaisonPrecedente } from '@/lib/saisons'

// ── Écran « Bureau » : fonctions des adhérents, par saison ───────────────────
// Spec : docs/SPEC-demande-accueil.md § 8.
// Une fonction est rattachée à la fiche Adherent d'UNE saison (table
// adherents_fonctions, la table adherents n'est pas modifiée).
// Règle applicative : un seul président par saison. Les autres fonctions
// (secrétaire, trésorier, CODIR…) peuvent avoir plusieurs titulaires.

const CODE_PRESIDENT = 'PRESIDENT'

type Resultat = { ok: boolean; error?: string }

function erreur(e: unknown): Resultat {
  return { ok: false, error: e instanceof Error ? e.message : String(e) }
}

/** Président déjà désigné sur la saison (autre que `saufAdherentId`), ou null. */
async function presidentDeLaSaison(saisonId: string, saufAdherentId?: string) {
  return prisma.adherentFonction.findFirst({
    where: {
      fonction: { code: CODE_PRESIDENT },
      adherent: { saisonId, ...(saufAdherentId ? { id: { not: saufAdherentId } } : {}) },
    },
    select: { adherent: { select: { nom: true, prenom: true } } },
  })
}

/** Donne une fonction à un adhérent (fiche d'une saison). */
export async function ajouterFonction(adherentId: string, fonctionId: string): Promise<Resultat> {
  try {
    await requireAdmin()

    const [adherent, fonction] = await Promise.all([
      prisma.adherent.findUnique({ where: { id: adherentId }, select: { saisonId: true } }),
      prisma.fonction.findUnique({ where: { id: fonctionId }, select: { code: true, libelle: true, actif: true } }),
    ])
    if (!adherent) return { ok: false, error: 'Adhérent introuvable' }
    if (!fonction || !fonction.actif) return { ok: false, error: 'Fonction introuvable ou inactive' }

    if (fonction.code === CODE_PRESIDENT) {
      const autre = await presidentDeLaSaison(adherent.saisonId, adherentId)
      if (autre) {
        return {
          ok: false,
          error: `Un président est déjà désigné pour cette saison (${autre.adherent.prenom} ${autre.adherent.nom}). Retirez-le d'abord.`,
        }
      }
    }

    const existe = await prisma.adherentFonction.findUnique({
      where: { adherentId_fonctionId: { adherentId, fonctionId } },
      select: { id: true },
    })
    if (existe) return { ok: false, error: `Cette personne est déjà ${fonction.libelle}` }

    await prisma.adherentFonction.create({ data: { adherentId, fonctionId } })
    return { ok: true }
  } catch (e) {
    return erreur(e)
  }
}

/** Retire une fonction (supprime l'affectation, pas l'adhérent). */
export async function retirerFonction(affectationId: string): Promise<Resultat> {
  try {
    await requireAdmin()
    await prisma.adherentFonction.delete({ where: { id: affectationId } })
    return { ok: true }
  } catch (e) {
    return erreur(e)
  }
}

export interface ResultatReprise extends Resultat {
  saisonPrecedente?: string
  /** Fonctions recopiées */
  ajoutes?: string[]
  /** Déjà en place sur la saison cible, rien à faire */
  dejaPresents?: string[]
  /** Pas de fiche avec ce nom + prénom dans la saison cible */
  introuvables?: string[]
  /** Non recopié pour une autre raison (ex. autre président déjà désigné) */
  conflits?: string[]
}

/**
 * Recopie le bureau de la saison précédente sur `saisonId`.
 * Correspondance par nom + prénom normalisés (makeKey : casse, accents,
 * tirets) — jamais de rapprochement approximatif : une personne introuvable
 * est listée, rien n'est inventé. N'efface rien sur la saison cible.
 */
export async function reprendreBureauPrecedent(saisonId: string): Promise<ResultatReprise> {
  try {
    await requireAdmin()

    const precedente = await getSaisonPrecedente(saisonId)
    if (!precedente) return { ok: false, error: "Pas de saison précédente (d'après les dates de début)" }

    const [anciennes, fiches] = await Promise.all([
      prisma.adherentFonction.findMany({
        where:   { adherent: { saisonId: precedente.id }, fonction: { actif: true } },
        select:  {
          fonctionId: true,
          fonction: { select: { code: true, libelle: true, ordre: true } },
          adherent: { select: { nom: true, prenom: true } },
        },
        orderBy: { fonction: { ordre: 'asc' } },
      }),
      prisma.adherent.findMany({
        where:  { saisonId },
        select: { id: true, nom: true, prenom: true, fonctions: { select: { fonctionId: true } } },
      }),
    ])
    if (anciennes.length === 0) {
      return { ok: false, error: `Aucune fonction n'est renseignée sur la saison ${precedente.label}` }
    }

    const parCle = new Map(fiches.map(f => [makeKey(f.nom, f.prenom), f]))
    const res: ResultatReprise = {
      ok: true, saisonPrecedente: precedente.label,
      ajoutes: [], dejaPresents: [], introuvables: [], conflits: [],
    }

    for (const a of anciennes) {
      const libelle = `${a.adherent.prenom} ${a.adherent.nom} (${a.fonction.libelle})`
      const fiche = parCle.get(makeKey(a.adherent.nom, a.adherent.prenom))
      if (!fiche) { res.introuvables!.push(libelle); continue }
      if (fiche.fonctions.some(f => f.fonctionId === a.fonctionId)) { res.dejaPresents!.push(libelle); continue }

      if (a.fonction.code === CODE_PRESIDENT) {
        const autre = await presidentDeLaSaison(saisonId, fiche.id)
        if (autre) {
          res.conflits!.push(`${libelle} : ${autre.adherent.prenom} ${autre.adherent.nom} est déjà président·e`)
          continue
        }
      }

      await prisma.adherentFonction.create({ data: { adherentId: fiche.id, fonctionId: a.fonctionId } })
      fiche.fonctions.push({ fonctionId: a.fonctionId })
      res.ajoutes!.push(libelle)
    }
    return res
  } catch (e) {
    return erreur(e)
  }
}
