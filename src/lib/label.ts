/**
 * src/lib/label.ts
 * Génère une image étiquette Brother QL-570 via SVG → PNG (sharp)
 * Port de printing.py — canvas 696×300 px @ 300 dpi, ruban 62 mm
 */

import sharp from 'sharp'
import crypto from 'crypto'

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
  dateExpiration: string   // JJ/MM/AAAA
  labelMm?: LabelWidth
}

export interface LabelResult {
  pngBuffer: Buffer
  checksum: string
  filename: string
}

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

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildSvg(data: LabelData): string {
  const mm = (data.labelMm ?? 62) as LabelWidth
  const { w, h } = LABEL_CANVAS[mm]

  const line1 = normNom(data.nom)
  const line2 = normPrenom(data.prenom)
  const saison = saisonFromExpire(data.dateExpiration)
  const line3 = `Saison : ${saison}`

  const fontBig   = mm >= 62 ? 56 : mm >= 38 ? 42 : 30
  const fontSmall = mm >= 62 ? 42 : mm >= 38 ? 32 : 24

  const mx    = 20
  const myTop = 14
  const lineH = Math.round(fontBig * 1.3)
  const y1    = myTop + fontBig
  const y2    = y1 + lineH
  const y3    = y2 + Math.round(fontSmall * 1.4) + 4

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="white"/>
  <text x="${mx}" y="${y1}"
    font-family="DejaVu Sans,Arial,Helvetica,sans-serif"
    font-size="${fontBig}" font-weight="bold" fill="black"
  >${escapeXml(line1)}</text>
  <text x="${mx}" y="${y2}"
    font-family="DejaVu Sans,Arial,Helvetica,sans-serif"
    font-size="${fontBig}" font-weight="normal" fill="black"
  >${escapeXml(line2)}</text>
  <text x="${mx}" y="${y3}"
    font-family="DejaVu Sans,Arial,Helvetica,sans-serif"
    font-size="${fontSmall}" font-weight="bold" fill="black"
  >${escapeXml(line3)}</text>
  <rect x="2" y="2" width="${w - 4}" height="${h - 4}"
    fill="none" stroke="#cccccc" stroke-width="2"/>
</svg>`
}

export async function generateLabelPng(data: LabelData): Promise<LabelResult> {
  const mm = (data.labelMm ?? 62) as LabelWidth
  const { w, h } = LABEL_CANVAS[mm]

  const svg = buildSvg(data)
  const pngBuffer = await sharp(Buffer.from(svg, 'utf-8'))
    .resize(w, h, { fit: 'fill' })
    .png({ compressionLevel: 6 })
    .toBuffer()

  const checksum = crypto.createHash('sha1').update(pngBuffer).digest('hex')

  const safeName = `${normNom(data.nom)}_${normPrenom(data.prenom)}`
    .replace(/[^A-Za-z0-9_-]/g, '_')
  const filename = `label_${safeName}.png`

  return { pngBuffer, checksum, filename }
}

export function generateLabelSvg(data: LabelData): string {
  return buildSvg(data)
}
