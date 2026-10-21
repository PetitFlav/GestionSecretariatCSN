'use server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { decrypt, makeKey, keysMatch } from '@/lib/crypto'
import { civiliteVersSexe, type Sexe } from '@/lib/sexe'
import { estInvite } from '@/lib/invite'
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

// ── Réinscription ────────────────────────────────────────────────────────────
// Pour chaque saison N qui a une saison précédente P en base :
//   REINSCRIT : actif en P ET actif en N      (section = celle de N)
//   NOUVEAU   : actif en N, absent de P        (section = celle de N)
//   PARTI     : actif en P, absent de N        (section = celle de P)
//   → effectif P = REINSCRIT + PARTI ; effectif N = REINSCRIT + NOUVEAU
// « Absent de N » = pas réinscrit À LA DATE DES DONNÉES : pour la saison en
// cours, les inscriptions continuent, le chiffre est donc provisoire.

export type TypeReinscription = 'REINSCRIT' | 'NOUVEAU' | 'PARTI'

export interface StatReinscription {
  saisonId:    string       // saison N
  precedentId: string       // saison P (la précédente en base)
  dateDonnees: string       // JJ/MM/AAAA — dernière mise à jour des fiches de N
  parNom:      number       // réinscrits rapprochés par nom faute de licence commune
  lignes:      { section: string | null; type: TypeReinscription; count: number }[]
}

export interface StatsData {
  saisons:        StatSaison[]
  lignes:         StatLigne[]
  reinscriptions: StatReinscription[]
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

// Licence normalisée pour le rapprochement (même règle que l'import FFESSM).
// « INVITE » n'est pas un numéro : ignoré (les invités sont exclus de toute façon).
function cleLicence(l: string | null | undefined): string | null {
  const k = (l ?? '').toUpperCase().replace(/\s+/g, '').trim()
  return k && !estInvite(k) ? k : null
}

function dateFr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
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
        // nom/prénom/updatedAt : uniquement pour le rapprochement des saisons,
        // jamais renvoyés au navigateur.
        nom: true, prenom: true, updatedAt: true,
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

  // Membres actifs retenus, par saison — sert au calcul de réinscription
  interface Membre { licence: string | null; cle: string; section: string | null; updatedAt: Date }
  const actifsParSaison = new Map<string, Membre[]>()

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

    const liste = actifsParSaison.get(a.saisonId) ?? []
    liste.push({ licence: cleLicence(a.licence), cle: makeKey(a.nom, a.prenom), section, updatedAt: a.updatedAt })
    actifsParSaison.set(a.saisonId, liste)
  }

  const saisonsTriees = saisons
    .map(s => ({ id: s.id, ordre: ordreSaison(s.dateDebut, s.createdAt) }))
    .sort((a, b) => a.ordre - b.ordre)

  const reinscriptions: StatReinscription[] = []
  for (let i = 1; i < saisonsTriees.length; i++) {
    const P = actifsParSaison.get(saisonsTriees[i - 1].id) ?? []
    const N = actifsParSaison.get(saisonsTriees[i].id) ?? []
    if (P.length === 0 || N.length === 0) continue
    reinscriptions.push(calculerReinscription(saisonsTriees[i].id, saisonsTriees[i - 1].id, P, N))
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
    reinscriptions,
  }
}

// Rapprochement 1-pour-1 entre P et N :
//   1) numéro de licence (stable d'une saison à l'autre à la FFESSM) ;
//   2) à défaut, nom + prénom avec les variantes de l'import (tiret/espace,
//      ordre des mots…). Fragile par nature → compté à part (parNom).
// Une fiche de N ne peut être rapprochée qu'une fois (pas de double compte
// en cas d'homonymes).
function calculerReinscription(
  saisonId: string,
  precedentId: string,
  P: { licence: string | null; cle: string; section: string | null }[],
  N: { licence: string | null; cle: string; section: string | null; updatedAt: Date }[],
): StatReinscription {
  const pris = new Array<boolean>(N.length).fill(false)
  const rapproche = new Array<boolean>(P.length).fill(false)
  let parNom = 0

  // 1) licence
  const nParLicence = new Map<string, number>()
  N.forEach((m, j) => { if (m.licence && !nParLicence.has(m.licence)) nParLicence.set(m.licence, j) })
  P.forEach((m, i) => {
    const j = m.licence ? nParLicence.get(m.licence) : undefined
    if (j !== undefined && !pris[j]) { pris[j] = true; rapproche[i] = true }
  })

  // 2) nom + prénom (exact d'abord, puis variantes)
  const nParCle = new Map<string, number[]>()
  N.forEach((m, j) => { if (!pris[j]) nParCle.set(m.cle, [...(nParCle.get(m.cle) ?? []), j]) })
  P.forEach((m, i) => {
    if (rapproche[i]) return
    let j = (nParCle.get(m.cle) ?? []).find(k => !pris[k])
    if (j === undefined) j = N.findIndex((n, k) => !pris[k] && keysMatch(m.cle, n.cle))
    if (j !== undefined && j >= 0) { pris[j] = true; rapproche[i] = true; parNom++ }
  })

  // Comptages par (section, type)
  const compte = new Map<string, { section: string | null; type: TypeReinscription; count: number }>()
  const ajoute = (section: string | null, type: TypeReinscription) => {
    const k = `${section ?? ''}|${type}`
    const l = compte.get(k)
    if (l) l.count++
    else compte.set(k, { section, type, count: 1 })
  }
  N.forEach((m, j) => ajoute(m.section, pris[j] ? 'REINSCRIT' : 'NOUVEAU'))
  P.forEach((m, i) => { if (!rapproche[i]) ajoute(m.section, 'PARTI') })

  const derniereMaj = N.reduce((d, m) => (m.updatedAt > d ? m.updatedAt : d), N[0].updatedAt)

  return {
    saisonId, precedentId, parNom,
    dateDonnees: dateFr(derniereMaj),
    lignes: Array.from(compte.values()),
  }
}
