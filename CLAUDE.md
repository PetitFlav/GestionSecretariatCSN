# GestionSecretariatCSN — Contexte pour Claude Code

Application de gestion du secrétariat du CSN (Centre Subaquatique Nantais, club multi-sections : plongée, apnée, hockey subaquatique, nage avec palmes, chasse).
Elle remplace les workflows manuels basés sur les exports VPdive (outil tiers de gestion des adhérents) et FFESSM (fédération).

Mainteneur : Yann AUBER, secrétaire du club. Développeur de métier (Delphi/logistique) mais **pas expert des langages web** : il pilote en chef de projet, définit besoins et architecture, et veut comprendre ce qui est fait.

Langue : **tout en français** (échanges, commentaires, messages de commit, libellés UI).

---

## Stack

- Next.js 14 (App Router) + TypeScript
- Prisma ORM + PostgreSQL sur **Neon** (anciennement Supabase)
- Tailwind CSS
- iron-session (authentification)
- `@napi-rs/canvas` (génération des étiquettes PNG)
- SheetJS (parsing Excel, y compris `.xls` BIFF de VPdive)
- Déploiement : Vercel (`main` = production)
- Repo GitHub : PetitFlav/GestionSecretariatCSN

## Branches et déploiement

- `dev` → travail courant ; `main` → déclenche le déploiement Vercel en prod.
- Branches de fonctionnalité : `feat/`, `fix/`, `chore/`, `refactor/`.
- **Avant tout merge vers `main` : `npx tsc --noEmit` doit passer.**
- `git add` avec des chemins explicites (jamais `git add .`) pour ne pas embarquer de fichiers gelés.
- Hotfix directement sur `main` si Vercel est bloqué, puis resynchroniser `dev`.

## Bases de données

- Deux branches Neon : **dev** (endpoint `ep-ancient-block`) et **prod** (endpoint `ep-tiny-mountain`).
- Par défaut, on travaille **toujours sur dev**.
- ⚠️ **Ne jamais lancer `prisma migrate dev` contre la prod** : en cas de drift, Prisma réinitialise la base et efface toutes les tables (dont `users`).
  - Colonne additive/nullable → `prisma db push` (non destructif).
  - Prod → `prisma migrate deploy` uniquement, et seulement sur demande explicite de Yann.
  - En cas d'accident : restauration instantanée Neon (historique de 6 h sur le plan Free → agir vite).
- Prisma CLI n'expanse pas les variables du type `DIRECT_URL="$DEV_DIRECT_URL"` dans `.env` (erreur P1013). Soit mettre les valeurs en dur dans `.env` local, soit préfixer :
  `DATABASE_URL="$DEV_DATABASE_URL" DIRECT_URL="$DEV_DIRECT_URL" npx prisma …`
- Les URL DIRECT n'utilisent pas `-pooler`.

## Patterns d'architecture

- Server actions protégées par `requireAuth()`.
- Les parsers renvoient des `Map` typées + un tableau d'erreurs.
- Rapprochement des membres par le nom (`makeKey` / `keysMatch` / `cleanName`) car VPdive n'a pas de clé unique fiable ; le **numéro de licence** sert de clé de jointure quand il existe.
- Champs sensibles (email, adresse, date de naissance) chiffrés via les helpers `encrypt` / `decrypt`.
- **Agent d'impression local** (`agent/agent.js` + scripts Python `agent/print_windows.py`, `agent/print_ql570.py`, `localhost:3333`) : obligatoire, car Vercel ne peut pas joindre localhost. C'est le navigateur qui orchestre : récupère le PNG sur `/api/label` → POST vers l'agent local → enregistre l'impression via `/api/print/record`.

## Règles métier

- 3 statuts d'adhérent :
  - **licencié CSN** : licence + adhésion
  - **adhérent externe** : adhésion, licence dans un autre club
  - **passager** : licence prise au CSN sans adhésion, pas d'accès aux entraînements, pas d'étiquette
  - + case séparée « validation FFESSM forcée »
- « Licenciés CSN » = licenciés complets + passagers. Les externes ne sont pas des licenciés CSN.
- **Invités** (« INVITE » dans la colonne licence) : accompagnants qui ne vont pas dans l'eau, sans adhésion. Gardés pour les étiquettes, **exclus** des attestations, de l'O.M.S., du suivi et des statistiques.
- Chasse et Nage avec palmes = une seule section au club (séparées dans VPdive) → regroupées en « Chasse / Nage avec palmes » dans les stats.
- `normSection()` : abréviations par sous-chaîne en minuscules (évite les soucis d'accents) — Nage avec palmes → N.A.P, Hockey → Hockey Sub.
- Extraction O.M.S. : `.xls` BIFF8, 12 colonnes dans l'ordre imposé par Nantes Métropole, normalisation des 24 communes de la métropole ; les passagers sont inclus (décision explicite).

## ⛔ Zone gelée : impression des étiquettes

Le setup d'impression a demandé plus de 4 h de calibration. **Ne rien modifier dans ces fichiers sans demande explicite de Yann :**
`src/lib/label.ts`, `src/app/api/label/route.ts`, `src/app/api/print/route.ts`, `src/app/api/print/preview/route.ts`, et tout le dossier `agent/` (`agent.js`, `print_windows.py`, `print_ql570.py`).

Faits établis :
- Brother QL-570 sur un PC Windows, impression via `pywin32` / `win32print` (`brother_ql` ne marche pas sous Windows).
- Canvas = **449×230 px** (zone imprimable réelle, vérifiée via `GetDeviceCaps`). 296 px est la hauteur physique de la page : un commentaire obsolète du code dit 296, il est faux.
- Le pipeline PNG fait foi. `generateLabelSvg` a un bug connu (`y=234/258` > `h=230`).
- Polices DejaVu Sans dans `public/fonts/` (versionnées).
- Agent lancé au démarrage via `start-agent.vbs` + Planificateur de tâches en « exécuter seulement si l'utilisateur est connecté » (l'isolation Session 0 bloque l'USB/imprimante).

Travail gelé prévu (à reprendre plus tard, sur demande) : fusion « Section — Saison » sur l'étiquette, ajout de `section` dans les select Prisma et le type `LabelData`, garde de largeur via `measureText` (`w - 2*mx`).

## Pièges connus (build Vercel)

- `Buffer` → envelopper dans `new Uint8Array()` avant de le passer à `NextResponse`.
- Pas de cast `(prisma as any)` : ça casse le build Vercel. Préférer un filtrage en mémoire aux `groupBy` problématiques.
- Ne jamais committer de binaires (`*.zip` dans `.gitignore`).
- Ne jamais committer `.env` ni les exports Excel contenant des données personnelles.

## Chantiers en cours / à venir

- Statistiques (présentées à l'AG du 20/11/2026) : répartition femmes/hommes en prod, gelée pour l'instant. Idées suivantes : strates d'âge.
- Flag « inscrit pré-AG » par adhérent, posé via un bouton dans l'admin des saisons (+ date d'AG par saison), et date d'activation posée à l'import → comparaison d'une année sur l'autre.
- Envoi des attestations : migration du SMTP perso (Bbox, erreurs 451) vers Brevo.
- Demande d'autorisation piscine (Léo Lagrange uniquement) : PDF généré depuis le modèle Word de la saison, 4 types dans une table de référence (alimentée en SQL, suppression bloquée si référencée), table de destinataires mémorisant la sélection, CC responsables/président/créateur, table de fonctions du bureau liée aux adhérents, téléphone saisi dans les paramètres d'envoi (ne pas toucher à la table adhérents ni aux imports).
- Plus tard : chiffrement complet de la table adhérents (nom/prénom inclus).

## Comment travailler avec Yann

- **Avant de coder** : signaler franchement les contraintes et risques (jointures fragiles, champs manquants, impact sur la zone gelée).
- Quand il y a un choix produit, présenter 2-3 options avec leurs compromis et **le laisser décider**.
- Il veut apprendre : expliquer brièvement ce qui change et pourquoi, fichier par fichier.
- Petits commits ciblés sur `dev` ; ne jamais pousser sur `main` ni toucher à la prod sans accord explicite.
- Lancer `npx tsc --noEmit` (et `npm run build` si pertinent) après chaque modification significative.
