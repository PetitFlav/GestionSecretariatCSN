-- Reconstruction UNIQUE de « dateActivation » pour l'existant.
-- À lancer UNE fois, APRÈS `npx prisma db push` (qui crée la colonne),
-- et AVANT le prochain import. Idempotent : ne touche que les fiches dont
-- dateActivation est encore vide.
--   npx prisma db execute --file prisma/sql/2026-10-date-activation.sql --schema prisma/schema.prisma
--
-- Règle, pour les membres ACTIFS de chaque saison
-- (dateExpiration = dateExpireLicence de la saison) :
--   1) date de la PREMIÈRE impression d'étiquette réelle de la saison
--      (approximation de la date d'inscription : un peu tardive si les
--      étiquettes sont imprimées par lots) ;
--   2) sinon, pour la SAISON ACTIVE seulement : maintenant (date de mise en
--      place) — cas des passagers (pas d'étiquette) et des non-imprimés ;
--   3) sinon (saison passée sans impression) : on laisse vide, plutôt que de
--      dater un membre de 2025-2026 d'octobre 2026.
-- "updatedAt" n'est pas modifié (SQL brut) : la « date des données » des
-- statistiques reste celle du dernier import.

UPDATE "adherents" a
SET    "dateActivation" = COALESCE(
         (SELECT MIN(i."printedAt")
          FROM   "impressions" i
          WHERE  i."adherentId" = a."id"
            AND  i."saisonId"   = a."saisonId"
            AND  i."status"     = 'PRINTED'),
         CASE WHEN s."isActive" THEN NOW() ELSE NULL END
       )
FROM   "saisons" s
WHERE  s."id" = a."saisonId"
  AND  a."dateActivation" IS NULL
  AND  (s."dateExpireLicence" IS NULL OR s."dateExpireLicence" = ''
        OR a."dateExpiration" = s."dateExpireLicence");

-- Contrôle (à lancer dans l'éditeur SQL de Neon : `prisma db execute`
-- n'affiche pas les résultats) — répartition des dates de la saison active ;
-- un gros pic au jour de lancement = fiches sans étiquette imprimée :
--
--   SELECT to_char(a."dateActivation", 'YYYY-MM-DD') AS jour, COUNT(*) AS fiches
--   FROM   "adherents" a
--   JOIN   "saisons" s ON s."id" = a."saisonId" AND s."isActive"
--   WHERE  a."dateActivation" IS NOT NULL
--   GROUP  BY 1 ORDER BY 1;
