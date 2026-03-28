import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import JurisdictionCard from '../components/JurisdictionCard'
import JurisdictionModal from '../components/JurisdictionModal'
import JurisdictionDetail from '../components/JurisdictionDetail'
import { fetchJurisdictions, deleteJurisdiction } from '../lib/api'

export default function Jurisdictions() {
  const [editTarget, setEditTarget] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [detailTarget, setDetailTarget] = useState(null)
  const queryClient = useQueryClient()

  const { data: jurisdictions = [], isLoading, error } = useQuery({
    queryKey: ['jurisdictions'],
    queryFn: fetchJurisdictions,
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteJurisdiction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jurisdictions'] })
      setDeleteTarget(null)
    },
  })

  if (isLoading) return <div className="flex items-center justify-center h-32 text-[#8a9ab5]">Loading...</div>
  if (error) return <div className="p-4 text-red-500 text-sm">Error: {error.message}</div>

  return (
    <div className="p-4 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-base font-semibold text-[#1a2a42]">Jurisdictions</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {jurisdictions.length === 0 ? (
        <div className="text-center py-12 text-[#8a9ab5]">
          <p className="text-lg">No jurisdictions yet</p>
          <button onClick={() => setShowAdd(true)} className="text-blue-600 hover:text-blue-700 text-sm mt-2">Add your first jurisdiction →</button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {jurisdictions.map(j => (
            <JurisdictionCard
              key={j.id}
              jurisdiction={j}
              onTap={() => setDetailTarget(j)}
              onEdit={() => setEditTarget(j)}
              onDelete={() => setDeleteTarget(j)}
            />
          ))}
        </div>
      )}

      {detailTarget && (
        <JurisdictionDetail
          jurisdiction={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEdit={() => { setEditTarget(detailTarget); setDetailTarget(null) }}
        />
      )}

      {showAdd && <JurisdictionModal onClose={() => setShowAdd(false)} />}
      {editTarget && <JurisdictionModal jurisdiction={editTarget} onClose={() => setEditTarget(null)} />}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-xl border border-[#e4e8f0] p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-[#1a2a42] mb-2">Delete Jurisdiction?</h3>
            <p className="text-sm text-[#4a5568] mb-4">Delete <strong>{deleteTarget.name}</strong>? This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2 bg-[#f0f3f8] hover:bg-[#e4e8f0] text-[#4a5568] text-sm rounded-lg transition-colors">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
