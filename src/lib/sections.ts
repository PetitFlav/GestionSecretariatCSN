// Sections du club proposées dans la fiche adhérent (saisie manuelle).
// ⚠ Garder aligné sur les libellés canoniques de SECTION_CANON
// (src/lib/parsers/formulaire.ts) : la liste adhérents filtre et les stats
// regroupent sur ces libellés exacts.
export const SECTIONS = [
  'Apnée',
  'Chasse',
  'Hockey subaquatique',
  'Nage avec palmes',
  'Plongée',
] as const

export type Section = (typeof SECTIONS)[number]

export function isSection(v: string): v is Section {
  return (SECTIONS as readonly string[]).includes(v)
}
