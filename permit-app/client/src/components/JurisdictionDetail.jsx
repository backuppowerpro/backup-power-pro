import { useState, useEffect } from 'react'
import { ArrowLeft, ExternalLink, Copy, Eye, EyeOff, Check, Phone, LogIn, Pencil, Building2 } from 'lucide-react'
import { useToast } from './Toast'

function CopyButton({ value, label = 'Value', large = false }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  if (!value) return null
  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    toast?.(`${label} copied!`)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#edf0f7] hover:bg-[#e4e8f0] text-[#4a5568] hover:text-[#1a2a42] transition-colors text-xs font-medium shrink-0 ${large ? 'px-4 py-2' : ''}`}
    >
      {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
      {copied ? 'Copied!' : `Copy ${label}`}
    </button>
  )
}

function CredRow({ label, children }) {
  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-[#e4e8f0] last:border-0">
      <span className="text-xs text-[#8a9ab5] w-20 shrink-0 uppercase tracking-wide">{label}</span>
      <div className="flex-1 min-w-0 flex items-center gap-2 justify-between">
        {children}
      </div>
    </div>
  )
}

export default function JurisdictionDetail({ jurisdiction: j, onClose, onEdit }) {
  const [showPassword, setShowPassword] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  const noteLines = (j.notes || '').split('\n').filter(Boolean)
  const description = noteLines[0] || ''
  const extraLinks = noteLines.slice(1).map(line => {
    const match = line.match(/^(.+?):\s*(https?:\/\/.+)$/)
    if (match) return { label: match[1], url: match[2] }
    return { label: line, url: null }
  })

  const formatPhone = (raw) => {
    if (!raw) return null
    const digits = raw.replace(/\D/g, '')
    if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
    return raw
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      style={{
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 280ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Hero section */}
      <div className="relative h-48 shrink-0 overflow-hidden bg-[#dde3ef]">
        {j.background_url ? (
          <img
            src={j.background_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={e => { e.target.style.display = 'none' }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/70" />

        <button
          onClick={handleClose}
          className="absolute top-4 left-4 z-10 flex items-center gap-2 text-white/90 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="text-sm font-medium">Back</span>
        </button>

        <button
          onClick={onEdit}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/30 text-white/80 hover:text-white hover:bg-black/50 transition-colors"
        >
          <Pencil size={16} />
        </button>

        <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/10 backdrop-blur-sm shrink-0 flex items-center justify-center border border-white/20">
            {j.logo_url ? (
              <img
                src={j.logo_url}
                alt={j.name}
                className="w-full h-full object-contain"
                onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
              />
            ) : null}
            <Building2 size={24} className="text-white/50" style={{ display: j.logo_url ? 'none' : 'block' }} />
          </div>
          <div className="min-w-0">
            <h1 className="text-white font-bold text-lg leading-tight drop-shadow-sm">{j.name}</h1>
            {description && (
              <p className="text-white/70 text-xs mt-0.5">{description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 py-4 flex gap-2 border-b border-[#e4e8f0] shrink-0">
        {j.portal_url && (
          <a
            href={j.portal_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-sm transition-colors"
          >
            <LogIn size={16} />
            Open Portal
          </a>
        )}
        {j.phone && (
          <a
            href={`tel:${j.phone}`}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-[#edf0f7] hover:bg-[#e4e8f0] text-[#1a2a42] rounded-xl font-medium text-sm transition-colors"
          >
            <Phone size={16} />
            Call
          </a>
        )}
      </div>

      {/* Credentials */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4">
          {j.username && (
            <CredRow label="Username">
              <span className="text-sm text-[#1a2a42] truncate">{j.username}</span>
              <CopyButton value={j.username} label="Username" />
            </CredRow>
          )}

          {j.password && (
            <CredRow label="Password">
              <span className="text-sm text-[#1a2a42] font-mono">
                {showPassword ? j.password : '••••••••••'}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1.5 rounded-lg bg-[#edf0f7] hover:bg-[#e4e8f0] text-[#4a5568] hover:text-[#1a2a42] transition-colors"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <CopyButton value={j.password} label="Password" />
              </div>
            </CredRow>
          )}

          {j.phone && (
            <CredRow label="Phone">
              <a href={`tel:${j.phone}`} className="text-sm text-blue-600 hover:text-blue-700 transition-colors">
                {formatPhone(j.phone)}
              </a>
            </CredRow>
          )}

          {extraLinks.map((link, i) => (
            link.url ? (
              <CredRow key={i} label={link.label}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink size={13} className="shrink-0" />
                  <span className="truncate">Open →</span>
                </a>
              </CredRow>
            ) : (
              <CredRow key={i} label={link.label}>
                <span className="text-sm text-[#8a9ab5]">{link.label}</span>
              </CredRow>
            )
          ))}
        </div>
      </div>
    </div>
  )
}
