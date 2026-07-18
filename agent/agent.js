/**
 * agent/agent.js
 * Agent local d'impression Brother QL-570 — Windows
 *
 * Installation :
 *   cd agent
 *   npm install
 *   pip install pywin32 pillow
 *   node agent.js
 *
 * Endpoints :
 *   GET  /status    → état de l'agent + Python
 *   POST /print     → { image: base64PNG, nom, prenom, expire }
 *   GET  /printers  → liste des imprimantes Windows
 *   POST /config    → { device?, rotate? }
 */
'use strict'

const express    = require('express')
const cors       = require('cors')
const bodyParser = require('body-parser')
const { execFile, exec } = require('child_process')
const fs         = require('fs')
const path       = require('path')
const os         = require('os')

const app  = express()
const PORT = 3333

// ── Config ────────────────────────────────────────────────────────────────────
let config = {
  device: 'Brother QL-570',   // nom exact dans Périphériques et imprimantes Windows
  rotate: '0',
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }))
app.use(bodyParser.json({ limit: '20mb' }))   // PNG peut être lourd

// ── Constantes ────────────────────────────────────────────────────────────────
const PYTHON       = 'python'                                    // Windows = python
const PRINT_SCRIPT = path.join(__dirname, 'print_windows.py')   // nouveau script

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

// ── Vérifie Python + script ───────────────────────────────────────────────────
function checkPython() {
  return new Promise(resolve => {
    exec(`${PYTHON} --version`, err => {
      if (err) return resolve({ ok: false, reason: 'Python introuvable' })
      if (!fs.existsSync(PRINT_SCRIPT))
        return resolve({ ok: false, reason: `Script absent : ${PRINT_SCRIPT}` })
      resolve({ ok: true })
    })
  })
}

// ── GET /status ───────────────────────────────────────────────────────────────
app.get('/status', async (req, res) => {
  const py = await checkPython()
  res.json({
    ok: true,
    agent: 'CSN Label Agent v2.0 (Windows)',
    pythonAvailable: py.ok,
    pythonError: py.reason ?? null,
    printScript: PRINT_SCRIPT,
    config,
    platform: process.platform,
  })
})

// ── POST /print ───────────────────────────────────────────────────────────────
/**
 * Body attendu :
 *   {
 *     image: string     // PNG en base64 (généré par Next.js via lib/label.ts)
 *     nom: string       // pour le log
 *     prenom: string
 *     expire: string
 *     copies?: number   // défaut 1
 *   }
 */
app.post('/print', async (req, res) => {
  const { image, nom, prenom, expire, copies = 1 } = req.body

  if (!image)
    return res.status(400).json({ ok: false, error: 'Champ "image" (base64 PNG) requis' })

  log(`Job reçu : ${nom ?? '?'} ${prenom ?? '?'} | copies=${copies}`)

  // Vérifie Python
  const py = await checkPython()
  if (!py.ok)
    return res.status(503).json({ ok: false, error: py.reason })

  // Écrit le PNG dans un fichier temporaire
  const tmpFile = path.join(os.tmpdir(), `csn_label_${Date.now()}.png`)
  try {
    fs.writeFileSync(tmpFile, Buffer.from(image, 'base64'))
  } catch (err) {
    return res.status(500).json({ ok: false, error: `Erreur écriture tmp : ${err.message}` })
  }

  const printerName = config.device || 'Brother QL-570'
  const n           = Math.max(1, parseInt(copies, 10) || 1)

  // Imprime N copies
  try {
    for (let i = 0; i < n; i++) {
      await new Promise((resolve, reject) => {
        execFile(
          PYTHON,
          [PRINT_SCRIPT, tmpFile, printerName],
          { timeout: 30000 },
          (err, stdout, stderr) => {
            if (err) {
              log(`Erreur Python : ${stderr || err.message}`)
              return reject(new Error(stderr || err.message))
            }
            log(`Python OK : ${stdout.trim()}`)
            resolve(stdout)
          }
        )
      })
    }

    res.json({
      ok: true,
      message: `${n} étiquette${n > 1 ? 's' : ''} envoyée${n > 1 ? 's' : ''} à l'imprimante`,
      printer: printerName,
      nom, prenom,
    })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  } finally {
    // Nettoyage fichier tmp
    try { fs.unlinkSync(tmpFile) } catch {}
  }
})

// ── GET /printers ─────────────────────────────────────────────────────────────
// Liste les imprimantes via Python win32print (pas besoin de brother_ql)
app.get('/printers', (req, res) => {
  const script = `
import win32print, json
printers = [p[2] for p in win32print.EnumPrinters(
  win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
)]
print(json.dumps(printers))
`
  execFile(PYTHON, ['-c', script], { timeout: 5000 }, (err, stdout, stderr) => {
    if (err) {
      return res.json({
        printers: [],
        error: stderr || err.message,
        hint: 'Installez pywin32 : pip install pywin32',
      })
    }
    try {
      const printers = JSON.parse(stdout.trim())
      res.json({ printers })
    } catch {
      res.json({ printers: [], error: 'Parse JSON échoué', raw: stdout })
    }
  })
})

// ── POST /config ──────────────────────────────────────────────────────────────
app.post('/config', (req, res) => {
  const { device, rotate } = req.body
  if (device !== undefined) config.device = device
  if (rotate !== undefined) config.rotate = rotate
  log(`Config mise à jour : ${JSON.stringify(config)}`)
  res.json({ ok: true, config })
})

// ── Démarrage ─────────────────────────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', async () => {
  const py = await checkPython()
  console.log(`\n╔══════════════════════════════════════════╗`)
  console.log(`║   CSN Label Agent v2.0 — port ${PORT}       ║`)
  console.log(`╚══════════════════════════════════════════╝`)
  console.log(`Python   : ${py.ok ? '✓ disponible' : `✗ ${py.reason}`}`)
  console.log(`Script   : ${PRINT_SCRIPT}`)
  console.log(`Imprim.  : ${config.device}`)
  console.log(`\nEn attente sur http://127.0.0.1:${PORT}\n`)
})
