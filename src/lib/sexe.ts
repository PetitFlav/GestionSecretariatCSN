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
