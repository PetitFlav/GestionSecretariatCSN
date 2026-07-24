/**
 * src/app/api/label/route.ts
 *
 * GET /api/label?adherentId=xxx
 *
 * Génère le PNG de l'étiquette pour un adhérent et le retourne en base64.
 * Appelé par le NAVIGATEUR (pas par l'agent).
 * Tourne sur Vercel — pas d'impression ici, juste la génération.
 *
 * Réponse :
 * {
 *   ok: true,
 *   pngBase64: "...",
 *   filename: "label_DUPONT_Jean.png",
 *   checksum: "sha1...",
 *   adherentId: "...",
 *   saisonId: "...",
 *   nom: "DUPONT",
 *   prenom: "Jean",
 *   expire: "31/12/2026"
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { prisma } from '@/lib/db'
import { generateLabelPng, LabelData, LabelWidth } from '@/lib/label'

export async function GET(req: NextRequest) {
  // Auth
  const user = await getSessionUser()
  if (!user || user.status !== 'ACTIVE')
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const adherentId = req.nextUrl.searchParams.get('adherentId')
  if (!adherentId)
    return NextResponse.json({ error: 'adherentId requis' }, { status: 400 })

  // Charge l'adhérent
  const adherent = await prisma.adherent.findUnique({
    where: { id: adherentId },
    select: {
      id: true,
      nom: true,
      prenom: true,
      dateExpiration: true,
      saisonId: true,
      licence: true,
      caci: true,
    },
  })

  if (!adherent)
    return NextResponse.json({ error: 'Adhérent introuvable' }, { status: 404 })

  // Génère le PNG
  const labelData: LabelData = {
    nom:            adherent.nom,
    prenom:         adherent.prenom,
    dateExpiration: adherent.dateExpiration ?? '31/12/2025',
    licence:        adherent.licence ?? null,
    caci:           adherent.caci    ?? null,
    labelMm:        62 as LabelWidth,
  }

  const { pngBuffer, checksum, filename } = await generateLabelPng(labelData)

  return NextResponse.json({
    ok:         true,
    pngBase64:  pngBuffer.toString('base64'),
    filename,
    checksum,
    adherentId: adherent.id,
    saisonId:   adherent.saisonId,
    nom:        adherent.nom,
    prenom:     adherent.prenom,
    expire:     adherent.dateExpiration ?? '31/12/2025',
  })
}
