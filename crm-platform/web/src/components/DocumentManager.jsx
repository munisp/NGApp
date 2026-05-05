import { useState, useContext, useEffect } from 'react';
import { FileText, Upload, Search, Filter, Download, Trash2, Eye, CheckCircle, Clock, XCircle, FolderOpen } from 'lucide-react';
import { TenantContext } from '../contexts/TenantContext';

const SEED_DOCS = {
  'tenant-acme-bank': [
    { id: 'doc-001', title: 'KYC Policy v3.2', category: 'kyc', status: 'approved', version: 3, size: '245 KB', mime: 'PDF', uploaded_by: 'Compliance Team', date: '2025-04-15', expires: '2026-04-15', tags: ['policy', 'kyc', 'compliance'] },
    { id: 'doc-002', title: 'Q1 2025 Audit Report', category: 'audit', status: 'approved', version: 1, size: '1.2 MB', mime: 'PDF', uploaded_by: 'External Auditor', date: '2025-04-01', tags: ['audit', 'quarterly'] },
    { id: 'doc-003', title: 'Agent Agreement Template', category: 'contract', status: 'approved', version: 5, size: '89 KB', mime: 'DOCX', uploaded_by: 'Legal Team', date: '2025-03-20', tags: ['contract', 'agent'] },
    { id: 'doc-004', title: 'NDPR Compliance Certificate', category: 'compliance', status: 'approved', version: 1, size: '56 KB', mime: 'PDF', uploaded_by: 'DPO', date: '2025-03-01', expires: '2026-03-01', tags: ['ndpr', 'certificate'] },
    { id: 'doc-005', title: 'Monthly Transaction Report', category: 'financial', status: 'draft', version: 1, size: '340 KB', mime: 'XLSX', uploaded_by: 'Finance Team', date: '2025-04-30', tags: ['report', 'transactions'] },
    { id: 'doc-006', title: 'Board Resolution - Q2 Budget', category: 'legal', status: 'pending_approval', version: 1, size: '125 KB', mime: 'PDF', uploaded_by: 'Company Secretary', date: '2025-04-28', tags: ['board', 'budget'] },
    { id: 'doc-007', title: 'CBN License Renewal', category: 'compliance', status: 'approved', version: 2, size: '780 KB', mime: 'PDF', uploaded_by: 'Regulatory Affairs', date: '2025-02-15', expires: '2026-02-15', tags: ['cbn', 'license'] },
    { id: 'doc-008', title: 'Employee Handbook v2025', category: 'operational', status: 'approved', version: 8, size: '2.1 MB', mime: 'PDF', uploaded_by: 'HR Team', date: '2025-01-10', tags: ['hr', 'handbook'] },
  ],
  'tenant-nextgen-mfb': [
    { id: 'doc-n01', title: 'Onboarding Checklist', category: 'onboarding', status: 'pending_approval', version: 1, size: '23 KB', mime: 'PDF', uploaded_by: 'Ops Team', date: '2025-04-20', tags: ['onboarding'] },
  ],
};

const CATEGORY_COLORS = {
  kyc: 'bg-blue-100 text-blue-700', compliance: 'bg-green-100 text-green-700', audit: 'bg-purple-100 text-purple-700',
  contract: 'bg-orange-100 text-orange-700', financial: 'bg-yellow-100 text-yellow-700', legal: 'bg-red-100 text-red-700',
  operational: 'bg-gray-100 text-gray-700', onboarding: 'bg-indigo-100 text-indigo-700', campaign: 'bg-pink-100 text-pink-700', report: 'bg-teal-100 text-teal-700',
};

const STATUS_CONFIG = {
  approved: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
  pending_approval: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  draft: { icon: FileText, color: 'text-gray-600', bg: 'bg-gray-100' },
  rejected: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
  archived: { icon: FolderOpen, color: 'text-gray-400', bg: 'bg-gray-50' },
};

export default function DocumentManager() {
  const { currentTenant } = useContext(TenantContext);
  const tenantId = currentTenant?.id || 'tenant-acme-bank';
  const [docs, setDocs] = useState(SEED_DOCS[tenantId] || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => { setDocs(SEED_DOCS[tenantId] || []); }, [tenantId]);

  const filtered = docs.filter(d => {
    if (categoryFilter !== 'all' && d.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (searchQuery) return d.title.toLowerCase().includes(searchQuery.toLowerCase()) || d.tags.some(t => t.includes(searchQuery.toLowerCase()));
    return true;
  });

  const stats = {
    total: docs.length,
    approved: docs.filter(d => d.status === 'approved').length,
    pending: docs.filter(d => d.status === 'pending_approval').length,
    expiring: docs.filter(d => d.expires).length,
  };

  return (
    <div className="p-6 max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Document Management</h1>
            <p className="text-sm text-gray-500">KYC documents, contracts, compliance certificates, and reports</p>
          </div>
        </div>
        <button onClick={() => setShowUpload(!showUpload)} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <Upload className="w-4 h-4" /> Upload Document
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Documents', value: stats.total, color: 'text-gray-900' },
          { label: 'Approved', value: stats.approved, color: 'text-green-600' },
          { label: 'Pending Approval', value: stats.pending, color: 'text-yellow-600' },
          { label: 'Expiring Soon', value: stats.expiring, color: 'text-orange-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 border">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {showUpload && (
        <div className="bg-white rounded-xl border p-4 mb-6">
          <h3 className="font-medium text-gray-900 mb-3">Upload New Document</h3>
          <div className="grid grid-cols-3 gap-4">
            <input type="text" placeholder="Document title" className="px-3 py-2 border rounded-lg text-sm" />
            <select className="px-3 py-2 border rounded-lg text-sm">
              <option>Select category</option>
              {Object.keys(CATEGORY_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <input type="file" className="text-sm" />
              <button className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">Upload</button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search documents..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm" />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="all">All Categories</option>
          {Object.keys(CATEGORY_COLORS).map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="all">All Statuses</option>
          {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {/* Document List */}
      <div className="bg-white rounded-xl border">
        {filtered.map(doc => {
          const statusCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.draft;
          const StatusIcon = statusCfg.icon;
          return (
            <div key={doc.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0 hover:bg-gray-50">
              <div className="flex items-center gap-3 flex-1">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <FileText className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{doc.title}</p>
                    <span className="text-xs text-gray-400">v{doc.version}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${CATEGORY_COLORS[doc.category] || 'bg-gray-100 text-gray-600'}`}>{doc.category}</span>
                    <span className="text-xs text-gray-400">{doc.size} • {doc.mime}</span>
                    <span className="text-xs text-gray-400">by {doc.uploaded_by}</span>
                    {doc.expires && <span className="text-xs text-orange-500">Expires: {doc.expires}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded ${statusCfg.bg} ${statusCfg.color}`}>
                  <StatusIcon className="w-3 h-3" /> {doc.status.replace(/_/g, ' ')}
                </span>
                <button className="p-1 hover:bg-gray-100 rounded"><Eye className="w-4 h-4 text-gray-400" /></button>
                <button className="p-1 hover:bg-gray-100 rounded"><Download className="w-4 h-4 text-gray-400" /></button>
                <button className="p-1 hover:bg-gray-100 rounded"><Trash2 className="w-4 h-4 text-gray-400" /></button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="px-4 py-8 text-center text-gray-400 text-sm">No documents found</div>}
      </div>
    </div>
  );
}
