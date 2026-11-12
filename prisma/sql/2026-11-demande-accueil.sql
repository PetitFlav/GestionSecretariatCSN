-- Demande d'accueil piscine Léo Lagrange : contrainte + référentiels.
-- À lancer APRÈS `npx prisma db push` (qui crée les tables).
-- Rejouable : relancer ne change rien et ne provoque pas d'erreur.
--   DATABASE_URL="$DEV_DATABASE_URL" DIRECT_URL="$DEV_DIRECT_URL" \
--     npx prisma db execute --file prisma/sql/2026-11-demande-accueil.sql --schema prisma/schema.prisma
-- Spec : docs/SPEC-demande-accueil.md (§ 5)

-- Au plus 2 responsables de l'accueil par demande
-- (l'unicité (demandeId, ordre) est déjà posée par Prisma).
-- DROP préalable : le script doit pouvoir être relancé sans erreur.
ALTER TABLE demandes_responsables_accueil
  DROP CONSTRAINT IF EXISTS chk_ordre_responsable;
ALTER TABLE demandes_responsables_accueil
  ADD CONSTRAINT chk_ordre_responsable CHECK (ordre BETWEEN 1 AND 2);

-- Types de demande (libellé = texte imprimé dans le PDF)
INSERT INTO types_demande (id, code, libelle, ordre, actif) VALUES
  (gen_random_uuid()::text, 'BAPTEME_PLONGEE', 'BAPTÊMES DE PLONGÉE',            1, true),
  (gen_random_uuid()::text, 'INIT_HOCKEY',     'INITIATION HOCKEY SUBAQUATIQUE', 2, true),
  (gen_random_uuid()::text, 'INIT_APNEE',      'INITIATION APNÉE',               3, true),
  (gen_random_uuid()::text, 'INVITATION_CSN',  'INVITATION CLUB CSN',            4, true)
ON CONFLICT (code) DO NOTHING;

-- Fonctions du bureau
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
