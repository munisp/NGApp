import { useState, useContext } from 'react';
import { Search, Filter, Save, Clock, User, CreditCard, Briefcase, MapPin, Star, X } from 'lucide-react';
import { TenantContext } from '../contexts/TenantContext';
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const SEARCH_FIELDS = [
  { id: 'name', label: 'Name', type: 'text', icon: User },
  { id: 'phone', label: 'Phone', type: 'text', icon: User },
  { id: 'email', label: 'Email', type: 'text', icon: User },
  { id: 'bvn', label: 'BVN', type: 'text', icon: CreditCard },
  { id: 'account_number', label: 'Account Number', type: 'text', icon: CreditCard },
  { id: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive', 'Dormant', 'Suspended'] },
  { id: 'kyc_level', label: 'KYC Level', type: 'select', options: ['Level 1', 'Level 2', 'Level 3'] },
  { id: 'product', label: 'Product', type: 'select', options: ['Core Banking', 'Agent Banking', 'Remittance', 'Payments', 'Mobile Money'] },
  { id: 'risk_score', label: 'Risk Score', type: 'range', min: 0, max: 100 },
  { id: 'region', label: 'Region', type: 'select', options: ['Lagos', 'Abuja', 'Kano', 'Port Harcourt', 'Ibadan', 'Enugu'] },
  { id: 'created_after', label: 'Created After', type: 'date' },
  { id: 'created_before', label: 'Created Before', type: 'date' },
];

const SAMPLE_RESULTS = [
  { id: 'cust-001', name: 'Fatima Ibrahim', phone: '+2348012345678', email: 'fatima@gmail.com', status: 'Active', kyc_level: 'Level 3', products: ['Core Banking', 'Agent Banking'], risk_score: 12, region: 'Lagos' },
  { id: 'cust-002', name: 'Adebayo Okonkwo', phone: '+2347098765432', email: 'adebayo@yahoo.com', status: 'Active', kyc_level: 'Level 2', products: ['Agent Banking'], risk_score: 25, region: 'Abuja' },
  { id: 'cust-003', name: 'Ngozi Okwu', phone: '+2349055566677', email: 'ngozi@outlook.com', status: 'Active', kyc_level: 'Level 3', products: ['Remittance', 'Payments'], risk_score: 8, region: 'Port Harcourt' },
  { id: 'cust-004', name: 'Musa Bello', phone: '+2348033344455', email: 'musa.b@gmail.com', status: 'Dormant', kyc_level: 'Level 1', products: ['Core Banking'], risk_score: 45, region: 'Kano' },
  { id: 'cust-005', name: 'Amina Mohammed', phone: '+2347066677788', email: 'amina.m@yahoo.com', status: 'Active', kyc_level: 'Level 2', products: ['Mobile Money'], risk_score: 18, region: 'Ibadan' },
];

const SAVED_SEARCHES = [
  { id: 's-001', name: 'High-risk dormant accounts', filters: 'risk_score > 40 AND status = Dormant', results: 234, last_used: '2025-05-04' },
  { id: 's-002', name: 'New customers — Lagos (30d)', filters: 'region = Lagos AND created_after = 2025-04-04', results: 1842, last_used: '2025-05-03' },
  { id: 's-003', name: 'KYC Level 1 pending upgrade', filters: 'kyc_level = Level 1 AND status = Active', results: 8500, last_used: '2025-05-01' },
];

export default function AdvancedSearch() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('advancedsearch', () => apiClient.dashboard.metrics(), { fallback: SEARCH_FIELDS })
  const { t } = useTranslation()
  const { tenantId } = useContext(TenantContext);
  const [activeFilters, setActiveFilters] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showFilters, setShowFilters] = useState(true);
  const [activeTab, setActiveTab] = useState('search');

  const addFilter = (field) => {
    if (!activeFilters.find(f => f.id === field.id)) {
      setActiveFilters([...activeFilters, { ...field, value: '' }]);
    }
  };

  const removeFilter = (fieldId) => {
    setActiveFilters(activeFilters.filter(f => f.id !== fieldId));
  };

  const handleSearch = () => {
    setResults(SAMPLE_RESULTS.filter(r => {
      if (searchQuery) return r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.phone.includes(searchQuery) || r.email.toLowerCase().includes(searchQuery.toLowerCase());
      return true;
    }));
  };

  return (
    <div role="region" aria-label="AdvancedSearch"  className="p-6 max-w-full">
      <div className="flex items-center gap-3 mb-6">
        <Search className="w-8 h-8 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Advanced Search</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Multi-field search across customers, transactions, and agents</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg w-fit">
        {['search', 'saved'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition ${activeTab === tab ? 'bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
            {tab === 'saved' ? 'Saved Searches' : 'Search'}
          </button>
        ))}
      </div>

      {activeTab === 'search' && (
        <>
          {/* Quick Search */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              <input type="text" placeholder="Quick search — name, phone, email, BVN, account number..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm" />
            </div>
            <button onClick={handleSearch} className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Search</button>
            <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1 px-4 py-2.5 border rounded-lg text-sm hover:bg-gray-50 dark:bg-gray-800">
              <Filter className="w-4 h-4" /> Filters {activeFilters.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-xs">{activeFilters.length}</span>}
            </button>
          </div>

          {showFilters && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter Fields</h3>
                <button className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"><Save className="w-3 h-3" /> Save Search</button>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {SEARCH_FIELDS.map(field => (
                  <button key={field.id} onClick={() => addFilter(field)}
                    className={`px-2 py-1 rounded text-xs border transition ${activeFilters.find(f => f.id === field.id) ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'hover:bg-gray-50 dark:bg-gray-800'}`}>
                    {field.label}
                  </button>
                ))}
              </div>
              {activeFilters.length > 0 && (
                <div className="space-y-2 pt-3 border-t">
                  {activeFilters.map(filter => (
                    <div key={filter.id} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-28">{filter.label}</span>
                      {filter.type === 'text' && <input type="text" placeholder={`Enter ${filter.label}...`} className="flex-1 px-2 py-1 border rounded text-sm" />}
                      {filter.type === 'select' && (
                        <select className="flex-1 px-2 py-1 border rounded text-sm">
                          <option>Any</option>
                          {filter.options?.map(o => <option key={o}>{o}</option>)}
                        </select>
                      )}
                      {filter.type === 'date' && <input type="date" className="flex-1 px-2 py-1 border rounded text-sm" />}
                      {filter.type === 'range' && <input type="range" min={filter.min} max={filter.max} className="flex-1" />}
                      <button onClick={() => removeFilter(filter.id)} className="p-1 hover:bg-gray-100 dark:bg-gray-700 rounded"><X className="w-3 h-3 text-gray-400" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">{results.length} results found</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Name</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Phone</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Status</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">KYC</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Products</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Risk</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Region</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(r => (
                    <tr key={r.id} className="border-b hover:bg-gray-50 dark:bg-gray-800 cursor-pointer">
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.phone}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${r.status === 'Active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>{r.status}</span></td>
                      <td className="px-4 py-3 text-xs">{r.kyc_level}</td>
                      <td className="px-4 py-3"><div className="flex gap-1">{r.products.map(p => <span key={p} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">{p}</span>)}</div></td>
                      <td className="px-4 py-3"><span className={`text-xs ${r.risk_score > 30 ? 'text-red-600' : 'text-green-600'}`}>{r.risk_score}</span></td>
                      <td className="px-4 py-3 text-xs">{r.region}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {results.length === 0 && searchQuery && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border p-8 text-center text-gray-400">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Press Enter or click Search to find results</p>
            </div>
          )}
        </>
      )}

      {activeTab === 'saved' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border">
          {SAVED_SEARCHES.map(search => (
            <div key={search.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0 hover:bg-gray-50 dark:bg-gray-800 cursor-pointer">
              <div className="flex items-center gap-3">
                <Star className="w-4 h-4 text-yellow-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{search.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{search.filters}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600 dark:text-gray-400">{search.results.toLocaleString()} results</p>
                <p className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {search.last_used}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
