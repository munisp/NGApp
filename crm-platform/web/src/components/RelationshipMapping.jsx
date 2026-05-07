import { useState } from 'react'
import { GitBranch, Users, Star, AlertTriangle, TrendingUp, Mail, Phone, Calendar, Eye, UserCheck, UserX, Crown, Shield } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
const tenantData = {
  'acme-bank': {
    accounts: [
      { name: 'Dangote Group', stakeholders: [
        { name: 'Aliko Dangote', role: 'CEO / Decision Maker', strength: 95, type: 'champion', lastContact: '2 days ago', interactions: 34 },
        { name: 'Kola Jamodu', role: 'CFO / Economic Buyer', strength: 82, type: 'influencer', lastContact: '1 week ago', interactions: 22 },
        { name: 'Fatima Wali-Abdurrahman', role: 'Head of Treasury', strength: 71, type: 'champion', lastContact: '3 days ago', interactions: 18 },
        { name: 'Emmanuel Okoro', role: 'VP Procurement', strength: 45, type: 'neutral', lastContact: '3 weeks ago', interactions: 5 },
        { name: 'Halima Bello', role: 'Legal Counsel', strength: 38, type: 'blocker', lastContact: '1 month ago', interactions: 3 },
        { name: 'David Onyema', role: 'IT Director', strength: 62, type: 'influencer', lastContact: '1 week ago', interactions: 12 },
      ]},
      { name: 'MTN Nigeria', stakeholders: [
        { name: 'Karl Toriola', role: 'CEO', strength: 40, type: 'neutral', lastContact: '2 weeks ago', interactions: 8 },
        { name: 'Modupe Kadri', role: 'CFO', strength: 75, type: 'champion', lastContact: '3 days ago', interactions: 15 },
        { name: 'Adekunle Johnson', role: 'VP Payments', strength: 68, type: 'influencer', lastContact: '5 days ago', interactions: 11 },
        { name: 'Sade Ogunleye', role: 'Procurement Lead', strength: 52, type: 'neutral', lastContact: '2 weeks ago', interactions: 6 },
      ]},
    ],
    stats: { totalAccounts: 186, avgStakeholders: 4.2, strongRelationships: 342, weakRelationships: 128, unmapped: 45 },
  },
  'nextgen-mfb': {
    accounts: [
      { name: 'Lagos Market Coop', stakeholders: [
        { name: 'Mama Iyabo', role: 'Chair', strength: 88, type: 'champion', lastContact: '1 day ago', interactions: 20 },
        { name: 'Bola Adeyemi', role: 'Treasurer', strength: 72, type: 'influencer', lastContact: '3 days ago', interactions: 10 },
      ]},
    ],
    stats: { totalAccounts: 24, avgStakeholders: 2.1, strongRelationships: 38, weakRelationships: 12, unmapped: 8 },
  },
}
const typeIcons = { champion: { icon: Crown, color: 'text-emerald-600 bg-emerald-100' }, influencer: { icon: Star, color: 'text-blue-600 bg-blue-100' }, neutral: { icon: UserCheck, color: 'text-gray-600 bg-gray-100' }, blocker: { icon: Shield, color: 'text-red-600 bg-red-100' } }
export default function RelationshipMapping() {
  const { t } = useTranslation()
  const { tenant } = useTenant()
  const [selectedAccount, setSelectedAccount] = useState(0)
  const data = tenantData[tenant?.slug] || tenantData['acme-bank']
  const account = data.accounts[selectedAccount]
  return (
    <div role="region" aria-label="RelationshipMapping"  className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><GitBranch className="w-7 h-7 text-teal-600" /> Relationship Mapping & Stakeholder Intelligence</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{data.stats.totalAccounts} accounts · {data.stats.strongRelationships} strong relationships</p>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {[{ l: 'Total Accounts', v: data.stats.totalAccounts }, { l: 'Avg Stakeholders', v: data.stats.avgStakeholders }, { l: 'Strong', v: data.stats.strongRelationships }, { l: 'Weak', v: data.stats.weakRelationships }, { l: 'Unmapped', v: data.stats.unmapped }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mb-4">
        {data.accounts.map((a, i) => (
          <button key={a.name} onClick={() => setSelectedAccount(i)} className={`px-3 py-1.5 text-sm rounded-full ${selectedAccount === i ? 'bg-teal-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600'}`}>{a.name}</button>
        ))}
      </div>
      <div tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">{account.name} — {account.stakeholders.length} Stakeholders</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {account.stakeholders.map(s => {
            const typeInfo = typeIcons[s.type]
            return (
              <div key={s.name} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm">{s.name.split(' ').map(n=>n[0]).join('')}</div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white text-sm">{s.name}</h4>
                    <p className="text-xs text-gray-500">{s.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${typeInfo.color}`}><typeInfo.icon className="w-3 h-3" />{s.type}</span>
                  <span className="text-xs text-gray-500">{s.lastContact}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Strength</span>
                  <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full"><div className={`h-full rounded-full ${s.strength >= 70 ? 'bg-emerald-500' : s.strength >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${s.strength}%` }} /></div>
                  <span className="text-xs font-bold">{s.strength}%</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">{s.interactions} interactions</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
