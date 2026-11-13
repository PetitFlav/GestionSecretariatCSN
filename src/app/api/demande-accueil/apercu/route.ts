/**
 * src/app/api/demande-accueil/apercu/route.ts
 *
 * POST /api/demande-accueil/apercu  (corps JSON = SaisieDemande)
 *
 * Renvoie le PDF tel qu'il serait envoyé. N'écrit RIEN en base.
 * Mêmes calculs que l'envoi (preparerDemande) → l'aperçu est fidèle.
 * Erreur de saisie → 400 { error }. Les avertissements non bloquants sont
 * calculés par l'écran lui-même.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { genererPdfDemande } from '@/lib/pdf-demande-accueil'
import { SaisieDemande } from '@/lib/demande-accueil'
import { ErreurSaisie, preparerDemande } from '@/lib/demande-accueil-serveur'

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user || user.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  let saisie: SaisieDemande
  try {
    saisie = await req.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  try {
    const prep = await preparerDemande(user, saisie, false)
    const pdf = await genererPdfDemande(prep.modele.pdf, prep.valeurs, prep.modele.champs)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${prep.nomFichier}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (!(e instanceof ErreurSaisie)) console.error('[demande-accueil] Aperçu :', message)
    return NextResponse.json({ error: message }, { status: e instanceof ErreurSaisie ? 400 : 500 })
  }
}
