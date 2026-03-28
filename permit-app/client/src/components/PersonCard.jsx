import { useState } from 'react'
import { ChevronRight, Archive, RotateCcw, Pencil } from 'lucide-react'
import { getStage, STAGES } from '../lib/stages'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import EditPersonModal from './EditPersonModal'
import { useToast } from './Toast'

async function patchPerson(id, data) {
  const res = await fetch(`/api/people/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update person')
  return res.json()
}

export default function PersonCard({ person, isArchived = false }) {
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const queryClient = useQueryClient()
  const toast = useToast()
  const stage = getStage(person.stage)

  const mutation = useMutation({
    mutationFn: (data) => patchPerson(person.id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['people'] })
      if (updated.is_archived) {
        toast?.('Archived')
      } else if (updated.stage !== person.stage) {
        const stageName = STAGES.find(s => s.id === updated.stage)?.label || `Stage ${updated.stage}`
        toast?.(`Moved to ${stageName}`)
      } else {
        toast?.('Restored')
      }
    },
    onError: () => toast?.('Failed to update', 'error'),
  })

  const days = person.days_in_stage || 0
  const daysLabel = days === 0 ? 'today' : days === 1 ? '1 day' : `${days} days`

  return (
    <div className={`bg-slate-800 rounded-lg p-3 border-l-4 ${stage?.border || 'border-slate-600'} relative`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-100 truncate">{person.name}</p>
          {person.phone && <p className="text-xs text-slate-400 mt-0.5">{person.phone}</p>}
          <p className="text-xs text-slate-500 mt-1">{daysLabel} in stage</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isArchived && person.stage < 9 && (
            <button
              onClick={() => mutation.mutate({ stage: person.stage + 1 })}
              className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
              title="Advance to next stage"
            >
              <ChevronRight size={16} />
            </button>
          )}
          {!isArchived && (
            <button
              onClick={() => setShowMoveMenu(!showMoveMenu)}
              className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors text-xs font-mono"
              title="Move to stage"
            >
              ↕
            </button>
          )}
          {!isArchived && (
            <button
              onClick={() => setShowEditModal(true)}
              className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
              title="Edit details"
            >
              <Pencil size={16} />
            </button>
          )}
          {!isArchived ? (
            <button
              onClick={() => mutation.mutate({ is_archived: true, archive_reason: 'manual' })}
              className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded bg-slate-700 hover:bg-red-900 text-slate-400 hover:text-red-300 transition-colors"
              title="Archive"
            >
              <Archive size={16} />
            </button>
          ) : (
            <button
              onClick={() => mutation.mutate({ is_archived: false, archive_reason: null })}
              className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded bg-slate-700 hover:bg-green-900 text-slate-400 hover:text-green-300 transition-colors"
              title="Restore"
            >
              <RotateCcw size={16} />
            </button>
          )}
        </div>
      </div>
      {showEditModal && <EditPersonModal person={person} onClose={() => setShowEditModal(false)} />}
      {showMoveMenu && (
        <div className="mt-2 grid grid-cols-3 gap-1">
          {STAGES.map(s => (
            <button
              key={s.id}
              onClick={() => { mutation.mutate({ stage: s.id }); setShowMoveMenu(false) }}
              className={`text-xs py-1 px-2 rounded ${s.tailwind} text-white opacity-80 hover:opacity-100 transition-opacity ${person.stage === s.id ? 'ring-2 ring-white' : ''}`}
            >
              {s.id}. {s.label.split(' ')[0]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
