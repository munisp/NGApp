import { useState } from 'react'
import { FileText, Download, Eye, Copy, Clock, CheckCircle, Settings, Plus, Star, BarChart3 } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const templates = [
  { id: 'TPL-001', name: 'Sales Proposal', type: 'Proposal', uses: 892, lastUsed: '2 hours ago', fields: 24, pages: '8-12', format: 'PDF', rating: 4.8 },
  { id: 'TPL-002', name: 'Service Agreement', type: 'Contract', uses: 456, lastUsed: '1 day ago', fields: 36, pages: '15-20', format: 'PDF/DOCX', rating: 4.6 },
  { id: 'TPL-003', name: 'Quarterly Business Review', type: 'Report', uses: 128, lastUsed: '3 days ago', fields: 42, pages: '20-30', format: 'PDF', rating: 4.5 },
  { id: 'TPL-004', name: 'Invoice', type: 'Financial', uses: 2400, lastUsed: '1 hour ago', fields: 18, pages: '2-4', format: 'PDF', rating: 4.9 },
  { id: 'TPL-005', name: 'NDA', type: 'Legal', uses: 312, lastUsed: '1 week ago', fields: 12, pages: '4-6', format: 'PDF/DOCX', rating: 4.4 },
  { id: 'TPL-006', name: 'Customer Onboarding Kit', type: 'Operations', uses: 128, lastUsed: '2 days ago', fields: 28, pages: '12-16', format: 'PDF', rating: 4.7 },
]

const recentDocs = [
  { name: 'Proposal — Dangote Trade Finance.pdf', template: 'Sales Proposal', created: '2 hours ago', status: 'complete', pages: 12, size: '2.4 MB' },
  { name: 'Invoice — MTN Q1 2026.pdf', template: 'Invoice', created: '3 hours ago', status: 'complete', pages: 3, size: '0.8 MB' },
  { name: 'QBR — Shoprite H1 Review.pdf', template: 'Quarterly Business Review', created: '1 day ago', status: 'complete', pages: 24, size: '5.2 MB' },
]

export default function DocGeneration() {
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('templates')

  return (
    <div role="region" aria-label="DocGeneration" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><FileText className="w-7 h-7 text-blue-600" /> Document Generation</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Auto-generate proposals, contracts, and reports</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Templates', v: templates.length }, { l: 'Docs Generated', v: templates.reduce((s, t) => s + t.uses, 0).toLocaleString() }, { l: 'Recent (7d)', v: recentDocs.length }, { l: 'Avg Rating', v: (templates.reduce((s, t) => s + t.rating, 0) / templates.length).toFixed(1) }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="border-b border-gray-200 dark:border-gray-700"><div className="flex space-x-6">
        {[{ id: 'templates', label: 'Templates' }, { id: 'recent', label: 'Recent Documents' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3 text-sm font-medium border-b-2 ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>{tab.label}</button>
        ))}
      </div></div>
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map(tpl => (
            <div key={tpl.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md">
              <div className="flex items-center justify-between mb-2"><h4 className="font-semibold text-gray-900 dark:text-white">{tpl.name}</h4><span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{tpl.type}</span></div>
              <div className="grid grid-cols-4 gap-2 text-center mt-3">
                <div><p className="text-xs text-gray-400">Uses</p><p className="text-sm font-bold text-gray-900 dark:text-white">{tpl.uses}</p></div>
                <div><p className="text-xs text-gray-400">Fields</p><p className="text-sm font-bold text-gray-900 dark:text-white">{tpl.fields}</p></div>
                <div><p className="text-xs text-gray-400">Pages</p><p className="text-sm font-bold text-gray-900 dark:text-white">{tpl.pages}</p></div>
                <div><p className="text-xs text-gray-400">Rating</p><p className="text-sm font-bold text-gray-900 dark:text-white">{tpl.rating}</p></div>
              </div>
              <div className="flex justify-between items-center mt-3"><span className="text-xs text-gray-400">Format: {tpl.format} · Last used: {tpl.lastUsed}</span><button className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Generate</button></div>
            </div>
          ))}
        </div>
      )}
      {activeTab === 'recent' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full"><thead className="bg-gray-50 dark:bg-gray-700"><tr>{['Document', 'Template', 'Created', 'Pages', 'Size', 'Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {recentDocs.map((doc, i) => (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{doc.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{doc.template}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{doc.created}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{doc.pages}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{doc.size}</td>
                <td className="px-4 py-3"><button className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"><Download className="w-3 h-3" />Download</button></td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}
    </div>
  )
}
