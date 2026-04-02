// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../package.json') as { version: string }


export default function BottomBar() {
  return (
    <footer
      className="bg-white border-t px-5 py-2 flex items-center justify-between flex-shrink-0"
      style={{ borderColor: 'var(--csn-border-strong)' }}
    >
      <span className="text-[11px]" style={{ color: '#8faabf' }}>
        Centre Subaquatique Nantais — FFESSM N° 03-44-0034
      </span>
      <span className="text-[11px]" style={{ color: '#8faabf' }}>
        v{version}
      </span>
    </footer>
  )
}
