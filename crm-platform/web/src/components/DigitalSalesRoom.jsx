import { useState } from 'react'
import { Monitor } from 'lucide-react'
import { FallbackBadge } from '@/components/ui/DataStates'

const rooms = [
  { id: 'DSR-001', name: 'Dangote — Trade Finance', deal: '₦2.5B', stage: 'Negotiation', visitors: 12, lastVisit: '2 hours ago', docs: 8, engagement: 94, stakeholders: ['CEO', 'CFO', 'Procurement'], recentActivity: ['CFO viewed pricing proposal (2 hrs ago)', 'CEO shared room with board (1 day ago)', 'Legal downloaded NDA (2 days ago)'] },
  { id: 'DSR-002', name: 'MTN — Payroll Solution', deal: '₦890M', stage: 'Proposal', visitors: 6, lastVisit: '1 day ago', docs: 5, engagement: 72, stakeholders: ['CFO', 'HR Director'], recentActivity: ['CFO opened ROI calculator (1 day ago)', 'HR Director viewed case study (3 days ago)'] },
  { id: 'DSR-003', name: 'Shoprite — POS Fleet', deal: '₦180M', stage: 'Discovery', visitors: 3, lastVisit: '3 days ago', docs: 3, engagement: 45, stakeholders: ['IT Manager'], recentActivity: ['IT Manager viewed product overview (3 days ago)'] },
]

export default function DigitalSalesRoom() {
  const [selected, setSelected] = useState(null)

  return (
    <div role="region" aria-label="DigitalSalesRoom" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Monitor className="w-7 h-7 text-indigo-600" /> Digital Sales Rooms</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Personalized buyer collaboration spaces</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Active Rooms', v: rooms.length }, { l: 'Total Visitors', v: rooms.reduce((s, r) => s + r.visitors, 0) }, { l: 'Documents Shared', v: rooms.reduce((s, r) => s + r.docs, 0) }, { l: 'Avg Engagement', v: Math.round(rooms.reduce((s, r) => s + r.engagement, 0) / rooms.length) + '%' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="space-y-2">
        {rooms.map(room => (
          <div key={room.id} onClick={() => setSelected(selected === room.id ? null : room.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md ${selected === room.id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{room.name}</h4><span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">{room.stage}</span></div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1"><span>{room.deal}</span><span>{room.visitors} visitors</span><span>{room.docs} docs</span><span>Last visit: {room.lastVisit}</span></div>
              </div>
              <div className="text-right"><p className={`text-xl font-bold ${room.engagement >= 80 ? 'text-emerald-600' : room.engagement >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{room.engagement}%</p><p className="text-xs text-gray-400">engagement</p></div>
            </div>
            {selected === room.id && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-4">
                <div>
                  <h5 className="text-xs font-medium text-gray-500 mb-2">Stakeholders</h5>
                  <div className="flex gap-1">{room.stakeholders.map(s => <span key={s} className="text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">{s}</span>)}</div>
                </div>
                <div>
                  <h5 className="text-xs font-medium text-gray-500 mb-2">Recent Activity</h5>
                  <div className="space-y-1">{room.recentActivity.map((a, i) => <p key={i} className="text-xs text-gray-600 dark:text-gray-400">{a}</p>)}</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
