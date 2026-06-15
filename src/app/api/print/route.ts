/**
 * src/app/api/print/route.ts
 *
 * GET  /api/print         → { agentAvailable: bool }
 * POST /api/print         → impression ou fallback PNG download
 *
 * Body POST :
 *   { adherentIds: string[], force?: boolean, simulate?: boolean }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { prisma } from '@/lib/db'
import { generateLabelPng, LabelData, LabelWidth } from '@/lib/label'

const AGENT_URL        = 'http://localhost:3333'
const AGENT_TIMEOUT_MS = 2000

// ── Agent disponible ? ────────────────────────────────────────────────────────
async function isAgentAvailable(): Promise<boolean> {
  try {
    const ctrl  = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), AGENT_TIMEOUT_MS)
    const res   = await fetch(`${AGENT_URL}/status`, { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(timer)
    return res.ok
  } catch {
    return false
  }
}

// ── Envoi à l'agent ───────────────────────────────────────────────────────────
async function sendToAgent(
  nom: string, prenom: string, expire: string
): Promise<void> {
  const res = await fetch(`${AGENT_URL}/print`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nom, prenom, expire, copies: 1 }),
  })
  if (!res.ok) throw new Error(`Agent ${res.status}: ${await res.text()}`)
}

// ── Anti-doublon ──────────────────────────────────────────────────────────────
async function isAlreadyPrinted(adherentId: string, saisonId: string): Promise<boolean> {
  const ex = await prisma.impression.findFirst({
    where: { adherentId, saisonId, status: 'PRINTED' },
  })
  return ex !== null
}

async function recordImpression(
  adherentId: string, saisonId: string,
  checksum: string, status: 'PRINTED' | 'SIMULATED'
): Promise<void> {
  await prisma.impression.create({
    data: { adherentId, saisonId, zplChecksum: checksum, status },
  })
}

// ── GET /api/print ────────────────────────────────────────────────────────────
export async function GET() {
  const available = await isAgentAvailable()
  if (!available) return NextResponse.json({ agentAvailable: false })
  try {
    const res  = await fetch(`${AGENT_URL}/status`, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json({ agentAvailable: true, ...data })
  } catch {
    return NextResponse.json({ agentAvailable: false })
  }
}

// ── POST /api/print ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Auth
  const user = await getSessionUser()
  if (!user || user.status !== 'ACTIVE')
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { adherentIds, force = false, simulate = false } = await req.json()

  if (!Array.isArray(adherentIds) || adherentIds.length === 0)
    return NextResponse.json({ error: 'Aucun adhérent sélectionné' }, { status: 400 })

  // Charge les adhérents
  const adherents = await prisma.adherent.findMany({
    where: { id: { in: adherentIds } },
    select: { id: true, nom: true, prenom: true, dateExpiration: true, saisonId: true },
  })
  if (adherents.length === 0)
    return NextResponse.json({ error: 'Adhérents introuvables' }, { status: 404 })

  // Génère les PNG + filtre doublons
  const jobs: Array<{
    adherent: typeof adherents[0]
    pngBuffer: Buffer
    checksum: string
    filename: string
  }> = []
  const skippedNames: string[] = []

  for (const adherent of adherents) {
    if (!force && !simulate) {
      if (await isAlreadyPrinted(adherent.id, adherent.saisonId)) {
        skippedNames.push(`${adherent.nom} ${adherent.prenom}`)
        continue
      }
    }
    const labelData: LabelData = {
      nom: adherent.nom,
      prenom: adherent.prenom,
      dateExpiration: adherent.dateExpiration ?? '31/12/2025',
      labelMm: 62 as LabelWidth,
    }
    const result = await generateLabelPng(labelData)
    jobs.push({ adherent, ...result })
  }

  if (jobs.length === 0)
    return NextResponse.json({
      ok: false, printed: 0,
      skipped: skippedNames.length, skippedNames,
      message: 'Toutes les étiquettes ont déjà été imprimées. Utilisez "Forcer" pour réimprimer.',
    })

  // Mode simulate → PNG download direct sans passer par l'agent
  if (simulate) {
    for (const job of jobs)
      await recordImpression(job.adherent.id, job.adherent.saisonId, job.checksum, 'SIMULATED')

    if (jobs.length === 1) {
      const job = jobs[0]
      return new NextResponse(new Uint8Array(job.pngBuffer), {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="${job.filename}"`,
          'X-Print-Mode': 'simulate',
        },
      })
    }
    return NextResponse.json({
      ok: true, mode: 'simulate', simulated: jobs.length, skipped: skippedNames.length,
      labels: jobs.map(j => ({
        adherentId: j.adherent.id, nom: j.adherent.nom, prenom: j.adherent.prenom,
        filename: j.filename, pngBase64: j.pngBuffer.toString('base64'),
      })),
    })
  }

  // Tente l'agent local
  const agentAvailable = await isAgentAvailable()

  if (agentAvailable) {
    let printedCount = 0
    const errors: string[] = []
    for (const job of jobs) {
      try {
        await sendToAgent(job.adherent.nom, job.adherent.prenom,
          job.adherent.dateExpiration ?? '31/12/2025')
        await recordImpression(job.adherent.id, job.adherent.saisonId, job.checksum, 'PRINTED')
        printedCount++
      } catch (err) {
        errors.push(`${job.adherent.nom} ${job.adherent.prenom}: ${(err as Error).message}`)
      }
    }
    return NextResponse.json({
      ok: errors.length === 0, mode: 'agent',
      printed: printedCount, skipped: skippedNames.length, skippedNames,
      errors: errors.length > 0 ? errors : undefined,
    })
  }

  // Fallback : agent absent → PNG download
  for (const job of jobs)
    await recordImpression(job.adherent.id, job.adherent.saisonId, job.checksum, 'SIMULATED')

  if (jobs.length === 1) {
    const job = jobs[0]
    return new NextResponse(new Uint8Array(job.pngBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${job.filename}"`,
        'X-Print-Mode': 'fallback-download',
        'X-Agent-Available': 'false',
      },
    })
  }

  return NextResponse.json({
    ok: true, mode: 'fallback-download', agentAvailable: false,
    skipped: skippedNames.length, skippedNames,
    labels: jobs.map(j => ({
      adherentId: j.adherent.id, nom: j.adherent.nom, prenom: j.adherent.prenom,
      filename: j.filename, pngBase64: j.pngBuffer.toString('base64'),
    })),
    message: 'Agent non disponible — téléchargez les étiquettes.',
  })
}
