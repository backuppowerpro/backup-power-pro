import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import JurisdictionCard from '../components/JurisdictionCard'
import JurisdictionModal from '../components/JurisdictionModal'
import JurisdictionDetail from '../components/JurisdictionDetail'

async function fetchJurisdictions() {
  const res = await fetch('/api/jurisdictions')
  if (!res.ok) throw new Error('Failed to fetch jurisdictions')
  return res.json()
}

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
    mutationFn: async (id) => {
      const res = await fetch(`/api/jurisdictions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jurisdictions'] })
      setDeleteTarget(null)
    },
  })

  if (isLoading) return <div className="flex items-center justify-center h-32 text-slate-500">Loading...</div>
  if (error) return <div className="p-4 text-red-400 text-sm">Error: {error.message}</div>

  return (
    <div className="p-4 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-base font-semibold text-slate-200">Jurisdictions</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {jurisdictions.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <p className="text-lg">No jurisdictions yet</p>
          <button onClick={() => setShowAdd(true)} className="text-blue-400 hover:text-blue-300 text-sm mt-2">Add your first jurisdiction →</button>
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

      {/* Detail view — slides in over everything */}
      {detailTarget && (
        <JurisdictionDetail
          jurisdiction={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEdit={() => { setEditTarget(detailTarget); setDetailTarget(null) }}
        />
      )}

      {showAdd && <JurisdictionModal onClose={() => setShowAdd(false)} />}
      {editTarget && <JurisdictionModal jurisdiction={editTarget} onClose={() => setEditTarget(null)} />}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-slate-900 rounded-xl border border-slate-700 p-6 max-w-sm w-full">
            <h3 className="font-semibold text-slate-100 mb-2">Delete Jurisdiction?</h3>
            <p className="text-sm text-slate-400 mb-4">Delete <strong>{deleteTarget.name}</strong>? This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors">Cancel</button>
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
