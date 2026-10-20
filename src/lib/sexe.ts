// Déduction du sexe à partir de la civilité VPdive — partagé client/serveur.
// Même règle que civiliteVersSexe() dans actions/extractions.ts (O.M.S).

export type Sexe = 'F' | 'H' | 'NR'   // NR = non renseigné / civilité illisible

export const SEXE_LABEL: Record<Sexe, string> = {
  F:  'Femmes',
  H:  'Hommes',
  NR: 'Non renseigné',
}

export function civiliteVersSexe(civ: string | null | undefined): Sexe {
  if (!civ) return 'NR'
  const c = civ.trim().toLowerCase()
  if (c.startsWith('m.') || c === 'm' || c === 'monsieur') return 'H'
  if (c.startsWith('mme') || c.startsWith('mlle') || c === 'madame' || c === 'mademoiselle') return 'F'
  return 'NR'
}

// ── Invités ──────────────────────────────────────────────────────────────────
// Personnes saisies avec « INVITE » dans la colonne licence : elles ne font pas
// partie du CSN et sont exclues des statistiques. Tolère casse, espaces et
// accent (INVITÉ, invite, « Invité »…).
export function estInvite(licence: string | null | undefined): boolean {
  if (!licence) return false
  return licence
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toUpperCase() === 'INVITE'
}
