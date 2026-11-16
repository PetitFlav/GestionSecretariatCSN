// ── Classement des brevets FFESSM pour les statistiques ──────────────────────
// Transforme un libellé FFESSM brut en { famille, libellé court, ordre }.
// Utilisé côté navigateur (tableau des diplômes) : pas de 'use server'.
//
// Les RÈGLES sont testées dans l'ordre ; la première qui correspond gagne.
// Leur position fixe aussi l'ordre d'affichage dans la famille.
// Pour ajouter un brevet : une ligne { re, famille, court? } au bon endroit.
// `court` absent = libellé FFESSM gardé tel quel.
// Un libellé qui ne correspond à aucune règle s'affiche brut, dans « Autres » :
// rien ne disparaît du total.

export type Famille =
  | 'Plongée'
  | 'Plongée enfants'
  | 'Spécialités plongée'
  | 'Apnée'
  | 'Handisub'
  | 'Secourisme'
  | 'Encadrement'
  | 'Autres'

export const ORDRE_FAMILLES: Famille[] = [
  'Plongée', 'Plongée enfants', 'Spécialités plongée', 'Apnée',
  'Handisub', 'Secourisme', 'Encadrement', 'Autres',
]

interface Regle {
  re:      RegExp
  famille: Famille
  court?:  string | ((m: RegExpExecArray) => string)
}

const REGLES: Regle[] = [
  // Encadrement EN PREMIER : « Moniteur Nitrox Confirmé » ne doit pas tomber
  // dans les spécialités, ni « Initiateur … apnée » dans l'apnée.
  { re: /moniteur|initiateur|entra[iî]neur|\bmf ?[12]\b|^e[1-4]\b|encadrant|instructeur/i, famille: 'Encadrement' },

  // Secourisme AVANT l'apnée : « RIFA Apnée » est un brevet de secourisme.
  { re: /^rifa plong/i,                   famille: 'Secourisme', court: 'RIFA Plongée' },
  { re: /^rifa apn/i,                     famille: 'Secourisme', court: 'RIFA Apnée' },
  { re: /^rifa hockey/i,                  famille: 'Secourisme', court: 'RIFA Hockey' },
  { re: /rifa|anteor|secour|\bpsc|\bpse/i, famille: 'Secourisme' },

  { re: /^niveau 1$/i,                    famille: 'Plongée', court: 'Plongée Niveau 1' },
  { re: /^niveau 1 passerelle/i,          famille: 'Plongée' },
  { re: /^niveau 2$/i,                    famille: 'Plongée', court: 'Plongée Niveau 2' },
  { re: /^niveau 3$/i,                    famille: 'Plongée', court: 'Plongée Niveau 3' },
  { re: /^niveau 4|guide de palanqu/i,    famille: 'Plongée', court: 'Plongée Niveau 4 (Guide de palanquée)' },
  { re: /^niveau 5/i,                     famille: 'Plongée', court: 'Plongée Niveau 5' },
  { re: /^niveau/i,                       famille: 'Plongée' },

  { re: /^plongeur bronze/i,              famille: 'Plongée enfants', court: 'Plongeur Bronze' },
  { re: /^plongeur argent/i,              famille: 'Plongée enfants', court: 'Plongeur Argent' },
  { re: /^plongeur (d')?or\b/i,           famille: 'Plongée enfants', court: 'Plongeur Or' },

  { re: /^plongeur nitrox$/i,             famille: 'Spécialités plongée', court: 'Plongeur Nitrox' },
  { re: /nitrox/i,                        famille: 'Spécialités plongée' },
  { re: /trimix|recycleur/i,              famille: 'Spécialités plongée' },
  { re: /biolog\w*\s*(niveau \d)/i,       famille: 'Spécialités plongée', court: m => `Plongeur Bio ${cap(m[1])}` },
  { re: /biolog/i,                        famille: 'Spécialités plongée' },
  { re: /photo|vid[ée]o|arch[ée]o|souterrain|d[ée]rivant/i, famille: 'Spécialités plongée' },

  // « Apnéiste / Indoor Freediver 1 CMAS » → « Apnéiste Piscine (Indoor 1 CMAS) »
  { re: /^apn[ée]iste \/ indoor freediver (\d)/i,                famille: 'Apnée', court: m => `Apnéiste Piscine (Indoor ${m[1]} CMAS)` },
  { re: /^apn[ée]iste en eau libre \/ outdoor freediver (\d)/i,  famille: 'Apnée', court: m => `Apnéiste Eau Libre (Outdoor ${m[1]} CMAS)` },
  { re: /^apn[ée]iste confirm[ée] \/ indoor freediver (\d)/i,    famille: 'Apnée', court: m => `Apnéiste confirmé Piscine (Indoor ${m[1]} CMAS)` },
  { re: /^(.+?)\s*\/\s*(indoor|outdoor) freediver (\d)/i,        famille: 'Apnée', court: m => `${m[1]} (${cap(m[2])} ${m[3]} CMAS)` },
  { re: /apn[ée]|freediver/i,                                    famille: 'Apnée' },

  // « P.E.S.H.3 - 20 mètres », « P.E.S.H.2 12 mètres » → « P.E.S.H. 3 (20 m) »
  { re: /p\.?\s*e\.?\s*s\.?\s*h\.?\s*(\d)\D*?(\d+)\s*m/i, famille: 'Handisub', court: m => `P.E.S.H. ${m[1]} (${m[2]} m)` },
  { re: /p\.?\s*e\.?\s*s\.?\s*h|handi/i,                  famille: 'Handisub' },
]

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

export interface ClasseBrevet {
  famille: Famille
  libelle: string
  ordre:   number   // rang de la règle (les « Autres » à la fin)
}

export function classerBrevet(niveau: string): ClasseBrevet {
  const n = niveau.trim()
  for (let i = 0; i < REGLES.length; i++) {
    const r = REGLES[i]
    const m = r.re.exec(n)
    if (!m) continue
    const libelle = typeof r.court === 'function' ? r.court(m) : (r.court ?? n)
    return { famille: r.famille, libelle, ordre: i }
  }
  return { famille: 'Autres', libelle: n, ordre: REGLES.length }
}
