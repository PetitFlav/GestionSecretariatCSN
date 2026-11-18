---
name: prod-diplomes
description: Pense-bête de mise en production de « Gestion des diplômes » (saisie manuelle, catégories, Pêche sous-marine). À lancer par Yann avec /prod-diplomes.
disable-model-invocation: true
---

Affiche à Yann le pense-bête ci-dessous TEL QUEL, sans lancer aucune commande.
Termine par une seule ligne : « Je peux t'accompagner étape par étape : donne-moi le feu vert et, pour l'étape 2, les URL prod. »
Si Yann demande de l'aide ensuite : jamais de `git commit` / `git push` / merge par Claude, jamais de `--accept-data-loss`, jamais de `prisma migrate dev`.

---

# 🚀 Mise en prod — Gestion des diplômes

**Quand :** après l'AG du 20/11/2026 (la page Statistiques est touchée).
**Ordre impératif :** base prod (étape 2) **AVANT** le merge vers `main` (étape 3) — sinon `/statistiques`, `/ag/<jeton>` et `/diplomes` plantent (colonnes absentes).

## 1. Committer sur `dev`

```bash
cd ~/GestionSecretariatCSN && git checkout dev
npx tsc --noEmit
git add prisma/schema.prisma src/app/actions/brevets.ts src/app/page.tsx \
        src/app/statistiques/Diplomes.tsx src/lib/brevets.ts src/lib/diplomes-serveur.ts \
        src/app/diplomes/
git commit -m "feat(diplomes): écran Gestion des diplômes — saisie manuelle (adhérent, catégorie), famille Pêche sous-marine, import FFESSM déplacé depuis les statistiques"
git push origin dev
```

## 2. Base de prod (`ep-tiny-mountain`)

Coller les URL prod (console Neon, branche **prod**) — DIRECT **sans** `-pooler` :

```bash
export PROD_DATABASE_URL='postgresql://…ep-tiny-mountain…-pooler…'
export PROD_DIRECT_URL='postgresql://…ep-tiny-mountain…'
echo "$PROD_DIRECT_URL" | grep -o "ep-[a-z]*-[a-z]*"      # doit afficher ep-tiny-mountain
```

**a) Contrôle en lecture seule** (ne modifie rien) :

```bash
DATABASE_URL="$PROD_DATABASE_URL" DIRECT_URL="$PROD_DIRECT_URL" \
  npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --script
```

Le SQL affiché doit contenir **uniquement** :
- `CREATE TYPE "SourceBrevet" AS ENUM ('IMPORT', 'SAISIE');`
- `ALTER TABLE "brevets" ADD COLUMN "adherentId" TEXT, ADD COLUMN "famille" TEXT, ADD COLUMN "source" … DEFAULT 'IMPORT';`
- `CREATE INDEX "brevets_adherentId_idx" …`
- `ALTER TABLE "brevets" ADD CONSTRAINT "brevets_adherentId_fkey" …`

⛔ Un `DROP` ou une autre table → **STOP**, ne pas pousser, demander à Claude.
« This is an empty migration » dès ce premier contrôle → colonnes déjà présentes : sauter b).

**b) Application** (vérifier que la ligne « Datasource … at » affiche bien `ep-tiny-mountain`) :

```bash
DATABASE_URL="$PROD_DATABASE_URL" DIRECT_URL="$PROD_DIRECT_URL" npx prisma db push
```

- Jamais `--accept-data-loss` (si Prisma le réclame → STOP).
- Jamais `prisma migrate dev` contre la prod.
- Relancer le contrôle a) : il doit maintenant afficher « This is an empty migration ».

```bash
unset PROD_DATABASE_URL PROD_DIRECT_URL
npx prisma generate          # client local de nouveau aligné sur .env (dev)
```

## 3. Déployer (`main` → Vercel)

```bash
git checkout main && git pull
git merge dev
npx tsc --noEmit
git push origin main
git checkout dev
```

Suivre le build sur Vercel jusqu'au « Ready ».

## 4. Vérifications en prod

- [ ] Accueil : tuile « Gestion des diplômes » à côté d'Extractions O.M.S.
- [ ] `/statistiques` → Diplômes obtenus : mêmes totaux qu'avant (aucune saisie en prod pour l'instant), plus de bloc d'import en bas.
- [ ] `/ag/<jeton>` (lien de la diapo d'AG) s'affiche toujours.
- [ ] `/diplomes` : la liste des saisons s'affiche, la recherche d'adhérent fonctionne, les diplômes et catégories sont proposés à la frappe.
- [ ] Saisir les **vrais** diplômes manquants (ex. Pêcheur Sous-Marin N3, Initiateur Pêche) — pas de saisie de test :
      il n'y a pas d'écran de suppression, une erreur se corrige en SQL.

## En cas d'accident sur la base prod

Restauration instantanée Neon (branche prod, **historique de 6 h** sur le plan Free → agir vite).
