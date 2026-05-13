import { useState, useContext, useEffect } from 'react';
import { CheckSquare, Plus, Search, Clock, AlertTriangle, User, Filter, Calendar, Flag } from 'lucide-react';
import { TenantContext } from '../contexts/TenantContext';
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const SEED_TASKS = {
  'tenant-acme-bank': [
    { id: 'task-001', title: 'Review KYC for Adebayo Okonkwo', type: 'kyc_review', priority: 'high', status: 'open', assignee: 'Compliance Officer', due: '2025-05-05', sla_breached: false, related: 'customer/cust-4521', tags: ['kyc', 'urgent'] },
    { id: 'task-002', title: 'Approve Agent Onboarding — Lagos Zone', type: 'approval', priority: 'medium', status: 'in_progress', assignee: 'Operations Manager', due: '2025-05-06', sla_breached: false, related: 'agent/batch-42', tags: ['agent', 'onboarding'] },
    { id: 'task-003', title: 'Resolve disputed transaction TXN-4521', type: 'dispute', priority: 'critical', status: 'open', assignee: 'Dispute Handler', due: '2025-05-04', sla_breached: true, related: 'transaction/txn-4521', tags: ['dispute', 'urgent'] },
    { id: 'task-004', title: 'Monthly compliance report filing', type: 'compliance', priority: 'medium', status: 'review', assignee: 'Compliance Officer', due: '2025-05-10', sla_breached: false, related: 'compliance/monthly-05', tags: ['compliance', 'report'] },
    { id: 'task-005', title: 'Campaign review — Q2 Cross-sell', type: 'campaign', priority: 'low', status: 'open', assignee: 'Marketing Lead', due: '2025-05-15', sla_breached: false, related: 'campaign/q2-cross', tags: ['campaign'] },
    { id: 'task-006', title: 'Investigate failed login attempts', type: 'escalation', priority: 'high', status: 'in_progress', assignee: 'Security Team', due: '2025-05-04', sla_breached: false, related: 'security/alert-991', tags: ['security'] },
    { id: 'task-007', title: 'Update NDPR privacy policy', type: 'compliance', priority: 'medium', status: 'open', assignee: 'DPO', due: '2025-05-20', sla_breached: false, related: 'document/doc-001', tags: ['ndpr', 'policy'] },
    { id: 'task-008', title: 'Agent float reconciliation — Abuja', type: 'general', priority: 'medium', status: 'done', assignee: 'Finance Team', due: '2025-05-03', sla_breached: false, related: 'agent/abuja-zone', tags: ['reconciliation'] },
  ],
  'tenant-nextgen-mfb': [
    { id: 'task-n01', title: 'Complete technical onboarding', type: 'onboarding', priority: 'high', status: 'in_progress', assignee: 'Technical Lead', due: '2025-05-10', sla_breached: false, tags: ['onboarding'] },
  ],
};

const PRIORITY_COLORS = { critical: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700', medium: 'bg-blue-100 text-blue-700', low: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' };
const STATUS_COLORS = { open: 'bg-blue-50 text-blue-700', in_progress: 'bg-yellow-50 text-yellow-700', review: 'bg-purple-50 text-purple-700', done: 'bg-green-50 text-green-700', blocked: 'bg-red-50 text-red-700', cancelled: 'bg-gray-50 dark:bg-gray-800 text-gray-400' };

export default function TaskManager() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('taskmanager', () => apiClient.dashboard.metrics(), { fallback: SEED_TASKS })
  const { t } = useTranslation()
  const { tenantId } = useContext(TenantContext);
  const [tasks, setTasks] = useState(SEED_TASKS[tenantId] || []);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', type: 'general', priority: 'medium', assignee: '' });

  useEffect(() => { setTasks(SEED_TASKS[tenantId] || []); }, [tenantId]);

  const filtered = tasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (searchQuery) return t.title.toLowerCase().includes(searchQuery.toLowerCase());
    return true;
  });

  const stats = {
    total: tasks.length, open: tasks.filter(t => t.status === 'open').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    overdue: tasks.filter(t => t.sla_breached).length,
    done: tasks.filter(t => t.status === 'done').length,
  };

  const handleCreate = () => {
    if (!newTask.title) return;
    setTasks([{ id: `task-new-${Date.now()}`, ...newTask, status: 'open', due: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0], sla_breached: false, tags: [] }, ...tasks]);
    setNewTask({ title: '', type: 'general', priority: 'medium', assignee: '' });
    setShowCreate(false);
  };

  const updateStatus = (id, newStatus) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus } : t));
  };

  return (
    <div role="region" aria-label="TaskManager"  className="p-6 max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CheckSquare className="w-8 h-8 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Task Manager</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">KYC reviews, approvals, escalations, and SLA tracking</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
          <Plus className="w-4 h-4" /> New Task
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-900 dark:text-gray-100' },
          { label: 'Open', value: stats.open, color: 'text-blue-600' },
          { label: 'In Progress', value: stats.in_progress, color: 'text-yellow-600' },
          { label: 'SLA Breached', value: stats.overdue, color: 'text-red-600' },
          { label: 'Completed', value: stats.done, color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl p-4 border">
            <p className="text-sm text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border p-4 mb-6">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Create New Task</h3>
          <div className="grid grid-cols-4 gap-3">
            <input type="text" placeholder="Task title" value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm col-span-2" />
            <select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })} className="px-3 py-2 border rounded-lg text-sm">
              <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
            <button onClick={handleCreate} className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm">Create</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search tasks..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm" />
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
          {['all', 'open', 'in_progress', 'review', 'done'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded text-xs font-medium ${statusFilter === s ? 'bg-white dark:bg-gray-900 shadow' : 'text-gray-500 dark:text-gray-400'}`}>
              {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {filtered.map(task => (
          <div key={task.id} className={`bg-white dark:bg-gray-900 rounded-xl border p-4 hover:shadow-sm transition ${task.sla_breached ? 'border-red-200 bg-red-50/30' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <input type="checkbox" checked={task.status === 'done'} onChange={() => updateStatus(task.id, task.status === 'done' ? 'open' : 'done')}
                  className="mt-1 w-4 h-4 rounded border-gray-300 dark:border-gray-600" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'}`}>{task.title}</p>
                    {task.sla_breached && <span className="flex items-center gap-0.5 text-xs text-red-600"><AlertTriangle className="w-3 h-3" /> SLA Breached</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[task.status]}`}>{task.status.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-gray-400">{task.type.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><User className="w-3 h-3" /> {task.assignee}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {task.due}</span>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">No tasks match filters</div>}
      </div>
    </div>
  );
}
