'use server'

import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { requireAuth } from '@/lib/session'
import * as XLSX from 'xlsx'

export interface OmsExtractionResult {
  ok:                    boolean
  error?:                string
  filename?:             string
  base64?:               string
  count?:                number
  communesNonReconnues?: string[]   // villes hors liste O.M.S — à vérifier à la main
}

// ── Paramètres du gabarit O.M.S (Nantes métropole) ───────────────────────────
// Ces réglages encodent les règles de la notice O.M.S :

// Caractère de croix attendu dans les colonnes D/A/Co/Lo/Nl.
const CROIX = 'x'

// Le CSN est une fédération DÉLÉGATAIRE (FFESSM) → croix dans la colonne D.
// Passer à false croiserait la colonne A (Affinitaire) à la place.
const DELEGATAIRE = true

// Notice O.M.S : « NL : Non licencié (dans ce cas, pas de numéro de licence) ».
// true  → licence absente = croix Nl (correct au sens O.M.S)
// false → tout le monde en Lo, même sans numéro de licence (« Lo par défaut » littéral)
const NL_SI_SANS_LICENCE = true

// En-têtes EXACTS du gabarit (retours à la ligne compris) — reproduits tels quels
// pour coller au fichier officiel. Ne pas modifier l'ordre ni le libellé.
const OMS_HEADERS = [
  'Num Licence',
  'D',
  'A',
  'Sexe\n(H ou F)',
  'Nom',
  'Prénom',
  'Date Naissance\n(JJ-MM-AAAA)',
  'CP',
  'Ville',
  'Co',
  'Lo',
  'Nl',
]

// ── Communes de Nantes métropole (orthographe O.M.S exacte) ──────────────────
// Source : page « statistiques » de l'O.M.S (répartition des licenciés par commune).
// Convention O.M.S : pas de trait d'union, « sur/de/les » en minuscules, accents conservés.
const COMMUNES_OMS = [
  'Nantes', 'Basse Goulaine', 'Bouaye', 'Bouguenais', 'Brains', 'Carquefou',
  'Couëron', 'Indre', 'La Chapelle sur Erdre', 'La Montagne', 'Le Pellerin',
  'Les Sorinières', 'Mauves sur Loire', 'Orvault', 'Rezé',
  'Saint Aignan de Grand Lieu', 'Saint Herblain', 'Saint Jean de Boiseau',
  'Saint Léger', 'Saint Sébastien sur Loire', 'Sainte Luce sur Loire',
  'Sautron', 'Thouaré sur Loire', 'Vertou',
]

// Clé de comparaison : sans accent, majuscules, tirets/apostrophes → espaces,
// St/Ste développés. Permet de matcher « St-Herblain », « SAINT HERBLAIN », etc.
function keyCommune(s: string): string {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[-'’.]/g, ' ')
    .replace(/\bST\b/g, 'SAINT')
    .replace(/\bSTE\b/g, 'SAINTE')
    .replace(/\s+/g, ' ')
    .trim()
}

const COMMUNE_MAP = new Map<string, string>()
for (const c of COMMUNES_OMS) COMMUNE_MAP.set(keyCommune(c), c)
// Alias : formes officielles longues → forme courte attendue par l'O.M.S.
COMMUNE_MAP.set(keyCommune('Saint Léger les Vignes'), 'Saint Léger')

function normaliseCommune(ville: string | null): { label: string; reconnue: boolean } {
  if (!ville || !ville.trim()) return { label: '', reconnue: false }
  const hit = COMMUNE_MAP.get(keyCommune(ville))
  return hit ? { label: hit, reconnue: true } : { label: ville.trim(), reconnue: false }
}

function civiliteVersSexe(civ: string | null): string {
  if (!civ) return ''
  const c = civ.trim().toLowerCase()
  if (c.startsWith('m.') || c === 'm' || c === 'monsieur') return 'H'
  if (c.startsWith('mme') || c.startsWith('mlle') || c === 'madame' || c === 'mademoiselle') return 'F'
  return ''
}

// La base stocke les dates en JJ/MM/AAAA ; l'O.M.S veut JJ-MM-AAAA.
function dateVersOms(d: string | null): string {
  if (!d) return ''
  return d.replace(/\//g, '-')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToOmsRow(a: any, villeOms: string): string[] {
  const licence = (a.licence ?? '').trim()
  const estNL   = NL_SI_SANS_LICENCE && licence === ''

  const colD  = DELEGATAIRE ? CROIX : ''
  const colA  = DELEGATAIRE ? ''    : CROIX
  const colCo = ''                         // compétiteurs cochés à la main par Yann
  const colLo = estNL ? '' : CROIX         // Loisir par défaut, sauf non-licencié
  const colNl = estNL ? CROIX : ''

  return [
    licence,                                  // Num Licence
    colD,                                     // D (délégataire)
    colA,                                     // A (affinitaire)
    civiliteVersSexe(a.civilite),             // Sexe (H/F)
    a.nom ?? '',                              // Nom
    a.prenom ?? '',                           // Prénom
    dateVersOms(decrypt(a.dateNaissanceEnc)), // Date Naissance (JJ-MM-AAAA)
    decrypt(a.codePostalEnc) ?? '',           // CP
    villeOms,                                 // Ville (normalisée O.M.S)
    colCo,                                    // Co
    colLo,                                    // Lo
    colNl,                                    // Nl
  ]
}

export async function extractionOms(saisonId: string): Promise<OmsExtractionResult> {
  try {
    await requireAuth()
  } catch {
    return { ok: false, error: 'Non authentifié' }
  }
  if (!saisonId) return { ok: false, error: 'Saison non sélectionnée' }

  const saison = await prisma.saison.findUnique({ where: { id: saisonId } })
  if (!saison) return { ok: false, error: 'Saison introuvable' }

  // Filtre : membres actifs de la saison (dateExpiration === dateExpireLicence).
  // C'est ce qui permet de sortir une saison passée sans être écrasé,
  // contrairement à VPdive. Les passagers (licence dans un autre club) sont inclus.
  const where = saison.dateExpireLicence
    ? { saisonId, dateExpiration: saison.dateExpireLicence }
    : { saisonId }

  const adherents = await prisma.adherent.findMany({
    where,
    orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    select: {
      nom: true, prenom: true, civilite: true, licence: true,
      dateNaissanceEnc: true, codePostalEnc: true, villeEnc: true,
    },
  })

  // Construction des lignes + collecte des communes non reconnues (hors métropole
  // ou orthographe inconnue) pour les remonter à Yann sans les modifier en douce.
  const communesNonReconnues = new Set<string>()
  const dataRows = adherents.map(a => {
    const villeBrute = decrypt(a.villeEnc) ?? ''
    const { label: villeOms, reconnue } = normaliseCommune(villeBrute)
    if (villeBrute.trim() && !reconnue) communesNonReconnues.add(villeBrute.trim())
    return mapToOmsRow(a, villeOms)
  })

  const aoa: string[][] = [OMS_HEADERS, ...dataRows]

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Feuil1')

  // Sortie au format .xls (BIFF8), comme le gabarit officiel.
  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'biff8' })

  const safeLabel = saison.label.replace(/[^A-Za-z0-9_-]/g, '_')
  return {
    ok:       true,
    filename: `Oms_Effectifs_${safeLabel}.xls`,
    base64,
    count:    adherents.length,
    communesNonReconnues: [...communesNonReconnues].sort((x, y) => x.localeCompare(y, 'fr')),
  }
}
