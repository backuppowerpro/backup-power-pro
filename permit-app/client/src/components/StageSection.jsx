import { FileText, MessageSquare, Send, CheckCircle, Upload, CreditCard, Stamp, Calendar, Trophy, Circle } from 'lucide-react'
import PersonCard from './PersonCard'

const ICON_MAP = { FileText, MessageSquare, Send, CheckCircle, Upload, CreditCard, Stamp, Calendar, Trophy, Circle }

export default function StageSection({ stage, people }) {
  const Icon = ICON_MAP[stage.icon] || ICON_MAP.Circle

  if (people.length === 0) return null

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className={`w-6 h-6 rounded-full ${stage.tailwind} flex items-center justify-center shrink-0`}>
          <Icon size={14} className="text-white" />
        </div>
        <h2 className="text-sm font-semibold text-[#4a5568]">{stage.label}</h2>
        <span className="text-xs text-[#8a9ab5] ml-auto">{people.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {people.map(person => (
          <PersonCard key={person.id} person={person} />
        ))}
      </div>
    </div>
  )
}
