// ── Invités / accompagnants ──────────────────────────────────────────────────
// Statut à part, propre à l'appli (pas une donnée VPdive) : personnes qui
// accompagnent sans aller dans l'eau ni prendre d'adhésion.
// Convention actuelle : « INVITE » saisi dans la colonne licence.
//
//   Étiquettes   → GARDÉS (ils en ont besoin pour accéder au site)
//   Attestations → exclus (pas d'adhésion, rien à attester)
//   O.M.S        → exclus (pas membres du club)
//   Suivi        → exclus (sinon faux positifs FFESSM / CACI)
//   Statistiques → exclus
//
// ⚠️ SEUL ENDROIT où la règle est codée. Le jour où un champ booléen
// `invite` existera en base, il suffira de modifier les deux fonctions
// ci-dessous (ex. `return a.invite` / `{ invite: false }`) : tous les écrans
// suivront.

import type { Prisma } from '@prisma/client'

/** Test en mémoire (stats, suivi). Tolère casse, espaces et accent. */
export function estInvite(licence: string | null | undefined): boolean {
  if (!licence) return false
  return licence
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim().toUpperCase() === 'INVITE'
}

/**
 * Filtre Prisma « pas invité », pour les requêtes paginées ou exportées
 * (le comptage et la pagination doivent exclure les invités côté base).
 *
 * Le `licence: null` explicite est indispensable : un NOT Prisma/SQL écarte
 * aussi les lignes où la licence est vide — on perdrait les non-licenciés.
 */
export const PAS_INVITE: Prisma.AdherentWhereInput = {
  OR: [
    { licence: null },
    {
      NOT: {
        OR: [
          { licence: { equals: 'INVITE', mode: 'insensitive' } },
          { licence: { equals: 'INVITÉ', mode: 'insensitive' } },
        ],
      },
    },
  ],
}
