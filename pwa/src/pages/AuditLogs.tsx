import { useState, useEffect } from 'react';

interface AuditLog {
  id: string;
  action: string;
  category: 'auth' | 'transaction' | 'profile' | 'security' | 'kyc' | 'admin';
  description: string;
  userId: string;
  userEmail: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  status: 'success' | 'failure' | 'pending';
}

interface AuditFilters {
  category: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  search: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<AuditFilters>({
    category: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    search: '',
  });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 20;

  useEffect(() => {
    loadLogs();
  }, [filters]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.category) params.append('category', filters.category);
      if (filters.status) params.append('status', filters.status);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.search) params.append('search', filters.search);

      const response = await fetch(`${API_BASE_URL}/api/audit/logs?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });

      if (response.ok) {
        setLogs(await response.json());
      } else {
        // Mock data
        setLogs([
          {
            id: '1',
            action: 'LOGIN',
            category: 'auth',
            description: 'User logged in successfully',
            userId: 'user-123',
            userEmail: 'john.doe@example.com',
            ipAddress: '102.89.xxx.xxx',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
            timestamp: new Date().toISOString(),
            status: 'success',
          },
          {
            id: '2',
            action: 'TRANSFER_INITIATED',
            category: 'transaction',
            description: 'Transfer of NGN 50,000 to Chioma Adeyemi initiated',
            userId: 'user-123',
            userEmail: 'john.doe@example.com',
            ipAddress: '102.89.xxx.xxx',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
            timestamp: new Date(Date.now() - 1800000).toISOString(),
            metadata: { amount: 50000, currency: 'NGN', recipient: 'Chioma Adeyemi' },
            status: 'success',
          },
          {
            id: '3',
            action: 'PASSWORD_CHANGE',
            category: 'security',
            description: 'Password was changed',
            userId: 'user-123',
            userEmail: 'john.doe@example.com',
            ipAddress: '102.89.xxx.xxx',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            status: 'success',
          },
          {
            id: '4',
            action: 'KYC_SUBMITTED',
            category: 'kyc',
            description: 'KYC documents submitted for verification',
            userId: 'user-123',
            userEmail: 'john.doe@example.com',
            ipAddress: '102.89.xxx.xxx',
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/605.1.15',
            timestamp: new Date(Date.now() - 172800000).toISOString(),
            metadata: { documentType: 'PASSPORT', tier: 2 },
            status: 'pending',
          },
          {
            id: '5',
            action: 'LOGIN_FAILED',
            category: 'auth',
            description: 'Failed login attempt - incorrect password',
            userId: 'user-123',
            userEmail: 'john.doe@example.com',
            ipAddress: '41.58.xxx.xxx',
            userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0',
            timestamp: new Date(Date.now() - 259200000).toISOString(),
            status: 'failure',
          },
          {
            id: '6',
            action: 'PROFILE_UPDATE',
            category: 'profile',
            description: 'Profile information updated',
            userId: 'user-123',
            userEmail: 'john.doe@example.com',
            ipAddress: '102.89.xxx.xxx',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
            timestamp: new Date(Date.now() - 345600000).toISOString(),
            metadata: { fields: ['phone', 'address'] },
            status: 'success',
          },
          {
            id: '7',
            action: '2FA_ENABLED',
            category: 'security',
            description: 'Two-factor authentication enabled',
            userId: 'user-123',
            userEmail: 'john.doe@example.com',
            ipAddress: '102.89.xxx.xxx',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
            timestamp: new Date(Date.now() - 432000000).toISOString(),
            status: 'success',
          },
          {
            id: '8',
            action: 'BENEFICIARY_ADDED',
            category: 'transaction',
            description: 'New beneficiary added: Emeka Okafor',
            userId: 'user-123',
            userEmail: 'john.doe@example.com',
            ipAddress: '102.89.xxx.xxx',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
            timestamp: new Date(Date.now() - 518400000).toISOString(),
            metadata: { beneficiaryName: 'Emeka Okafor', bank: 'Access Bank' },
            status: 'success',
          },
        ]);
      }
    } catch {
      // Use mock data on error
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const exportLogs = async (format: 'csv' | 'json') => {
    const data = format === 'json' 
      ? JSON.stringify(logs, null, 2)
      : [
          ['ID', 'Action', 'Category', 'Description', 'User', 'IP Address', 'Timestamp', 'Status'].join(','),
          ...logs.map(log => [
            log.id,
            log.action,
            log.category,
            `"${log.description}"`,
            log.userEmail,
            log.ipAddress,
            log.timestamp,
            log.status,
          ].join(','))
        ].join('\n');

    const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCategoryColor = (category: AuditLog['category']) => {
    switch (category) {
      case 'auth':
        return 'bg-blue-100 text-blue-700';
      case 'transaction':
        return 'bg-green-100 text-green-700';
      case 'profile':
        return 'bg-purple-100 text-purple-700';
      case 'security':
        return 'bg-red-100 text-red-700';
      case 'kyc':
        return 'bg-yellow-100 text-yellow-700';
      case 'admin':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status: AuditLog['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-700';
      case 'failure':
        return 'bg-red-100 text-red-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filters.category && log.category !== filters.category) return false;
    if (filters.status && log.status !== filters.status) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      if (
        !log.action.toLowerCase().includes(search) &&
        !log.description.toLowerCase().includes(search) &&
        !log.userEmail.toLowerCase().includes(search)
      ) {
        return false;
      }
    }
    return true;
  });

  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * logsPerPage,
    currentPage * logsPerPage
  );

  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-500">View and export your account activity history</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportLogs('csv')}
            className="btn-secondary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
          <button
            onClick={() => exportLogs('json')}
            className="btn-secondary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export JSON
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="input-field"
              placeholder="Search logs..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="input-field"
            >
              <option value="">All Categories</option>
              <option value="auth">Authentication</option>
              <option value="transaction">Transaction</option>
              <option value="profile">Profile</option>
              <option value="security">Security</option>
              <option value="kyc">KYC</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="input-field"
            >
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="input-field"
            />
          </div>
        </div>
        {(filters.category || filters.status || filters.search || filters.dateFrom || filters.dateTo) && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-gray-500">Active filters:</span>
            {filters.category && (
              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full flex items-center gap-1">
                {filters.category}
                <button onClick={() => setFilters({ ...filters, category: '' })} className="hover:text-gray-900">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {filters.status && (
              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full flex items-center gap-1">
                {filters.status}
                <button onClick={() => setFilters({ ...filters, status: '' })} className="hover:text-gray-900">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            <button
              onClick={() => setFilters({ category: '', status: '', dateFrom: '', dateTo: '', search: '' })}
              className="text-xs text-primary-600 hover:text-primary-700"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    No logs found matching your filters
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{log.action}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${getCategoryColor(log.category)}`}>
                        {log.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                      {log.description}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                      {log.ipAddress}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(log.status)}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-primary-600 hover:text-primary-700 text-sm"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {(currentPage - 1) * logsPerPage + 1} to{' '}
              {Math.min(currentPage * logsPerPage, filteredLogs.length)} of {filteredLogs.length} logs
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded-lg border text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
                if (page > totalPages) return null;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded-lg text-sm ${
                      currentPage === page
                        ? 'bg-primary-600 text-white'
                        : 'border hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded-lg border text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Log Details</h2>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${getCategoryColor(selectedLog.category)}`}>
                    {selectedLog.category}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(selectedLog.status)}`}>
                    {selectedLog.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Action</p>
                  <p className="font-medium text-gray-900">{selectedLog.action}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Description</p>
                  <p className="text-gray-900">{selectedLog.description}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">User</p>
                  <p className="text-gray-900">{selectedLog.userEmail}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">IP Address</p>
                  <p className="font-mono text-gray-900">{selectedLog.ipAddress}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">User Agent</p>
                  <p className="text-sm text-gray-900 break-all">{selectedLog.userAgent}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Timestamp</p>
                  <p className="text-gray-900">{formatDate(selectedLog.timestamp)}</p>
                </div>
                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Metadata</p>
                    <pre className="bg-gray-50 rounded-lg p-3 text-sm overflow-x-auto">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
