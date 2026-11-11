# SPEC — Demande d'accueil piscine Léo Lagrange

> À placer dans le repo : `docs/SPEC-demande-accueil.md`
> Conception validée avec Yann le 11/11/2026, complétée le 12/11/2026 (réponses aux questions § 9). Ce document fait foi : en cas de doute, poser la question plutôt que d'improviser.

## 1. Besoin

Pour faire venir des personnes extérieures à une séance (baptêmes, initiations), le club doit envoyer au Service des Piscines de Nantes un formulaire PDF imposé par la Ville. Aujourd'hui : Word → export PDF → mail à la main.

Nouvelle fonction (tuile/bouton dans le menu d'accueil `src/app/page.tsx`) :
1. saisir les infos de la demande (type, date, horaires, responsables de l'accueil, nb adultes/enfants) ;
2. générer le PDF à partir du **modèle PDF de la saison** (formulaire à champs nommés) ;
3. aperçu, puis envoi par mail via le **SMTP de l'utilisateur connecté** ;
4. historiser l'envoi (avec le PDF exact envoyé).

Uniquement pour la piscine Léo Lagrange : **pas de notion de piscine**.
On n'indique jamais les noms des personnes accueillies, seulement des nombres (adultes / enfants).

## 2. Contexte technique (existant à réutiliser)

- Next.js 14 App Router, TypeScript, Prisma, PostgreSQL Neon, Tailwind, iron-session, Vercel.
- Auth : `requireAuth()` / `requireAdmin()` dans `src/lib/session.ts`.
- Chiffrement : `encrypt` / `decrypt` / `makeKey(nom, prenom)` dans `src/lib/crypto.ts`.
- SMTP : `getSmtpTransporter(userId)` dans `src/app/actions/smtp-config.ts` → `{ transporter, from }`. `UserSmtpConfig.isVerified` indique une config validée. (Yann a configuré un utilisateur avec Brevo.)
- PDF : `pdf-lib` + `@pdf-lib/fontkit` déjà installés (voir `src/lib/pdf-attestation.ts`). Polices : `public/fonts/DejaVuSans.ttf`, `DejaVuSans-Bold.ttf`.
- `Adherent` = **une ligne par saison** (`@@unique([saisonId, nom, prenom])`). Email adhérent chiffré dans `emailEnc`.
- `User` : `firstName`, `lastName`, `email`. Pas de lien User ↔ Adherent (et on n'en crée pas).
- Ids : `String @id @default(cuid())` partout.

## 3. Contraintes NON négociables

- **Ne pas modifier la table `adherents` ni les imports** (`src/lib/parsers/*`, `src/app/actions/import.ts`) — à part l'ajout des relations inverses Prisma (champs de relation virtuels, aucune colonne).
- **Ne pas toucher au chantier étiquettes gelé** : `src/lib/label.ts`, `src/app/api/label/*`, `src/app/api/print/*`.
- **Base de prod** : JAMAIS `prisma migrate dev` sur la prod (reset complet en cas de drift). Utiliser `prisma db push` (ajouts non destructifs) ou `migrate deploy`. Les commandes Prisma CLI doivent être préfixées :
  `DATABASE_URL="$DEV_DATABASE_URL" DIRECT_URL="$DEV_DIRECT_URL" npx prisma db push`
  (idem `PROD_*` pour la prod, seulement quand Yann le demande).
- Pièges Vercel connus : `Buffer` → envelopper avec `new Uint8Array()` avant `NextResponse` ; pas de `(prisma as any)`.
- Avant merge sur `main` : `npx tsc --noEmit`. Branche `feat/demande-accueil` depuis `dev`. `git add` avec chemins explicites, jamais `git add .`.

## 4. Modèle de données

```prisma
// ─── Référentiels (alimentés par SQL, pas d'écran) ──────────

model TypeDemande {
  id       String           @id @default(cuid())
  code     String           @unique
  libelle  String                       // texte imprimé dans le champ type_demande
  ordre    Int              @default(0)
  actif    Boolean          @default(true)
  demandes DemandeAccueil[]
  @@map("types_demande")
}

model Fonction {
  id           String             @id @default(cuid())
  code         String             @unique   // PRESIDENT, SECRETAIRE, TRESORIER, CODIR
  libelle      String
  ordre        Int                @default(0)
  actif        Boolean            @default(true)
  affectations AdherentFonction[]
  @@map("fonctions")
}

// Pas de saisonId : la ligne Adherent porte déjà la saison.
model AdherentFonction {
  id         String   @id @default(cuid())
  adherentId String
  fonctionId String
  createdAt  DateTime @default(now())
  adherent   Adherent @relation(fields: [adherentId], references: [id], onDelete: Cascade)
  fonction   Fonction @relation(fields: [fonctionId], references: [id], onDelete: Restrict)
  @@unique([adherentId, fonctionId])
  @@index([fonctionId])
  @@map("adherents_fonctions")
}

model DestinataireDemande {
  id          String  @id @default(cuid())
  nom         String
  prenom      String?
  email       String  @unique
  role        String?            // "Chef de bassin", "Direction", "Secrétaire"
  ordre       Int     @default(0)
  selectionne Boolean @default(true)   // mémorise la sélection du dernier envoi
  actif       Boolean @default(true)   // false = plus proposé, on ne supprime pas
  @@map("destinataires_demande")
}

// Téléphones saisis dans l'écran d'envoi, réutilisés d'un envoi à l'autre.
// Clé = makeKey(nom, prenom) → survit au changement de saison.
model ContactDemande {
  id           String   @id @default(cuid())
  cle          String   @unique
  nom          String
  prenom       String
  telephoneEnc String
  updatedAt    DateTime @updatedAt
  @@map("contacts_demande")
}

// ─── Modèle PDF par saison ──────────────────────────────────

model ModeleDemande {
  id        String           @id @default(cuid())
  saisonId  String           @unique
  pdf       Bytes
  champs    Json             // style par champ (taille, couleur, alignement, décalage)
  updatedAt DateTime         @updatedAt
  saison    Saison           @relation(fields: [saisonId], references: [id], onDelete: Restrict)
  demandes  DemandeAccueil[]
  @@map("modeles_demande")
}

// ─── Historique ─────────────────────────────────────────────

model DemandeAccueil {
  id            String        @id @default(cuid())
  saisonId      String
  typeDemandeId String
  modeleId      String
  creeParId     String
  dateSouhaitee DateTime      @db.Date
  heureDebut    String        // "09:00"
  heureFin      String        // "10:30"
  nbAdultes     Int
  nbEnfants     Int
  destinataires String[]      // emails réellement envoyés (À)
  cc            String[]
  pdf           Bytes?        // PDF exact envoyé
  statut        StatutDemande @default(BROUILLON)
  erreur        String?
  envoyeeLe     DateTime?
  createdAt     DateTime      @default(now())

  saison       Saison                      @relation(fields: [saisonId], references: [id], onDelete: Restrict)
  typeDemande  TypeDemande                 @relation(fields: [typeDemandeId], references: [id], onDelete: Restrict)
  modele       ModeleDemande               @relation(fields: [modeleId], references: [id], onDelete: Restrict)
  creePar      User                        @relation(fields: [creeParId], references: [id], onDelete: Restrict)
  responsables DemandeResponsableAccueil[]

  @@index([saisonId, dateSouhaitee])
  @@map("demandes_accueil")
}

model DemandeResponsableAccueil {
  id         String         @id @default(cuid())
  demandeId  String
  ordre      Int            // 1 ou 2 → champ responsable_accueil_1 / _2
  adherentId String?
  nom        String         // "Prénom NOM" figé au moment de l'envoi
  demande    DemandeAccueil @relation(fields: [demandeId], references: [id], onDelete: Cascade)
  adherent   Adherent?      @relation(fields: [adherentId], references: [id], onDelete: SetNull)
  @@unique([demandeId, ordre])
  @@unique([demandeId, adherentId])
  @@map("demandes_responsables_accueil")
}

enum StatutDemande {
  BROUILLON
  ENVOYEE
  ERREUR
}

// Relations inverses à ajouter (aucune colonne créée) :
// Adherent : fonctions AdherentFonction[]
//            demandesResponsable DemandeResponsableAccueil[]
// User     : demandesAccueil DemandeAccueil[]
// Saison   : modeleDemande ModeleDemande?
//            demandesAccueil DemandeAccueil[]
```

Principes de suppression : tout ce qui est référencé par un document envoyé est en `Restrict` (une saison ou un type utilisé ne se supprime plus ; pour retirer un type → `actif = false`). Responsable d'accueil : `SetNull` + nom figé (l'écran admin permet de supprimer une fiche adhérent, il ne doit pas être bloqué).

## 5. Script SQL — `prisma/sql/2026-11-demande-accueil.sql`

À exécuter après le `db push` :

```sql
-- Max 2 responsables de l'accueil par demande (unicité (demandeId, ordre) déjà posée par Prisma)
-- DROP préalable : le script doit pouvoir être relancé sans erreur
ALTER TABLE demandes_responsables_accueil
  DROP CONSTRAINT IF EXISTS chk_ordre_responsable;
ALTER TABLE demandes_responsables_accueil
  ADD CONSTRAINT chk_ordre_responsable CHECK (ordre BETWEEN 1 AND 2);

INSERT INTO types_demande (id, code, libelle, ordre, actif) VALUES
  (gen_random_uuid()::text, 'BAPTEME_PLONGEE', 'BAPTÊMES DE PLONGÉE',            1, true),
  (gen_random_uuid()::text, 'INIT_HOCKEY',     'INITIATION HOCKEY SUBAQUATIQUE', 2, true),
  (gen_random_uuid()::text, 'INIT_APNEE',      'INITIATION APNÉE',               3, true),
  (gen_random_uuid()::text, 'INVITATION_CSN',  'INVITATION CLUB CSN',            4, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO fonctions (id, code, libelle, ordre, actif) VALUES
  (gen_random_uuid()::text, 'PRESIDENT',  'Président·e',     1, true),
  (gen_random_uuid()::text, 'SECRETAIRE', 'Secrétaire',      2, true),
  (gen_random_uuid()::text, 'TRESORIER',  'Trésorier·e',     3, true),
  (gen_random_uuid()::text, 'CODIR',      'Membre du CODIR', 4, true)
ON CONFLICT (code) DO NOTHING;

-- Destinataires 2026 (repris du formulaire de la Ville)
INSERT INTO destinataires_demande (id, nom, prenom, email, role, ordre, selectionne, actif) VALUES
  (gen_random_uuid()::text, 'GIUDICELLI', 'Christophe', 'Christophe.GIUDICELLI@mairie-nantes.fr', 'Chef de bassin', 1, true, true),
  (gen_random_uuid()::text, 'NEDELEC',    'Marie',      'Marie.NEDELEC@mairie-nantes.fr',         'Chef de bassin', 2, true, true),
  (gen_random_uuid()::text, 'PAIREL',     'Steven',     'Steven.PAIREL@mairie-nantes.fr',         'Chef de bassin', 3, true, true),
  (gen_random_uuid()::text, 'ROBERT',     'Jean-Marc',  'Jean-Marc.ROBERT@mairie-nantes.fr',      'Direction',      4, true, true),
  (gen_random_uuid()::text, 'ROGER',      'Eric',       'Eric.ROGER@mairie-nantes.fr',            'Direction',      5, true, true),
  (gen_random_uuid()::text, 'VIOLIN',     'Stephanie',  'Stephanie.VIOLIN@mairie-nantes.fr',      'Secrétaire',     6, true, true)
ON CONFLICT (email) DO NOTHING;
```

## 6. Génération du PDF — `src/lib/pdf-demande-accueil.ts`

Le modèle (PDF exporté depuis LibreOffice avec « Créer un formulaire PDF ») contient **13 champs texte** :

| Champ | Valeur | Style |
|---|---|---|
| `type_demande` | `TypeDemande.libelle` | 16 pt, noir, centré |
| `president_nom` | « Prénom NOM » du président de la saison active | 12 pt, bleu |
| `president_tel` | ContactDemande du président | 12 pt, bleu |
| `president_email` | `decrypt(adherent.emailEnc)` | 12 pt, bleu |
| `demandeur_nom` | `User.firstName` + `User.lastName` (NOM en majuscules) | 12 pt, bleu |
| `demandeur_tel` | ContactDemande du demandeur | 12 pt, bleu |
| `demandeur_email` | `User.email` | 12 pt, bleu |
| `jour_souhaite` | ex. `mardi 15 septembre 2026` | 12 pt, bleu |
| `horaires_souhaites` | ex. `09h00 - 10h30` | 12 pt, bleu |
| `responsable_accueil_1` / `_2` | « Prénom NOM » | 12 pt, noir |
| `nb_adultes` / `nb_enfants` | entier | 12 pt, noir, centré |

- Bleu = `rgb(0.18, 0.33, 0.59)`. Style par défaut codé en dur, surchargeable par `ModeleDemande.champs` (JSON).
- **Formats** : date = `Intl.DateTimeFormat('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'UTC' })` (minuscules, pas de zéro devant le jour ; `timeZone:'UTC'` car `@db.Date` revient à minuit UTC, sinon décalage d'un jour possible). Heures = 2 chiffres + `h` minuscule + minutes : `09h00`, `20h00 - 21h45`.
- Les styles définis dans LibreOffice ne sont PAS conservés (tous les champs sortent en `/He 8 Tf` noir) → on impose police/taille/couleur dans le code.
- Recette validée en PoC (pdf-lib 1.17.1) :
  ```ts
  pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(dejavuBytes)            // DejaVuSans.ttf
  const form = pdf.getForm()
  const f = form.getTextField(name)
  // réduire la taille si le texte dépasse la largeur du widget (- 4 pt de marge), min 7 pt
  if (center) f.setAlignment(TextAlignment.Center)
  f.setText(value)
  f.setFontSize(size)
  f.acroField.setDefaultAppearance(`/F0 ${size} Tf ${r} ${g} ${b} rg`)
  f.updateAppearances(font)
  // ...
  form.flatten()   // le PDF envoyé n'est plus modifiable
  ```
- **Décalage vertical** : les zones `president_*` et `demandeur_*` sont plus hautes que la ligne → le texte apparaît 2-3 pt trop haut par rapport aux libellés. Abaisser le rectangle du widget d'environ 2,5 pt avant remplissage (valeur `dy` dans le style, réglable).
- Champ manquant dans le modèle → erreur explicite listant les champs attendus/trouvés (vérifiée aussi à l'upload du modèle).
- Champ vide (ex. responsable 2 absent) → laisser vide.

## 7. Envoi du mail

- Transport : `getSmtpTransporter(user.id)`. Si pas de config ou `isVerified = false` → bouton d'envoi désactivé + lien vers la config SMTP.
- **From** : `from` de la config ; si c'est une adresse seule, la préfixer du nom : `"CSN - Prénom NOM" <adresse>`.
- **À** : destinataires cochés (actifs).
- **CC** : président de la saison, responsables de l'accueil (email de leur fiche adhérent, si présent), créateur (`User.email`). Le CC du créateur est obligatoire (Brevo/Bbox ne gardent pas de copie dans « Envoyés »).
- **Reply-To** : `User.email` du créateur.
- **Dédoublonnage** insensible à la casse : une adresse n'apparaît qu'une fois, et jamais à la fois en À et en CC.
- Pièce jointe : le PDF généré (nom proposé : `Demande_LeoLagrange_<AAAA-MM-JJ>.pdf`).
- **Objet** (validé) : `Demande d'autorisation – <libellé type> – <date>`, ex. `Demande d'autorisation – BAPTÊMES DE PLONGÉE – mardi 15 septembre 2026`.
- **Corps** (validé, texte simple) — pas de mention des responsables de l'accueil (déjà dans le PDF, inconnus de la mairie) :
  ```
  Bonjour,

  Veuillez trouver ci-joint notre demande d'autorisation d'accueil à la piscine Léo Lagrange pour le <date>, de <heure début> à <heure fin> (<libellé type> : <n> adultes, <n> enfants).

  Restant à votre disposition,
  Cordialement,

  <Prénom NOM du demandeur>
  Centre Subaquatique Nantais
  Tél. : <téléphone du demandeur>
  ```
- Séquence : au clic sur « Envoyer », création de la demande en `BROUILLON`, envoi, puis `ENVOYEE` ou `ERREUR`. L'aperçu n'écrit rien en base.
- Après envoi réussi : `statut = ENVOYEE`, `envoyeeLe`, `destinataires`, `cc`, `pdf` enregistrés ; `DestinataireDemande.selectionne` mis à jour selon les cases cochées ; upsert des `ContactDemande` (téléphones). En cas d'échec : `statut = ERREUR` + message.

## 8. Écrans

**Écran « Demande piscine »** (nouvelle tuile sur `src/app/page.tsx`) :
- Type (liste des `TypeDemande` actifs, triés par `ordre`).
- Jour souhaité (date) + heure début / heure fin.
- Avertissement (non bloquant) si la date est à moins de **15 jours**.
- Président : déduit de la fonction PRESIDENT sur la saison active, avec son téléphone pré-rempli depuis `ContactDemande` (modifiable). Si aucun président sur la saison active (ex. pas encore réinscrit) → on reprend celui de la **saison précédente** (tri sur `dateDebut` converti en date) avec un avertissement non bloquant ; son email vient de sa fiche de la saison précédente. Message bloquant (expliquant où le désigner : écran « Bureau ») seulement si aucune des deux saisons n'a de président. Président sans email → avertissement non bloquant, champ vide et pas de CC.
- Demandeur = utilisateur connecté, téléphone pré-rempli depuis `ContactDemande` (modifiable).
- Responsables de l'accueil : 1 obligatoire, 1 facultatif, recherche parmi **tous les adhérents de la saison active** (pas de filtre pour l'instant). Pas deux fois la même personne. Si l'un n'a pas d'email → avertissement non bloquant (pas de CC pour lui).
- Nb adultes / nb enfants (entiers ≥ 0, au moins un > 0).
- Destinataires : cases à cocher, pré-cochées selon `selectionne`.
- Boutons : **Aperçu PDF** (route API qui renvoie le PDF) puis **Envoyer**.
- Historique des demandes de la saison (date, type, statut, envoyée par, lien vers le PDF). La liste ne charge jamais la colonne `pdf` : le PDF est servi par une route dédiée.

**Écran « Bureau »** (nouveau, menu Config → partie Administration, ADMIN et SUPERUSER, `requireAdmin`) :
- Choix de la saison (active par défaut) ; pour chaque fonction active, recherche parmi les adhérents de cette saison.
- Un seul président par saison (contrôle applicatif) ; plusieurs membres du CODIR possibles.
- Bouton « Reprendre le bureau de la saison précédente » : correspondance nom + prénom, liste des personnes introuvables (rien d'inventé).
- Le bureau change rarement (mandat de 4 ans), d'où la reprise en un clic.

**Gestion des saisons** (existant) :
- Upload du modèle PDF de la saison (`requireAdmin`), avec vérification des 13 champs à l'upload.
- La page `/saisons` devient réservée aux ADMIN / SUPERUSER (aujourd'hui seul le lien du menu l'est) ; les autres sont renvoyés vers l'accueil.
- Les liens « Gestion des saisons » des pages Import, Statistiques et Extractions O.M.S. ne s'affichent qu'aux admins ; les autres voient « contactez un administrateur ».

**Destinataires** : gestion par SQL uniquement pour l'instant.

**Droits** : tout utilisateur connecté peut créer/envoyer pour l'instant (à restreindre plus tard, non décidé).

## 9. Questions de conception — tranchées le 12/11/2026

1. Fonctions : écran « Bureau » dans le menu Config (admins), modèle `adherents_fonctions` conservé (fonction rattachée à la fiche d'une saison), bouton de reprise de la saison précédente.
2. Destinataires : SQL uniquement pour l'instant.
3. Objet et corps du mail : voir § 7.
4. Upload du modèle : réservé aux admins ; page `/saisons` réservée aux admins.

Suivi détaillé : `docs/AVANCEMENT-demande-accueil.md`.

## 10. Découpage

1. Schéma Prisma + `db push` sur la base **dev** + script SQL.
2. `pdf-demande-accueil.ts` + route d'aperçu, testés avec le modèle fourni.
3. Upload du modèle dans la gestion des saisons + accès `/saisons` réservé aux admins.
4. Écran « Bureau » (fonctions / président).
5. Écran de demande + envoi + historique.
6. `npx tsc --noEmit`, `npm run build`, tests manuels, puis merge `dev` → `main` sur demande de Yann.

## 11. À faire plus tard (optionnel)

- Écran de gestion des destinataires (ajout / désactivation), en remplacement du SQL.
- Restriction des droits de création / envoi des demandes.
