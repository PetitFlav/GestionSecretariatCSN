/**
 * src/lib/demande-accueil-serveur.ts
 *
 * Partie serveur de la demande d'accueil piscine : lecture des données
 * (président, téléphones, destinataires…) et préparation d'une demande.
 *
 * `preparerDemande` est le SEUL endroit qui transforme la saisie du
 * formulaire en textes du PDF et en adresses : l'aperçu et l'envoi passent
 * tous les deux par lui, ils ne peuvent donc pas diverger. Le navigateur
 * n'envoie que des identifiants et des nombres ; noms et courriels sont
 * toujours relus en base.
 * Spec : docs/SPEC-demande-accueil.md § 6 à § 8.
 */

import { prisma } from '@/lib/db'
import { decrypt, encrypt, makeKey } from '@/lib/crypto'
import { estInvite } from '@/lib/invite'
import { getSaisonPrecedente } from '@/lib/saisons'
import type { SessionUser } from '@/lib/session'
import {
  formaterHeure, formaterJour, formaterPrenomNom, StylesChamps, ValeursDemande,
} from '@/lib/pdf-demande-accueil'
import {
  controlerSaisie, corpsMail, dateIsoVersUtc, dedoublonnerAdresses, nomFichierPdf, objetMail, SaisieDemande,
} from '@/lib/demande-accueil'

const CODE_PRESIDENT = 'PRESIDENT'

// ─── Président ──────────────────────────────────────────────────────────────

export interface PresidentTrouve {
  nom:    string
  prenom: string
  email:  string | null
  /** Saison où la fonction a été trouvée */
  saisonLabel: string
  /** true = pas de président sur la saison active, repris de la précédente */
  depuisPrecedente: boolean
}

async function presidentDeSaison(saisonId: string) {
  return prisma.adherentFonction.findFirst({
    where:  { fonction: { code: CODE_PRESIDENT }, adherent: { saisonId } },
    select: { adherent: { select: { nom: true, prenom: true, emailEnc: true, saison: { select: { label: true } } } } },
  })
}

/**
 * Président de la saison active ; à défaut (pas encore réinscrit en
 * septembre), celui de la saison précédente. null si aucun des deux.
 */
export async function trouverPresident(saisonActiveId: string): Promise<PresidentTrouve | null> {
  let trouve = await presidentDeSaison(saisonActiveId)
  let depuisPrecedente = false
  if (!trouve) {
    const prec = await getSaisonPrecedente(saisonActiveId)
    if (prec) {
      trouve = await presidentDeSaison(prec.id)
      depuisPrecedente = !!trouve
    }
  }
  if (!trouve) return null
  const a = trouve.adherent
  return {
    nom: a.nom, prenom: a.prenom,
    email: decrypt(a.emailEnc)?.trim() || null,
    saisonLabel: a.saison.label,
    depuisPrecedente,
  }
}

// ─── Téléphones mémorisés ───────────────────────────────────────────────────

/** Téléphone mémorisé pour une personne (clé nom + prénom), ou ''. */
export async function telephoneMemorise(nom: string, prenom: string): Promise<string> {
  const c = await prisma.contactDemande.findUnique({
    where: { cle: makeKey(nom, prenom) }, select: { telephoneEnc: true },
  })
  return decrypt(c?.telephoneEnc) ?? ''
}

/** Mémorise (crée ou met à jour) le téléphone d'une personne. */
export async function memoriserTelephone(nom: string, prenom: string, telephone: string): Promise<void> {
  const tel = telephone.trim()
  const telephoneEnc = encrypt(tel)
  if (!tel || !telephoneEnc) return
  await prisma.contactDemande.upsert({
    where:  { cle: makeKey(nom, prenom) },
    create: { cle: makeKey(nom, prenom), nom, prenom, telephoneEnc },
    update: { nom, prenom, telephoneEnc },
  })
}

// ─── Contexte de l'écran ────────────────────────────────────────────────────

export interface ContexteDemande {
  saison:   { id: string; label: string } | null
  /** Le modèle PDF de la saison active est-il chargé ? */
  modelePresent: boolean
  types:    { id: string; libelle: string }[]
  destinataires: { id: string; nom: string; prenom: string | null; email: string; role: string | null; selectionne: boolean }[]
  president: PresidentTrouve | null
  presidentTel: string
  demandeur: { prenomNom: string; email: string }
  demandeurTel: string
  smtp: { configure: boolean; verifie: boolean }
  /** Adhérents de la saison active (invités exclus), pour les responsables de l'accueil */
  adherents: { id: string; nom: string; prenom: string; aEmail: boolean }[]
  historique: {
    id: string; dateSouhaitee: string; heureDebut: string; heureFin: string
    type: string; nbAdultes: number; nbEnfants: number
    statut: 'BROUILLON' | 'ENVOYEE' | 'ERREUR'; erreur: string | null
    envoyeePar: string; envoyeeLe: string | null; creeLe: string
  }[]
}

export async function chargerContexte(user: SessionUser): Promise<ContexteDemande> {
  const saison = await prisma.saison.findFirst({ where: { isActive: true }, select: { id: true, label: true } })

  const [types, destinataires, smtp, demandeurTel] = await Promise.all([
    prisma.typeDemande.findMany({ where: { actif: true }, orderBy: { ordre: 'asc' }, select: { id: true, libelle: true } }),
    prisma.destinataireDemande.findMany({
      where: { actif: true }, orderBy: { ordre: 'asc' },
      select: { id: true, nom: true, prenom: true, email: true, role: true, selectionne: true },
    }),
    prisma.userSmtpConfig.findUnique({ where: { userId: user.id }, select: { isVerified: true } }),
    telephoneMemorise(user.lastName, user.firstName),
  ])

  const base = {
    types, destinataires, demandeurTel,
    demandeur: { prenomNom: formaterPrenomNom(user.firstName, user.lastName), email: user.email },
    smtp: { configure: !!smtp, verifie: !!smtp?.isVerified },
  }
  if (!saison) {
    return { ...base, saison: null, modelePresent: false, president: null, presidentTel: '', adherents: [], historique: [] }
  }

  const [modele, president, adherents, demandes] = await Promise.all([
    prisma.modeleDemande.findUnique({ where: { saisonId: saison.id }, select: { id: true } }),
    trouverPresident(saison.id),
    prisma.adherent.findMany({
      where:   { saisonId: saison.id },
      select:  { id: true, nom: true, prenom: true, licence: true, emailEnc: true },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    }),
    // Historique : la colonne pdf n'est JAMAIS chargée ici
    prisma.demandeAccueil.findMany({
      where:   { saisonId: saison.id },
      orderBy: { createdAt: 'desc' },
      select:  {
        id: true, dateSouhaitee: true, heureDebut: true, heureFin: true,
        nbAdultes: true, nbEnfants: true, statut: true, erreur: true, envoyeeLe: true, createdAt: true,
        typeDemande: { select: { libelle: true } },
        creePar:     { select: { firstName: true, lastName: true } },
      },
    }),
  ])

  return {
    ...base,
    saison,
    modelePresent: !!modele,
    president,
    presidentTel: president ? await telephoneMemorise(president.nom, president.prenom) : '',
    adherents: adherents
      .filter(a => !estInvite(a.licence))
      .map(a => ({ id: a.id, nom: a.nom, prenom: a.prenom, aEmail: !!a.emailEnc })),
    historique: demandes.map(d => ({
      id: d.id,
      dateSouhaitee: d.dateSouhaitee.toISOString().slice(0, 10),
      heureDebut: d.heureDebut, heureFin: d.heureFin,
      type: d.typeDemande.libelle, nbAdultes: d.nbAdultes, nbEnfants: d.nbEnfants,
      statut: d.statut, erreur: d.erreur,
      envoyeePar: formaterPrenomNom(d.creePar.firstName, d.creePar.lastName),
      envoyeeLe: d.envoyeeLe?.toISOString() ?? null,
      creeLe: d.createdAt.toISOString(),
    })),
  }
}

// ─── Préparation d'une demande (aperçu ET envoi) ────────────────────────────

export interface DemandePreparee {
  saisonId:      string
  typeDemandeId: string
  modele:        { id: string; pdf: Uint8Array; champs: StylesChamps }
  dateSouhaitee: Date
  valeurs:       ValeursDemande
  a:             string[]
  cc:            string[]
  objet:         string
  corps:         string
  nomFichier:    string
  responsables:  { ordre: number; adherentId: string; nom: string }[]
  /** Pour mémoriser les téléphones après un envoi réussi */
  president:     { nom: string; prenom: string }
}

/** Erreur de saisie : message destiné à l'utilisateur. */
export class ErreurSaisie extends Error {}

/**
 * Valide la saisie et calcule tout ce qu'il faut pour générer le PDF et le
 * mail. Lève ErreurSaisie (message lisible) si quelque chose bloque.
 */
export async function preparerDemande(
  user: SessionUser,
  saisie: SaisieDemande,
  pourEnvoi: boolean,
): Promise<DemandePreparee> {
  const erreurs = controlerSaisie(saisie, pourEnvoi)
  if (erreurs.length) throw new ErreurSaisie(erreurs.join(' '))

  const saison = await prisma.saison.findFirst({ where: { isActive: true }, select: { id: true, label: true } })
  if (!saison) throw new ErreurSaisie('Aucune saison active.')

  const idsResp = [saisie.responsable1Id, saisie.responsable2Id].filter(Boolean)
  const [modele, type, president, responsables, destinataires] = await Promise.all([
    prisma.modeleDemande.findUnique({ where: { saisonId: saison.id }, select: { id: true, pdf: true, champs: true } }),
    prisma.typeDemande.findFirst({ where: { id: saisie.typeDemandeId, actif: true }, select: { id: true, libelle: true } }),
    trouverPresident(saison.id),
    prisma.adherent.findMany({
      where:  { id: { in: idsResp }, saisonId: saison.id },
      select: { id: true, nom: true, prenom: true, emailEnc: true, licence: true },
    }),
    prisma.destinataireDemande.findMany({
      where:  { id: { in: saisie.destinataireIds ?? [] }, actif: true },
      orderBy: { ordre: 'asc' },
      select: { email: true },
    }),
  ])

  if (!modele) {
    throw new ErreurSaisie(`Aucun modèle PDF pour la saison ${saison.label} : un administrateur doit le charger dans Gestion des saisons.`)
  }
  if (!type) throw new ErreurSaisie('Type de demande introuvable ou désactivé.')
  if (!president) {
    throw new ErreurSaisie(
      "Aucun président·e n'est désigné, ni sur la saison active ni sur la précédente : " +
      'un administrateur doit le désigner dans Config → Bureau.',
    )
  }

  const resp = (id: string) => {
    const a = responsables.find(r => r.id === id)
    if (!a || estInvite(a.licence)) throw new ErreurSaisie("Responsable de l'accueil introuvable dans la saison active.")
    return a
  }
  const r1 = resp(saisie.responsable1Id)
  const r2 = saisie.responsable2Id ? resp(saisie.responsable2Id) : null

  const date = dateIsoVersUtc(saisie.dateSouhaitee)!   // déjà contrôlée
  const jour = formaterJour(date)
  const heureDebut = formaterHeure(saisie.heureDebut)
  const heureFin   = formaterHeure(saisie.heureFin)
  const demandeur  = formaterPrenomNom(user.firstName, user.lastName)
  const nomR1 = formaterPrenomNom(r1.prenom, r1.nom)
  const nomR2 = r2 ? formaterPrenomNom(r2.prenom, r2.nom) : ''

  const valeurs: ValeursDemande = {
    type_demande:          type.libelle,
    president_nom:         formaterPrenomNom(president.prenom, president.nom),
    president_tel:         saisie.presidentTel.trim(),
    president_email:       president.email ?? '',
    demandeur_nom:         demandeur,
    demandeur_tel:         saisie.demandeurTel.trim(),
    demandeur_email:       user.email,
    jour_souhaite:         jour,
    horaires_souhaites:    `${heureDebut} - ${heureFin}`,
    responsable_accueil_1: nomR1,
    responsable_accueil_2: nomR2,
    nb_adultes:            String(saisie.nbAdultes),
    nb_enfants:            String(saisie.nbEnfants),
  }

  // À = destinataires cochés ; CC = président, responsables, créateur (obligatoire :
  // Brevo / Bbox ne gardent pas de copie dans « Envoyés »).
  const { a, cc } = dedoublonnerAdresses(
    destinataires.map(d => d.email),
    [president.email, decrypt(r1.emailEnc), r2 ? decrypt(r2.emailEnc) : null, user.email],
  )

  return {
    saisonId: saison.id,
    typeDemandeId: type.id,
    modele: { id: modele.id, pdf: modele.pdf, champs: (modele.champs ?? {}) as StylesChamps },
    dateSouhaitee: date,
    valeurs, a, cc,
    objet: objetMail(type.libelle, jour),
    corps: corpsMail({
      jour, heureDebut, heureFin, libelleType: type.libelle,
      nbAdultes: saisie.nbAdultes, nbEnfants: saisie.nbEnfants,
      demandeur, telephone: saisie.demandeurTel.trim(),
    }),
    nomFichier: nomFichierPdf(saisie.dateSouhaitee.trim()),
    responsables: [
      { ordre: 1, adherentId: r1.id, nom: nomR1 },
      ...(r2 ? [{ ordre: 2, adherentId: r2.id, nom: nomR2 }] : []),
    ],
    president: { nom: president.nom, prenom: president.prenom },
  }
}
