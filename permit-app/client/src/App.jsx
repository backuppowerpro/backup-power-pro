import { HashRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Layers, BarChart3, MapPin } from 'lucide-react'
import Pipeline from './pages/Pipeline'
import Analytics from './pages/Analytics'
import Jurisdictions from './pages/Jurisdictions'

export default function App() {
  return (
    <HashRouter>
      <div className="flex flex-col h-screen bg-slate-950 text-white">
        <div className="flex-1 overflow-y-auto pb-20">
          <Routes>
            <Route path="/" element={<Pipeline />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/jurisdictions" element={<Jurisdictions />} />
          </Routes>
        </div>
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex">
          {[
            { to: '/', icon: <Layers size={22} />, label: 'Pipeline' },
            { to: '/jurisdictions', icon: <MapPin size={22} />, label: 'Jurisdictions' },
            { to: '/analytics', icon: <BarChart3 size={22} />, label: 'Analytics' },
          ].map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-3 text-xs gap-1 transition-colors ${
                  isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-200'
                }`
              }
            >
              {icon}
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </HashRouter>
  )
}
