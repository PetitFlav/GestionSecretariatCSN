// Statuts d'adhésion — constantes partagées client/serveur.
// (Pas dans actions/adherents.ts : un fichier 'use server' ne peut exporter
// que des fonctions async.)

export const STATUTS = ['LICENCIE', 'EXTERNE', 'PASSAGER'] as const
export type Statut = typeof STATUTS[number]

export const STATUT_LABEL: Record<Statut, string> = {
  LICENCIE: 'Licencié CSN',
  EXTERNE:  'Adhérent externe',
  PASSAGER: 'Passager',
}

export const STATUT_DESCRIPTION: Record<Statut, string> = {
  LICENCIE: 'Adhésion + licence FFESSM prises au CSN. Contrôlé dans le fichier FFESSM.',
  EXTERNE:  'Adhésion au CSN, licence prise dans un autre club. Non contrôlé dans le fichier FFESSM.',
  PASSAGER: "Licence prise via le CSN, sans adhésion : pas d'accès aux entraînements, pas d'étiquette. Contrôlé dans le fichier FFESSM.",
}

// Couleurs de badge (LICENCIE = cas standard, pas de badge)
export const STATUT_BADGE: Record<Statut, { bg: string; fg: string; border: string } | null> = {
  LICENCIE: null,
  EXTERNE:  { bg: '#eef2ff', fg: '#4338ca', border: '#c7d2fe' },
  PASSAGER: { bg: '#f1f5f9', fg: '#64748b', border: '#cbd5e1' },
}

export function isStatut(v: unknown): v is Statut {
  return typeof v === 'string' && (STATUTS as readonly string[]).includes(v)
}

/** L'adhérent doit-il apparaître dans le fichier FFESSM du club ? */
export function soumisControleFFESSM(statut: Statut): boolean {
  return statut !== 'EXTERNE'
}

/** Peut-on lui imprimer une étiquette (accès aux entraînements) ? */
export function peutAvoirEtiquette(statut: Statut): boolean {
  return statut !== 'PASSAGER'
}
