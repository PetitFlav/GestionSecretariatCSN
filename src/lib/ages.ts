// Tranches d'âge des statistiques — partagé client/serveur.
//
// Les deux premières reprennent les catégories de licence FFESSM :
//   Enfant  = moins de 12 ans
//   Jeune   = 12 à 15 ans  (la grille FFESSM écrit « 12 à 16 ans » ET
//             « adulte 16 ans et plus » : on tranche 16 ans = adulte)
// Les suivantes sont des tranches du club.
//
// L'âge est calculé à une DATE PIVOT FIXE par saison (sa dateDebut,
// ex. 01/09/2026) et non à aujourd'hui : sinon les membres d'une ancienne
// saison paraîtraient plus âgés et la comparaison N / N-1 glisserait.

export const TRANCHES = [
  { id: 'ENF', label: 'Enfants (< 12)', min: 0,  max: 11 },
  { id: 'JEU', label: 'Jeunes (12–15)', min: 12, max: 15 },
  { id: 'A16', label: '16–25',          min: 16, max: 25 },
  { id: 'A26', label: '26–39',          min: 26, max: 39 },
  { id: 'A40', label: '40–49',          min: 40, max: 49 },
  { id: 'A50', label: '50–59',          min: 50, max: 59 },
  { id: 'A60', label: '60 et +',        min: 60, max: 200 },
] as const

export type TrancheId = typeof TRANCHES[number]['id'] | 'NR'

export const TRANCHE_LABEL: Record<TrancheId, string> = {
  ...Object.fromEntries(TRANCHES.map(t => [t.id, t.label])),
  NR: 'Non renseigné',
} as Record<TrancheId, string>

export const ORDRE_TRANCHES: TrancheId[] = [...TRANCHES.map(t => t.id), 'NR']

// Dates stockées en JJ/MM/AAAA
function parseFr(d: string | null | undefined): { j: number; m: number; a: number } | null {
  const r = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(d?.trim() ?? '')
  if (!r) return null
  return { j: parseInt(r[1]), m: parseInt(r[2]), a: parseInt(r[3]) }
}

/** Âge révolu à la date pivot, ou null si une des dates est illisible. */
export function ageA(dateNaissance: string | null | undefined, pivot: string | null | undefined): number | null {
  const n = parseFr(dateNaissance)
  const p = parseFr(pivot)
  if (!n || !p) return null
  let age = p.a - n.a
  if (p.m < n.m || (p.m === n.m && p.j < n.j)) age--
  return age >= 0 && age < 120 ? age : null   // garde-fou contre une date aberrante
}

export function trancheAge(dateNaissance: string | null | undefined, pivot: string | null | undefined): TrancheId {
  const age = ageA(dateNaissance, pivot)
  if (age === null) return 'NR'
  return TRANCHES.find(t => age >= t.min && age <= t.max)?.id ?? 'NR'
}
