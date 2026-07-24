/**
 * src/lib/label.ts
 * Génère une image étiquette Brother QL-570 via @napi-rs/canvas
 * Rendu texte natif avec fonts chargées depuis public/fonts/
 * Canvas 696×300 px @ 300 dpi, ruban 62 mm
 */

import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs'

export const LABEL_CANVAS = {
  62: { w: 696, h: 300 },
  38: { w: 413, h: 300 },
  29: { w: 306, h: 300 },
  12: { w: 118, h: 300 },
} as const

export type LabelWidth = keyof typeof LABEL_CANVAS

export interface LabelData {
  nom: string
  prenom: string
  dateExpiration: string
  licence?: string | null
  caci?: string | null
  labelMm?: LabelWidth
}

export interface LabelResult {
  pngBuffer: Buffer
  checksum: string
  filename: string
}

// ── Chargement des fonts ──────────────────────────────────────────────────────
let fontsLoaded = false

function loadFonts() {
  if (fontsLoaded) return

  const candidates = [
    // public/fonts/ dans le repo (Vercel + Codespaces)
    path.join(process.cwd(), 'public', 'fonts', 'DejaVuSans.ttf'),
    // Linux système
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    // Windows
    'C:\\Windows\\Fonts\\arial.ttf',
  ]
  const candidatesBold = [
    path.join(process.cwd(), 'public', 'fonts', 'DejaVuSans-Bold.ttf'),
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    'C:\\Windows\\Fonts\\arialbd.ttf',
  ]

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      GlobalFonts.registerFromPath(p, 'LabelFont')
      break
    }
  }
  for (const p of candidatesBold) {
    if (fs.existsSync(p)) {
      GlobalFonts.registerFromPath(p, 'LabelFontBold')
      break
    }
  }

  fontsLoaded = true
}

// ── Utilitaires ───────────────────────────────────────────────────────────────
export function saisonFromExpire(expire: string): string {
  const parts = expire.split('/')
  if (parts.length !== 3) return expire
  const year = parseInt(parts[2], 10)
  if (isNaN(year)) return expire
  return `${year - 1} / ${year}`
}

function normNom(nom: string): string {
  return nom.trim().toUpperCase()
}

function normPrenom(prenom: string): string {
  const s = prenom.trim().toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Rendu canvas ──────────────────────────────────────────────────────────────
async function renderCanvas(data: LabelData): Promise<Buffer> {
  loadFonts()

  const mm = (data.labelMm ?? 62) as LabelWidth
  const { w, h } = LABEL_CANVAS[mm]

  const canvas = createCanvas(w, h)
  const ctx    = canvas.getContext('2d')

  // Fond blanc
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, w, h)

  // Tailles police
  const fontBig    = mm >= 62 ? 52 : mm >= 38 ? 40 : 28
  const fontMedium = mm >= 62 ? 36 : mm >= 38 ? 28 : 20
  const fontSmall  = mm >= 62 ? 26 : mm >= 38 ? 20 : 15

  const mx    = 20
  const myTop = 10

  ctx.fillStyle = 'black'
  ctx.textBaseline = 'top'

  // Ligne 1 — NOM (gras)
  ctx.font = `bold ${fontBig}px LabelFontBold, LabelFont, Arial, sans-serif`
  ctx.fillText(normNom(data.nom), mx, myTop)

  // Ligne 2 — Prénom
  const y2 = myTop + Math.round(fontBig * 1.25)
  ctx.font = `${fontBig}px LabelFont, Arial, sans-serif`
  ctx.fillText(normPrenom(data.prenom), mx, y2)

  // Ligne 3 — Saison (gras)
  const y3 = y2 + Math.round(fontMedium * 1.35)
  ctx.font = `bold ${fontMedium}px LabelFontBold, LabelFont, Arial, sans-serif`
  ctx.fillText(`Saison : ${saisonFromExpire(data.dateExpiration)}`, mx, y3)

  // Ligne 4 — Licence
  ctx.font = `${fontSmall}px LabelFont, Arial, sans-serif`
  let yNext = y3 + Math.round(fontMedium * 1.3)

  if (data.licence) {
    ctx.fillText(`Licence : ${data.licence}`, mx, yNext)
    yNext += Math.round(fontSmall * 1.35)
  }

  // Ligne 5 — CACI
  if (data.caci) {
    ctx.fillText(`Fin CACI : ${data.caci}`, mx, yNext)
  }

  // Bordure
  ctx.strokeStyle = '#cccccc'
  ctx.lineWidth   = 2
  ctx.strokeRect(2, 2, w - 4, h - 4)

  return canvas.toBuffer('image/png')
}

// ── Exports ───────────────────────────────────────────────────────────────────
export async function generateLabelPng(data: LabelData): Promise<LabelResult> {
  const pngBuffer = await renderCanvas(data)

  const checksum = crypto.createHash('sha1').update(pngBuffer).digest('hex')
  const safeName = `${normNom(data.nom)}_${normPrenom(data.prenom)}`
    .replace(/[^A-Za-z0-9_-]/g, '_')
  const filename = `label_${safeName}.png`

  return { pngBuffer, checksum, filename }
}

// Compat preview SVG — on retourne un SVG simple pour la preview
export function generateLabelSvg(data: LabelData): string {
  const mm = (data.labelMm ?? 62) as LabelWidth
  const { w, h } = LABEL_CANVAS[mm]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="white"/>
  <text x="20" y="60" font-family="Arial" font-size="52" font-weight="bold" fill="black">${data.nom.toUpperCase()}</text>
  <text x="20" y="125" font-family="Arial" font-size="52" fill="black">${data.prenom}</text>
  <text x="20" y="175" font-family="Arial" font-size="36" font-weight="bold" fill="black">Saison : ${saisonFromExpire(data.dateExpiration)}</text>
  ${data.licence ? `<text x="20" y="210" font-family="Arial" font-size="26" fill="black">Licence : ${data.licence}</text>` : ''}
  ${data.caci    ? `<text x="20" y="245" font-family="Arial" font-size="26" fill="black">Fin CACI : ${data.caci}</text>` : ''}
</svg>`
}
