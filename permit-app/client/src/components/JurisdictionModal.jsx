import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Modal from './Modal'

export default function JurisdictionModal({ jurisdiction = null, onClose }) {
  const isEditing = !!jurisdiction
  const [form, setForm] = useState({
    name: jurisdiction?.name || '',
    portal_url: jurisdiction?.portal_url || '',
    username: jurisdiction?.username || '',
    password: jurisdiction?.password || '',
    phone: jurisdiction?.phone || '',
    notes: jurisdiction?.notes || '',
    logo_url: jurisdiction?.logo_url || '',
    background_url: jurisdiction?.background_url || '',
  })
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (data) => {
      const url = isEditing ? `/api/jurisdictions/${jurisdiction.id}` : '/api/jurisdictions'
      const method = isEditing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to save jurisdiction')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jurisdictions'] })
      onClose()
    },
    onError: (e) => setError(e.message),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    // Send nulls for empty strings
    const payload = {}
    for (const [k, v] of Object.entries(form)) {
      payload[k] = v.trim() || null
    }
    mutation.mutate(payload)
  }

  const Field = ({ fieldKey, label, type = 'text', placeholder }) => (
    <div>
      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
      <input
        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
        type={type}
        placeholder={placeholder}
        value={form[fieldKey]}
        onChange={e => setForm({ ...form, [fieldKey]: e.target.value })}
      />
    </div>
  )

  return (
    <Modal title={isEditing ? `Edit — ${jurisdiction.name}` : 'Add Jurisdiction'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field fieldKey="name" label="Name *" placeholder="City of Greenville" />
        <Field fieldKey="portal_url" label="Portal URL" type="url" placeholder="https://..." />
        <Field fieldKey="username" label="Username" placeholder="username" />
        <Field fieldKey="password" label="Password" placeholder="(stored locally)" />
        <Field fieldKey="phone" label="Phone" type="tel" placeholder="8645550000" />
        <Field fieldKey="logo_url" label="Logo Image URL" type="url" placeholder="https://..." />
        <Field fieldKey="background_url" label="Background Image URL" type="url" placeholder="https://..." />
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Notes</label>
          <textarea
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 resize-none"
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            rows={3}
            placeholder="First line = description. Then: Label: https://url.com"
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors mt-1"
        >
          {mutation.isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Jurisdiction'}
        </button>
      </form>
    </Modal>
  )
}
