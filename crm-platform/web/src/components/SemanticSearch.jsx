import { useState, useCallback } from 'react'
import { Search, Brain, Clock, Filter, X, Users, Building2, MapPin, TrendingUp, TrendingDown, AlertTriangle, Star, ChevronDown, Sparkles, ArrowRight, Tag, RefreshCw } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { FallbackBadge , ErrorState } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const customerDB = {
  'acme-bank': [
    { id: 'CUS-001', name: 'Dangote Industries', segment: 'Enterprise', value: '₦2.4B', health: 92, location: 'Lagos', vertical: 'Manufacturing', lastContact: '2 days ago', status: 'active', tags: ['high-value', 'growth'], risk: 'low', products: ['Trade Finance', 'Treasury', 'FX'] },
    { id: 'CUS-002', name: 'MTN Nigeria', segment: 'Enterprise', value: '₦1.8B', health: 88, location: 'Lagos', vertical: 'Telecom', lastContact: '1 day ago', status: 'active', tags: ['strategic', 'upsell-ready'], risk: 'low', products: ['Payroll', 'Collections', 'Cash Mgmt'] },
    { id: 'CUS-003', name: 'Kano Textiles Ltd', segment: 'SME', value: '₦45.2M', health: 25, location: 'Kano', vertical: 'Manufacturing', lastContact: '45 days ago', status: 'at-risk', tags: ['churn-risk', 'escalated'], risk: 'critical', products: ['Business Account', 'POS'] },
    { id: 'CUS-004', name: 'Shoprite Nigeria', segment: 'Corporate', value: '₦890M', health: 76, location: 'Lagos', vertical: 'Retail', lastContact: '5 days ago', status: 'active', tags: ['cross-sell'], risk: 'medium', products: ['POS Fleet', 'Collections'] },
    { id: 'CUS-005', name: 'Abuja Motors Group', segment: 'Corporate', value: '₦22.1M', health: 28, location: 'Abuja', vertical: 'Automotive', lastContact: '30 days ago', status: 'at-risk', tags: ['churn-risk', 'downgrade'], risk: 'high', products: ['Auto Loans', 'Insurance'] },
    { id: 'CUS-006', name: 'Lagos Fresh Markets', segment: 'SME', value: '₦8.7M', health: 22, location: 'Lagos', vertical: 'Agriculture', lastContact: '60 days ago', status: 'at-risk', tags: ['churn-risk'], risk: 'critical', products: ['Business Account'] },
    { id: 'CUS-007', name: 'Zenith Pharma', segment: 'Corporate', value: '₦340M', health: 85, location: 'Lagos', vertical: 'Healthcare', lastContact: '3 days ago', status: 'active', tags: ['growth', 'upsell-ready'], risk: 'low', products: ['Trade Finance', 'FX', 'Payroll'] },
    { id: 'CUS-008', name: 'Port Harcourt Shipping', segment: 'Enterprise', value: '₦67.8M', health: 31, location: 'Port Harcourt', vertical: 'Logistics', lastContact: '20 days ago', status: 'at-risk', tags: ['renewal-due'], risk: 'high', products: ['Letters of Credit', 'FX'] },
    { id: 'CUS-009', name: 'Ibadan AgriTech', segment: 'SME', value: '₦5.3M', health: 33, location: 'Ibadan', vertical: 'Agriculture', lastContact: '15 days ago', status: 'warning', tags: ['declining-usage'], risk: 'medium', products: ['Business Account', 'Mobile'] },
    { id: 'CUS-010', name: 'Flour Mills Nigeria', segment: 'Enterprise', value: '₦4.2B', health: 95, location: 'Lagos', vertical: 'Manufacturing', lastContact: '1 day ago', status: 'active', tags: ['strategic', 'high-value'], risk: 'low', products: ['Treasury', 'Trade Finance', 'FX', 'Payroll', 'Insurance'] },
  ],
  'aerotel': [
    { id: 'SUB-001', name: 'Victoria Island Tower Cluster', segment: 'Infrastructure', value: '$12.4M ARR', health: 94, location: 'Lagos', vertical: 'Cell Sites', lastContact: '1 hour ago', status: 'active', tags: ['5G-ready'], risk: 'low', products: ['Fiber Backhaul', '5G Small Cells'] },
    { id: 'SUB-002', name: 'Northern Region Enterprise', segment: 'Enterprise', value: '$4.8M ARR', health: 72, location: 'Kano', vertical: 'Enterprise', lastContact: '3 days ago', status: 'active', tags: ['expansion'], risk: 'medium', products: ['MPLS', 'SIP Trunking', 'Cloud PBX'] },
    { id: 'SUB-003', name: 'Lagos Metro Subscribers', segment: 'Consumer', value: '$28.2M MRR', health: 81, location: 'Lagos', vertical: 'Mobile', lastContact: 'Real-time', status: 'active', tags: ['high-arpu'], risk: 'low', products: ['4G Data', 'Voice', 'VAS'] },
    { id: 'SUB-004', name: 'Abuja Government Contract', segment: 'Government', value: '$8.9M ARR', health: 45, location: 'Abuja', vertical: 'Government', lastContact: '14 days ago', status: 'warning', tags: ['renewal-risk', 'compliance'], risk: 'high', products: ['Dedicated Fiber', 'Managed Security'] },
  ],
  'petromark': [
    { id: 'CTR-001', name: 'Shell Western Operations', segment: 'Major', value: '$450M notional', health: 91, location: 'Port Harcourt', vertical: 'Upstream', lastContact: '2 hours ago', status: 'active', tags: ['strategic', 'hedging'], risk: 'low', products: ['Crude Forwards', 'Options', 'Swaps'] },
    { id: 'CTR-002', name: 'Vitol Asia Trading Desk', segment: 'Trading House', value: '$280M notional', health: 87, location: 'Singapore', vertical: 'Trading', lastContact: '1 day ago', status: 'active', tags: ['high-volume'], risk: 'low', products: ['Gasoil Futures', 'Crude Spot'] },
    { id: 'CTR-003', name: 'NNPC Refinery Contract', segment: 'Sovereign', value: '$1.2B notional', health: 68, location: 'Abuja', vertical: 'Downstream', lastContact: '7 days ago', status: 'warning', tags: ['settlement-delay'], risk: 'medium', products: ['Product Swaps', 'Freight'] },
  ],
  'messageflow': [
    { id: 'DEV-001', name: 'Flutterwave Payments', segment: 'Enterprise', value: '$42K MRR', health: 96, location: 'Lagos', vertical: 'Fintech', lastContact: '1 hour ago', status: 'active', tags: ['high-volume', 'api-v3'], risk: 'low', products: ['SMS API', 'WhatsApp Business', 'Voice OTP'] },
    { id: 'DEV-002', name: 'Kuda Bank', segment: 'Scale-up', value: '$18K MRR', health: 82, location: 'Lagos', vertical: 'Neobank', lastContact: '2 days ago', status: 'active', tags: ['growing', 'multi-channel'], risk: 'low', products: ['SMS API', 'Push Notifications'] },
    { id: 'DEV-003', name: 'Jumia Marketplace', segment: 'Enterprise', value: '$31K MRR', health: 54, location: 'Lagos', vertical: 'E-commerce', lastContact: '12 days ago', status: 'warning', tags: ['declining-usage', 'competitor-eval'], risk: 'high', products: ['SMS API', 'Email API'] },
  ],
}

const nlpExamples = [
  { query: 'enterprise customers in Lagos with churn risk', description: 'Find at-risk enterprise accounts' },
  { query: 'high value accounts that haven\'t been contacted in 30 days', description: 'Identify neglected opportunities' },
  { query: 'customers with health score below 40', description: 'Critical health alerts' },
  { query: 'SME segment with upsell potential in Kano', description: 'Expansion opportunities' },
  { query: 'strategic accounts with multiple products', description: 'Cross-sell analysis' },
  { query: 'all accounts with declining usage this quarter', description: 'Usage trend alerts' },
]

function semanticMatch(customer, query) {
  const q = query.toLowerCase()
  const searchable = `${customer.name} ${customer.segment} ${customer.location} ${customer.vertical} ${customer.status} ${customer.tags.join(' ')} ${customer.risk} ${customer.products.join(' ')} ${customer.value}`.toLowerCase()
  if (searchable.includes(q)) return { score: 0.98, reason: 'Direct match' }
  const terms = q.split(/\s+/).filter(t => t.length > 2)
  let matched = 0
  const reasons = []
  for (const term of terms) {
    if (term === 'churn' || term === 'risk' || term === 'at-risk') {
      if (customer.risk === 'critical' || customer.risk === 'high' || customer.status === 'at-risk') { matched += 2; reasons.push('At-risk status') }
    } else if (term === 'enterprise' || term === 'corporate' || term === 'sme') {
      if (customer.segment.toLowerCase().includes(term)) { matched += 1.5; reasons.push(`${customer.segment} segment`) }
    } else if (term === 'high' && (q.includes('value') || q.includes('worth'))) {
      const numVal = parseFloat(customer.value.replace(/[^0-9.]/g, ''))
      if (numVal > 100) { matched += 1.5; reasons.push('High-value account') }
    } else if (term === 'lagos' || term === 'kano' || term === 'abuja') {
      if (customer.location.toLowerCase().includes(term)) { matched += 1.5; reasons.push(`Located in ${customer.location}`) }
    } else if (term === 'contacted' || term === 'neglected' || term === 'inactive') {
      const days = parseInt(customer.lastContact)
      if (days >= 14 || customer.lastContact.includes('days ago')) { matched += 1; reasons.push(`Last contact: ${customer.lastContact}`) }
    } else if (term === 'health' || term === 'score' || term === 'below') {
      if (q.includes('below') && customer.health < 40) { matched += 2; reasons.push(`Health score: ${customer.health}`) }
      else if (customer.health < 50) { matched += 1; reasons.push(`Low health: ${customer.health}`) }
    } else if (term === 'upsell' || term === 'cross-sell' || term === 'growth') {
      if (customer.tags.some(t => t.includes('upsell') || t.includes('growth') || t.includes('cross-sell'))) { matched += 1.5; reasons.push('Upsell opportunity') }
    } else if (term === 'strategic') {
      if (customer.tags.includes('strategic')) { matched += 2; reasons.push('Strategic account') }
    } else if (term === 'declining') {
      if (customer.tags.some(t => t.includes('declining'))) { matched += 1.5; reasons.push('Declining usage') }
    } else if (searchable.includes(term)) {
      matched += 0.5; reasons.push('Keyword match')
    }
  }
  const score = terms.length > 0 ? Math.min(matched / terms.length, 1) : 0
  return { score, reason: [...new Set(reasons)].slice(0, 3).join(', ') || 'Partial match' }
}

const SemanticSearch = () => {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('semanticsearch', () => apiClient.dashboard.metrics(), { fallback: customerDB })
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [history, setHistory] = useState([])
  const [filters, setFilters] = useState({ segment: 'all', risk: 'all', minHealth: 0 })
  const [showFilters, setShowFilters] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [error, setError] = useState(null)

  const tenantSlug = tenant?.slug || 'acme-bank'
  const customers = customerDB[tenantSlug] || customerDB['acme-bank']

  const doSearch = useCallback((searchQuery) => {
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearched(false)
    setTimeout(() => {
      const scored = customers.map(c => {
        const { score, reason } = semanticMatch(c, searchQuery)
        return { ...c, relevance: score, matchReason: reason }
      }).filter(c => c.relevance > 0.1)
        .filter(c => filters.segment === 'all' || c.segment.toLowerCase() === filters.segment.toLowerCase())
        .filter(c => filters.risk === 'all' || c.risk === filters.risk)
        .filter(c => c.health >= filters.minHealth)
        .sort((a, b) => b.relevance - a.relevance)
      setResults(scored)
      setSearching(false)
      setSearched(true)
      setHistory(prev => {
        const next = [{ query: searchQuery, count: scored.length, time: new Date().toLocaleTimeString() }, ...prev.filter(h => h.query !== searchQuery)]
        return next.slice(0, 10)
      })
    }, 600)
  }, [customers, filters])

  const riskColor = (risk) => ({ critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' })[risk] || 'bg-gray-100 text-gray-600'
  const healthColor = (h) => h >= 80 ? 'text-emerald-600' : h >= 50 ? 'text-amber-600' : 'text-red-600'
  const segments = [...new Set(customers.map(c => c.segment))]

  if (error) return <ErrorState message={error} />

  return (
    <div role="region" aria-label="SemanticSearch" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Brain className="w-7 h-7 text-purple-600" /> Semantic Customer Search
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Natural language search across {customers.length} {tenant?.name || 'platform'} records using RAG</p>
        </div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { l: 'Total Records', v: customers.length.toLocaleString(), icon: Users },
          { l: 'At-Risk', v: customers.filter(c => c.risk === 'critical' || c.risk === 'high').length, icon: AlertTriangle },
          { l: 'Avg Health', v: Math.round(customers.reduce((s, c) => s + c.health, 0) / customers.length), icon: TrendingUp },
          { l: 'Searches Today', v: history.length, icon: Search },
        ].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center gap-1.5 mb-1"><s.icon className="w-3.5 h-3.5 text-gray-400" /><p className="text-xs text-gray-500">{s.l}</p></div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text" value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doSearch(query)}
              placeholder="Try: 'enterprise customers in Lagos with churn risk' or 'health score below 40'"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400"
            />
            {query && <button onClick={() => { setQuery(''); setResults([]); setSearched(false) }} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>}
          </div>
          <button onClick={() => doSearch(query)} disabled={!query.trim() || searching} className="px-5 py-3 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">
            {searching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {searching ? 'Searching...' : 'Search'}
          </button>
          <button onClick={() => setShowFilters(!showFilters)} className={`px-3 py-3 rounded-lg border text-sm ${showFilters ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'}`}>
            <Filter className="w-4 h-4" />
          </button>
        </div>
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Segment:</span>
              <select value={filters.segment} onChange={e => setFilters(f => ({ ...f, segment: e.target.value }))} className="text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="all">All</option>
                {segments.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Risk:</span>
              <select value={filters.risk} onChange={e => setFilters(f => ({ ...f, risk: e.target.value }))} className="text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="all">All</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Min Health:</span>
              <input type="range" min="0" max="100" value={filters.minHealth} onChange={e => setFilters(f => ({ ...f, minHealth: parseInt(e.target.value) }))} className="w-20" />
              <span className="text-xs text-gray-600 dark:text-gray-400 w-6">{filters.minHealth}</span>
            </div>
          </div>
        )}
      </div>

      {!searched && !searching && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-purple-500" /> Try these queries</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {nlpExamples.map(ex => (
              <button key={ex.query} onClick={() => { setQuery(ex.query); doSearch(ex.query) }} className="text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors">
                <p className="text-sm font-medium text-gray-900 dark:text-white">"{ex.query}"</p>
                <p className="text-xs text-gray-500 mt-0.5">{ex.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {searching && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Analyzing query with semantic embeddings...</p>
          <p className="text-xs text-gray-400 mt-1">Searching {customers.length} records across {tenant?.name || 'platform'}</p>
        </div>
      )}

      {searched && !searching && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Found <span className="font-semibold text-gray-900 dark:text-white">{results.length}</span> results for "<span className="text-purple-600">{query}</span>"
            </p>
          </div>
          {results.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No matching records found. Try different search terms.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map(c => (
                <div key={c.id} onClick={() => setSelectedCustomer(selectedCustomer?.id === c.id ? null : c)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${selectedCustomer?.id === c.id ? 'border-purple-500 ring-1 ring-purple-500' : 'border-gray-200 dark:border-gray-700'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{c.name}</h4>
                        <span className="text-xs text-gray-400">{c.id}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${riskColor(c.risk)}`}>{c.risk}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{c.segment}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.location}</span>
                        <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{c.vertical}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{c.lastContact}</span>
                      </div>
                      <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 flex items-center gap-1"><Sparkles className="w-3 h-3" />{c.matchReason}</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-bold text-gray-900 dark:text-white">{c.value}</p>
                      <p className={`text-sm font-semibold ${healthColor(c.health)}`}>{c.health}/100</p>
                      <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                        <div className={`h-full rounded-full ${c.health >= 80 ? 'bg-emerald-500' : c.health >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${c.health}%` }} />
                      </div>
                    </div>
                  </div>
                  {selectedCustomer?.id === c.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 mb-2">Products</h5>
                        <div className="flex flex-wrap gap-1">{c.products.map(p => <span key={p} className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">{p}</span>)}</div>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 mb-2">Tags</h5>
                        <div className="flex flex-wrap gap-1">{c.tags.map(tg => <span key={tg} className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{tg}</span>)}</div>
                      </div>
                      <div className="flex gap-2">
                        <button className="flex-1 px-3 py-1.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-700">View Profile</button>
                        <button className="flex-1 px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Contact</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" /> Recent Searches</h3>
          <div className="space-y-1">
            {history.map((h, i) => (
              <button key={i} onClick={() => { setQuery(h.query); doSearch(h.query) }} className="w-full flex items-center justify-between p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-left">
                <div className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{h.query}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{h.count} results</span>
                  <span>{h.time}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default SemanticSearch
