import { useState } from 'react'
import { ChevronRight, Archive, RotateCcw, Pencil } from 'lucide-react'
import { getStage, STAGES } from '../lib/stages'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import EditPersonModal from './EditPersonModal'
import { useToast } from './Toast'
import { patchPerson } from '../lib/api'

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
    <div className={`bg-white rounded-lg p-3 border-l-4 ${stage?.border || 'border-slate-400'} border border-[#e4e8f0] relative`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[#1a2a42] truncate">{person.name}</p>
          {person.phone && <p className="text-xs text-[#8a9ab5] mt-0.5">{person.phone}</p>}
          <p className="text-xs text-[#8a9ab5] mt-1">{daysLabel} in stage</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isArchived && person.stage < 9 && (
            <button
              onClick={() => mutation.mutate({ stage: person.stage + 1 })}
              className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded bg-[#f0f3f8] hover:bg-[#e4e8f0] text-[#4a5568] hover:text-[#1a2a42] transition-colors"
              title="Advance to next stage"
            >
              <ChevronRight size={16} />
            </button>
          )}
          {!isArchived && (
            <button
              onClick={() => setShowMoveMenu(!showMoveMenu)}
              className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded bg-[#f0f3f8] hover:bg-[#e4e8f0] text-[#8a9ab5] hover:text-[#1a2a42] transition-colors text-xs font-mono"
              title="Move to stage"
            >
              ↕
            </button>
          )}
          {!isArchived && (
            <button
              onClick={() => setShowEditModal(true)}
              className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded bg-[#f0f3f8] hover:bg-[#e4e8f0] text-[#8a9ab5] hover:text-[#1a2a42] transition-colors"
              title="Edit details"
            >
              <Pencil size={16} />
            </button>
          )}
          {!isArchived ? (
            <button
              onClick={() => mutation.mutate({ is_archived: true, archive_reason: 'manual' })}
              className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded bg-[#f0f3f8] hover:bg-red-100 text-[#8a9ab5] hover:text-red-600 transition-colors"
              title="Archive"
            >
              <Archive size={16} />
            </button>
          ) : (
            <button
              onClick={() => mutation.mutate({ is_archived: false, archive_reason: null })}
              className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded bg-[#f0f3f8] hover:bg-green-100 text-[#8a9ab5] hover:text-green-600 transition-colors"
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
              className={`text-xs py-1 px-2 rounded ${s.tailwind} text-white opacity-80 hover:opacity-100 transition-opacity ${person.stage === s.id ? 'ring-2 ring-[#1a2a42]' : ''}`}
            >
              {s.id}. {s.label.split(' ')[0]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
