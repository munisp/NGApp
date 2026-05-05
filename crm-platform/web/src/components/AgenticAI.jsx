import { useState, useContext } from 'react';
import { TenantContext } from '../contexts/TenantContext';
import { Bot, Brain, Shield, TrendingUp, Users, Zap, Activity, AlertTriangle, CheckCircle, Clock, DollarSign, Eye, Settings, Play, Pause, BarChart3, Target, Cpu, MessageSquare, Search as SearchIcon, FileText } from 'lucide-react';

const AGENTS = [
  {
    id: 'agent-customer-service', name: 'Customer Service Agent', icon: MessageSquare, color: 'from-blue-500 to-cyan-600', bgLight: 'bg-blue-50', textColor: 'text-blue-700',
    type: 'Autonomous', languages: 'Go + Python', autonomy: 'Level 3',
    description: '24/7 autonomous customer support across voice, chat, WhatsApp. Handles account inquiries, transaction disputes, product information, and escalations.',
    capabilities: ['Natural language understanding (English, Hausa, Yoruba, Igbo, Pidgin)', 'Account balance/transaction lookup', 'Card block/unblock', 'Transaction dispute filing', 'Product recommendation based on profile', 'Seamless human escalation with full context'],
    metrics: { resolution_time: '2.3 min', first_contact: '78%', csat: 4.2, interactions: '45K/mo' },
    status: 'active', decisions_today: 1245, accuracy: 96.8,
  },
  {
    id: 'agent-fraud-sentinel', name: 'Fraud Sentinel Agent', icon: Shield, color: 'from-red-500 to-rose-600', bgLight: 'bg-red-50', textColor: 'text-red-700',
    type: 'Autonomous', languages: 'Rust + Python', autonomy: 'Level 4',
    description: 'Real-time fraud detection and response. Monitors transactions, identifies anomalies, auto-blocks suspicious activity.',
    capabilities: ['Real-time transaction scoring (<5ms latency)', 'Behavioral anomaly detection (ML ensemble)', 'Auto-block compromised cards/accounts', 'Investigation case management', 'Pattern recognition across customer clusters', 'Regulatory reporting (STR/CTR auto-generation)'],
    metrics: { false_positive: '0.8%', detection_rate: '99.2%', response_time: '12ms', blocked: '₦2.8B/mo' },
    status: 'active', decisions_today: 8542, accuracy: 99.2,
  },
  {
    id: 'agent-compliance-officer', name: 'Compliance Officer Agent', icon: FileText, color: 'from-emerald-500 to-green-600', bgLight: 'bg-emerald-50', textColor: 'text-emerald-700',
    type: 'Semi-Autonomous', languages: 'Python + Go', autonomy: 'Level 3',
    description: 'Automated compliance monitoring, KYC/AML screening, regulatory reporting, and policy enforcement.',
    capabilities: ['KYC document verification (OCR + face match)', 'PEP/sanctions list screening', 'Transaction monitoring (AML/CFT rules)', 'Automated regulatory report generation (CBN, NDPC)', 'Policy change impact analysis', 'Compliance calendar management'],
    metrics: { kyc_time: '45 sec', false_match: '2.1%', reports: 142, score: '96.8%' },
    status: 'active', decisions_today: 3421, accuracy: 97.5,
  },
  {
    id: 'agent-revenue-optimizer', name: 'Revenue Optimizer Agent', icon: TrendingUp, color: 'from-violet-500 to-purple-600', bgLight: 'bg-violet-50', textColor: 'text-violet-700',
    type: 'Autonomous', languages: 'Python + TypeScript', autonomy: 'Level 3',
    description: 'AI-driven cross-sell/upsell engine. Identifies revenue opportunities, designs personalized offers, orchestrates campaigns.',
    capabilities: ['Next-best-product prediction (collaborative filtering)', 'Dynamic pricing optimization', 'Personalized offer generation', 'Multi-channel campaign orchestration', 'A/B test design and auto-promotion', 'Revenue attribution modeling'],
    metrics: { cross_sell: '12.5%', acceptance: '8.2%', revenue: '₦450M/mo', campaigns: 28 },
    status: 'active', decisions_today: 2156, accuracy: 91.2,
  },
  {
    id: 'agent-ops-commander', name: 'Operations Commander Agent', icon: Cpu, color: 'from-orange-500 to-amber-600', bgLight: 'bg-orange-50', textColor: 'text-orange-700',
    type: 'Semi-Autonomous', languages: 'Go + Rust', autonomy: 'Level 4',
    description: 'Infrastructure and operations management. Monitors system health, auto-scales services, manages incidents.',
    capabilities: ['Real-time system health monitoring', 'Auto-scaling based on load prediction', 'Incident detection and auto-remediation', 'Cost optimization (right-sizing, spot instances)', 'SLA breach prediction and prevention', 'Capacity planning and forecasting'],
    metrics: { uptime: '99.97%', mttr: '4.2 min', auto_resolved: '82%', savings: '₦12M/mo' },
    status: 'active', decisions_today: 456, accuracy: 98.1,
  },
  {
    id: 'agent-data-steward', name: 'Data Steward Agent', icon: Brain, color: 'from-indigo-500 to-blue-600', bgLight: 'bg-indigo-50', textColor: 'text-indigo-700',
    type: 'Autonomous', languages: 'Python + Rust', autonomy: 'Level 3',
    description: 'Master data quality management. Continuously monitors data quality, resolves duplicates, enriches records.',
    capabilities: ['Continuous data quality scoring', 'Automated duplicate detection and merge', 'Address standardization (Nigerian format)', 'BVN/NIN validation and enrichment', 'Data lineage tracking', 'Anomaly detection in data pipelines'],
    metrics: { quality: '94.2%', dupes_resolved: '12.5K', enriched: '45K', pipeline: '99.8%' },
    status: 'active', decisions_today: 5678, accuracy: 94.2,
  },
  {
    id: 'agent-market-intelligence', name: 'Market Intelligence Agent', icon: Eye, color: 'from-teal-500 to-cyan-600', bgLight: 'bg-teal-50', textColor: 'text-teal-700',
    type: 'Autonomous', languages: 'Python + TypeScript', autonomy: 'Level 2',
    description: 'Competitive intelligence and market analysis. Monitors competitor activity, tracks regulatory changes, analyzes trends.',
    capabilities: ['Competitor product/pricing monitoring', 'Regulatory change tracking (CBN, SEC, NDPC)', 'Social sentiment analysis', 'Market trend identification', 'Strategic recommendation generation', 'News and event impact assessment'],
    metrics: { insights: 85, accuracy: '91%', alerts: 230, actions: 12 },
    status: 'active', decisions_today: 892, accuracy: 91.0,
  },
];

const AUTONOMY_COLORS = { 'Level 2': 'bg-blue-100 text-blue-700', 'Level 3': 'bg-purple-100 text-purple-700', 'Level 4': 'bg-green-100 text-green-700' };
const STATUS_COLORS = { active: 'bg-green-100 text-green-700', paused: 'bg-yellow-100 text-yellow-700', maintenance: 'bg-gray-100 text-gray-600' };

export default function AgenticAI() {
  const { tenantId } = useContext(TenantContext);
  const [activeTab, setActiveTab] = useState('agents');
  const [selectedAgent, setSelectedAgent] = useState(null);

  const totalDecisions = AGENTS.reduce((s, a) => s + a.decisions_today, 0);
  const avgAccuracy = (AGENTS.reduce((s, a) => s + a.accuracy, 0) / AGENTS.length).toFixed(1);

  const tabs = [
    { id: 'agents', label: 'AI Agents', icon: Bot },
    { id: 'activity', label: 'Activity Feed', icon: Activity },
    { id: 'performance', label: 'Performance', icon: BarChart3 },
    { id: 'governance', label: 'Governance', icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bot className="w-7 h-7 text-violet-600" /> Agentic AI Platform
          </h1>
          <p className="text-gray-500 mt-1">Autonomous AI agents for customer service, fraud detection, compliance, revenue optimization, and operations</p>
        </div>
      </div>

      {/* System KPIs */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Active Agents', value: '7', icon: Bot, color: 'text-violet-600' },
          { label: 'Decisions Today', value: totalDecisions.toLocaleString(), icon: Zap, color: 'text-blue-600' },
          { label: 'Avg Accuracy', value: `${avgAccuracy}%`, icon: Target, color: 'text-green-600' },
          { label: 'Cost Savings', value: '₦462M/mo', icon: DollarSign, color: 'text-orange-600' },
          { label: 'Human Escalations', value: '142', icon: Users, color: 'text-red-600' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{kpi.label}</span>
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'agents' && (
        <div className="space-y-4">
          {AGENTS.map(agent => {
            const Icon = agent.icon;
            const expanded = selectedAgent === agent.id;
            return (
              <div key={agent.id} onClick={() => setSelectedAgent(expanded ? null : agent.id)} className="bg-white dark:bg-gray-800 rounded-xl border hover:shadow-md transition-all cursor-pointer">
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 bg-gradient-to-br ${agent.color} rounded-xl flex items-center justify-center`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{agent.name}</div>
                        <div className="text-xs text-gray-500">{agent.languages} · {agent.type}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[agent.status]}`}>{agent.status}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${AUTONOMY_COLORS[agent.autonomy]}`}>{agent.autonomy}</span>
                      <div className="text-right">
                        <div className="text-sm font-bold">{agent.decisions_today.toLocaleString()} decisions</div>
                        <div className="text-xs text-gray-500">{agent.accuracy}% accuracy</div>
                      </div>
                    </div>
                  </div>

                  {expanded && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-gray-600 mb-4">{agent.description}</p>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Capabilities</h4>
                          <ul className="space-y-1">
                            {agent.capabilities.map((c, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                                <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 shrink-0" /> {c}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Performance Metrics</h4>
                          <div className="grid grid-cols-2 gap-3">
                            {Object.entries(agent.metrics).map(([key, val]) => (
                              <div key={key} className={`p-2 rounded-lg ${agent.bgLight}`}>
                                <div className="text-xs text-gray-500 capitalize">{key.replace(/_/g, ' ')}</div>
                                <div className={`text-sm font-bold ${agent.textColor}`}>{val}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
          <h3 className="font-semibold mb-4">Recent Agent Activity</h3>
          <div className="space-y-3">
            {[
              { agent: 'Fraud Sentinel', action: 'Blocked suspicious transaction ₦4.5M from Lagos IP', time: '2 min ago', type: 'alert', icon: Shield },
              { agent: 'Customer Service', action: 'Resolved card dispute for Adebayo O. via WhatsApp (Yoruba)', time: '5 min ago', type: 'success', icon: MessageSquare },
              { agent: 'Revenue Optimizer', action: 'Launched personalized loan offer to 2,500 eligible customers', time: '12 min ago', type: 'campaign', icon: TrendingUp },
              { agent: 'Compliance Officer', action: 'Generated CBN monthly transaction report (142 pages)', time: '25 min ago', type: 'report', icon: FileText },
              { agent: 'Ops Commander', action: 'Auto-scaled payment service from 3→8 replicas (Black Friday load)', time: '32 min ago', type: 'ops', icon: Cpu },
              { agent: 'Data Steward', action: 'Merged 45 duplicate customer records (BVN-based match)', time: '45 min ago', type: 'data', icon: Brain },
              { agent: 'Market Intelligence', action: 'Alert: Competitor XYZ Bank launched 0% fee remittance corridor', time: '1 hour ago', type: 'alert', icon: Eye },
              { agent: 'Customer Service', action: 'Escalated high-value customer complaint to RM (Chinedu N.)', time: '1.5 hours ago', type: 'escalation', icon: Users },
              { agent: 'Fraud Sentinel', action: 'Identified coordinated fraud ring across 12 accounts', time: '2 hours ago', type: 'alert', icon: AlertTriangle },
              { agent: 'Revenue Optimizer', action: 'A/B test concluded: Variant B (WhatsApp) 2.3x better than SMS', time: '3 hours ago', type: 'insight', icon: BarChart3 },
            ].map((item, i) => {
              const Icon = item.icon;
              const typeColors = { alert: 'bg-red-100 text-red-700', success: 'bg-green-100 text-green-700', campaign: 'bg-purple-100 text-purple-700', report: 'bg-blue-100 text-blue-700', ops: 'bg-orange-100 text-orange-700', data: 'bg-indigo-100 text-indigo-700', escalation: 'bg-yellow-100 text-yellow-700', insight: 'bg-teal-100 text-teal-700' };
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${typeColors[item.type]}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm"><span className="font-medium">{item.agent}</span>: {item.action}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-1"><Clock className="w-3 h-3" /> {item.time}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
            <h3 className="font-semibold mb-4">Agent Accuracy Comparison</h3>
            <div className="space-y-3">
              {AGENTS.sort((a, b) => b.accuracy - a.accuracy).map(a => (
                <div key={a.id} className="flex items-center gap-3">
                  <div className="w-40 text-sm truncate">{a.name.replace(' Agent', '')}</div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden">
                      <div className={`bg-gradient-to-r ${a.color} h-full rounded-full flex items-center justify-end pr-2`} style={{ width: `${a.accuracy}%` }}>
                        <span className="text-xs text-white font-bold">{a.accuracy}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
            <h3 className="font-semibold mb-4">Decision Volume (Today)</h3>
            <div className="space-y-3">
              {AGENTS.sort((a, b) => b.decisions_today - a.decisions_today).map(a => {
                const Icon = a.icon;
                return (
                  <div key={a.id} className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-gray-400" />
                    <div className="w-40 text-sm truncate">{a.name.replace(' Agent', '')}</div>
                    <div className="flex-1 text-right text-sm font-bold">{a.decisions_today.toLocaleString()}</div>
                  </div>
                );
              })}
              <div className="pt-3 border-t flex justify-between font-bold">
                <span>Total</span>
                <span>{totalDecisions.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'governance' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
            <h3 className="font-semibold mb-4">Autonomy Levels</h3>
            <div className="space-y-4">
              {[
                { level: 'Level 2', desc: 'Monitors and recommends, human decides', agents: AGENTS.filter(a => a.autonomy === 'Level 2').map(a => a.name), color: 'bg-blue-500' },
                { level: 'Level 3', desc: 'Plans and executes, escalates edge cases', agents: AGENTS.filter(a => a.autonomy === 'Level 3').map(a => a.name), color: 'bg-purple-500' },
                { level: 'Level 4', desc: 'Fully autonomous with audit trail', agents: AGENTS.filter(a => a.autonomy === 'Level 4').map(a => a.name), color: 'bg-green-500' },
              ].map(l => (
                <div key={l.level} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-3 h-3 ${l.color} rounded-full`} />
                    <span className="font-medium text-sm">{l.level}</span>
                    <span className="text-xs text-gray-500">— {l.desc}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {l.agents.map(a => <span key={a} className="px-2 py-1 bg-white rounded text-xs font-medium">{a.replace(' Agent', '')}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
            <h3 className="font-semibold mb-4">Guardrails & Controls</h3>
            <div className="space-y-3">
              {[
                { rule: 'Budget approval required for campaigns >₦5M', status: 'active', agent: 'Revenue Optimizer' },
                { rule: 'Human review for KYC decisions with <70% confidence', status: 'active', agent: 'Compliance Officer' },
                { rule: 'Auto-escalate high-value customer complaints (>₦10M)', status: 'active', agent: 'Customer Service' },
                { rule: 'Fraud blocks >₦50M require manual confirmation', status: 'active', agent: 'Fraud Sentinel' },
                { rule: 'Data merges with <80% match confidence flagged for review', status: 'active', agent: 'Data Steward' },
                { rule: 'Infrastructure changes require approval during business hours', status: 'active', agent: 'Ops Commander' },
                { rule: 'All agent decisions logged with full audit trail', status: 'active', agent: 'All Agents' },
                { rule: 'Weekly human review of agent performance metrics', status: 'active', agent: 'All Agents' },
              ].map((r, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm">{r.rule}</div>
                    <div className="text-xs text-gray-500">{r.agent}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
