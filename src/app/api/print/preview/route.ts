/**
 * src/app/api/print/preview/route.ts
 *
 * GET /api/print/preview?nom=Dupont&prenom=Jean&expire=31/12/2026&format=html
 *
 * ⚠️ DEV UNIQUEMENT — bloqué en production
 * Pas d'auth — permet de tester le rendu sans imprimante ni session
 *
 * Formats :
 *   ?format=html  → page de preview avec miniature + bouton download
 *   ?format=png   → PNG brut (affiché dans le navigateur)
 *   ?format=svg   → SVG brut
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateLabelPng, generateLabelSvg, LabelData, LabelWidth } from '@/lib/label'

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production')
    return NextResponse.json({ error: 'Non disponible en production' }, { status: 403 })

  const p      = req.nextUrl.searchParams
  const nom    = p.get('nom')    || 'DUPONT'
  const prenom = p.get('prenom') || 'Jean'
  const expire = p.get('expire') || '31/12/2026'
  const mm     = parseInt(p.get('mm') || '62', 10) as LabelWidth
  const format = p.get('format') || 'html'

  const data: LabelData = {
    nom, prenom,
    dateExpiration: expire,
    labelMm: ([62, 38, 29, 12].includes(mm) ? mm : 62) as LabelWidth,
  }

  // ── SVG ───────────────────────────────────────────────────────────────────
  if (format === 'svg') {
    return new NextResponse(generateLabelSvg(data), {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' },
    })
  }

  // ── PNG ───────────────────────────────────────────────────────────────────
  const { pngBuffer, checksum, filename } = await generateLabelPng(data)

  if (format === 'png') {
    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  // ── HTML (défaut) ─────────────────────────────────────────────────────────
  const base64 = pngBuffer.toString('base64')
  const { w, h } = { 62: { w: 696, h: 300 }, 38: { w: 413, h: 300 }, 29: { w: 306, h: 300 }, 12: { w: 118, h: 300 } }[mm as 62|38|29|12] ?? { w: 696, h: 300 }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Preview étiquette — CSN</title>
  <style>
    body { font-family:system-ui,sans-serif; background:#f1f5f9; display:flex;
           flex-direction:column; align-items:center; padding:40px 20px; gap:24px; margin:0 }
    h1   { font-size:18px; color:#1e293b; margin:0 }
    .badge { background:#fef3c7; color:#92400e; padding:4px 12px;
             border-radius:20px; font-size:12px; font-weight:500 }
    .frame { background:white; border:2px solid #e2e8f0; border-radius:8px;
             padding:16px; box-shadow:0 2px 8px rgba(0,0,0,.08) }
    .frame img { display:block; max-width:100%; height:auto }
    .meta  { background:white; border:1px solid #e2e8f0; border-radius:8px;
             padding:16px 20px; font-size:13px; color:#475569; width:100%; max-width:500px }
    table  { width:100%; border-collapse:collapse }
    td     { padding:4px 8px }
    td:first-child { font-weight:600; color:#1e293b; width:140px }
    .dl    { background:#1e40af; color:white; padding:10px 20px; border-radius:8px;
             text-decoration:none; font-size:14px; font-weight:500 }
    .dl:hover { background:#1d4ed8 }
    .hint  { font-size:12px; color:#94a3b8; text-align:center }
    code   { background:#f1f5f9; padding:2px 6px; border-radius:4px }
  </style>
</head>
<body>
  <h1>🏷️ Preview étiquette CSN</h1>
  <span class="badge">⚠️ Mode développement</span>
  <div class="frame">
    <img src="data:image/png;base64,${base64}" alt="Étiquette ${nom} ${prenom}" />
  </div>
  <div class="meta">
    <table>
      <tr><td>Nom</td><td>${nom.toUpperCase()}</td></tr>
      <tr><td>Prénom</td><td>${prenom}</td></tr>
      <tr><td>Date expiration</td><td>${expire}</td></tr>
      <tr><td>Ruban</td><td>${mm} mm</td></tr>
      <tr><td>Dimensions</td><td>${w}×${h} px</td></tr>
      <tr><td>Checksum</td><td style="font-family:monospace;font-size:11px">${checksum.slice(0,16)}…</td></tr>
      <tr><td>Fichier</td><td>${filename}</td></tr>
    </table>
  </div>
  <a class="dl" href="data:image/png;base64,${base64}" download="${filename}">
    ⬇️ Télécharger le PNG
  </a>
  <p class="hint">
    Modifiez dans l'URL :<br>
    <code>?nom=NOM&amp;prenom=PRENOM&amp;expire=JJ/MM/AAAA&amp;mm=62&amp;format=html</code>
  </p>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
