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
      className="w-full text-left bg-slate-800 hover:bg-slate-750 active:bg-slate-700 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors overflow-hidden cursor-pointer select-none"
    >
      <div className="flex items-center gap-3 p-3">
        {/* Logo thumbnail */}
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-700 shrink-0 flex items-center justify-center">
          {j.logo_url ? (
            <img
              src={j.logo_url}
              alt={j.name}
              className="w-full h-full object-contain"
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
            />
          ) : null}
          <div
            className="w-full h-full flex items-center justify-center text-slate-500"
            style={{ display: j.logo_url ? 'none' : 'flex' }}
          >
            <Building2 size={20} />
          </div>
        </div>

        {/* Name + description */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-100 text-sm leading-tight">{j.name}</p>
          {description && (
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          )}
          {j.phone && (
            <p className="text-xs text-slate-600 mt-0.5">
              {j.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="p-2 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-200 transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg hover:bg-red-900/50 text-slate-500 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
          <ChevronRight size={16} className="text-slate-600 ml-1" />
        </div>
      </div>
    </div>
  )
}
