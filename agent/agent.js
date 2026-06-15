/**
 * agent/agent.js
 * Agent local d'impression Brother QL-570
 * Installer sur le PC connecté à l'imprimante USB.
 *
 * Installation :
 *   cd agent && npm install && node agent.js
 */
'use strict'

const express    = require('express')
const cors       = require('cors')
const bodyParser = require('body-parser')
const { execFile, exec } = require('child_process')
const path       = require('path')
const os         = require('os')

const app  = express()
const PORT = 3333

let config = { label: '62', backend: 'pyusb', device: null, rotate: '0' }

app.use(cors({ origin: '*' }))
app.use(bodyParser.json({ limit: '10mb' }))

const PYTHON       = process.platform === 'win32' ? 'python' : 'python3'
const PRINT_SCRIPT = path.join(__dirname, 'print_ql570.py')

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`) }

function checkPython() {
  return new Promise(resolve => {
    exec(`${PYTHON} --version`, err => {
      if (err) return resolve(false)
      const fs = require('fs')
      resolve(fs.existsSync(PRINT_SCRIPT))
    })
  })
}

// GET /status
app.get('/status', async (req, res) => {
  const pythonAvailable = await checkPython()
  res.json({ ok: true, agent: 'CSN Label Agent v1.0', pythonAvailable, config, platform: process.platform })
})

// POST /print — reçoit { nom, prenom, expire, ddn?, copies? }
app.post('/print', async (req, res) => {
  const { nom, prenom, expire, ddn, copies = 1 } = req.body
  if (!nom || !prenom || !expire)
    return res.status(400).json({ ok: false, error: 'Champs requis : nom, prenom, expire' })

  log(`Job : ${nom} ${prenom} | expire=${expire} | copies=${copies}`)

  if (!(await checkPython()))
    return res.status(503).json({ ok: false, error: `Python ou ${PRINT_SCRIPT} introuvable` })

  const args = [
    PRINT_SCRIPT,
    '--nom', nom, '--prenom', prenom,
    '--ddn', ddn || '01/01/2000',
    '--expire', expire,
    '--label', config.label,
    '--backend', config.backend,
    '--rotate', config.rotate,
  ]
  if (config.device) args.push('--device', config.device)

  try {
    for (let i = 0; i < Math.max(1, parseInt(copies, 10) || 1); i++) {
      await new Promise((resolve, reject) => {
        execFile(PYTHON, args, { timeout: 30000 }, (err, stdout, stderr) => {
          if (err) return reject(new Error(stderr || err.message))
          log(`Python OK : ${stdout.trim()}`)
          resolve(stdout)
        })
      })
    }
    res.json({ ok: true, message: `${copies} étiquette(s) imprimée(s)`, nom, prenom })
  } catch (err) {
    log(`Erreur : ${err.message}`)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// GET /printers
app.get('/printers', (req, res) => {
  execFile(PYTHON, ['-c',
    "from brother_ql.backends import backend_factory; b=backend_factory('pyusb'); print('\\n'.join(b.enumerate() or []))"
  ], { timeout: 5000 }, (err, stdout) => {
    res.json({ printers: err ? [] : stdout.trim().split('\n').filter(Boolean), error: err?.message })
  })
})

// POST /config
app.post('/config', (req, res) => {
  const { label, backend, device, rotate } = req.body
  if (label)             config.label   = label
  if (backend)           config.backend = backend
  if (device !== undefined) config.device = device || null
  if (rotate)            config.rotate  = rotate
  log(`Config : ${JSON.stringify(config)}`)
  res.json({ ok: true, config })
})

app.listen(PORT, '127.0.0.1', async () => {
  const py = await checkPython()
  console.log(`\n╔══════════════════════════════════════╗`)
  console.log(`║  CSN Label Agent — port ${PORT}          ║`)
  console.log(`╚══════════════════════════════════════╝`)
  console.log(`Python  : ${py ? '✓ disponible' : '✗ NON TROUVÉ'}`)
  console.log(`Script  : ${PRINT_SCRIPT}`)
  console.log(`Config  : ${JSON.stringify(config)}`)
  console.log(`\nEn attente sur http://127.0.0.1:${PORT}\n`)
})
