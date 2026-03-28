import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Modal from './Modal'
import { STAGES } from '../lib/stages'
import { addPerson } from '../lib/api'

export default function AddPersonModal({ onClose }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '', stage: 1 })
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data) => addPerson(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] })
      onClose()
    },
    onError: (e) => setError(e.message),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    mutation.mutate({ ...form, stage: parseInt(form.stage) })
  }

  const inputClass = "w-full bg-white border border-[#e4e8f0] rounded-lg px-3 py-2 text-sm text-[#1a2a42] focus:outline-none focus:border-blue-500"

  return (
    <Modal title="Add Person" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="text-xs text-[#8a9ab5] mb-1 block">Name *</label>
          <input
            className={inputClass}
            value={form.name} onChange={e => setForm({...form, name: e.target.value})}
            placeholder="Full name" autoFocus
          />
        </div>
        <div>
          <label className="text-xs text-[#8a9ab5] mb-1 block">Phone</label>
          <input
            className={inputClass}
            value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
            placeholder="(864) 555-0000" type="tel"
          />
        </div>
        <div>
          <label className="text-xs text-[#8a9ab5] mb-1 block">Email</label>
          <input
            className={inputClass}
            value={form.email} onChange={e => setForm({...form, email: e.target.value})}
            placeholder="email@example.com" type="email"
          />
        </div>
        <div>
          <label className="text-xs text-[#8a9ab5] mb-1 block">Starting Stage</label>
          <select
            className={inputClass}
            value={form.stage} onChange={e => setForm({...form, stage: e.target.value})}
          >
            {STAGES.map(s => (
              <option key={s.id} value={s.id}>{s.id}. {s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-[#8a9ab5] mb-1 block">Notes</label>
          <textarea
            className={`${inputClass} resize-none`}
            value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
            placeholder="Optional notes..." rows={2}
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors mt-1"
        >
          {mutation.isPending ? 'Adding...' : 'Add Person'}
        </button>
      </form>
    </Modal>
  )
}
