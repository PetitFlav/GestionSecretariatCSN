-- CreateEnum
CREATE TYPE "PrintStatus" AS ENUM ('PRINTED', 'SIMULATED');

-- CreateEnum
CREATE TYPE "StatutFFESSM" AS ENUM ('VALIDE', 'EN_ATTENTE', 'NON_SOUMIS');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPERUSER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL DEFAULT '',
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "setupToken" TEXT,
    "setupTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saisons" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dateExpire" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adherents" (
    "id" TEXT NOT NULL,
    "saisonId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "dateNaissance" TEXT NOT NULL,
    "email" TEXT,
    "montant" TEXT,
    "dateExpiration" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adherents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impressions" (
    "id" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "saisonId" TEXT NOT NULL,
    "zplChecksum" TEXT,
    "status" "PrintStatus" NOT NULL DEFAULT 'PRINTED',
    "printedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attestation_emails" (
    "id" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "saisonId" TEXT NOT NULL,
    "email" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attestation_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validations_ffessm" (
    "id" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "saisonId" TEXT NOT NULL,
    "statut" "StatutFFESSM" NOT NULL DEFAULT 'NON_SOUMIS',
    "validateur" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "validations_ffessm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "saisons_label_key" ON "saisons"("label");
CREATE UNIQUE INDEX "adherents_saisonId_nom_prenom_dateNaissance_key" ON "adherents"("saisonId", "nom", "prenom", "dateNaissance");
CREATE UNIQUE INDEX "validations_ffessm_adherentId_key" ON "validations_ffessm"("adherentId");
CREATE INDEX "adherents_saisonId_idx" ON "adherents"("saisonId");
CREATE INDEX "adherents_nom_prenom_idx" ON "adherents"("nom", "prenom");
CREATE INDEX "adherents_nom_prenom_dateNaissance_idx" ON "adherents"("nom", "prenom", "dateNaissance");
CREATE INDEX "impressions_adherentId_saisonId_idx" ON "impressions"("adherentId", "saisonId");
CREATE INDEX "impressions_saisonId_idx" ON "impressions"("saisonId");
CREATE INDEX "impressions_status_printedAt_idx" ON "impressions"("status", "printedAt");
CREATE INDEX "attestation_emails_adherentId_saisonId_idx" ON "attestation_emails"("adherentId", "saisonId");
CREATE INDEX "attestation_emails_sentAt_idx" ON "attestation_emails"("sentAt");
CREATE INDEX "validations_ffessm_saisonId_statut_idx" ON "validations_ffessm"("saisonId", "statut");

-- AddForeignKey
ALTER TABLE "adherents" ADD CONSTRAINT "adherents_saisonId_fkey" FOREIGN KEY ("saisonId") REFERENCES "saisons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "impressions" ADD CONSTRAINT "impressions_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "impressions" ADD CONSTRAINT "impressions_saisonId_fkey" FOREIGN KEY ("saisonId") REFERENCES "saisons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attestation_emails" ADD CONSTRAINT "attestation_emails_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attestation_emails" ADD CONSTRAINT "attestation_emails_saisonId_fkey" FOREIGN KEY ("saisonId") REFERENCES "saisons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "validations_ffessm" ADD CONSTRAINT "validations_ffessm_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "validations_ffessm" ADD CONSTRAINT "validations_ffessm_saisonId_fkey" FOREIGN KEY ("saisonId") REFERENCES "saisons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
