export const SMTP_PRESETS = {
  gmail:   { host: 'smtp.gmail.com',        port: 587, secure: false, label: 'Gmail' },
  ovh:     { host: 'ssl0.ovh.net',          port: 465, secure: true,  label: 'OVH' },
  orange:  { host: 'smtp.orange.fr',        port: 587, secure: false, label: 'Orange' },
  free:    { host: 'smtp.free.fr',          port: 465, secure: true,  label: 'Free' },
  outlook: { host: 'smtp-mail.outlook.com', port: 587, secure: false, label: 'Outlook / Hotmail' },
  sfr:     { host: 'smtp.sfr.fr',           port: 587, secure: false, label: 'SFR' },
  manual:  { host: '',                       port: 587, secure: false, label: 'Configuration manuelle' },
} as const

export type SmtpProvider = keyof typeof SMTP_PRESETS
