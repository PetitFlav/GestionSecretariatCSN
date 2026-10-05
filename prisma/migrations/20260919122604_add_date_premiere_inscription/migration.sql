/*
  Warnings:

  - You are about to drop the column `dateNaissance` on the `adherents` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `adherents` table. All the data in the column will be lost.
  - You are about to drop the column `dateExpire` on the `saisons` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[saisonId,nom,prenom]` on the table `adherents` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `dateDebut` to the `saisons` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateExpireLicence` to the `saisons` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateFin` to the `saisons` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "adherents_nom_prenom_dateNaissance_idx";

-- DropIndex
DROP INDEX "adherents_saisonId_nom_prenom_dateNaissance_key";

-- AlterTable
ALTER TABLE "adherents" DROP COLUMN "dateNaissance",
DROP COLUMN "email",
ADD COLUMN     "adresseDesync" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "adresseEnc" TEXT,
ADD COLUMN     "caci" TEXT,
ADD COLUMN     "civilite" TEXT,
ADD COLUMN     "codePostalEnc" TEXT,
ADD COLUMN     "dateNaissanceEnc" TEXT,
ADD COLUMN     "datePaiement" TEXT,
ADD COLUMN     "datePremiereInscription" TEXT,
ADD COLUMN     "emailEnc" TEXT,
ADD COLUMN     "ffessmId" TEXT,
ADD COLUMN     "licence" TEXT,
ADD COLUMN     "passager" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "section" TEXT,
ADD COLUMN     "villeEnc" TEXT;

-- AlterTable
ALTER TABLE "saisons" DROP COLUMN "dateExpire",
ADD COLUMN     "dateDebut" TEXT NOT NULL,
ADD COLUMN     "dateExpireLicence" TEXT NOT NULL,
ADD COLUMN     "dateFin" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "validations_ffessm" ADD COLUMN     "adresseEnc" TEXT,
ADD COLUMN     "codePostalEnc" TEXT,
ADD COLUMN     "villeEnc" TEXT;

-- CreateTable
CREATE TABLE "user_smtp_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT,
    "hostEnc" TEXT,
    "portEnc" TEXT,
    "secureEnc" TEXT,
    "userEnc" TEXT,
    "passwordEnc" TEXT,
    "fromEnc" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_smtp_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rappels_caci" (
    "id" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "saisonId" TEXT NOT NULL,
    "email" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rappels_caci_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_smtp_configs_userId_key" ON "user_smtp_configs"("userId");

-- CreateIndex
CREATE INDEX "rappels_caci_adherentId_idx" ON "rappels_caci"("adherentId");

-- CreateIndex
CREATE INDEX "rappels_caci_saisonId_idx" ON "rappels_caci"("saisonId");

-- CreateIndex
CREATE UNIQUE INDEX "adherents_saisonId_nom_prenom_key" ON "adherents"("saisonId", "nom", "prenom");

-- AddForeignKey
ALTER TABLE "user_smtp_configs" ADD CONSTRAINT "user_smtp_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rappels_caci" ADD CONSTRAINT "rappels_caci_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rappels_caci" ADD CONSTRAINT "rappels_caci_saisonId_fkey" FOREIGN KEY ("saisonId") REFERENCES "saisons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
