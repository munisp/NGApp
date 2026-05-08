import { Navigation, Play } from 'lucide-react'
import { FallbackBadge } from '@/components/ui/DataStates'

const tours = [
  { id: 'TOUR-001', name: 'New User Welcome', steps: 5, completionRate: 84, startedBy: 4200, completedBy: 3528, avgTime: '3.2 min', status: 'active' },
  { id: 'TOUR-002', name: 'CRM Feature Discovery', steps: 8, completionRate: 62, startedBy: 2800, completedBy: 1736, avgTime: '6.8 min', status: 'active' },
  { id: 'TOUR-003', name: 'Admin Setup Guide', steps: 12, completionRate: 91, startedBy: 120, completedBy: 109, avgTime: '15.4 min', status: 'active' },
  { id: 'TOUR-004', name: 'Trade Finance Module', steps: 6, completionRate: 78, startedBy: 890, completedBy: 694, avgTime: '4.5 min', status: 'active' },
  { id: 'TOUR-005', name: 'API Integration Setup', steps: 10, completionRate: 55, startedBy: 340, completedBy: 187, avgTime: '12.1 min', status: 'draft' },
]

export default function OnboardingTours() {
  return (
    <div role="region" aria-label="OnboardingTours" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Navigation className="w-7 h-7 text-sky-600" /> Onboarding Tours</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Interactive product tours for user onboarding</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Active Tours', v: tours.filter(t => t.status === 'active').length }, { l: 'Total Started', v: tours.reduce((s, t) => s + t.startedBy, 0).toLocaleString() }, { l: 'Avg Completion', v: Math.round(tours.reduce((s, t) => s + t.completionRate, 0) / tours.length) + '%' }, { l: 'Avg Time', v: (tours.reduce((s, t) => s + parseFloat(t.avgTime), 0) / tours.length).toFixed(1) + ' min' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="space-y-2">
        {tours.map(tour => (
          <div key={tour.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{tour.name}</h4><span className={`text-xs px-2 py-0.5 rounded ${tour.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{tour.status}</span></div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1"><span>{tour.steps} steps</span><span>{tour.startedBy.toLocaleString()} started</span><span>{tour.completedBy.toLocaleString()} completed</span><span>Avg: {tour.avgTime}</span></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right"><p className="text-lg font-bold text-gray-900 dark:text-white">{tour.completionRate}%</p><div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full"><div className={`h-full rounded-full ${tour.completionRate >= 80 ? 'bg-emerald-500' : tour.completionRate >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${tour.completionRate}%` }} /></div></div>
                <button className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1"><Play className="w-3 h-3" /> Preview</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
