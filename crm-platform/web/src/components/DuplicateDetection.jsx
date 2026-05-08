import { useState } from 'react'
import { Copy, CheckCircle, AlertTriangle, Merge, Eye, Search, Filter, Users, Database } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const duplicates = [
  { id: 'DUP-001', records: ['Dangote Industries Ltd', 'Dangote Industries'], confidence: 98, field: 'Company Name', count: 2, impact: '\u20A62.4B revenue split across records', status: 'pending', matchType: 'Fuzzy name' },
  { id: 'DUP-002', records: ['MTN Nigeria PLC', 'MTN Nigeria', 'MTN Nig.'], confidence: 95, field: 'Company Name', count: 3, impact: 'Split communication history', status: 'pending', matchType: 'Abbreviation' },
  { id: 'DUP-003', records: ['sarah.okonkwo@acme.ng', 's.okonkwo@acme.ng'], confidence: 88, field: 'Email', count: 2, impact: 'Duplicate contact records', status: 'pending', matchType: 'Email variation' },
  { id: 'DUP-004', records: ['+234-801-234-5678', '+2348012345678'], confidence: 92, field: 'Phone', count: 2, impact: 'Duplicate lead entries', status: 'pending', matchType: 'Phone format' },
  { id: 'DUP-005', records: ['Kano Textiles Ltd', 'Kano Textiles Limited'], confidence: 99, field: 'Company Name', count: 2, impact: 'Duplicate support tickets', status: 'resolved', matchType: 'Suffix variation' },
]

export default function DuplicateDetection() {
  const { tenant } = useTenant()
  const { t } = useTranslation()

  const pending = duplicates.filter(d => d.status === 'pending')

  return (
    <div role="region" aria-label="DuplicateDetection" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Copy className="w-7 h-7 text-orange-600" /> Duplicate Detection</h1><p className="text-gray-500 dark:text-gray-400 mt-1">AI-powered duplicate detection and merge</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Duplicates Found', v: duplicates.length }, { l: 'Pending Review', v: pending.length }, { l: 'Records Affected', v: duplicates.reduce((s, d) => s + d.count, 0) }, { l: 'Avg Confidence', v: Math.round(duplicates.reduce((s, d) => s + d.confidence, 0) / duplicates.length) + '%' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="space-y-2">
        {duplicates.map(dup => (
          <div key={dup.id} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 ${dup.status === 'resolved' ? 'border-gray-200 dark:border-gray-700 opacity-60' : 'border-orange-200 dark:border-orange-800'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{dup.records.join(' ↔ ')}</h4><span className={`text-xs px-1.5 py-0.5 rounded ${dup.confidence >= 95 ? 'bg-red-100 text-red-700' : dup.confidence >= 85 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{dup.confidence}% match</span></div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1"><span>Field: {dup.field}</span><span>Type: {dup.matchType}</span><span>{dup.count} records</span></div>
                <p className="text-xs text-gray-400 mt-0.5">{dup.impact}</p>
              </div>
              {dup.status === 'pending' ? (
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 bg-orange-600 text-white rounded text-xs hover:bg-orange-700 flex items-center gap-1"><Merge className="w-3 h-3" /> Merge</button>
                  <button className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Dismiss</button>
                </div>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Resolved</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
