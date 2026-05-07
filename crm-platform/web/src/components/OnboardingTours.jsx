import { useState } from 'react'
import { Compass, CheckCircle, Circle, ArrowRight, Users, Clock, TrendingUp, BarChart3, Star, Zap, BookOpen } from 'lucide-react'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
const tours = [
  { id: 'staff', name: 'CRM Staff Onboarding', users: 342, completion: 78, steps: [
    { name: 'Welcome & Navigation', completion: 98 }, { name: 'Customer Search & 360 View', completion: 92 },
    { name: 'Creating & Managing Tasks', completion: 85 }, { name: 'Pipeline Management', completion: 72 },
    { name: 'Reporting & Analytics', completion: 65 }, { name: 'Advanced Features', completion: 48 },
  ]},
  { id: 'customer', name: 'Customer Banking Onboarding', users: 8420, completion: 64, steps: [
    { name: 'Account Activation', completion: 95 }, { name: 'Mobile App Setup', completion: 82 },
    { name: 'First Transfer', completion: 71 }, { name: 'Bill Payment Setup', completion: 55 },
    { name: 'Savings Goal Creation', completion: 42 }, { name: 'Investment Products', completion: 28 },
  ]},
]
const ahaMoments = [
  { event: 'First successful transfer', users: 7840, conversionLift: '+45%', timeToReach: '2.3 days' },
  { event: 'Set up recurring payment', users: 3420, conversionLift: '+62%', timeToReach: '5.1 days' },
  { event: 'Used Customer 360 view', users: 280, conversionLift: '+38%', timeToReach: '1.2 days' },
  { event: 'Created first report', users: 145, conversionLift: '+52%', timeToReach: '3.8 days' },
]
export default function OnboardingTours() {
  const { t } = useTranslation()
  const [selectedTour, setSelectedTour] = useState('staff')
  const tour = tours.find(t => t.id === selectedTour)
  return (
    <div role="region" aria-label="OnboardingTours"  className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Compass className="w-7 h-7 text-orange-500" /> In-App Onboarding & Product Tours</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Guided experiences for staff and customers</p></div>
      <div className="grid grid-cols-4 gap-3">{[{ l: 'Active Users', v: '8,762' }, { l: 'Avg Completion', v: '71%' }, { l: 'Retention Lift', v: '+2.5x' }, { l: 'Time to Value', v: '2.8 days' }].map(s => (<div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>))}</div>
      <div className="flex gap-2">{tours.map(t => (<button key={t.id} onClick={() => setSelectedTour(t.id)} className={`px-3 py-1.5 text-sm rounded-full ${selectedTour === t.id ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600'}`}>{t.name}</button>))}</div>
      {tour && (<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">{tour.name} — {tour.completion}% avg completion</h3>
          <div className="space-y-3">{tour.steps.map((s, i) => (<div key={s.name} className="flex items-center gap-3"><div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${s.completion >= 80 ? 'bg-emerald-100 text-emerald-700' : s.completion >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{i + 1}</div><div className="flex-1"><div className="flex justify-between"><span className="text-sm text-gray-900 dark:text-white">{s.name}</span><span className="text-sm font-medium">{s.completion}%</span></div><div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full mt-1"><div className={`h-full rounded-full ${s.completion >= 80 ? 'bg-emerald-500' : s.completion >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{width: `${s.completion}%`}} /></div></div></div>))}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" /> Aha Moments</h3>
          <div className="space-y-3">{ahaMoments.map(m => (<div key={m.event} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"><h4 className="text-sm font-medium text-gray-900 dark:text-white">{m.event}</h4><div className="flex gap-4 text-xs text-gray-500 mt-1"><span>{m.users.toLocaleString()} users</span><span className="text-emerald-600 font-medium">{m.conversionLift} retention</span><span>{m.timeToReach} avg</span></div></div>))}</div>
        </div>
      </div>)}
    </div>
  )
}