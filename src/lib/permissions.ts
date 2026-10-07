/**
 * src/lib/permissions.ts
 *
 * Règles de gestion des comptes utilisateurs :
 *   - SUPERUSER : peut tout gérer (sauf son propre compte) et attribuer tous les rôles
 *   - ADMIN     : ne gère que les comptes USER, et ne peut attribuer que USER
 *   - personne ne peut agir sur son propre compte depuis l'écran admin
 *
 * ⚠️ Pas de 'use server' : ces fonctions sont internes, pas des endpoints.
 */

import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/session'

export type Role = 'USER' | 'ADMIN' | 'SUPERUSER'

const RANK: Record<Role, number> = { USER: 0, ADMIN: 1, SUPERUSER: 2 }

type Account = { id: string; role: Role }

/** L'acteur peut-il désactiver / réactiver / renvoyer un lien à la cible ? */
export function canManage(actor: Account, target: Account): boolean {
  if (actor.id === target.id) return false
  if (actor.role === 'SUPERUSER') return true
  return RANK[target.role] < RANK[actor.role]
}

/** Rôles que l'acteur a le droit d'attribuer */
export function assignableRoles(actorRole: Role): Role[] {
  if (actorRole === 'SUPERUSER') return ['USER', 'ADMIN', 'SUPERUSER']
  return (Object.keys(RANK) as Role[]).filter(r => RANK[r] < RANK[actorRole])
}

/** Rôles proposés lors d'un changement de rôle (SUPERUSER exclu volontairement) */
export const ROLE_CHANGE_OPTIONS: Role[] = ['USER', 'ADMIN']

/** Seul un SUPERUSER change le rôle d'un compte, et jamais celui d'un autre SUPERUSER */
export function canChangeRole(actor: Account, target: Account): boolean {
  return actor.role === 'SUPERUSER' && target.role !== 'SUPERUSER' && actor.id !== target.id
}

/**
 * Vérifie qu'une action admin sur `targetId` est autorisée.
 *
 * L'acteur est relu EN BASE et non depuis le cookie de session : le cookie
 * peut garder un ancien rôle jusqu'à 7 jours (un admin rétrogradé ou désactivé
 * conserverait sinon ses droits).
 */
export async function authorizeUserAdmin(targetId: string): Promise<
  | { ok: true; actor: Account; target: Account }
  | { ok: false; error: string }
> {
  const session = await getSessionUser()
  if (!session) return { ok: false, error: 'Accès refusé.' }

  const actor = await prisma.user.findUnique({
    where:  { id: session.id },
    select: { id: true, role: true, status: true },
  })
  if (!actor || actor.status !== 'ACTIVE' || RANK[actor.role as Role] < RANK.ADMIN) {
    return { ok: false, error: 'Accès refusé.' }
  }

  const target = await prisma.user.findUnique({
    where:  { id: targetId },
    select: { id: true, role: true },
  })
  if (!target) return { ok: false, error: 'Utilisateur introuvable.' }

  const a = { id: actor.id,  role: actor.role  as Role }
  const t = { id: target.id, role: target.role as Role }

  if (!canManage(a, t)) {
    return { ok: false, error: 'Vous n’avez pas les droits pour modifier ce compte.' }
  }
  return { ok: true, actor: a, target: t }
}
