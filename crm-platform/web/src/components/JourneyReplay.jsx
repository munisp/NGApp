import { useState } from 'react'
import { Play, MapPin, ArrowRight, CheckCircle, XCircle, Clock, AlertTriangle, Users, Search, Filter, BarChart3 } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
const journeys = [
  { id: 'J-001', customer: 'Chinedu Okafor', type: 'SME Loan Onboarding', status: 'completed', startDate: 'Jan 15', endDate: 'Feb 12', days: 28, designedDays: 14, steps: [
    { name: 'Application Received', status: 'completed', actual: 'Jan 15', designed: 'Day 1', duration: '0d', channel: 'Web' },
    { name: 'Document Upload', status: 'completed', actual: 'Jan 16', designed: 'Day 1-2', duration: '1d', channel: 'WhatsApp' },
    { name: 'KYC Verification', status: 'completed', actual: 'Jan 22', designed: 'Day 3-5', duration: '6d', channel: 'Agent Visit', bottleneck: true },
    { name: 'Credit Assessment', status: 'completed', actual: 'Jan 28', designed: 'Day 5-7', duration: '6d', channel: 'Internal', bottleneck: true },
    { name: 'Approval', status: 'completed', actual: 'Feb 5', designed: 'Day 7-8', duration: '8d', channel: 'Internal', bottleneck: true },
    { name: 'Disbursement', status: 'completed', actual: 'Feb 10', designed: 'Day 8-10', duration: '5d', channel: 'Core Banking' },
    { name: 'Welcome Call', status: 'completed', actual: 'Feb 12', designed: 'Day 10-11', duration: '2d', channel: 'Phone' },
  ]},
  { id: 'J-002', customer: 'Ngozi Eze', type: 'Account Upgrade', status: 'in_progress', startDate: 'Mar 20', endDate: null, days: 15, designedDays: 7, steps: [
    { name: 'Upgrade Request', status: 'completed', actual: 'Mar 20', designed: 'Day 1', duration: '0d', channel: 'Branch' },
    { name: 'Document Collection', status: 'completed', actual: 'Mar 22', designed: 'Day 2-3', duration: '2d', channel: 'Email' },
    { name: 'Compliance Review', status: 'in_progress', actual: 'Mar 25', designed: 'Day 3-4', duration: '10d+', channel: 'Internal', bottleneck: true },
    { name: 'Account Migration', status: 'pending', actual: null, designed: 'Day 4-5', duration: null, channel: 'Core Banking' },
    { name: 'New Features Setup', status: 'pending', actual: null, designed: 'Day 5-6', duration: null, channel: 'Digital' },
    { name: 'Confirmation', status: 'pending', actual: null, designed: 'Day 7', duration: null, channel: 'SMS' },
  ]},
  { id: 'J-003', customer: 'Bala Mohammed', type: 'New Account Opening', status: 'dropped', startDate: 'Feb 1', endDate: 'Feb 8', days: 7, designedDays: 3, steps: [
    { name: 'Registration', status: 'completed', actual: 'Feb 1', designed: 'Day 1', duration: '0d', channel: 'Mobile App' },
    { name: 'BVN Verification', status: 'completed', actual: 'Feb 2', designed: 'Day 1', duration: '1d', channel: 'NIBSS' },
    { name: 'Initial Deposit', status: 'dropped', actual: 'Feb 8', designed: 'Day 2', duration: '6d', channel: null, bottleneck: true },
  ]},
]
const stats = { totalJourneys: 4280, completed: 3420, inProgress: 640, dropped: 220, avgDuration: '18 days', designedAvg: '10 days', bottleneckRate: '34%' }
export default function JourneyReplay() {
  const { t } = useTranslation()
  const [selectedJourney, setSelectedJourney] = useState('J-001')
  const journey = journeys.find(j => j.id === selectedJourney)
  return (
    <div role="region" aria-label="JourneyReplay"  className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Play className="w-7 h-7 text-cyan-600" /> Customer Journey Replay</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Visual replay of actual vs designed customer journeys</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[{ l: 'Completed', v: `${stats.completed}/${stats.totalJourneys}` }, { l: 'Avg Duration', v: stats.avgDuration }, { l: 'Designed Avg', v: stats.designedAvg }, { l: 'Bottleneck Rate', v: stats.bottleneckRate }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="flex gap-2">
        {journeys.map(j => (
          <button key={j.id} onClick={() => setSelectedJourney(j.id)} className={`px-3 py-2 text-sm rounded-lg border ${selectedJourney === j.id ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700' : 'border-gray-200 dark:border-gray-700 text-gray-600'}`}>
            <div className="font-medium">{j.customer}</div>
            <div className="text-xs text-gray-500">{j.type}</div>
          </button>
        ))}
      </div>
      {journey && (
        <div tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{journey.customer} — {journey.type}</h3>
              <p className="text-xs text-gray-500">{journey.startDate} → {journey.endDate || 'In Progress'} · {journey.days} days (designed: {journey.designedDays})</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${journey.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : journey.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{journey.status.replace('_', ' ')}</span>
          </div>
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
            <div className="space-y-6">
              {journey.steps.map((step, i) => (
                <div key={i} className="relative flex items-start gap-4 pl-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 shrink-0 ${step.status === 'completed' ? 'bg-emerald-500 text-white' : step.status === 'in_progress' ? 'bg-blue-500 text-white' : step.status === 'dropped' ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}`}>
                    {step.status === 'completed' ? <CheckCircle className="w-5 h-5" /> : step.status === 'dropped' ? <XCircle className="w-5 h-5" /> : step.status === 'in_progress' ? <Clock className="w-5 h-5" /> : <span className="text-sm">{i + 1}</span>}
                  </div>
                  <div className={`flex-1 rounded-xl border p-4 ${step.bottleneck ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900 dark:text-white text-sm">{step.name}</h4>
                      {step.bottleneck && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Bottleneck</span>}
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-gray-500">
                      <span>Designed: {step.designed}</span>
                      {step.actual && <span>Actual: {step.actual}</span>}
                      {step.duration && <span>Duration: {step.duration}</span>}
                      {step.channel && <span>Channel: {step.channel}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
