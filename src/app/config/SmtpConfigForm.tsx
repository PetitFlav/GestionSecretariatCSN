'use client'

import { useState, useEffect, useTransition } from 'react'
import { SMTP_PRESETS, SmtpProvider } from '@/lib/smtp-presets'
import { SmtpConfigDisplay, saveSmtpConfig, testSmtpConfig } from '@/app/actions/smtp-config'

interface Props {
  initialConfig: SmtpConfigDisplay | null
}

export default function SmtpConfigForm({ initialConfig }: Props) {
  const [isPending,  startSave] = useTransition()
  const [isTesting,  startTest] = useTransition()
  const [feedback,   setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  const [provider, setProvider] = useState<SmtpProvider>(initialConfig?.provider ?? 'gmail')
  const [host,     setHost]     = useState(initialConfig?.host     ?? '')
  const [port,     setPort]     = useState(initialConfig?.port     ?? 587)
  const [secure,   setSecure]   = useState(initialConfig?.secure   ?? false)
  const [user,     setUser]     = useState(initialConfig?.user     ?? '')
  const [password, setPassword] = useState('')  // jamais pré-rempli
  const [from,     setFrom]     = useState(initialConfig?.from     ?? '')

  // Appliquer le preset quand on change de provider
  useEffect(() => {
    if (provider !== 'manual') {
      const preset = SMTP_PRESETS[provider]
      setHost(preset.host)
      setPort(preset.port)
      setSecure(preset.secure)
    }
  }, [provider])

  function handleSave() {
    setFeedback(null)
    startSave(async () => {
      const res = await saveSmtpConfig({ provider, host, port, secure, user, password, from })
      if (res.success) {
        setFeedback({ type: 'ok', msg: 'Configuration enregistrée.' })
        setPassword('')
      } else {
        setFeedback({ type: 'err', msg: res.error ?? 'Erreur lors de la sauvegarde' })
      }
    })
  }

  function handleTest() {
    setFeedback(null)
    startTest(async () => {
      const res = await testSmtpConfig()
      if (res.success) {
        setFeedback({ type: 'ok', msg: 'Connexion réussie ! Un email de test a été envoyé à votre adresse.' })
      } else {
        setFeedback({ type: 'err', msg: res.error ?? 'Échec de la connexion' })
      }
    })
  }

  const inputClass = "w-full px-3 py-2 text-[13px] rounded-lg outline-none"
  const inputStyle = {
    border: '0.5px solid var(--csn-border-strong)',
    background: 'var(--csn-cream)',
    color: 'var(--csn-navy)',
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Statut */}
      {initialConfig && (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: initialConfig.isVerified ? '#16a34a' : '#d97706' }} />
          <span className="text-[12px]"
            style={{ color: initialConfig.isVerified ? '#16a34a' : '#d97706' }}>
            {initialConfig.isVerified
              ? 'Configuration vérifiée et fonctionnelle'
              : 'Configuration enregistrée mais non testée'}
          </span>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div className="rounded-lg px-3.5 py-2.5 text-[13px]"
          style={{
            background: feedback.type === 'ok' ? '#eaf7f0' : '#fff3cd',
            border: `0.5px solid ${feedback.type === 'ok' ? '#7dd4a8' : '#e8c96a'}`,
            color: feedback.type === 'ok' ? '#1a6642' : '#7a5a00',
          }}>
          {feedback.msg}
        </div>
      )}

      {/* Sélection provider */}
      <div>
        <label className="text-[12px] text-slate-500 mb-1.5 block">Fournisseur email</label>
        <select value={provider}
          onChange={e => setProvider(e.target.value as SmtpProvider)}
          className={inputClass} style={inputStyle}>
          {Object.entries(SMTP_PRESETS).map(([key, p]) => (
            <option key={key} value={key}>{p.label}</option>
          ))}
        </select>
        {provider === 'gmail' && (
          <p className="text-[11px] text-slate-400 mt-1">
            Gmail : utilisez un <strong>mot de passe d&apos;application</strong> (pas votre mot de passe Gmail).
            Activez la validation en 2 étapes puis générez un mot de passe d&apos;application dans votre compte Google.
          </p>
        )}
      </div>

      {/* Paramètres serveur */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="text-[12px] text-slate-500 mb-1.5 block">Serveur SMTP</label>
          <input type="text" value={host} onChange={e => setHost(e.target.value)}
            placeholder="smtp.example.com" className={inputClass} style={inputStyle}
            readOnly={provider !== 'manual'} />
        </div>
        <div>
          <label className="text-[12px] text-slate-500 mb-1.5 block">Port</label>
          <input type="number" value={port} onChange={e => setPort(parseInt(e.target.value))}
            className={inputClass} style={inputStyle}
            readOnly={provider !== 'manual'} />
        </div>
      </div>

      {/* SSL */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={secure}
            onChange={e => setSecure(e.target.checked)}
            disabled={provider !== 'manual'}
            className="w-4 h-4 cursor-pointer" />
          <span className="text-[13px]" style={{ color: 'var(--csn-navy)' }}>
            SSL/TLS activé
          </span>
        </label>
        <span className="text-[11px] text-slate-400">
          {secure ? 'Connexion sécurisée SSL (port 465)' : 'STARTTLS (port 587)'}
        </span>
      </div>

      {/* Identifiants */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[12px] text-slate-500 mb-1.5 block">Identifiant SMTP</label>
          <input type="email" value={user} onChange={e => setUser(e.target.value)}
            placeholder="votre@email.com" autoComplete="username"
            className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className="text-[12px] text-slate-500 mb-1.5 block">
            Mot de passe
            {initialConfig && <span className="ml-1 text-slate-300">(laisser vide = inchangé)</span>}
          </label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder={initialConfig ? '••••••••' : 'Mot de passe SMTP'}
            autoComplete="new-password"
            className={inputClass} style={inputStyle} />
        </div>
      </div>

      {/* Email expéditeur */}
      <div>
        <label className="text-[12px] text-slate-500 mb-1.5 block">
          Email expéditeur <span className="text-slate-300">(affiché dans le &quot;De :&quot; de l&apos;email)</span>
        </label>
        <input type="email" value={from} onChange={e => setFrom(e.target.value)}
          placeholder="votre@email.com" autoComplete="off"
          className={inputClass} style={inputStyle} />
        <p className="text-[11px] text-slate-400 mt-1">
          Peut être différent de l&apos;identifiant SMTP. Ex : <em>secretariat.csn@gmail.com</em>
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button onClick={handleSave} disabled={isPending || isTesting}
          className="flex-1 py-2.5 rounded-lg text-[13px] font-medium text-white disabled:opacity-60 transition-opacity"
          style={{ background: 'var(--csn-navy)' }}>
          {isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button onClick={handleTest} disabled={isPending || isTesting || !initialConfig}
          className="px-4 py-2.5 rounded-lg text-[13px] border disabled:opacity-50 transition-colors hover:bg-slate-50"
          style={{ borderColor: 'var(--csn-border-strong)', color: 'var(--csn-blue)' }}
          title={!initialConfig ? 'Enregistrez d\'abord la configuration' : 'Envoyer un email de test'}>
          {isTesting ? 'Test…' : '✉ Tester'}
        </button>
      </div>

      <p className="text-[11px] text-slate-400">
        Vos identifiants sont chiffrés et ne sont visibles que par vous.
        Ni les administrateurs ni les autres utilisateurs ne peuvent y accéder.
      </p>
    </div>
  )
}
