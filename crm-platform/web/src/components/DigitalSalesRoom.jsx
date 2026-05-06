import { useState } from 'react'
import { Layout, FileText, MessageSquare, Eye, Clock, Users, Link, CheckCircle, BarChart3, Share2, DollarSign, Video } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
const rooms = [
  { id: 'DSR-001', deal: 'Dangote Group — Trade Finance', value: '₦2.5B', owner: 'Sarah Okonkwo', stage: 'Closing', visitors: 12, views: 48, avgTime: '8.2 min', lastVisit: '2 hours ago', sections: [{ name: 'Executive Summary', views: 18, time: '3.4 min' }, { name: 'Pricing & Terms', views: 15, time: '5.1 min' }, { name: 'Case Studies', views: 8, time: '2.8 min' }, { name: 'Implementation Plan', views: 7, time: '1.9 min' }] },
  { id: 'DSR-002', deal: 'MTN Nigeria — Payroll Processing', value: '₦890M', owner: 'Ahmed Musa', stage: 'Negotiation', visitors: 8, views: 32, avgTime: '6.5 min', lastVisit: '1 day ago', sections: [{ name: 'Product Demo', views: 12, time: '4.2 min' }, { name: 'Pricing Comparison', views: 10, time: '3.8 min' }] },
  { id: 'DSR-003', deal: 'Shoprite — POS Fleet', value: '₦180M', owner: 'Sarah Okonkwo', stage: 'Proposal', visitors: 5, views: 18, avgTime: '4.2 min', lastVisit: '3 days ago', sections: [{ name: 'Terminal Specs', views: 8, time: '2.5 min' }] },
]
export default function DigitalSalesRoom() {
  const [selected, setSelected] = useState('DSR-001')
  const room = rooms.find(r => r.id === selected)
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Layout className="w-7 h-7 text-rose-600" /> Digital Sales Rooms</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Personalized deal rooms with buyer engagement tracking</p></div>
      <div className="grid grid-cols-4 gap-3">{[{ l: 'Active Rooms', v: '24' }, { l: 'Total Views', v: '1,842' }, { l: 'Avg Engagement', v: '6.8 min' }, { l: 'Deals Influenced', v: '₦8.2B' }].map(s => (<div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>))}</div>
      <div className="flex gap-2">{rooms.map(r => (<button key={r.id} onClick={() => setSelected(r.id)} className={`px-3 py-2 text-sm rounded-lg border text-left ${selected === r.id ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20' : 'border-gray-200 dark:border-gray-700'}`}><div className="font-medium text-gray-900 dark:text-white">{r.deal}</div><div className="text-xs text-gray-500">{r.value} · {r.stage}</div></button>))}</div>
      {room && (<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Content Engagement</h3>
          <div className="space-y-3">{room.sections.map(s => (<div key={s.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"><div><h4 className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</h4><p className="text-xs text-gray-500">{s.views} views · {s.time} avg time</p></div><div className="w-24 h-2 bg-gray-200 dark:bg-gray-600 rounded-full"><div className="h-full bg-rose-500 rounded-full" style={{width: `${Math.min((s.views / 20) * 100, 100)}%`}} /></div></div>))}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Room Stats</h3>
          {[{ l: 'Unique Visitors', v: room.visitors, i: Users }, { l: 'Total Views', v: room.views, i: Eye }, { l: 'Avg Time', v: room.avgTime, i: Clock }, { l: 'Last Visit', v: room.lastVisit, i: Clock }].map(s => (<div key={s.l} className="flex items-center gap-3"><s.i className="w-4 h-4 text-gray-400" /><div><p className="text-xs text-gray-500">{s.l}</p><p className="text-sm font-medium text-gray-900 dark:text-white">{s.v}</p></div></div>))}
          <button className="w-full px-4 py-2 bg-rose-600 text-white rounded-lg text-sm hover:bg-rose-700 flex items-center justify-center gap-2"><Share2 className="w-4 h-4" /> Share Room Link</button>
        </div>
      </div>)}
    </div>
  )
}