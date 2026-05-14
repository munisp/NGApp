import { useState } from 'react'
import { Navigation, Play, Plus, Search, Edit, Trash2, Eye, BarChart3, GripVertical } from 'lucide-react'
import { FallbackBadge , ErrorState } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const tours = [
  { id: 'TOUR-001', name: 'New User Welcome', steps: 5, completionRate: 84, startedBy: 4200, completedBy: 3528, avgTime: '3.2 min', status: 'active', dropOff: [100, 95, 88, 82, 84], description: 'Guides new users through dashboard, navigation, and key features', target: 'All new users', trigger: 'First login' },
  { id: 'TOUR-002', name: 'CRM Feature Discovery', steps: 8, completionRate: 62, startedBy: 2800, completedBy: 1736, avgTime: '6.8 min', status: 'active', dropOff: [100, 92, 85, 78, 72, 68, 65, 62], description: 'Deep dive into customer management, pipeline, and reporting', target: 'Sales users', trigger: 'After 3rd login' },
  { id: 'TOUR-003', name: 'Admin Setup Guide', steps: 12, completionRate: 91, startedBy: 120, completedBy: 109, avgTime: '15.4 min', status: 'active', dropOff: [100, 98, 97, 96, 95, 94, 93, 93, 92, 92, 91, 91], description: 'Complete admin setup: users, roles, integrations, security', target: 'Admins only', trigger: 'Admin role assigned' },
  { id: 'TOUR-004', name: 'Trade Finance Module', steps: 6, completionRate: 78, startedBy: 890, completedBy: 694, avgTime: '4.5 min', status: 'active', dropOff: [100, 94, 90, 85, 80, 78], description: 'Banking-specific: trade finance workflows, LC issuance, documentation', target: 'Banking vertical', trigger: 'Feature access' },
  { id: 'TOUR-005', name: 'API Integration Setup', steps: 10, completionRate: 55, startedBy: 340, completedBy: 187, avgTime: '12.1 min', status: 'draft', dropOff: [100, 88, 78, 72, 68, 64, 60, 58, 56, 55], description: 'Developer guide for REST API, webhooks, and SDK setup', target: 'Developers', trigger: 'Manual start' },
  { id: 'TOUR-006', name: 'Mobile App Walkthrough', steps: 4, completionRate: 0, startedBy: 0, completedBy: 0, avgTime: '0 min', status: 'draft', dropOff: [0, 0, 0, 0], description: 'Field agent mobile CRM features and offline mode', target: 'Field agents', trigger: 'Mobile login' },
]

export default function OnboardingTours() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('onboardingtours', () => apiClient.dashboard.metrics(), { fallback: tours })
  const [activeTab, setActiveTab] = useState('tours')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedTour, setSelectedTour] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [error, setError] = useState(null)

  const filtered = tours.filter(t => {
    const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (error) return <ErrorState message={error} />

  return (
    <div role="region" aria-label="OnboardingTours" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Navigation className="w-7 h-7 text-sky-600" /> Onboarding Tours</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Interactive product tours for user onboarding</p></div>
        <div className="flex gap-2"><button onClick={() => setShowCreateForm(!showCreateForm)} className="px-3 py-2 bg-sky-600 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-sky-700"><Plus className="w-4 h-4" /> Create Tour</button><FallbackBadge /></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ l: 'Active Tours', v: tours.filter(t => t.status === 'active').length }, { l: 'Total Started', v: tours.reduce((s, t) => s + t.startedBy, 0).toLocaleString() }, { l: 'Avg Completion', v: Math.round(tours.filter(t => t.status === 'active').reduce((s, t) => s + t.completionRate, 0) / tours.filter(t => t.status === 'active').length) + '%', c: 'text-emerald-600' }, { l: 'Avg Time', v: (tours.filter(t => t.startedBy > 0).reduce((s, t) => s + parseFloat(t.avgTime), 0) / tours.filter(t => t.startedBy > 0).length).toFixed(1) + ' min' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      {showCreateForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-sky-200 dark:border-sky-900/50 p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">Create New Tour</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">Tour Name</label><input type="text" placeholder="e.g., Feature Discovery" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Target Audience</label><select className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"><option>All Users</option><option>Sales Users</option><option>Admins</option><option>Developers</option><option>Banking Vertical</option></select></div>
            <div><label className="text-xs text-gray-500 block mb-1">Trigger</label><select className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"><option>First Login</option><option>Feature Access</option><option>Manual Start</option><option>After N Logins</option></select></div>
            <div><label className="text-xs text-gray-500 block mb-1">Description</label><input type="text" placeholder="Brief description" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" /></div>
          </div>
          <div className="flex gap-2"><button className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-700">Create</button><button onClick={() => setShowCreateForm(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300">Cancel</button></div>
        </div>
      )}

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['tours', 'analytics', 'settings'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        ))}
      </div>

      {activeTab === 'tours' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tours..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"><option value="all">All Status</option><option value="active">Active</option><option value="draft">Draft</option></select>
          </div>
          <div className="space-y-2">
            {filtered.length === 0 && <div className="text-center py-8 text-gray-500 dark:text-gray-400">No records found</div>}
          {filtered.map(tour => (
              <div key={tour.id} onClick={() => setSelectedTour(selectedTour === tour.id ? null : tour.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md ${selectedTour === tour.id ? 'border-sky-500 ring-1 ring-sky-500' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{tour.name}</h4><span className={`text-xs px-2 py-0.5 rounded ${tour.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>{tour.status}</span></div>
                    <p className="text-xs text-gray-500 mt-0.5">{tour.description}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-1"><span>{tour.steps} steps</span><span>{tour.startedBy.toLocaleString()} started</span><span>{tour.completedBy.toLocaleString()} completed</span><span>Avg: {tour.avgTime}</span></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right"><p className="text-lg font-bold text-gray-900 dark:text-white">{tour.completionRate}%</p><div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full"><div className={`h-full rounded-full ${tour.completionRate >= 80 ? 'bg-emerald-500' : tour.completionRate >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${tour.completionRate}%` }} /></div></div>
                    <div className="flex gap-1">
                      <button className="p-1.5 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700" title="Preview"><Play className="w-3 h-3 text-gray-600 dark:text-gray-400" /></button>
                      <button className="p-1.5 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700" title="Edit"><Edit className="w-3 h-3 text-gray-600 dark:text-gray-400" /></button>
                    </div>
                  </div>
                </div>
                {selectedTour === tour.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs mb-3">
                      <div><span className="text-gray-500">Target</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{tour.target}</p></div>
                      <div><span className="text-gray-500">Trigger</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{tour.trigger}</p></div>
                      <div><span className="text-gray-500">Steps</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{tour.steps}</p></div>
                    </div>
                    <div><h5 className="text-xs font-medium text-gray-500 mb-2">Step-by-Step Drop-off</h5>
                      <div className="flex items-end gap-1 h-16">
                        {tour.dropOff.map((pct, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center">
                            <div className={`w-full rounded-t ${pct >= 80 ? 'bg-emerald-400' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ height: `${pct * 0.6}px` }} />
                            <span className="text-[10px] text-gray-400 mt-0.5">{pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Tour Performance Overview</h3>
          {tours.filter(t => t.status === 'active').map(t => (
            <div key={t.id} className="flex items-center gap-3">
              <span className="w-40 text-sm text-gray-600 dark:text-gray-400 truncate">{t.name}</span>
              <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className={`h-full rounded-full flex items-center pl-2 text-xs text-white font-medium ${t.completionRate >= 80 ? 'bg-emerald-500' : t.completionRate >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${t.completionRate}%` }}>{t.completionRate}%</div></div>
              <span className="w-24 text-right text-xs text-gray-500">{t.startedBy.toLocaleString()} users</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Tour Settings</h3>
          <div className="space-y-3">
            {[{ label: 'Auto-start tours for new users', checked: true }, { label: 'Allow users to skip tours', checked: true }, { label: 'Show progress indicator', checked: true }, { label: 'Collect completion feedback', checked: false }].map(s => (
              <label key={s.label} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" defaultChecked={s.checked} className="w-4 h-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{s.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
