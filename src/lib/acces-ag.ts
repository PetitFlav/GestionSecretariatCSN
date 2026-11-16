// ── Accès « présentation d'AG » par lien secret ──────────────────────────────
// Le smiley du PowerPoint d'AG pointe sur /ag/<jeton>. Impossible de savoir
// qu'un clic vient de CE fichier : le jeton dans l'adresse est la seule preuve,
// et quiconque possède le lien entre. D'où les garde-fous :
//   - lecture seule, statistiques agrégées uniquement (aucun nom, aucune
//     session ouverte, pas d'import, pas de menu vers le reste de l'appli) ;
//   - date d'expiration OBLIGATOIRE (le PPTX circule souvent après l'AG) ;
//   - révocable à tout moment : supprimer/changer AG_JETON dans Vercel.
//
// Variables d'environnement (Vercel) :
//   AG_JETON          ≥ 32 caractères aléatoires (sinon accès désactivé)
//   AG_JETON_EXPIRE   JJ/MM/AAAA — lien valable jusqu'à la fin de ce jour
//                     (heure de Paris) ; absente = accès désactivé
//
// ⚠️ PAS de 'use server' : fonction interne, pas un point d'entrée.

import { createHash, timingSafeEqual } from 'crypto'

const LONGUEUR_MIN = 32

/** Date du jour à Paris au format AAAA-MM-JJ. */
function aujourdhuiParis(): string {
  // 'fr-CA' formate en AAAA-MM-JJ
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

/** JJ/MM/AAAA → AAAA-MM-JJ, ou null si invalide. */
function versIso(date: string | undefined): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date?.trim() ?? '')
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

export function jetonAgValide(jeton: string | undefined): boolean {
  const attendu = process.env.AG_JETON?.trim() ?? ''
  const expire  = versIso(process.env.AG_JETON_EXPIRE)
  if (attendu.length < LONGUEUR_MIN || !expire || !jeton) return false
  if (aujourdhuiParis() > expire) return false

  // Comparaison à temps constant (sur les empreintes, de longueur fixe) :
  // la durée de la vérification ne renseigne pas sur le jeton.
  const a = createHash('sha256').update(jeton).digest()
  const b = createHash('sha256').update(attendu).digest()
  return timingSafeEqual(a, b)
}

/** Date d'expiration affichable (JJ/MM/AAAA), pour le bandeau de la page. */
export function expirationAg(): string | null {
  return process.env.AG_JETON_EXPIRE?.trim() || null
}
