-- Migration des données : ancien booléen `passager` → nouveau `statut`.
-- À lancer UNE fois, APRÈS `npx prisma db push` (qui crée l'enum et les colonnes).
-- Idempotent : relancer ne change rien.
--   npx prisma db execute --file prisma/sql/2026-10-statut-adherent.sql --schema prisma/schema.prisma

-- L'ancien « passager » voulait dire « licence prise dans un autre club »
-- = adhérent externe dans la nouvelle nomenclature.
UPDATE "adherents"
SET    "statut" = 'EXTERNE'
WHERE  "passager" = true
  AND  "statut" = 'LICENCIE';
