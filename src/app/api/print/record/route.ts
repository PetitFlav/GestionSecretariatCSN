/**
 * src/app/api/print/record/route.ts
 *
 * POST /api/print/record
 *
 * Appelé par le NAVIGATEUR après confirmation de l'agent local.
 * Enregistre en base que l'étiquette a été imprimée.
 *
 * Body : { adherentId, saisonId, checksum, force? }
 * Réponse : { ok: true } | { ok: false, skipped: true, message: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  // Auth
  const user = await getSessionUser()
  if (!user || user.status !== 'ACTIVE')
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { adherentId, saisonId, checksum, force = false } = await req.json()

  if (!adherentId || !saisonId || !checksum)
    return NextResponse.json(
      { error: 'adherentId, saisonId et checksum requis' },
      { status: 400 }
    )

  // Anti-doublon (sauf force=true)
  if (!force) {
    const existing = await prisma.impression.findFirst({
      where: { adherentId, saisonId, status: 'PRINTED' },
    })
    if (existing) {
      return NextResponse.json({
        ok:      false,
        skipped: true,
        message: 'Étiquette déjà imprimée pour cette saison.',
      })
    }
  }

  // Enregistre
  await prisma.impression.create({
    data: {
      adherentId,
      saisonId,
      zplChecksum: checksum,
      status: 'PRINTED',
    },
  })

  return NextResponse.json({ ok: true })
}
