/**
 * src/lib/label.ts
 * Génère une image étiquette Brother QL-570 via @napi-rs/canvas
 * Canvas 449×296 px = dimensions réelles driver Brother Windows
 *
 *  ┌──────────────────────────────────────┐
 *  │ NOM                        (haut)    │
 *  │ Prénom                               │
 *  │                                      │
 *  │ Saison : 2025 / 2026       (milieu)  │
 *  │                                      │
 *  │ Licence : XXXXXXX          (bas)     │
 *  │ Fin CACI : JJ/MM/AAAA               │
 *  └──────────────────────────────────────┘
 */

import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs'

export const LABEL_CANVAS = {
  62: { w: 449, h: 296 },   // dimensions réelles driver Brother Windows
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

let fontsLoaded = false

function loadFonts() {
  if (fontsLoaded) return
  const regular = [
    path.join(process.cwd(), 'public', 'fonts', 'DejaVuSans.ttf'),
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    'C:\\Windows\\Fonts\\arial.ttf',
  ]
  const bold = [
    path.join(process.cwd(), 'public', 'fonts', 'DejaVuSans-Bold.ttf'),
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    'C:\\Windows\\Fonts\\arialbd.ttf',
  ]
  for (const p of regular) { if (fs.existsSync(p)) { GlobalFonts.registerFromPath(p, 'LabelFont'); break } }
  for (const p of bold)    { if (fs.existsSync(p)) { GlobalFonts.registerFromPath(p, 'LabelFontBold'); break } }
  fontsLoaded = true
}

export function saisonFromExpire(expire: string): string {
  const parts = expire.split('/')
  if (parts.length !== 3) return expire
  const year = parseInt(parts[2], 10)
  if (isNaN(year)) return expire
  return `${year - 1} / ${year}`
}

function normNom(nom: string) { return nom.trim().toUpperCase() }
function normPrenom(prenom: string) {
  const s = prenom.trim().toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

async function renderCanvas(data: LabelData): Promise<Buffer> {
  loadFonts()

  const mm = (data.labelMm ?? 62) as LabelWidth
  const { w, h } = LABEL_CANVAS[mm]

  const canvas = createCanvas(w, h)
  const ctx    = canvas.getContext('2d')

  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle    = 'black'
  ctx.textBaseline = 'top'

  // ── Tailles police calées sur 449×296 ──────────────────────────────────────
  const fontBig    = mm >= 62 ? 44 : mm >= 38 ? 38 : 28   // NOM + Prénom
  const fontMedium = mm >= 62 ? 30 : mm >= 38 ? 26 : 20   // Saison
  const fontSmall  = mm >= 62 ? 18 : mm >= 38 ? 16 : 12   // Licence + CACI

  const mx      = 14
  const marginV = 6

  // ── BLOC HAUT : NOM + Prénom ───────────────────────────────────────────────
  const y1 = marginV
  ctx.font = `bold ${fontBig}px LabelFontBold, LabelFont, Arial, sans-serif`
  ctx.fillText(normNom(data.nom), mx, y1)

  const y2 = y1 + Math.round(fontBig * 1.15)
  ctx.font = `${fontBig}px LabelFont, Arial, sans-serif`
  ctx.fillText(normPrenom(data.prenom), mx, y2)

  // ── BLOC MILIEU : Saison centré verticalement ──────────────────────────────
  const blockTopEnd      = y2 + Math.round(fontBig * 1.1)
  const lineSmallH       = Math.round(fontSmall * 1.35)
  const nbLines          = (data.licence ? 1 : 0) + (data.caci ? 1 : 0)
  const blockBottomStart = h - marginV - (nbLines * lineSmallH)
  const saisonY          = Math.round((blockTopEnd + blockBottomStart - fontMedium) / 2)

  ctx.font = `bold ${fontMedium}px LabelFontBold, LabelFont, Arial, sans-serif`
  ctx.fillText(`Saison : ${saisonFromExpire(data.dateExpiration)}`, mx, saisonY)

  // ── BLOC BAS : Licence + CACI ancrés en bas ───────────────────────────────
  let yBottom = h - marginV - (nbLines * lineSmallH)
  ctx.font = `${fontSmall}px LabelFont, Arial, sans-serif`

  if (data.licence) {
    ctx.fillText(`Licence : ${data.licence}`, mx, yBottom)
    yBottom += lineSmallH
  }
  if (data.caci) {
    ctx.fillText(`Fin CACI : ${data.caci}`, mx, yBottom)
  }

  // Bordure
  ctx.strokeStyle = '#cccccc'
  ctx.lineWidth   = 1.5
  ctx.strokeRect(1, 1, w - 2, h - 2)

  return canvas.toBuffer('image/png')
}

export async function generateLabelPng(data: LabelData): Promise<LabelResult> {
  const pngBuffer = await renderCanvas(data)
  const checksum  = crypto.createHash('sha1').update(pngBuffer).digest('hex')
  const safeName  = `${normNom(data.nom)}_${normPrenom(data.prenom)}`.replace(/[^A-Za-z0-9_-]/g, '_')
  return { pngBuffer, checksum, filename: `label_${safeName}.png` }
}

export function generateLabelSvg(data: LabelData): string {
  const mm = (data.labelMm ?? 62) as LabelWidth
  const { w, h } = LABEL_CANVAS[mm]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="white"/>
  <text x="14" y="6"   font-family="Arial" font-size="44" font-weight="bold" fill="black">${data.nom.toUpperCase()}</text>
  <text x="14" y="57"  font-family="Arial" font-size="44" fill="black">${data.prenom}</text>
  <text x="14" y="148" font-family="Arial" font-size="30" font-weight="bold" fill="black">Saison : ${saisonFromExpire(data.dateExpiration)}</text>
  ${data.licence ? `<text x="14" y="234" font-family="Arial" font-size="18" fill="black">Licence : ${data.licence}</text>` : ''}
  ${data.caci    ? `<text x="14" y="258" font-family="Arial" font-size="18" fill="black">Fin CACI : ${data.caci}</text>` : ''}
</svg>`
}
