import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  MapPin, Wrench, Signal, Users, CheckCircle, Clock, AlertTriangle,
  TrendingUp, Truck, Radio, Activity, Shield
, Search } from 'lucide-react'
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { useTenant } from '../contexts/TenantContext'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'
import { ErrorState } from '@/components/ui/DataStates'

const seedData = {
  'aerotel': {
    totalTechnicians: 842,
    activeTasks: 1247,
    completedToday: 389,
    avgResolutionHrs: 4.2,
    slaCompliance: 94.8,
    cellSites: 4200,
    sitesDown: 12,
    scheduledMaintenance: 48,
    tasks: [
      { id: 'FT-4821', type: 'Installation', priority: 'high', location: 'Lagos — Victoria Island', technician: 'Emeka Obi', status: 'in_progress', eta: '2h 15m' },
      { id: 'FT-4822', type: 'Repair', priority: 'critical', location: 'Abuja — Wuse Zone 5', technician: 'Ibrahim Musa', status: 'assigned', eta: '45m' },
      { id: 'FT-4823', type: 'Maintenance', priority: 'medium', location: 'Kano — Sabon Gari', technician: 'Yusuf Abdullahi', status: 'completed', eta: '-' },
      { id: 'FT-4824', type: 'Upgrade', priority: 'medium', location: 'Port Harcourt — GRA', technician: 'Ada Nwosu', status: 'in_progress', eta: '4h 30m' },
      { id: 'FT-4825', type: 'Installation', priority: 'low', location: 'Ibadan — Challenge', technician: 'Tunde Bakare', status: 'scheduled', eta: 'Tomorrow' },
      { id: 'FT-4826', type: 'Repair', priority: 'high', location: 'Lagos — Ikeja', technician: 'Chidera Eze', status: 'in_progress', eta: '1h 20m' },
    ],
    tasksByType: [
      { type: 'Installation', count: 312, completed: 245, sla: 96.2 },
      { type: 'Repair', count: 428, completed: 342, sla: 92.4 },
      { type: 'Maintenance', count: 285, completed: 248, sla: 97.1 },
      { type: 'Upgrade', count: 142, completed: 98, sla: 94.8 },
      { type: 'Decommission', count: 80, completed: 72, sla: 98.6 },
    ],
    regionPerformance: [
      { region: 'Lagos', tasks: 420, completion: 92.4, technicians: 210 },
      { region: 'Abuja', tasks: 280, completion: 95.1, technicians: 142 },
      { region: 'Kano', tasks: 180, completion: 91.2, technicians: 98 },
      { region: 'Port Harcourt', tasks: 160, completion: 93.8, technicians: 84 },
      { region: 'Ibadan', tasks: 120, completion: 96.4, technicians: 68 },
    ],
  },
  'netwave': {
    totalTechnicians: 248,
    activeTasks: 342,
    completedToday: 108,
    avgResolutionHrs: 5.8,
    slaCompliance: 91.2,
    cellSites: 1100,
    sitesDown: 6,
    scheduledMaintenance: 14,
    tasks: [
      { id: 'FT-1201', type: 'Repair', priority: 'critical', location: 'Lagos — Surulere', technician: 'Bola Adeyemi', status: 'in_progress', eta: '1h' },
      { id: 'FT-1202', type: 'Installation', priority: 'high', location: 'Abuja — Garki', technician: 'Musa Danjuma', status: 'assigned', eta: '3h' },
      { id: 'FT-1203', type: 'Maintenance', priority: 'medium', location: 'Kano — Nassarawa', technician: 'Aminu Yusuf', status: 'scheduled', eta: 'Tomorrow' },
    ],
    tasksByType: [
      { type: 'Installation', count: 82, completed: 64, sla: 94.1 },
      { type: 'Repair', count: 124, completed: 98, sla: 89.2 },
      { type: 'Maintenance', count: 78, completed: 68, sla: 95.4 },
      { type: 'Upgrade', count: 38, completed: 28, sla: 92.1 },
      { type: 'Decommission', count: 20, completed: 18, sla: 97.2 },
    ],
    regionPerformance: [
      { region: 'Lagos', tasks: 118, completion: 90.2, technicians: 62 },
      { region: 'Abuja', tasks: 84, completion: 92.8, technicians: 44 },
      { region: 'Kano', tasks: 56, completion: 88.4, technicians: 32 },
    ],
  },
}

const TelcoFieldOps = () => {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('telcofieldops', () => apiClient.dashboard.metrics(), { fallback: seedData })
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('tasks')
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [selectedTask, setSelectedTask] = useState(null)
  const [error, setError] = useState(null)
  const data = seedData[tenant?.slug] || seedData['aerotel']
  const filteredTasks = data.tasks.filter(task => {
    const matchSearch = !search || task.location.toLowerCase().includes(search.toLowerCase()) || task.technician.toLowerCase().includes(search.toLowerCase()) || task.id.toLowerCase().includes(search.toLowerCase())
    const matchPriority = priorityFilter === 'all' || task.priority === priorityFilter
    return matchSearch && matchPriority
  })

  const priorityColors = { critical: 'red', high: 'orange', medium: 'yellow', low: 'gray' }
  const statusColors = { in_progress: 'blue', assigned: 'purple', completed: 'green', scheduled: 'gray' }

  if (error) return <ErrorState message={error} />

  return (
    <div role="region" aria-label="TelcoFieldOps" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('nav.telcoFieldOps', 'Field Operations')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Network maintenance, installations & field technician dispatch</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full text-sm">
            {data.sitesDown} sites down
          </span>
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full text-sm">
            {data.scheduledMaintenance} maintenance scheduled
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {[
          { label: 'Technicians', value: data.totalTechnicians, icon: Users, color: 'blue' },
          { label: 'Active Tasks', value: data.activeTasks.toLocaleString(), icon: Wrench, color: 'yellow' },
          { label: 'Completed Today', value: data.completedToday, icon: CheckCircle, color: 'green' },
          { label: 'Avg Resolution', value: `${data.avgResolutionHrs}h`, icon: Clock, color: 'purple' },
          { label: 'SLA Compliance', value: `${data.slaCompliance}%`, icon: Shield, color: 'cyan' },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={`w-4 h-4 text-${kpi.color}-500`} />
              <span className="text-xs text-gray-500 dark:text-gray-400">{kpi.label}</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        {['tasks', 'by-type', 'regions'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm rounded-md capitalize transition-colors ${
              activeTab === tab ? 'bg-white dark:bg-gray-700 shadow-sm font-medium text-gray-900 dark:text-gray-100'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
            {tab.replace('-', ' ')}
          </button>
        ))}
      </div>

      {activeTab === 'tasks' && (<>
        <div className="flex gap-2">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks, locations, technicians..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"><option value="all">All Priorities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['Task ID', 'Type', 'Priority', 'Location', 'Technician', 'Status', 'ETA'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredTasks.length === 0 ? <tr><td colSpan="7" className="text-center py-8 text-gray-500 dark:text-gray-400">No results found</td></tr> : null}
                {filteredTasks.map((task, i) => (
                  <tr key={i} onClick={() => setSelectedTask(selectedTask === task.id ? null : task.id)} onKeyDown={e => e.key === "Enter" && setSelectedTask(selectedTask === task.id ? null : task.id)} tabIndex={0} role="button" className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                    <td className="px-6 py-4 font-mono text-sm text-blue-600 dark:text-blue-400">{task.id}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{task.type}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium bg-${priorityColors[task.priority]}-100 text-${priorityColors[task.priority]}-700 dark:bg-${priorityColors[task.priority]}-900/30 dark:text-${priorityColors[task.priority]}-400`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-sm">{task.location}</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-gray-100">{task.technician}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium bg-${statusColors[task.status]}-100 text-${statusColors[task.status]}-700 dark:bg-${statusColors[task.status]}-900/30 dark:text-${statusColors[task.status]}-400`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm">{task.eta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>)}

      {activeTab === 'by-type' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Task Completion by Type</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.tasksByType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#3b82f6" name="Total" />
              <Bar dataKey="completed" fill="#10b981" name="Completed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeTab === 'regions' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['Region', 'Tasks', 'Completion Rate', 'Technicians'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.regionPerformance.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{r.region}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{r.tasks}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${r.completion >= 95 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                        {r.completion}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{r.technicians}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default TelcoFieldOps
