import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { STAGES } from '../lib/stages'
import { fetchAnalytics } from '../lib/api'

const STAGE_COLORS = {
  'slate':  '#64748b',
  'blue':   '#3b82f6',
  'violet': '#8b5cf6',
  'green':  '#22c55e',
  'yellow': '#eab308',
  'orange': '#f97316',
  'teal':   '#14b8a6',
  'pink':   '#ec4899',
  'amber':  '#f59e0b',
}

const PRESET_RANGES = [
  { label: 'This Week', getValue: () => {
    const now = new Date()
    const start = new Date(now); start.setDate(now.getDate() - now.getDay())
    return { from: start.toISOString().split('T')[0], to: now.toISOString().split('T')[0] }
  }},
  { label: 'This Month', getValue: () => {
    const now = new Date()
    return { from: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, to: now.toISOString().split('T')[0] }
  }},
  { label: 'This Year', getValue: () => {
    const now = new Date()
    return { from: `${now.getFullYear()}-01-01`, to: now.toISOString().split('T')[0] }
  }},
  { label: 'All Time', getValue: () => ({ from: '2000-01-01', to: '2099-12-31' }) },
]

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-[#e4e8f0] rounded-lg p-2 text-xs shadow-md">
      <p className="text-[#8a9ab5] mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

export default function Analytics() {
  const [activePreset, setActivePreset] = useState('All Time')
  const [dateRange, setDateRange] = useState({ from: '2000-01-01', to: '2099-12-31' })
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics', dateRange.from, dateRange.to],
    queryFn: () => fetchAnalytics(dateRange.from, dateRange.to),
  })

  const handlePreset = (preset) => {
    setActivePreset(preset.label)
    setDateRange(preset.getValue())
  }

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      setActivePreset('Custom')
      setDateRange({ from: customFrom, to: customTo })
    }
  }

  if (isLoading) return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex gap-1.5">{[1,2,3,4].map(i => <div key={i} className="bg-[#e4e8f0] rounded-full h-7 w-20 animate-pulse" />)}</div>
      <div className="grid grid-cols-3 gap-2">{[1,2,3].map(i => <div key={i} className="bg-[#e4e8f0] rounded-xl h-16 animate-pulse" />)}</div>
      <div className="bg-[#e4e8f0] rounded-xl h-48 animate-pulse" />
    </div>
  )
  if (error) return (
    <div className="p-4 text-red-500 text-sm">Error: {error.message}</div>
  )

  const {
    summary = {},
    funnelCounts = [],
    conversionRates = [],
    eventsOverTime = [],
  } = data || {}

  const funnelMap = {}
  funnelCounts.forEach(r => { funnelMap[r.stage] = r.reached })

  const funnelData = STAGES.map(s => ({
    name: s.label.split(' ').slice(0, 2).join(' '),
    count: funnelMap[s.id] || 0,
    stage: s,
  }))

  const worstConversion = [...conversionRates]
    .filter(r => r.from_count > 0 && r.rate !== null)
    .sort((a, b) => a.rate - b.rate)[0]

  return (
    <div className="p-4 pb-6">
      {/* Date range picker */}
      <div className="mb-4">
        <div className="flex gap-1.5 flex-wrap">
          {PRESET_RANGES.map(preset => (
            <button
              key={preset.label}
              onClick={() => handlePreset(preset)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activePreset === preset.label
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#edf0f7] text-[#4a5568] hover:text-[#1a2a42] hover:bg-[#e4e8f0]'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-2 items-center">
          <input
            type="date"
            className="bg-white border border-[#e4e8f0] rounded px-2 py-1 text-xs text-[#1a2a42] focus:outline-none focus:border-blue-500"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
          />
          <span className="text-[#8a9ab5] text-xs">to</span>
          <input
            type="date"
            className="bg-white border border-[#e4e8f0] rounded px-2 py-1 text-xs text-[#1a2a42] focus:outline-none focus:border-blue-500"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
          />
          <button
            onClick={handleCustomApply}
            className="px-2 py-1 bg-[#edf0f7] hover:bg-[#e4e8f0] text-xs text-[#4a5568] rounded transition-colors"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: 'Total', value: summary.totalPeople },
          { label: 'Active', value: summary.totalActive },
          { label: 'Completed', value: summary.totalCompleted },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-[#e4e8f0] rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-[#1a2a42]">{value ?? 0}</p>
            <p className="text-xs text-[#8a9ab5] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Funnel chart */}
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-[#4a5568] mb-2">Pipeline Funnel</h2>
        <div className="bg-white border border-[#e4e8f0] rounded-xl p-3">
          {funnelData.every(d => d.count === 0) ? (
            <p className="text-center text-[#8a9ab5] text-xs py-4">No data in range</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={funnelData}
                layout="vertical"
                margin={{ left: 80, right: 20, top: 4, bottom: 4 }}
              >
                <XAxis type="number" tick={{ fontSize: 10, fill: '#8a9ab5' }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#8a9ab5' }}
                  width={76}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {funnelData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={STAGE_COLORS[entry.stage.color] || '#64748b'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Conversion rates */}
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-[#4a5568] mb-2">Stage Conversion Rates</h2>
        <div className="bg-white border border-[#e4e8f0] rounded-xl overflow-hidden">
          {conversionRates.filter(r => r.from_count > 0).length === 0 ? (
            <p className="text-center text-[#8a9ab5] text-xs py-4">No conversion data</p>
          ) : (
            conversionRates.filter(r => r.from_count > 0).map((r, i) => {
              const fromStage = STAGES[r.from_stage - 1]
              const toStage = STAGES[r.to_stage - 1]
              if (!fromStage || !toStage) return null
              const isWorst = worstConversion && r.from_stage === worstConversion.from_stage
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2.5 border-b border-[#e4e8f0] last:border-0 ${
                    isWorst ? 'bg-red-50' : ''
                  }`}
                >
                  <span className={`text-xs ${fromStage.textLight} w-28 truncate`}>{fromStage.label}</span>
                  <span className="text-[#8a9ab5] text-xs">→</span>
                  <span className={`text-xs ${toStage.textLight} w-28 truncate`}>{toStage.label}</span>
                  <div className="flex-1 flex items-center gap-2 justify-end">
                    <span className="text-xs text-[#8a9ab5]">{r.from_count}→{r.to_count}</span>
                    <span className={`text-xs font-semibold ${isWorst ? 'text-red-600' : 'text-[#1a2a42]'}`}>
                      {r.rate !== null ? `${r.rate}%` : 'N/A'}
                      {isWorst && ' ⚠'}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Activity over time */}
      {eventsOverTime.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-[#4a5568] mb-2">Activity Over Time</h2>
          <div className="bg-white border border-[#e4e8f0] rounded-xl p-3">
            <ResponsiveContainer width="100%" height={120}>
              <BarChart
                data={eventsOverTime}
                margin={{ left: 0, right: 8, top: 4, bottom: 4 }}
              >
                <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#8a9ab5' }} />
                <YAxis tick={{ fontSize: 9, fill: '#8a9ab5' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="new_leads" name="New Leads" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#f59e0b" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
