export const STAGES = [
  { id: 1, label: 'Form Submitted',       color: 'slate',  tailwind: 'bg-slate-500',   border: 'border-slate-500',   text: 'text-slate-400',   icon: 'FileText'        },
  { id: 2, label: 'Responded',            color: 'blue',   tailwind: 'bg-blue-500',    border: 'border-blue-500',    text: 'text-blue-400',    icon: 'MessageSquare'   },
  { id: 3, label: 'Quote Sent',           color: 'violet', tailwind: 'bg-violet-500',  border: 'border-violet-500',  text: 'text-violet-400',  icon: 'Send'            },
  { id: 4, label: 'Booked',               color: 'green',  tailwind: 'bg-green-500',   border: 'border-green-500',   text: 'text-green-400',   icon: 'CheckCircle'     },
  { id: 5, label: 'Permit Submitted',     color: 'yellow', tailwind: 'bg-yellow-500',  border: 'border-yellow-500',  text: 'text-yellow-400',  icon: 'Upload'          },
  { id: 6, label: 'Permit Paid',          color: 'orange', tailwind: 'bg-orange-500',  border: 'border-orange-500',  text: 'text-orange-400',  icon: 'CreditCard'      },
  { id: 7, label: 'Permit Approved',      color: 'teal',   tailwind: 'bg-teal-500',    border: 'border-teal-500',    text: 'text-teal-400',    icon: 'Stamp'           },
  { id: 8, label: 'Inspection Scheduled', color: 'pink',   tailwind: 'bg-pink-500',    border: 'border-pink-500',    text: 'text-pink-400',    icon: 'Calendar'        },
  { id: 9, label: 'Complete',             color: 'amber',  tailwind: 'bg-amber-500',   border: 'border-amber-500',   text: 'text-amber-400',   icon: 'Trophy'          },
]

export const getStage = (id) => STAGES.find(s => s.id === id)
