import { useState, useContext, useEffect } from 'react';
import { ClipboardCheck, FileText, AlertTriangle, CheckCircle, XCircle, TrendingUp, Download, Shield } from 'lucide-react';
import { TenantContext } from '../contexts/TenantContext';

const FRAMEWORKS = [
  { id: 'ndpr', name: 'NDPR', full: 'Nigeria Data Protection Regulation', score: 93.8, total: 8, compliant: 7, partial: 1, non: 0, color: 'bg-green-500' },
  { id: 'cbn', name: 'CBN', full: 'Central Bank of Nigeria', score: 95.0, total: 10, compliant: 9, partial: 1, non: 0, color: 'bg-blue-500' },
  { id: 'pci_dss', name: 'PCI-DSS', full: 'Payment Card Industry', score: 93.8, total: 8, compliant: 7, partial: 1, non: 0, color: 'bg-purple-500' },
  { id: 'aml_cft', name: 'AML/CFT', full: 'Anti-Money Laundering', score: 100.0, total: 8, compliant: 8, partial: 0, non: 0, color: 'bg-indigo-500' },
];

const KYC_DATA = {
  total: 45230, bvn_verified: 43100, nin_verified: 41500, pep_screened: 45230, sanctions_screened: 45230,
  by_level: { level_1: 8500, level_2: 22730, level_3: 14000 },
  by_risk: { low: 38200, medium: 5800, high: 1230 },
};

const AML_DATA = {
  total_txns: 284500, suspicious: 142, sar_filed: 28, ctr_filed: 1250, avg_risk: 0.12,
  high_risk: 89, flagged_amount: 425000000,
};

export default function ComplianceDashboard() {
  const { currentTenant } = useContext(TenantContext);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedFramework, setSelectedFramework] = useState(null);

  const overallScore = (FRAMEWORKS.reduce((sum, f) => sum + f.score, 0) / FRAMEWORKS.length).toFixed(1);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: ClipboardCheck },
    { id: 'frameworks', label: 'Frameworks', icon: Shield },
    { id: 'kyc', label: 'KYC/AML', icon: FileText },
    { id: 'reports', label: 'Reports', icon: Download },
  ];

  return (
    <div className="p-6 max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="w-8 h-8 text-emerald-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Compliance Dashboard</h1>
            <p className="text-sm text-gray-500">NDPR, CBN, PCI-DSS, AML/CFT regulatory compliance monitoring</p>
          </div>
        </div>
        <button className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
          <Download className="w-4 h-4" /> Export Report
        </button>
      </div>

      {/* Score Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-green-600 rounded-xl p-6 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">Overall Compliance Score</p>
            <p className="text-5xl font-bold">{overallScore}%</p>
            <p className="text-sm opacity-80 mt-1">Across {FRAMEWORKS.length} regulatory frameworks</p>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {FRAMEWORKS.map(fw => (
              <div key={fw.id} className="bg-white/10 rounded-lg p-3 text-center min-w-[100px]">
                <p className="text-xl font-bold">{fw.score}%</p>
                <p className="text-xs opacity-80">{fw.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === tab.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-4">
          {FRAMEWORKS.map(fw => (
            <div key={fw.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-medium text-gray-900">{fw.name}</h3>
                  <p className="text-xs text-gray-500">{fw.full}</p>
                </div>
                <span className={`text-2xl font-bold ${fw.score >= 95 ? 'text-green-600' : fw.score >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>{fw.score}%</span>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden mb-3">
                <div className={`h-full ${fw.color} rounded-full`} style={{ width: `${fw.score}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" /> {fw.compliant} Compliant</span>
                <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-yellow-500" /> {fw.partial} Partial</span>
                <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" /> {fw.non} Non-compliant</span>
                <span>Total: {fw.total}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'frameworks' && (
        <div className="space-y-4">
          {FRAMEWORKS.map(fw => (
            <div key={fw.id} className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => setSelectedFramework(selectedFramework === fw.id ? null : fw.id)}>
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-8 rounded ${fw.color}`} />
                  <div>
                    <h3 className="font-medium text-gray-900">{fw.full}</h3>
                    <p className="text-xs text-gray-500">{fw.total} controls | {fw.compliant} compliant</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-gray-900">{fw.score}%</span>
              </div>
              {selectedFramework === fw.id && (
                <div className="p-4 bg-gray-50 text-sm">
                  <p className="text-gray-600 mb-2">All {fw.compliant} compliant controls are monitored continuously. {fw.partial > 0 ? `${fw.partial} control(s) require remediation.` : 'Full compliance achieved.'}</p>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 bg-white border rounded text-xs hover:bg-gray-50">View Details</button>
                    <button className="px-3 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700">Download Report</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'kyc' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <h3 className="font-medium text-gray-900 mb-4">KYC Verification Status</h3>
            <div className="space-y-3">
              {[
                { label: 'Total Customers', value: KYC_DATA.total.toLocaleString(), color: 'text-gray-900' },
                { label: 'BVN Verified', value: KYC_DATA.bvn_verified.toLocaleString(), pct: ((KYC_DATA.bvn_verified / KYC_DATA.total) * 100).toFixed(1), color: 'text-green-600' },
                { label: 'NIN Verified', value: KYC_DATA.nin_verified.toLocaleString(), pct: ((KYC_DATA.nin_verified / KYC_DATA.total) * 100).toFixed(1), color: 'text-green-600' },
                { label: 'PEP Screened', value: KYC_DATA.pep_screened.toLocaleString(), pct: '100.0', color: 'text-green-600' },
                { label: 'Sanctions Screened', value: KYC_DATA.sanctions_screened.toLocaleString(), pct: '100.0', color: 'text-green-600' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm text-gray-500">{item.label}</span>
                  <span className={`text-sm font-medium ${item.color}`}>{item.value} {item.pct && <span className="text-xs text-gray-400">({item.pct}%)</span>}</span>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <h4 className="text-xs text-gray-400 uppercase mb-2">By KYC Level</h4>
              <div className="flex gap-2">
                <div className="flex-1 bg-blue-50 rounded p-2 text-center"><p className="text-lg font-bold text-blue-600">{KYC_DATA.by_level.level_1.toLocaleString()}</p><p className="text-xs text-gray-500">Level 1</p></div>
                <div className="flex-1 bg-blue-50 rounded p-2 text-center"><p className="text-lg font-bold text-blue-600">{KYC_DATA.by_level.level_2.toLocaleString()}</p><p className="text-xs text-gray-500">Level 2</p></div>
                <div className="flex-1 bg-blue-50 rounded p-2 text-center"><p className="text-lg font-bold text-blue-600">{KYC_DATA.by_level.level_3.toLocaleString()}</p><p className="text-xs text-gray-500">Level 3</p></div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <h3 className="font-medium text-gray-900 mb-4">AML/CFT Monitoring</h3>
            <div className="space-y-3">
              {[
                { label: 'Total Transactions', value: AML_DATA.total_txns.toLocaleString() },
                { label: 'Suspicious Transactions', value: AML_DATA.suspicious, color: 'text-red-600' },
                { label: 'SARs Filed', value: AML_DATA.sar_filed },
                { label: 'CTRs Filed (> ₦5M)', value: AML_DATA.ctr_filed.toLocaleString() },
                { label: 'Avg Risk Score', value: AML_DATA.avg_risk.toFixed(2) },
                { label: 'High Risk Transactions', value: AML_DATA.high_risk, color: 'text-orange-600' },
                { label: 'Total Flagged Amount', value: `₦${(AML_DATA.flagged_amount / 1000000).toFixed(0)}M`, color: 'text-red-600' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm text-gray-500">{item.label}</span>
                  <span className={`text-sm font-medium ${item.color || 'text-gray-900'}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-medium text-gray-900 mb-4">Compliance Reports</h3>
          <div className="space-y-3">
            {[
              { name: 'NDPR Annual Compliance Report', date: '2025-04-01', status: 'Generated', framework: 'NDPR' },
              { name: 'CBN Quarterly Filing', date: '2025-03-31', status: 'Submitted', framework: 'CBN' },
              { name: 'PCI-DSS SAQ Assessment', date: '2025-02-15', status: 'Approved', framework: 'PCI-DSS' },
              { name: 'AML/CFT Risk Assessment', date: '2025-01-31', status: 'Filed', framework: 'AML/CFT' },
              { name: 'Monthly Transaction Monitoring', date: '2025-04-30', status: 'Generated', framework: 'CBN' },
            ].map((report, i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{report.name}</p>
                    <p className="text-xs text-gray-500">{report.framework} | {report.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-600">{report.status}</span>
                  <button className="p-1 hover:bg-gray-100 rounded"><Download className="w-4 h-4 text-gray-400" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
