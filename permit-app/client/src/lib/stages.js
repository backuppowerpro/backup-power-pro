export const STAGES = [
  { id: 1, label: 'Form Submitted',       color: 'slate',  tailwind: 'bg-slate-500',   border: 'border-slate-400',   text: 'text-slate-600',   textLight: 'text-slate-600',   icon: 'FileText'        },
  { id: 2, label: 'Responded',            color: 'blue',   tailwind: 'bg-blue-500',    border: 'border-blue-400',    text: 'text-blue-600',    textLight: 'text-blue-600',    icon: 'MessageSquare'   },
  { id: 3, label: 'Quote Sent',           color: 'violet', tailwind: 'bg-violet-500',  border: 'border-violet-400',  text: 'text-violet-600',  textLight: 'text-violet-600',  icon: 'Send'            },
  { id: 4, label: 'Booked',               color: 'green',  tailwind: 'bg-green-500',   border: 'border-green-400',   text: 'text-green-600',   textLight: 'text-green-600',   icon: 'CheckCircle'     },
  { id: 5, label: 'Permit Submitted',     color: 'yellow', tailwind: 'bg-yellow-500',  border: 'border-yellow-400',  text: 'text-yellow-600',  textLight: 'text-yellow-600',  icon: 'Upload'          },
  { id: 6, label: 'Permit Paid',          color: 'orange', tailwind: 'bg-orange-500',  border: 'border-orange-400',  text: 'text-orange-600',  textLight: 'text-orange-600',  icon: 'CreditCard'      },
  { id: 7, label: 'Permit Approved',      color: 'teal',   tailwind: 'bg-teal-500',    border: 'border-teal-400',    text: 'text-teal-600',    textLight: 'text-teal-600',    icon: 'Stamp'           },
  { id: 8, label: 'Inspection Scheduled', color: 'pink',   tailwind: 'bg-pink-500',    border: 'border-pink-400',    text: 'text-pink-600',    textLight: 'text-pink-600',    icon: 'Calendar'        },
  { id: 9, label: 'Complete',             color: 'amber',  tailwind: 'bg-amber-500',   border: 'border-amber-400',   text: 'text-amber-600',   textLight: 'text-amber-600',   icon: 'Trophy'          },
]

export const getStage = (id) => STAGES.find(s => s.id === id)
