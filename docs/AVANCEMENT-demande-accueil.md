# AVANCEMENT — Demande d'accueil piscine Léo Lagrange

> Suivi de réalisation de la fonction décrite dans `docs/SPEC-demande-accueil.md` (qui fait foi).
> Branche : `feat/demande-accueil` (depuis `dev`). Base : **DEV uniquement** (`ep-ancient-block`).
> Analyse faite les 11 et 12/11/2026 avec Yann. Aucun code écrit à ce stade.

## Plan

- [ ] **1. Schéma et base dev**
  - 7 modèles + enum `StatutDemande` + relations inverses dans `prisma/schema.prisma` (aucune colonne ajoutée à `adherents`, à vérifier dans le SQL généré).
  - Vérifier que l'URL pointe sur `ep-ancient-block`, puis :
    `DATABASE_URL="$DEV_DATABASE_URL" DIRECT_URL="$DEV_DIRECT_URL" npx prisma db push`
  - Script `prisma/sql/2026-11-demande-accueil.sql` (rejouable) exécuté sur dev.
- [ ] **2. Génération du PDF** : `src/lib/pdf-demande-accueil.ts` + route d'aperçu, testés sur le modèle fourni (données fictives), calibrage du décalage `dy`.
- [ ] **3. Modèle PDF dans la gestion des saisons**
  - Upload du modèle (`requireAdmin`) avec vérification des 13 champs.
  - Page `/saisons` réservée aux ADMIN / SUPERUSER (redirection des autres vers l'accueil).
  - Liens « Gestion des saisons » des pages Import, Statistiques et Extractions O.M.S. affichés aux admins seulement ; les autres voient « contactez un administrateur ».
- [ ] **4. Écran « Bureau »** dans le menu Config (partie Administration), `requireAdmin`.
- [ ] **5. Écran de demande** : tuile sur l'accueil, formulaire, aperçu, envoi, historique.
- [ ] **6. Contrôles finaux** : `npx tsc --noEmit`, `npm run build`, tests manuels sur dev. Merge `dev` → `main` et mise à jour de la prod **uniquement sur demande de Yann**.

## Décisions prises

### Réponses aux questions de la section 9 de la spec

| # | Question | Décision |
|---|---|---|
| 1 | Où désigner les fonctions ? | Écran **« Bureau »** accessible depuis le menu Config (partie Administration, ADMIN et SUPERUSER). Modèle de la spec conservé : `adherents_fonctions`, table séparée de `adherents`, une fonction rattachée à la fiche d'**une** saison. Bouton « Reprendre le bureau de la saison précédente ». |
| 2 | Gestion des destinataires | **SQL uniquement** pour l'instant. Écran de gestion noté en tâche optionnelle future. |
| 3 | Objet et corps du mail | Validés (voir spec § 7), **sans** la ligne sur les responsables de l'accueil : ils figurent déjà dans le PDF et ne sont pas connus de la mairie. |
| 4 | Upload du modèle réservé aux admins ? | **Oui**, `requireAdmin`. Et la page `/saisons` elle-même devient réservée aux admins (aujourd'hui seul le lien du menu l'est). |

### Autres décisions

- **Président absent de la saison active** (ex. pas encore réinscrit en septembre) : on reprend le président de la **saison précédente**, avec un avertissement non bloquant. Message bloquant seulement si aucune des deux saisons n'a de président. Le bureau change rarement (mandat de 4 ans, olympiade).
- **Saison précédente** = tri sur `Saison.dateDebut` (texte JJ/MM/AAAA, converti en date avant de trier).
- **Président sans email** : avertissement non bloquant ; champ `president_email` vide, pas de copie pour lui.
- **Script SQL rejouable** : `DROP CONSTRAINT IF EXISTS` avant le `ADD CONSTRAINT chk_ordre_responsable` (les `INSERT … ON CONFLICT` l'étaient déjà).
- **Date souhaitée** (`@db.Date`, renvoyée à minuit UTC) : formatage avec `timeZone: 'UTC'` pour éviter un décalage d'un jour.
- **Statut `BROUILLON`** : l'aperçu n'écrit rien en base. Au clic sur « Envoyer » : création de la demande en `BROUILLON` → envoi → `ENVOYEE` ou `ERREUR`.
- **Historique** : la liste ne charge jamais la colonne `pdf` ; le PDF est servi par une route dédiée au clic.
- **Écran Bureau** : un seul président par saison (contrôle applicatif) ; plusieurs membres du CODIR possibles ; la reprise de la saison précédente se fait par nom + prénom et liste les personnes introuvables sans rien inventer.

## Points encore ouverts

- **Droits de création / envoi** des demandes : tout utilisateur connecté pour l'instant, restriction éventuelle non décidée (spec § 8).
- **Écran de gestion des destinataires** : optionnel, plus tard.
- **Calibrage du décalage vertical `dy`** (environ 2,5 pt annoncés) : à valider visuellement à l'étape 2.
- **Fichier modèle de test** : il s'appelle en réalité `tmp/3fc0068c-LEO_LAGRANGE_DEMANDE_ENTREE_PISCINE.pdf` (13 champs vérifiés, conformes).
- **Mise en production** (`db push` + script SQL sur la prod, merge vers `main`) : à planifier avec Yann à la fin.
