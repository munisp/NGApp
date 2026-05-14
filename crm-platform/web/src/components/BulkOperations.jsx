import { useState, useContext } from 'react';
import { Layers, Upload, CheckSquare, Send, UserPlus, RefreshCw, AlertTriangle, FileText, ArrowRight } from 'lucide-react';
import { TenantContext } from '../contexts/TenantContext';
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const OPERATIONS = [
  { id: 'import_customers', name: 'Bulk Customer Import', icon: UserPlus, desc: 'Import customer records from CSV/XLSX', fields: ['name', 'phone', 'email', 'bvn', 'address', 'kyc_level'] },
  { id: 'bulk_approve', name: 'Bulk KYC Approval', icon: CheckSquare, desc: 'Approve multiple pending KYC applications', fields: ['kyc_request_id', 'status', 'notes'] },
  { id: 'bulk_notify', name: 'Bulk Notifications', icon: Send, desc: 'Send messages to customer segments', fields: ['customer_segment', 'channel', 'template', 'message'] },
  { id: 'bulk_update', name: 'Bulk Status Update', icon: RefreshCw, desc: 'Update status for multiple records', fields: ['entity_type', 'entity_ids', 'new_status'] },
  { id: 'bulk_deactivate', name: 'Bulk Deactivation', icon: AlertTriangle, desc: 'Deactivate dormant accounts per CBN guideline', fields: ['criteria', 'inactive_days', 'notify'] },
];

const RECENT_JOBS = [
  { id: 'job-001', operation: 'Bulk Customer Import', records: 1250, success: 1238, failed: 12, status: 'completed', date: '2025-05-04 10:30', duration: '2m 15s' },
  { id: 'job-002', operation: 'Bulk KYC Approval', records: 89, success: 89, failed: 0, status: 'completed', date: '2025-05-03 16:00', duration: '12s' },
  { id: 'job-003', operation: 'Bulk Notifications', records: 12500, success: 12312, failed: 188, status: 'completed', date: '2025-05-02 09:00', duration: '5m 42s' },
];

export default function BulkOperations() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('bulkoperations', () => apiClient.dashboard.metrics(), { fallback: OPERATIONS })
  const { t } = useTranslation()
  const { tenantId } = useContext(TenantContext);
  const [selectedOp, setSelectedOp] = useState(null);
  const [activeTab, setActiveTab] = useState('operations');
  const [uploadFile, setUploadFile] = useState(null);

  const handleCreateOperation = (e) => {
    e.preventDefault()
    const newOperation = { id: 'operation-' + Date.now(), ...formData, createdAt: new Date().toISOString(), status: 'active' }
    setFormData({})
    setShowCreateOperation(false)
  }

  return (
    <div role="region" aria-label="BulkOperations"  className="p-6 max-w-full">
      <div className="flex items-center gap-3 mb-6">
        <Layers className="w-8 h-8 text-violet-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bulk Operations</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Customer import, batch KYC approval, bulk notifications, and mass updates</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg w-fit">
        {['operations', 'history'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition ${activeTab === tab ? 'bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>{tab}</button>
        ))}
      </div>

      {activeTab === 'operations' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="col-span-1 space-y-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Available Operations</h3>
            {OPERATIONS.map(op => (
              <button key={op.id} onClick={() => setSelectedOp(op)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition ${selectedOp?.id === op.id ? 'border-violet-500 bg-violet-50' : 'hover:bg-gray-50 dark:bg-gray-800'}`}>
                <op.icon className={`w-5 h-5 ${selectedOp?.id === op.id ? 'text-violet-600' : 'text-gray-400'}`} />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{op.name}</p>
                  <p className="text-xs text-gray-400">{op.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="col-span-2">
            {selectedOp ? (
              <div className="bg-white dark:bg-gray-900 rounded-xl border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <selectedOp.icon className="w-6 h-6 text-violet-600" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{selectedOp.name}</h3>
                </div>

                {selectedOp.id === 'import_customers' && (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed rounded-xl p-8 text-center hover:border-violet-400 transition cursor-pointer">
                      <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">Drop CSV or XLSX file here</p>
                      <p className="text-xs text-gray-400 mt-1">Max 50,000 records per batch</p>
                      <input type="file" accept=".csv,.xlsx" className="mt-3 text-sm" onChange={e => setUploadFile(e.target.files[0])} />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Expected Fields</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedOp.fields.map(f => (
                          <span key={f} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">{f}</span>
                        ))}
                      </div>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-xs text-yellow-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Duplicate BVNs will be flagged for manual review. Existing records will not be overwritten.</p>
                    </div>
                  </div>
                )}

                {selectedOp.id === 'bulk_approve' && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Approve pending KYC applications in bulk. Only Level 1 and Level 2 KYC can be bulk-approved.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">KYC Level</label>
                        <select className="w-full px-3 py-2 border rounded-lg text-sm">
                          <option>Level 1 — Basic</option><option>Level 2 — Standard</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Pending Since</label>
                        <select className="w-full px-3 py-2 border rounded-lg text-sm">
                          <option>Last 24 hours</option><option>Last 7 days</option><option>Last 30 days</option>
                        </select>
                      </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-700">42 pending Level 1 KYC applications found matching criteria</p>
                    </div>
                  </div>
                )}

                {selectedOp.id === 'bulk_notify' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Channel</label>
                        <select className="w-full px-3 py-2 border rounded-lg text-sm">
                          <option>SMS</option><option>WhatsApp</option><option>Email</option><option>All Channels</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Segment</label>
                        <select className="w-full px-3 py-2 border rounded-lg text-sm">
                          <option>All Customers</option><option>Active — Last 30 days</option><option>Dormant — 90+ days</option><option>High Value — Top 10%</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Message</label>
                      <textarea rows={3} placeholder="Type your message..." className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                  </div>
                )}

                {(selectedOp.id === 'bulk_update' || selectedOp.id === 'bulk_deactivate') && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedOp.desc}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Entity Type</label>
                        <select className="w-full px-3 py-2 border rounded-lg text-sm">
                          <option>Customers</option><option>Agents</option><option>Accounts</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">New Status</label>
                        <select className="w-full px-3 py-2 border rounded-lg text-sm">
                          <option>Active</option><option>Inactive</option><option>Suspended</option><option>Dormant</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <button className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700">
                  <ArrowRight className="w-4 h-4" /> Execute {selectedOp.name}
                </button>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-900 rounded-xl border p-8 text-center text-gray-400">
                <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select an operation from the left panel</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border">
          <div className="overflow-x-auto"><table className="min-w-full w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-gray-500 dark:text-gray-400">Operation</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 dark:text-gray-400">Records</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 dark:text-gray-400">Success</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 dark:text-gray-400">Failed</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 dark:text-gray-400">Date</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 dark:text-gray-400">Duration</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_JOBS.map(job => (
                <tr key={job.id} className="border-b hover:bg-gray-50 dark:bg-gray-800">
                  <td className="px-4 py-3 font-medium">{job.operation}</td>
                  <td className="px-4 py-3">{job.records.toLocaleString()}</td>
                  <td className="px-4 py-3 text-green-600">{job.success.toLocaleString()}</td>
                  <td className="px-4 py-3">{job.failed > 0 ? <span className="text-red-600">{job.failed}</span> : <span className="text-green-600">0</span>}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{job.date}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{job.duration}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
