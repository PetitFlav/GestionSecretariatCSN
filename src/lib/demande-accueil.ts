/**
 * src/lib/demande-accueil.ts
 *
 * Fonctions PURES de la demande d'accueil piscine (aucun accès base, aucun
 * envoi) : textes du mail, adresses, contrôles de saisie.
 * Utilisables côté serveur comme côté navigateur.
 * Spec : docs/SPEC-demande-accueil.md § 7 et § 8.
 */

// ─── Saisie du formulaire ───────────────────────────────────────────────────

/** Ce que le navigateur envoie (aperçu et envoi). */
export interface SaisieDemande {
  typeDemandeId:   string
  /** « AAAA-MM-JJ » (input type=date) */
  dateSouhaitee:   string
  /** « HH:MM » */
  heureDebut:      string
  heureFin:        string
  responsable1Id:  string
  /** Facultatif : chaîne vide si absent */
  responsable2Id:  string
  nbAdultes:       number
  nbEnfants:       number
  presidentTel:    string
  demandeurTel:    string
  /** Destinataires cochés (ids DestinataireDemande) — utilisé pour l'envoi */
  destinataireIds: string[]
}

/** Délai conseillé par la Ville entre la demande et la date souhaitée. */
export const DELAI_CONSEILLE_JOURS = 15

const RE_DATE  = /^(\d{4})-(\d{2})-(\d{2})$/
const RE_HEURE = /^([01]?\d|2[0-3]):([0-5]\d)$/

/** « AAAA-MM-JJ » → Date à minuit UTC (comme une colonne @db.Date), ou null. */
export function dateIsoVersUtc(iso: string): Date | null {
  const m = RE_DATE.exec(iso?.trim() ?? '')
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  // Refuse les dates impossibles (31/02 → 03/03)
  return d.getUTCDate() === +m[3] && d.getUTCMonth() === +m[2] - 1 ? d : null
}

/** « HH:MM » → minutes depuis minuit, ou null. */
function minutes(heure: string): number | null {
  const m = RE_HEURE.exec(heure?.trim() ?? '')
  return m ? +m[1] * 60 + +m[2] : null
}

/** Nombre de jours entre aujourd'hui (date locale) et la date souhaitée « AAAA-MM-JJ ». */
export function joursAvant(iso: string, aujourdhui: Date = new Date()): number | null {
  const cible = dateIsoVersUtc(iso)
  if (!cible) return null
  const auj = Date.UTC(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate())
  return Math.round((cible.getTime() - auj) / 86_400_000)
}

/**
 * Contrôles qui ne demandent pas la base. Renvoie la liste des erreurs
 * bloquantes (vide = saisie correcte). `pourEnvoi` ajoute les contrôles
 * propres à l'envoi (au moins un destinataire).
 */
export function controlerSaisie(s: SaisieDemande, pourEnvoi: boolean): string[] {
  const e: string[] = []
  if (!s.typeDemandeId) e.push('Choisissez le type de demande.')

  if (!dateIsoVersUtc(s.dateSouhaitee)) e.push('Le jour souhaité est invalide.')

  const deb = minutes(s.heureDebut)
  const fin = minutes(s.heureFin)
  if (deb === null) e.push("L'heure de début est invalide (format HH:MM).")
  if (fin === null) e.push("L'heure de fin est invalide (format HH:MM).")
  if (deb !== null && fin !== null && fin <= deb) e.push("L'heure de fin doit être après l'heure de début.")

  if (!s.responsable1Id) e.push("Choisissez au moins un responsable de l'accueil.")
  if (s.responsable2Id && s.responsable2Id === s.responsable1Id) {
    e.push("Les deux responsables de l'accueil doivent être des personnes différentes.")
  }

  const entierOk = (n: number) => Number.isInteger(n) && n >= 0 && n <= 999
  if (!entierOk(s.nbAdultes)) e.push("Le nombre d'adultes doit être un entier positif ou nul.")
  if (!entierOk(s.nbEnfants)) e.push("Le nombre d'enfants doit être un entier positif ou nul.")
  if (entierOk(s.nbAdultes) && entierOk(s.nbEnfants) && s.nbAdultes + s.nbEnfants === 0) {
    e.push('Indiquez au moins un adulte ou un enfant.')
  }

  if (!s.presidentTel?.trim()) e.push('Indiquez le téléphone du président·e.')
  if (!s.demandeurTel?.trim()) e.push('Indiquez votre téléphone (responsable de la demande).')

  if (pourEnvoi && (!s.destinataireIds || s.destinataireIds.length === 0)) {
    e.push('Cochez au moins un destinataire.')
  }
  return e
}

// ─── Adresses ───────────────────────────────────────────────────────────────

/**
 * Dédoublonne À et CC sans tenir compte de la casse : une adresse n'apparaît
 * qu'une fois, et jamais à la fois en À et en CC (À est prioritaire).
 * Les valeurs vides sont ignorées. L'écriture d'origine est conservée.
 */
export function dedoublonnerAdresses(
  a: (string | null | undefined)[],
  cc: (string | null | undefined)[],
): { a: string[]; cc: string[] } {
  const vues = new Set<string>()
  const garder = (liste: (string | null | undefined)[]) => {
    const res: string[] = []
    for (const brut of liste) {
      const adr = brut?.trim()
      if (!adr) continue
      const cle = adr.toLowerCase()
      if (vues.has(cle)) continue
      vues.add(cle)
      res.push(adr)
    }
    return res
  }
  const listeA = garder(a)
  return { a: listeA, cc: garder(cc) }
}

/**
 * Expéditeur : si la config SMTP ne donne qu'une adresse, on la présente
 * sous le nom « CSN - Prénom NOM ». Si elle contient déjà un nom, on la garde.
 */
export function expediteur(fromConfig: string, prenomNom: string): string | { name: string; address: string } {
  const from = fromConfig.trim()
  if (from.includes('<')) return from
  return { name: `CSN - ${prenomNom}`, address: from }
}

// ─── Textes du mail (validés, spec § 7) ─────────────────────────────────────

function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? 's' : ''}`
}

/** « Demande d'autorisation – BAPTÊMES DE PLONGÉE – mardi 15 septembre 2026 » */
export function objetMail(libelleType: string, jour: string): string {
  return `Demande d'autorisation – ${libelleType} – ${jour}`
}

export function corpsMail(p: {
  jour:        string   // « mardi 15 septembre 2026 »
  heureDebut:  string   // « 09h00 »
  heureFin:    string   // « 10h30 »
  libelleType: string
  nbAdultes:   number
  nbEnfants:   number
  demandeur:   string   // « Prénom NOM »
  telephone:   string
}): string {
  return [
    'Bonjour,',
    '',
    `Veuillez trouver ci-joint notre demande d'autorisation d'accueil à la piscine Léo Lagrange ` +
      `pour le ${p.jour}, de ${p.heureDebut} à ${p.heureFin} ` +
      `(${p.libelleType} : ${pluriel(p.nbAdultes, 'adulte')}, ${pluriel(p.nbEnfants, 'enfant')}).`,
    '',
    'Restant à votre disposition,',
    'Cordialement,',
    '',
    p.demandeur,
    'Centre Subaquatique Nantais',
    `Tél. : ${p.telephone}`,
  ].join('\n')
}

/** « Demande_LeoLagrange_2026-09-15.pdf » */
export function nomFichierPdf(dateIso: string): string {
  return `Demande_LeoLagrange_${dateIso}.pdf`
}
