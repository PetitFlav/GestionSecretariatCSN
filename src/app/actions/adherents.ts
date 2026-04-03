'use server'

import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { requireAuth } from '@/lib/session'

export async function getSaisonActive() {
  return prisma.saison.findFirst({ where: { isActive: true } })
}

export interface AdherentFilters {
  search?:      string
  imprime?:     'oui' | 'non' | ''
  attestation?: 'oui' | 'non' | ''
  page?:        number
  perPage?:     number
}

// ── Étiquettes ────────────────────────────────────────────────────────────────

export interface AdherentEtiquette {
  id:             string
  nom:            string
  prenom:         string
  licence:        string | null
  dateExpiration: string | null
  caci:           string | null
  imprime:        boolean
}

export async function getAdherentsEtiquettes(
  saisonId: string,
  filters: AdherentFilters = {}
): Promise<{ adherents: AdherentEtiquette[]; total: number; page: number; totalPages: number }> {
  await requireAuth()
  const page = filters.page ?? 1
  const perPage = filters.perPage ?? 25
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { saisonId }
  if (filters.search?.trim()) {
    const s = filters.search.trim()
    where.OR = [
      { nom:     { contains: s, mode: 'insensitive' } },
      { prenom:  { contains: s, mode: 'insensitive' } },
      { licence: { contains: s, mode: 'insensitive' } },
    ]
  }
  if (filters.imprime === 'oui') where.impressions = { some: { status: 'PRINTED' } }
  if (filters.imprime === 'non') where.impressions = { none: { status: 'PRINTED' } }

  const [total, rows] = await Promise.all([
    prisma.adherent.count({ where }),
    prisma.adherent.findMany({
      where, skip: (page - 1) * perPage, take: perPage,
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      include: { impressions: { where: { status: 'PRINTED' }, take: 1, select: { id: true } } },
    }),
  ])
  return {
    adherents: rows.map(a => ({
      id: a.id, nom: a.nom, prenom: a.prenom,
      licence: a.licence, dateExpiration: a.dateExpiration,
      caci: a.caci, imprime: a.impressions.length > 0,
    })),
    total, page, totalPages: Math.ceil(total / perPage),
  }
}

// ── Attestations ──────────────────────────────────────────────────────────────

export interface AdherentAttestation {
  id:                      string
  civilite:                string | null
  nom:                     string
  prenom:                  string
  montant:                 string | null
  email:                   string | null
  attestationEnvoyee:      boolean
  dateDerniereAttestation: Date | null
}

export async function getAdherentsAttestations(
  saisonId: string,
  filters: AdherentFilters = {}
): Promise<{ adherents: AdherentAttestation[]; total: number; page: number; totalPages: number }> {
  await requireAuth()
  const page = filters.page ?? 1
  const perPage = filters.perPage ?? 25
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { saisonId }
  if (filters.search?.trim()) {
    const s = filters.search.trim()
    where.OR = [
      { nom:    { contains: s, mode: 'insensitive' } },
      { prenom: { contains: s, mode: 'insensitive' } },
    ]
  }
  if (filters.attestation === 'oui') where.attestationEmails = { some: {} }
  if (filters.attestation === 'non') where.attestationEmails = { none: {} }

  const [total, rows] = await Promise.all([
    prisma.adherent.count({ where }),
    prisma.adherent.findMany({
      where, skip: (page - 1) * perPage, take: perPage,
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      include: {
        attestationEmails: { orderBy: { sentAt: 'desc' }, take: 1, select: { sentAt: true } },
      },
    }),
  ])
  return {
    adherents: rows.map(a => ({
      id: a.id, civilite: a.civilite, nom: a.nom, prenom: a.prenom,
      montant: a.montant, email: decrypt(a.emailEnc),
      attestationEnvoyee: a.attestationEmails.length > 0,
      dateDerniereAttestation: a.attestationEmails[0]?.sentAt ?? null,
    })),
    total, page, totalPages: Math.ceil(total / perPage),
  }
}

// ── Suivi & alertes ───────────────────────────────────────────────────────────

export interface AlerteCaci {
  id:     string
  nom:    string
  prenom: string
  caci:   string
  jours:  number
}

export interface AlerteFFESSM {
  id:       string
  nom:      string
  prenom:   string
  type:     'absent' | 'desync'
  detail?:  string
  passager: boolean
}

export interface SuiviResult {
  caciExpires:          AlerteCaci[]
  caciExpirentBientot:  AlerteCaci[]
  ffessmAbsents:        AlerteFFESSM[]
  ffessmDesync:         AlerteFFESSM[]
  totalAdherents:       number
  totalAssures:         number
}

export async function getSuivi(saisonId: string): Promise<SuiviResult> {
  await requireAuth()

  const adherents = await prisma.adherent.findMany({
    where:   { saisonId },
    orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    select: {
      id: true, nom: true, prenom: true,
      caci: true, ffessmId: true, adresseDesync: true, passager: true,
      adresseEnc: true, codePostalEnc: true, villeEnc: true,
    },
  })

  const now = Date.now()
  const caciExpires:         AlerteCaci[]   = []
  const caciExpirentBientot: AlerteCaci[]   = []
  const ffessmAbsents:       AlerteFFESSM[] = []
  const ffessmDesync:        AlerteFFESSM[] = []

  for (const a of adherents) {
    // CACI
    if (!a.caci) {
      caciExpires.push({ id: a.id, nom: a.nom, prenom: a.prenom, caci: 'Non renseigné', jours: -999 })
    } else {
      const jours = diffJours(a.caci, now)
      if (jours < 0)       caciExpires.push({ id: a.id, nom: a.nom, prenom: a.prenom, caci: a.caci, jours })
      else if (jours < 90) caciExpirentBientot.push({ id: a.id, nom: a.nom, prenom: a.prenom, caci: a.caci, jours })
    }

    // FFESSM
    if (!a.ffessmId && !a.passager) {
      ffessmAbsents.push({ id: a.id, nom: a.nom, prenom: a.prenom, type: 'absent', passager: a.passager })
    } else if (a.adresseDesync) {
      const adresse = [decrypt(a.adresseEnc), decrypt(a.codePostalEnc), decrypt(a.villeEnc)]
        .filter(Boolean).join(' ')
      ffessmDesync.push({ id: a.id, nom: a.nom, prenom: a.prenom, type: 'desync', detail: adresse || undefined, passager: a.passager })
    }
  }

  caciExpires.sort((a, b) => a.jours - b.jours)
  caciExpirentBientot.sort((a, b) => a.jours - b.jours)

  return {
    caciExpires, caciExpirentBientot, ffessmAbsents, ffessmDesync,
    totalAdherents: adherents.length,
    totalAssures:   adherents.filter(a => !!a.ffessmId).length,
  }
}

// ── Fiche adhérent ────────────────────────────────────────────────────────────

export interface AdherentDetail {
  id: string; nom: string; prenom: string; civilite: string | null
  licence: string | null; montant: string | null; datePaiement: string | null
  dateExpiration: string | null; caci: string | null
  adresseDesync: boolean; ffessmId: string | null; passager: boolean
  email: string | null; dateNaissance: string | null
  adresse: string | null; codePostal: string | null; ville: string | null
  ffessmStatut:    string | null
  // Adresse FFESSM déchiffrée
  ffessmAdresse:   string | null
  ffessmCodePostal: string | null
  ffessmVille:     string | null
  impressions:  { id: string; printedAt: Date; status: string }[]
  attestations: { id: string; sentAt: Date; email: string | null }[]
}

export async function getAdherentDetail(id: string): Promise<AdherentDetail | null> {
  await requireAuth()
  const a = await prisma.adherent.findUnique({
    where: { id },
    include: {
      validation:        { select: { statut: true, adresseEnc: true, codePostalEnc: true, villeEnc: true } },
      impressions:       { orderBy: { printedAt: 'desc' } },
      attestationEmails: { orderBy: { sentAt:    'desc' } },
    },
  })
  if (!a) return null
  return {
    id: a.id, nom: a.nom, prenom: a.prenom, civilite: a.civilite,
    licence: a.licence, montant: a.montant, datePaiement: a.datePaiement,
    dateExpiration: a.dateExpiration, caci: a.caci,
    adresseDesync: a.adresseDesync, ffessmId: a.ffessmId, passager: a.passager,
    email:         decrypt(a.emailEnc),
    dateNaissance: decrypt(a.dateNaissanceEnc),
    adresse:       decrypt(a.adresseEnc),
    codePostal:    decrypt(a.codePostalEnc),
    ville:         decrypt(a.villeEnc),
    ffessmStatut:    a.validation?.statut ?? null,
    ffessmAdresse:   decrypt(a.validation?.adresseEnc ?? null),
    ffessmCodePostal: decrypt(a.validation?.codePostalEnc ?? null),
    ffessmVille:     decrypt(a.validation?.villeEnc ?? null),
    impressions:   a.impressions.map(i => ({ id: i.id, printedAt: i.printedAt, status: i.status })),
    attestations:  a.attestationEmails.map(e => ({ id: e.id, sentAt: e.sentAt, email: e.email })),
  }
}

function diffJours(dateStr: string, now: number): number {
  try {
    const [d, m, y] = dateStr.split('/')
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
    return Math.floor((date.getTime() - now) / (1000 * 60 * 60 * 24))
  } catch { return -999 }
}

// ── Toggle passager ───────────────────────────────────────────────────────────

export async function togglePassager(
  adherentId: string,
  passager: boolean
): Promise<{ success: boolean }> {
  await requireAuth()
  await prisma.adherent.update({
    where: { id: adherentId },
    data:  { passager },
  })
  return { success: true }
}
