'use server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { decrypt } from '@/lib/crypto'
import { civiliteVersSexe, estInvite, type Sexe } from '@/lib/sexe'
import { trancheAge, type TrancheId } from '@/lib/ages'

// ── Données brutes des statistiques ──────────────────────────────────────────
// On renvoie des COMPTAGES déjà agrégés par (saison, section, sexe, tranche) : quelques
// centaines de lignes au maximum. Tout le filtrage (saison, section, mode
// évolution) se fait ensuite côté navigateur, sans aller-retour serveur —
// l'écran reste fluide en AG même si le wifi est moyen une fois la page chargée.
//
// Aucune donnée nominative ne quitte le serveur.
// Les invités (licence = « INVITE ») ne font pas partie du CSN : exclus ici,
// à la source, pour qu'aucun graphique ne puisse les compter par erreur.
//
// Membres ACTIFS uniquement : même règle que les listes étiquettes /
// attestations / suivi (getSaisonDateExpire dans actions/adherents.ts) —
// dateExpiration de l'adhérent = dateExpireLicence de sa saison. L'export
// VPdive contient aussi les anciens membres non renouvelés, à écarter.

export interface StatSaison {
  id:          string
  label:       string
  isActive:    boolean
  dateDebut:   string    // JJ/MM/AAAA — date pivot du calcul des âges
  ordre:       number    // AAAAMM de dateDebut — tri chronologique fiable
  hasSections: boolean   // au moins un adhérent avec une section renseignée
  total:       number
  invites:     number    // personnes « INVITE » exclues des comptages
}

export interface StatLigne {
  saisonId: string
  section:  string | null
  sexe:     Sexe
  tranche:  TrancheId
  count:    number
}

export interface StatsData {
  saisons: StatSaison[]
  lignes:  StatLigne[]
}

// ── Regroupement de sections (statistiques uniquement) ───────────────────────
// Certaines sections distinctes dans VPdive n'en forment qu'une au club.
// Ne modifie PAS la base : seuls les comptages des stats sont fusionnés.
// Pour en ajouter une : une ligne { re, label } de plus.
const SECTIONS_REGROUPEES: { re: RegExp; label: string }[] = [
  { re: /chasse|nage.*palme/i, label: 'Chasse / Nage avec palmes' },
]

function sectionStat(section: string | null | undefined): string | null {
  const s = section?.trim()
  if (!s) return null
  return SECTIONS_REGROUPEES.find(g => g.re.test(s))?.label ?? s
}

// dateDebut est stockée en JJ/MM/AAAA
function ordreSaison(dateDebut: string, fallback: Date): number {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateDebut?.trim() ?? '')
  if (m) return parseInt(m[3]) * 100 + parseInt(m[2])
  return fallback.getFullYear() * 100 + (fallback.getMonth() + 1)
}

export async function getStatsData(): Promise<StatsData> {
  await requireAuth()

  const [saisons, adherents] = await Promise.all([
    prisma.saison.findMany(),
    // civilite et section ne sont PAS chiffrées → lecture directe.
    // dateNaissance est chiffrée → déchiffrée ici, jamais renvoyée au client.
    prisma.adherent.findMany({
      select: {
        saisonId: true, section: true, civilite: true, licence: true,
        dateExpiration: true, dateNaissanceEnc: true,
      },
    }),
  ])

  // Agrégation en mémoire (pas de groupBy Prisma — cf. soucis de build Vercel)
  const compteurs = new Map<string, StatLigne>()
  const totalParSaison  = new Map<string, number>()
  const saisonsAvecSect = new Set<string>()
  const invitesParSaison = new Map<string, number>()

  // dateExpireLicence par saison (vide = pas de filtre, comme les listes)
  const expireParSaison = new Map(saisons.map(s => [s.id, s.dateExpireLicence?.trim() || null]))
  // Date pivot de calcul de l'âge = début de saison (JJ/MM/AAAA)
  const pivotParSaison  = new Map<string, string>(saisons.map(s => [s.id, s.dateDebut]))

  for (const a of adherents) {
    const expire = expireParSaison.get(a.saisonId)
    if (expire && a.dateExpiration !== expire) continue   // ancien membre non actif

    if (estInvite(a.licence)) {
      invitesParSaison.set(a.saisonId, (invitesParSaison.get(a.saisonId) ?? 0) + 1)
      continue
    }
    const sexe    = civiliteVersSexe(a.civilite)
    const section = sectionStat(a.section)
    const tranche = trancheAge(decrypt(a.dateNaissanceEnc), pivotParSaison.get(a.saisonId))
    const key     = `${a.saisonId}|${section ?? ''}|${sexe}|${tranche}`

    const l = compteurs.get(key)
    if (l) l.count++
    else compteurs.set(key, { saisonId: a.saisonId, section, sexe, tranche, count: 1 })

    totalParSaison.set(a.saisonId, (totalParSaison.get(a.saisonId) ?? 0) + 1)
    if (section) saisonsAvecSect.add(a.saisonId)
  }

  return {
    saisons: saisons
      .map(s => ({
        id:          s.id,
        label:       s.label,
        isActive:    s.isActive,
        dateDebut:   s.dateDebut,
        ordre:       ordreSaison(s.dateDebut, s.createdAt),
        hasSections: saisonsAvecSect.has(s.id),
        total:       totalParSaison.get(s.id) ?? 0,
        invites:     invitesParSaison.get(s.id) ?? 0,
      }))
      .sort((a, b) => a.ordre - b.ordre),
    lignes: Array.from(compteurs.values()),
  }
}
