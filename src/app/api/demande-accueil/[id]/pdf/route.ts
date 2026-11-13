/**
 * src/app/api/demande-accueil/[id]/pdf/route.ts
 *
 * GET /api/demande-accueil/<id>/pdf
 *
 * Sert le PDF exact envoyé pour une demande de l'historique.
 * Route dédiée : la liste de l'historique ne charge jamais la colonne pdf.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { prisma } from '@/lib/db'
import { nomFichierPdf } from '@/lib/demande-accueil'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user || user.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const demande = await prisma.demandeAccueil.findUnique({
    where:  { id: params.id },
    select: { pdf: true, dateSouhaitee: true },
  })
  if (!demande?.pdf) {
    return NextResponse.json({ error: 'PDF introuvable pour cette demande' }, { status: 404 })
  }

  const nom = nomFichierPdf(demande.dateSouhaitee.toISOString().slice(0, 10))
  return new NextResponse(new Uint8Array(demande.pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nom}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
