import { useState, useContext } from 'react';
import { Download, Database, FileText, Table, Settings, Clock, CheckCircle, Play, Trash2 } from 'lucide-react';
import { TenantContext } from '../contexts/TenantContext';
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const EXPORT_TYPES = [
  { id: 'customers', name: 'Customer Records', icon: '👤', fields: ['customer_id', 'name', 'email', 'phone', 'bvn_hash', 'status', 'risk_score', 'kyc_level', 'products', 'created_at'], estimated: '45,230 records' },
  { id: 'transactions', name: 'Transaction History', icon: '💳', fields: ['transaction_id', 'amount', 'currency', 'type', 'status', 'channel', 'timestamp'], estimated: '284,500 records' },
  { id: 'agents', name: 'Agent Network', icon: '🏪', fields: ['agent_id', 'name', 'location', 'float_balance', 'status', 'commission_earned', 'activated_at'], estimated: '2,847 records' },
  { id: 'campaigns', name: 'Campaign Data', icon: '📢', fields: ['campaign_id', 'name', 'channel', 'sent', 'delivered', 'opened', 'converted', 'revenue'], estimated: '142 campaigns' },
  { id: 'audit_logs', name: 'Audit Trail', icon: '🔐', fields: ['event_id', 'actor', 'action', 'resource', 'category', 'severity', 'timestamp'], estimated: '1.2M events' },
  { id: 'compliance', name: 'Compliance Reports', icon: '📋', fields: ['framework', 'control', 'status', 'score', 'assessed_at', 'findings'], estimated: '34 assessments' },
];

const FORMATS = [
  { id: 'csv', name: 'CSV', icon: Table, desc: 'Comma-separated values — universal compatibility' },
  { id: 'json', name: 'JSON', icon: FileText, desc: 'Structured data — API consumption' },
  { id: 'parquet', name: 'Parquet', icon: Database, desc: 'Columnar format — analytics/data warehouse' },
];

const RECENT_EXPORTS = [
  { id: 'exp-001', type: 'Customer Records', format: 'CSV', records: 45230, size: '12.4 MB', status: 'completed', date: '2025-05-04 12:00', duration: '8s' },
  { id: 'exp-002', type: 'Transaction History', format: 'Parquet', records: 284500, size: '45.2 MB', status: 'completed', date: '2025-05-03 18:30', duration: '24s' },
  { id: 'exp-003', type: 'Audit Trail', format: 'JSON', records: 1200000, size: '890 MB', status: 'completed', date: '2025-05-01 09:00', duration: '2m 15s' },
];

export default function DataExport() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('dataexport', () => apiClient.dashboard.metrics(), { fallback: EXPORT_TYPES })
  const { t } = useTranslation()
  const { tenantId } = useContext(TenantContext);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState('csv');
  const [selectedFields, setSelectedFields] = useState([]);
  const [dateRange, setDateRange] = useState({ from: '2025-01-01', to: '2025-05-04' });
  const [activeTab, setActiveTab] = useState('new');

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    setSelectedFields(type.fields);
  };

  const toggleField = (field) => {
    setSelectedFields(prev => prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]);
  };

  return (
    <div role="region" aria-label="DataExport"  className="p-6 max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Download className="w-8 h-8 text-teal-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Data Export</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Export customer data, transactions, audit logs in CSV, JSON, or Parquet</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg w-fit">
        {['new', 'history'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition ${activeTab === tab ? 'bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>{tab === 'new' ? 'New Export' : 'Export History'}</button>
        ))}
      </div>

      {activeTab === 'new' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Step 1: Data Type */}
          <div className="col-span-2 space-y-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">1. Select Data Type</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {EXPORT_TYPES.map(type => (
                  <button key={type.id} onClick={() => handleTypeSelect(type)}
                    className={`p-3 rounded-lg border text-left transition ${selectedType?.id === type.id ? 'border-teal-500 bg-teal-50' : 'hover:bg-gray-50 dark:bg-gray-800'}`}>
                    <span className="text-2xl">{type.icon}</span>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">{type.name}</p>
                    <p className="text-xs text-gray-400">{type.estimated}</p>
                  </button>
                ))}
              </div>
            </div>

            {selectedType && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">2. Select Fields</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedType.fields.map(field => (
                    <button key={field} onClick={() => toggleField(field)}
                      className={`px-3 py-1 rounded-full text-xs font-mono transition ${selectedFields.includes(field) ? 'bg-teal-100 text-teal-700 border border-teal-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-transparent'}`}>
                      {field}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">{selectedFields.length} of {selectedType.fields.length} fields selected</p>
              </div>
            )}

            <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">3. Date Range</h3>
              <div className="flex gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">From</label>
                  <input type="date" value={dateRange.from} onChange={e => setDateRange({ ...dateRange, from: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">To</label>
                  <input type="date" value={dateRange.to} onChange={e => setDateRange({ ...dateRange, to: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar: Format + Export */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">4. Export Format</h3>
              <div className="space-y-2">
                {FORMATS.map(fmt => (
                  <button key={fmt.id} onClick={() => setSelectedFormat(fmt.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition ${selectedFormat === fmt.id ? 'border-teal-500 bg-teal-50' : 'hover:bg-gray-50 dark:bg-gray-800'}`}>
                    <fmt.icon className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{fmt.name}</p>
                      <p className="text-xs text-gray-400">{fmt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button disabled={!selectedType} className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${selectedType ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
              <Play className="w-4 h-4" /> Start Export
            </button>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border">
          <div className="overflow-x-auto"><table className="min-w-full w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-gray-500 dark:text-gray-400">Data Type</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 dark:text-gray-400">Format</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 dark:text-gray-400">Records</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 dark:text-gray-400">Size</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 dark:text-gray-400">Date</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 dark:text-gray-400">Duration</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_EXPORTS.map(exp => (
                <tr key={exp.id} className="border-b hover:bg-gray-50 dark:bg-gray-800">
                  <td className="px-4 py-3 font-medium">{exp.type}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">{exp.format}</span></td>
                  <td className="px-4 py-3">{exp.records.toLocaleString()}</td>
                  <td className="px-4 py-3">{exp.size}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{exp.date}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{exp.duration}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button className="p-1 hover:bg-gray-100 dark:bg-gray-700 rounded"><Download className="w-4 h-4 text-gray-400" /></button>
                      <button className="p-1 hover:bg-gray-100 dark:bg-gray-700 rounded"><Trash2 className="w-4 h-4 text-gray-400" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
