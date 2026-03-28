import { Building2, ChevronRight, Pencil, Trash2 } from 'lucide-react'

export default function JurisdictionCard({ jurisdiction: j, onTap, onEdit, onDelete }) {
  const noteLines = (j.notes || '').split('\n').filter(Boolean)
  const description = noteLines[0] || ''

  return (
    <div
      onClick={onTap}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onTap()}
      className="w-full text-left bg-white hover:bg-[#f4f6fa] active:bg-[#edf0f7] rounded-xl border border-[#e4e8f0] hover:border-[#0b1f3b] transition-colors overflow-hidden cursor-pointer select-none"
    >
      <div className="flex items-center gap-3 p-3">
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#edf0f7] shrink-0 flex items-center justify-center">
          {j.logo_url ? (
            <img
              src={j.logo_url}
              alt={j.name}
              className="w-full h-full object-contain"
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
            />
          ) : null}
          <div
            className="w-full h-full flex items-center justify-center text-[#8a9ab5]"
            style={{ display: j.logo_url ? 'none' : 'flex' }}
          >
            <Building2 size={20} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#1a2a42] text-sm leading-tight">{j.name}</p>
          {description && (
            <p className="text-xs text-[#8a9ab5] mt-0.5">{description}</p>
          )}
          {j.phone && (
            <p className="text-xs text-[#8a9ab5] mt-0.5">
              {j.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="p-2 rounded-lg hover:bg-[#edf0f7] text-[#8a9ab5] hover:text-[#1a2a42] transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg hover:bg-red-100 text-[#8a9ab5] hover:text-red-600 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
          <ChevronRight size={16} className="text-[#8a9ab5] ml-1" />
        </div>
      </div>
    </div>
  )
}
