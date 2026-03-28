import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import PersonCard from './PersonCard'

export default function ArchivedAccordion({ title, people, colorClass = 'text-[#8a9ab5]' }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 py-2 px-3 bg-[#edf0f7] rounded-lg hover:bg-[#e4e8f0] transition-colors"
      >
        {open ? <ChevronUp size={16} className="text-[#8a9ab5]" /> : <ChevronDown size={16} className="text-[#8a9ab5]" />}
        <span className={`text-sm font-medium ${colorClass}`}>{title}</span>
        <span className="text-xs text-[#8a9ab5] ml-auto">{people.length}</span>
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2 pl-2">
          {people.length === 0 ? (
            <p className="text-xs text-[#8a9ab5] py-2 text-center">None</p>
          ) : (
            people.map(person => (
              <PersonCard key={person.id} person={person} isArchived={true} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
