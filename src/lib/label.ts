/**
 * src/lib/label.ts
 * Génère une image étiquette Brother QL-570 via SVG → PNG (sharp)
 * Utilise DejaVu Sans embarqué en base64 pour garantir le rendu
 * sur tous les environnements (Vercel, Windows, Codespaces)
 */

import sharp from 'sharp'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

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
  dateExpiration: string    // JJ/MM/AAAA
  licence?: string | null
  caci?: string | null
  labelMm?: LabelWidth
}

export interface LabelResult {
  pngBuffer: Buffer
  checksum: string
  filename: string
}

// ── Chargement des polices en base64 ─────────────────────────────────────────
// Les fichiers .ttf sont dans public/fonts/ (commités dans le repo)
function loadFontBase64(filename: string): string {
  const candidates = [
    path.join(process.cwd(), 'public', 'fonts', filename),
    path.join('/usr/share/fonts/truetype/dejavu', filename),
    path.join('C:\\Windows\\Fonts', filename === 'DejaVuSans.ttf' ? 'arial.ttf' : 'arialbd.ttf'),
  ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p).toString('base64')
      }
    } catch {}
  }
  return ''
}

// Cache en mémoire (chargé une seule fois au démarrage)
let _fontRegular = ''
let _fontBold    = ''

function getFonts(): { regular: string; bold: string } {
  if (!_fontRegular) _fontRegular = loadFontBase64('DejaVuSans.ttf')
  if (!_fontBold)    _fontBold    = loadFontBase64('DejaVuSans-Bold.ttf')
  return { regular: _fontRegular, bold: _fontBold }
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

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ── Construction SVG avec font embarquée ──────────────────────────────────────
function buildSvg(data: LabelData): string {
  const mm = (data.labelMm ?? 62) as LabelWidth
  const { w, h } = LABEL_CANVAS[mm]

  const line1 = normNom(data.nom)
  const line2 = normPrenom(data.prenom)
  const saison = saisonFromExpire(data.dateExpiration)
  const line3  = `Saison : ${saison}`
  const line4  = data.licence ? `Licence : ${data.licence}` : null
  const line5  = data.caci    ? `Fin CACI : ${data.caci}`   : null

  // Tailles police
  const fontBig    = mm >= 62 ? 52 : mm >= 38 ? 40 : 28
  const fontMedium = mm >= 62 ? 36 : mm >= 38 ? 28 : 20
  const fontSmall  = mm >= 62 ? 26 : mm >= 38 ? 20 : 15

  const mx    = 20
  const myTop = 10
  const y1    = myTop + fontBig
  const y2    = y1 + Math.round(fontBig * 1.25)
  const y3    = y2 + Math.round(fontMedium * 1.35)
  const y4    = y3 + Math.round(fontSmall * 1.4)
  const y5    = y4 + Math.round(fontSmall * 1.3)

  // Police embarquée via base64 dans @font-face
  const { regular, bold } = getFonts()

  const fontFaceStyle = regular ? `
  <defs>
    <style>
      @font-face {
        font-family: 'DejaVuSans';
        font-weight: normal;
        src: url('data:font/truetype;base64,${regular}');
      }
      @font-face {
        font-family: 'DejaVuSans';
        font-weight: bold;
        src: url('data:font/truetype;base64,${bold || regular}');
      }
    </style>
  </defs>` : ''

  const fontFamily = regular ? 'DejaVuSans' : 'Arial,Helvetica,sans-serif'

  // Lignes 4 et 5
  let extraLines = ''
  const bothOnOneLine = line4 !== null && line5 !== null && y5 > h - 10
  if (bothOnOneLine) {
    const combined = [line4, line5].filter(Boolean).join('   |   ')
    extraLines = `
  <text x="${mx}" y="${y4}" font-family="${fontFamily}" font-size="${fontSmall}" font-weight="normal" fill="black">${escapeXml(combined!)}</text>`
  } else {
    if (line4) extraLines += `
  <text x="${mx}" y="${y4}" font-family="${fontFamily}" font-size="${fontSmall}" font-weight="normal" fill="black">${escapeXml(line4)}</text>`
    if (line5) {
      const yLine5 = line4 ? y5 : y4
      extraLines += `
  <text x="${mx}" y="${yLine5}" font-family="${fontFamily}" font-size="${fontSmall}" font-weight="normal" fill="black">${escapeXml(line5)}</text>`
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${fontFaceStyle}
  <rect width="${w}" height="${h}" fill="white"/>
  <text x="${mx}" y="${y1}" font-family="${fontFamily}" font-size="${fontBig}" font-weight="bold" fill="black">${escapeXml(line1)}</text>
  <text x="${mx}" y="${y2}" font-family="${fontFamily}" font-size="${fontBig}" font-weight="normal" fill="black">${escapeXml(line2)}</text>
  <text x="${mx}" y="${y3}" font-family="${fontFamily}" font-size="${fontMedium}" font-weight="bold" fill="black">${escapeXml(line3)}</text>${extraLines}
  <rect x="2" y="2" width="${w - 4}" height="${h - 4}" fill="none" stroke="#cccccc" stroke-width="2"/>
</svg>`
}

// ── Export principal ──────────────────────────────────────────────────────────
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
