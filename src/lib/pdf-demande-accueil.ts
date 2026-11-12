/**
 * src/lib/pdf-demande-accueil.ts
 *
 * Remplit le formulaire PDF de la Ville (« demande d'entrée piscine Léo
 * Lagrange ») à partir du modèle de la saison, puis l'aplatit (le PDF envoyé
 * n'est plus modifiable).
 *
 * Le modèle est un PDF exporté de LibreOffice avec « Créer un formulaire PDF »,
 * qui contient 13 champs texte nommés (voir CHAMPS_DEMANDE).
 * Spec : docs/SPEC-demande-accueil.md § 6.
 *
 * Points importants :
 *  - LibreOffice ne conserve pas les styles des champs (tous sortent en
 *    Helvetica 8 pt noir) → police, taille et couleur sont imposées ici.
 *  - Police DejaVu Sans (public/fonts) : gère tous les accents et caractères
 *    spéciaux, contrairement aux polices standard du PDF.
 *  - Réglage `dy` par champ : abaisse la zone de `dy` points avant de la
 *    remplir, pour aligner le texte sur les libellés si un modèle le demande
 *    (0 par défaut, voir DY_ZONES_HAUTES).
 */

import fs from 'fs/promises'
import path from 'path'
import { PDFDocument, PDFTextField, TextAlignment } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

// ─── Champs attendus dans le modèle ─────────────────────────────────────────

export const CHAMPS_DEMANDE = [
  'type_demande',
  'president_nom',
  'president_tel',
  'president_email',
  'demandeur_nom',
  'demandeur_tel',
  'demandeur_email',
  'jour_souhaite',
  'horaires_souhaites',
  'responsable_accueil_1',
  'responsable_accueil_2',
  'nb_adultes',
  'nb_enfants',
] as const

export type ChampDemande = (typeof CHAMPS_DEMANDE)[number]

/** Valeur texte de chaque champ (chaîne vide = champ laissé vide). */
export type ValeursDemande = Record<ChampDemande, string>

// ─── Styles ─────────────────────────────────────────────────────────────────

export interface StyleChamp {
  /** Taille de police en points (réduite automatiquement si le texte déborde) */
  taille: number
  /** Couleur RVB, chaque composante entre 0 et 1 */
  couleur: [number, number, number]
  /** Texte centré horizontalement dans la zone */
  centre: boolean
  /** Décalage vers le bas de la zone, en points (0 = aucun) */
  dy: number
}

/** Surcharge partielle, stockée dans ModeleDemande.champs (JSON). */
export type StylesChamps = Partial<Record<ChampDemande, Partial<StyleChamp>>>

const NOIR: [number, number, number] = [0, 0, 0]
const BLEU: [number, number, number] = [0.18, 0.33, 0.59]

/**
 * Décalage par défaut des zones president_* / demandeur_*.
 * Calibré le 12/11/2026 sur le modèle 2026 : à 0, la ligne de base du texte
 * est alignée sur celle des libellés (le décalage de 2,5 pt observé lors du
 * PoC ne se reproduit pas). Conservé comme réglage, surchargeable par saison
 * via ModeleDemande.champs si un futur modèle en a besoin.
 */
const DY_ZONES_HAUTES = 0

/** Taille minimale lorsqu'un texte trop long est réduit. */
const TAILLE_MIN = 7
/** Marge intérieure laissée de chaque côté du texte (points). */
const MARGE = 2

export const STYLES_PAR_DEFAUT: Record<ChampDemande, StyleChamp> = {
  type_demande:          { taille: 16, couleur: NOIR, centre: true,  dy: 0 },
  president_nom:         { taille: 12, couleur: BLEU, centre: false, dy: DY_ZONES_HAUTES },
  president_tel:         { taille: 12, couleur: BLEU, centre: false, dy: DY_ZONES_HAUTES },
  president_email:       { taille: 12, couleur: BLEU, centre: false, dy: DY_ZONES_HAUTES },
  demandeur_nom:         { taille: 12, couleur: BLEU, centre: false, dy: DY_ZONES_HAUTES },
  demandeur_tel:         { taille: 12, couleur: BLEU, centre: false, dy: DY_ZONES_HAUTES },
  demandeur_email:       { taille: 12, couleur: BLEU, centre: false, dy: DY_ZONES_HAUTES },
  jour_souhaite:         { taille: 12, couleur: BLEU, centre: false, dy: 0 },
  horaires_souhaites:    { taille: 12, couleur: BLEU, centre: false, dy: 0 },
  responsable_accueil_1: { taille: 12, couleur: NOIR, centre: false, dy: 0 },
  responsable_accueil_2: { taille: 12, couleur: NOIR, centre: false, dy: 0 },
  nb_adultes:            { taille: 12, couleur: NOIR, centre: true,  dy: 0 },
  nb_enfants:            { taille: 12, couleur: NOIR, centre: true,  dy: 0 },
}

/** Style effectif d'un champ : défaut + surcharge éventuelle du modèle. */
function styleDe(champ: ChampDemande, styles?: StylesChamps): StyleChamp {
  return { ...STYLES_PAR_DEFAUT[champ], ...(styles?.[champ] ?? {}) }
}

// ─── Police ─────────────────────────────────────────────────────────────────

// Lue une seule fois par instance du serveur (même chemin que les étiquettes).
let policeCache: Uint8Array | null = null

async function chargerPolice(): Promise<Uint8Array> {
  if (!policeCache) {
    const fichier = path.join(process.cwd(), 'public', 'fonts', 'DejaVuSans.ttf')
    policeCache = new Uint8Array(await fs.readFile(fichier))
  }
  return policeCache
}

// ─── Vérification du modèle ─────────────────────────────────────────────────

export interface VerificationModele {
  ok: boolean
  /** Champs attendus absents du modèle (ou qui ne sont pas des champs texte) */
  manquants: ChampDemande[]
  /** Noms de tous les champs trouvés dans le modèle */
  trouves: string[]
}

/**
 * Vérifie qu'un PDF contient bien les 13 champs texte attendus.
 * Utilisé à l'upload du modèle (étape 3) et avant chaque génération.
 * Lève une erreur si le fichier n'est pas un PDF lisible.
 */
export async function verifierModeleDemande(pdfBytes: Uint8Array): Promise<VerificationModele> {
  const pdf = await PDFDocument.load(pdfBytes)
  const champs = pdf.getForm().getFields()
  const textes = new Set(
    champs.filter(c => c instanceof PDFTextField).map(c => c.getName()),
  )
  const manquants = CHAMPS_DEMANDE.filter(nom => !textes.has(nom))
  return {
    ok: manquants.length === 0,
    manquants,
    trouves: champs.map(c => c.getName()),
  }
}

function messageChampsManquants(v: VerificationModele): string {
  return (
    `Le modèle PDF ne contient pas les champs attendus. ` +
    `Manquants : ${v.manquants.join(', ')}. ` +
    `Attendus : ${CHAMPS_DEMANDE.join(', ')}. ` +
    `Trouvés : ${v.trouves.length ? v.trouves.join(', ') : '(aucun)'}.`
  )
}

// ─── Génération ─────────────────────────────────────────────────────────────

/**
 * Remplit le modèle avec les valeurs fournies et renvoie le PDF aplati.
 * @param modele  octets du PDF modèle de la saison (ModeleDemande.pdf)
 * @param valeurs texte de chaque champ (déjà formaté, voir les helpers ci-dessous)
 * @param styles  surcharges de style du modèle (ModeleDemande.champs), facultatif
 */
export async function genererPdfDemande(
  modele: Uint8Array,
  valeurs: ValeursDemande,
  styles?: StylesChamps,
): Promise<Uint8Array> {
  const verif = await verifierModeleDemande(modele)
  if (!verif.ok) throw new Error(messageChampsManquants(verif))

  const pdf = await PDFDocument.load(modele)
  pdf.registerFontkit(fontkit)
  const police = await pdf.embedFont(await chargerPolice())
  const form = pdf.getForm()

  // Tous les champs sont traités, même vides : chacun reçoit ainsi son
  // apparence avec notre police, et flatten() ne la régénère pas en Helvetica.
  for (const champ of CHAMPS_DEMANDE) {
    const style = styleDe(champ, styles)
    const valeur = (valeurs[champ] ?? '').trim()
    const f = form.getTextField(champ)

    // Abaisser la zone (une seule zone par champ dans le modèle)
    if (style.dy) {
      for (const w of f.acroField.getWidgets()) {
        const r = w.getRectangle()
        w.setRectangle({ x: r.x, y: r.y - style.dy, width: r.width, height: r.height })
      }
    }

    // Réduire la taille si le texte dépasse la largeur de la zone
    const largeurDispo = f.acroField.getWidgets()[0].getRectangle().width - 2 * MARGE
    let taille = style.taille
    while (taille > TAILLE_MIN && police.widthOfTextAtSize(valeur, taille) > largeurDispo) {
      taille -= 0.5
    }

    const [r, g, b] = style.couleur
    f.setAlignment(style.centre ? TextAlignment.Center : TextAlignment.Left)
    f.setText(valeur)
    f.setFontSize(taille)
    // pdf-lib lit la couleur et la taille dans cette chaîne pour dessiner le champ
    f.acroField.setDefaultAppearance(`/F0 ${taille} Tf ${r} ${g} ${b} rg`)
    f.updateAppearances(police)
  }

  form.flatten()
  return pdf.save()
}

// ─── Formats (spec § 6) ─────────────────────────────────────────────────────

const FORMAT_JOUR = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  // Les dates @db.Date reviennent à minuit UTC : sans ceci, un serveur réglé
  // sur un fuseau à l'ouest de Greenwich afficherait la veille.
  timeZone: 'UTC',
})

/** Date → « mardi 15 septembre 2026 » */
export function formaterJour(date: Date): string {
  return FORMAT_JOUR.format(date)
}

/** "9:00" ou "09:00" → « 09h00 » */
export function formaterHeure(heure: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(heure.trim())
  if (!m) throw new Error(`Heure invalide : « ${heure} » (format attendu HH:MM)`)
  return `${m[1].padStart(2, '0')}h${m[2]}`
}

/** ("09:00", "10:30") → « 09h00 - 10h30 » */
export function formaterHoraires(debut: string, fin: string): string {
  return `${formaterHeure(debut)} - ${formaterHeure(fin)}`
}

/** ("Jean", "Dupont") → « Jean DUPONT » */
export function formaterPrenomNom(prenom: string, nom: string): string {
  return `${prenom.trim()} ${nom.trim().toUpperCase()}`.trim()
}
