import { useState, useContext } from 'react';
import { LayoutGrid, Settings, Plus, GripVertical, Eye, EyeOff, Save, RotateCcw, Palette } from 'lucide-react';
import { TenantContext } from '../contexts/TenantContext';
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const AVAILABLE_WIDGETS = [
  { id: 'customer-overview', name: 'Customer Overview', category: 'customers', size: '2x1', desc: 'Total customers, growth trend, active/dormant ratio' },
  { id: 'revenue-chart', name: 'Revenue Chart', category: 'finance', size: '2x2', desc: 'Revenue trend with product breakdown' },
  { id: 'agent-network', name: 'Agent Network', category: 'agents', size: '2x1', desc: 'Active agents, float balance, top performers' },
  { id: 'campaign-perf', name: 'Campaign Performance', category: 'marketing', size: '2x1', desc: 'Active campaigns, delivery rate, conversions' },
  { id: 'compliance-score', name: 'Compliance Score', category: 'compliance', size: '1x1', desc: 'Overall compliance across frameworks' },
  { id: 'security-status', name: 'Security Status', category: 'security', size: '1x1', desc: 'Threats blocked, WAF status, DDoS protection' },
  { id: 'sla-tracker', name: 'SLA Tracker', category: 'operations', size: '2x1', desc: 'SLA compliance rate, breaches, trend' },
  { id: 'remittance-flow', name: 'Remittance Flows', category: 'finance', size: '2x2', desc: 'Corridor volumes, exchange rates, settlement status' },
  { id: 'recent-activity', name: 'Recent Activity', category: 'general', size: '1x2', desc: 'Latest actions, events, and system alerts' },
  { id: 'kyc-pipeline', name: 'KYC Pipeline', category: 'compliance', size: '2x1', desc: 'Pending verifications, approval rate, bottlenecks' },
  { id: 'task-summary', name: 'Task Summary', category: 'operations', size: '1x1', desc: 'Open tasks, overdue, by priority' },
  { id: 'geo-map', name: 'Geographic Map', category: 'general', size: '2x2', desc: 'Customer and agent distribution map' },
];

const DEFAULT_LAYOUT = [
  { widgetId: 'customer-overview', visible: true, order: 0 },
  { widgetId: 'revenue-chart', visible: true, order: 1 },
  { widgetId: 'agent-network', visible: true, order: 2 },
  { widgetId: 'compliance-score', visible: true, order: 3 },
  { widgetId: 'security-status', visible: true, order: 4 },
  { widgetId: 'campaign-perf', visible: true, order: 5 },
  { widgetId: 'sla-tracker', visible: false, order: 6 },
  { widgetId: 'remittance-flow', visible: false, order: 7 },
  { widgetId: 'recent-activity', visible: true, order: 8 },
  { widgetId: 'kyc-pipeline', visible: false, order: 9 },
  { widgetId: 'task-summary', visible: true, order: 10 },
  { widgetId: 'geo-map', visible: false, order: 11 },
];

const ROLE_PRESETS = [
  { role: 'Tenant Admin', widgets: ['customer-overview', 'revenue-chart', 'agent-network', 'compliance-score', 'security-status', 'campaign-perf', 'recent-activity'] },
  { role: 'Compliance Officer', widgets: ['compliance-score', 'kyc-pipeline', 'sla-tracker', 'recent-activity', 'task-summary'] },
  { role: 'Marketing Manager', widgets: ['campaign-perf', 'customer-overview', 'revenue-chart', 'geo-map'] },
  { role: 'Operations Manager', widgets: ['agent-network', 'sla-tracker', 'task-summary', 'customer-overview', 'recent-activity'] },
  { role: 'Security Analyst', widgets: ['security-status', 'recent-activity', 'compliance-score'] },
];

export default function DashboardCustomization() {
  const { t } = useTranslation()
  const { tenantId } = useContext(TenantContext);
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [activeTab, setActiveTab] = useState('layout');
  const [hasChanges, setHasChanges] = useState(false);

  const toggleWidget = (widgetId) => {
    setLayout(layout.map(l => l.widgetId === widgetId ? { ...l, visible: !l.visible } : l));
    setHasChanges(true);
  };

  const applyPreset = (preset) => {
    setLayout(layout.map(l => ({ ...l, visible: preset.widgets.includes(l.widgetId) })));
    setHasChanges(true);
  };

  const visibleCount = layout.filter(l => l.visible).length;

  return (
    <div role="region" aria-label="DashboardCustomization"  className="p-6 max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <LayoutGrid className="w-8 h-8 text-gray-700" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard Customization</h1>
            <p className="text-sm text-gray-500">Configure widgets, layout, and role-based dashboard presets</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setLayout(DEFAULT_LAYOUT); setHasChanges(false); }}
            className="flex items-center gap-1 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
          <button disabled={!hasChanges}
            className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium ${hasChanges ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400'}`}>
            <Save className="w-4 h-4" /> Save Layout
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {['layout', 'presets'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition ${activeTab === tab ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
            {tab === 'presets' ? 'Role Presets' : tab}
          </button>
        ))}
      </div>

      {activeTab === 'layout' && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Widget Configuration</h3>
                <span className="text-xs text-gray-400">{visibleCount} of {AVAILABLE_WIDGETS.length} widgets active</span>
              </div>
              <div className="space-y-2">
                {layout.map(item => {
                  const widget = AVAILABLE_WIDGETS.find(w => w.id === item.widgetId);
                  if (!widget) return null;
                  return (
                    <div key={item.widgetId} className={`flex items-center justify-between p-3 rounded-lg border transition ${item.visible ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-gray-300 cursor-grab" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{widget.name}</p>
                          <p className="text-xs text-gray-400">{widget.desc}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">{widget.size}</span>
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded">{widget.category}</span>
                        <button onClick={() => toggleWidget(item.widgetId)}
                          className={`p-1 rounded ${item.visible ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                          {item.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-xl border p-4">
            <h3 className="font-medium text-gray-900 mb-3">Layout Preview</h3>
            <div className="grid grid-cols-4 gap-1">
              {layout.filter(l => l.visible).map(item => {
                const widget = AVAILABLE_WIDGETS.find(w => w.id === item.widgetId);
                const cols = widget?.size.startsWith('2') ? 'col-span-2' : 'col-span-1';
                const rows = widget?.size.endsWith('2') ? 'row-span-2' : 'row-span-1';
                return (
                  <div key={item.widgetId} className={`${cols} ${rows} bg-blue-50 border border-blue-200 rounded p-1.5`}>
                    <p className="text-[9px] text-blue-600 font-medium truncate">{widget?.name}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'presets' && (
        <div className="grid grid-cols-2 gap-4">
          {ROLE_PRESETS.map(preset => (
            <div key={preset.role} className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">{preset.role}</h3>
                <button onClick={() => applyPreset(preset)} className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Apply</button>
              </div>
              <div className="flex flex-wrap gap-1">
                {preset.widgets.map(wId => {
                  const widget = AVAILABLE_WIDGETS.find(w => w.id === wId);
                  return <span key={wId} className="px-2 py-0.5 bg-gray-100 rounded text-xs">{widget?.name}</span>;
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2">{preset.widgets.length} widgets</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
