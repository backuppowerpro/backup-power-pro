import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { STAGES } from '../lib/stages'
import StageSection from '../components/StageSection'
import ArchivedAccordion from '../components/ArchivedAccordion'
import AddPersonModal from '../components/AddPersonModal'
import { fetchPeople } from '../lib/api'

export default function Pipeline() {
  const [showAddModal, setShowAddModal] = useState(false)
  const { data: people = [], isLoading, error } = useQuery({
    queryKey: ['people'],
    queryFn: fetchPeople,
  })

  if (isLoading) return (
    <div className="p-4 flex flex-col gap-3">
      {[1,2,3].map(i => (
        <div key={i} className="bg-[#e4e8f0] rounded-lg h-16 animate-pulse" />
      ))}
    </div>
  )

  if (error) return (
    <div className="p-4 text-red-500 text-sm">
      Error loading pipeline: {error.message}
    </div>
  )

  const active = people.filter(p => !p.is_archived)
  const coldLeads = people.filter(p => p.is_archived && p.archive_reason === 'cold_lead')
  const completed = people.filter(p => p.is_archived && p.archive_reason === 'completed')
  const manualArchived = people.filter(p => p.is_archived && p.archive_reason === 'manual')

  const byStage = (stageId) => active.filter(p => p.stage === stageId)

  return (
    <div className="p-4 pb-6">
      {(coldLeads.length > 0 || manualArchived.length > 0) && (
        <ArchivedAccordion
          title={`Cold Leads${manualArchived.length > 0 ? ' + Archived' : ''}`}
          people={[...coldLeads, ...manualArchived]}
          colorClass="text-[#8a9ab5]"
        />
      )}

      {STAGES.map(stage => (
        <StageSection
          key={stage.id}
          stage={stage}
          people={byStage(stage.id)}
        />
      ))}

      {active.length === 0 && (
        <div className="text-center py-12 text-[#8a9ab5]">
          <p className="text-lg">No active people in the pipeline</p>
          <p className="text-sm mt-1">Add someone to get started</p>
        </div>
      )}

      {completed.length > 0 && (
        <ArchivedAccordion
          title="Completed"
          people={completed}
          colorClass="text-amber-600"
        />
      )}

      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-200 flex items-center justify-center transition-colors z-40"
        title="Add person"
      >
        <Plus size={24} />
      </button>

      {showAddModal && <AddPersonModal onClose={() => setShowAddModal(false)} />}
    </div>
  )
}
