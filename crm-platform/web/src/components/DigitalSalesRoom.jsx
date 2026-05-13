import { useState } from 'react'
import { Presentation, Search, Users, FileText, Calendar, MessageSquare, Video, ExternalLink } from 'lucide-react'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const rooms = [
  { id: 'DSR-001', name: 'Dangote — Trade Finance Expansion', deal: '₦2.5B', stage: 'Closing', stakeholders: 6, documents: 12, lastActivity: '2 hours ago', engagementScore: 94, owner: 'Sarah Okonkwo', created: 'Apr 10, 2026', views: 48, avgTimeSpent: '12 min', topDoc: 'Proposal v3.pdf', nextMeeting: 'May 6 at 10:00' },
  { id: 'DSR-002', name: 'MTN — Enterprise Payroll', deal: '₦890M', stage: 'Proposal', stakeholders: 4, documents: 8, lastActivity: '1 day ago', engagementScore: 72, owner: 'Chidi Obi', created: 'Mar 22, 2026', views: 32, avgTimeSpent: '8 min', topDoc: 'Technical Architecture.pdf', nextMeeting: 'May 8 at 14:00' },
  { id: 'DSR-003', name: 'Total Energies — FX Hedging', deal: '₦1.2B', stage: 'Discovery', stakeholders: 3, documents: 5, lastActivity: '5 days ago', engagementScore: 35, owner: 'Ahmed Musa', created: 'Apr 28, 2026', views: 8, avgTimeSpent: '3 min', topDoc: 'Product Overview.pdf', nextMeeting: 'TBD' },
  { id: 'DSR-004', name: 'Lafarge — Treasury Module', deal: '₦450M', stage: 'Negotiation', stakeholders: 5, documents: 10, lastActivity: '12 hours ago', engagementScore: 82, owner: 'Fatima Ibrahim', created: 'Mar 15, 2026', views: 42, avgTimeSpent: '10 min', topDoc: 'ROI Analysis.xlsx', nextMeeting: 'May 7 at 11:00' },
]

export default function DigitalSalesRoom() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('digitalsalesroom', () => apiClient.dashboard.metrics(), { fallback: rooms })
  const [search, setSearch] = useState('')
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [activeTab, setActiveTab] = useState('rooms')

  const filtered = rooms.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.owner.toLowerCase().includes(search.toLowerCase()))

  return (
    <div role="region" aria-label="DigitalSalesRoom" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Presentation className="w-7 h-7 text-indigo-600" /> Digital Sales Rooms</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Collaborative deal rooms for enterprise sales</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Active Rooms', v: rooms.length }, { l: 'Total Stakeholders', v: rooms.reduce((s, r) => s + r.stakeholders, 0) }, { l: 'Avg Engagement', v: Math.round(rooms.reduce((s, r) => s + r.engagementScore, 0) / rooms.length) + '%', c: 'text-emerald-600' }, { l: 'Pipeline Value', v: '₦5.0B' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['rooms', 'analytics'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        ))}
      </div>

      {activeTab === 'rooms' && (<div className="space-y-4">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search rooms..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
        <div className="space-y-2">
          {filtered.map(r => (
            <div key={r.id} onClick={() => setSelectedRoom(selectedRoom === r.id ? null : r.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md ${selectedRoom === r.id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{r.name}</h4><span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">{r.stage}</span></div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1"><span>{r.deal}</span><span><Users className="w-3 h-3 inline mr-0.5" />{r.stakeholders}</span><span><FileText className="w-3 h-3 inline mr-0.5" />{r.documents} docs</span><span>Last: {r.lastActivity}</span></div>
                </div>
                <div className="text-right"><div className={`text-lg font-bold ${r.engagementScore >= 70 ? 'text-emerald-600' : r.engagementScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{r.engagementScore}%</div><div className="text-xs text-gray-400">engagement</div></div>
              </div>
              {selectedRoom === r.id && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-4 gap-4 text-xs mb-3">
                    <div><span className="text-gray-500">Owner</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{r.owner}</p></div>
                    <div><span className="text-gray-500">Views</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{r.views} ({r.avgTimeSpent} avg)</p></div>
                    <div><span className="text-gray-500">Top Document</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{r.topDoc}</p></div>
                    <div><span className="text-gray-500">Next Meeting</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{r.nextMeeting}</p></div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Open Room</button>
                    <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1"><Video className="w-3 h-3" /> Schedule Call</button>
                    <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Add Document</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>)}

      {activeTab === 'analytics' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Room Analytics</h3>
        {rooms.map(r => (
          <div key={r.id} className="flex items-center gap-3"><span className="w-48 text-sm text-gray-600 dark:text-gray-400 truncate">{r.name}</span><div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className={`h-full rounded-full ${r.engagementScore >= 70 ? 'bg-indigo-500' : r.engagementScore >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${r.engagementScore}%` }} /></div><span className="w-16 text-right text-sm font-medium text-gray-900 dark:text-white">{r.engagementScore}%</span></div>
        ))}
      </div>)}
    </div>
  )
}
