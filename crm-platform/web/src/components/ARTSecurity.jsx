import { useState } from 'react'
import { useTenant } from '../contexts/TenantContext'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const ARTSecurity = () => {
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('dashboard')

  const dashboard = {
    totalModels: 6, totalAttacks: 14, mitigated: 13, mitigationRate: 0.929,
    criticalVulnerabilities: 3, avgRobustness: 78.2, totalDefenses: 11,
    attackTypes: { evasion: 6, poisoning: 3, extraction: 2, inference: 3 },
    certificationSummary: { certified_robust: 3, certified_with_caveats: 1, needs_improvement: 1, not_tested: 1 },
  }

  const models = [
    { id: 'model-fraud-001', name: 'Transaction Fraud Detector', type: 'gradient_boosting', accuracy: 0.967, purpose: 'fraud_detection', status: 'deployed' },
    { id: 'model-churn-001', name: 'Customer Churn Predictor', type: 'neural_network', accuracy: 0.912, purpose: 'churn_prediction', status: 'deployed' },
    { id: 'model-score-001', name: 'Credit Risk Scorer', type: 'logistic_regression', accuracy: 0.884, purpose: 'credit_scoring', status: 'deployed' },
    { id: 'model-rec-001', name: 'Product Recommender', type: 'collaborative_filtering', accuracy: 0.845, purpose: 'recommendation', status: 'deployed' },
    { id: 'model-aml-001', name: 'AML Transaction Monitor', type: 'random_forest', accuracy: 0.938, purpose: 'aml_detection', status: 'deployed' },
    { id: 'model-sentiment-001', name: 'Customer Sentiment Analyzer', type: 'transformer', accuracy: 0.891, purpose: 'sentiment_analysis', status: 'staging' },
  ]

  const attacks = [
    { type: 'evasion', name: 'FGSM (Fast Gradient Sign)', model: 'model-fraud-001', successRate: 0.23, origAcc: 0.967, advAcc: 0.745, severity: 'high', mitigated: true },
    { type: 'evasion', name: 'PGD (Projected Gradient Descent)', model: 'model-fraud-001', successRate: 0.31, origAcc: 0.967, advAcc: 0.668, severity: 'critical', mitigated: true },
    { type: 'evasion', name: 'C&W Attack', model: 'model-fraud-001', successRate: 0.18, origAcc: 0.967, advAcc: 0.793, severity: 'high', mitigated: true },
    { type: 'evasion', name: 'DeepFool', model: 'model-churn-001', successRate: 0.42, origAcc: 0.912, advAcc: 0.531, severity: 'critical', mitigated: true },
    { type: 'poisoning', name: 'Clean-Label Poisoning', model: 'model-fraud-001', successRate: 0.08, origAcc: 0.967, advAcc: 0.892, severity: 'medium', mitigated: true },
    { type: 'poisoning', name: 'Backdoor Attack', model: 'model-churn-001', successRate: 0.12, origAcc: 0.912, advAcc: 0.804, severity: 'high', mitigated: true },
    { type: 'extraction', name: 'Copycat CNN', model: 'model-fraud-001', successRate: 0.67, origAcc: 0.967, advAcc: 0.967, severity: 'critical', mitigated: false },
    { type: 'inference', name: 'Membership Inference', model: 'model-fraud-001', successRate: 0.34, origAcc: 0.967, advAcc: 0.967, severity: 'high', mitigated: true },
    { type: 'inference', name: 'Attribute Inference', model: 'model-score-001', successRate: 0.22, origAcc: 0.884, advAcc: 0.884, severity: 'medium', mitigated: true },
  ]

  const defenses = [
    { name: 'Adversarial Training', model: 'Fraud Detector', cleanAcc: 0.952, robustAcc: 0.918, attack: 'FGSM + PGD', overhead: 2.3 },
    { name: 'Input Gradient Regularization', model: 'Fraud Detector', cleanAcc: 0.961, robustAcc: 0.935, attack: 'C&W Attack', overhead: 1.8 },
    { name: 'Feature Squeezing', model: 'Churn Predictor', cleanAcc: 0.908, robustAcc: 0.872, attack: 'DeepFool', overhead: 1.2 },
    { name: 'STRIP (Poison Detection)', model: 'Fraud Detector', cleanAcc: 0.967, robustAcc: 0.958, attack: 'Clean-Label Poisoning', overhead: 4.1 },
    { name: 'PATE (Privacy)', model: 'Fraud Detector', cleanAcc: 0.941, robustAcc: 0.941, attack: 'Membership Inference', overhead: 5.2 },
    { name: 'DP-SGD', model: 'Credit Scorer', cleanAcc: 0.862, robustAcc: 0.862, attack: 'Attribute Inference', overhead: 8.7 },
    { name: 'Watermarking', model: 'Fraud Detector', cleanAcc: 0.967, robustAcc: 0.967, attack: 'Copycat CNN', overhead: 0.1 },
  ]

  const reports = [
    { model: 'Transaction Fraud Detector', score: 87.4, tested: 6, mitigated: 5, status: 'certified_robust' },
    { model: 'Customer Churn Predictor', score: 78.2, tested: 4, mitigated: 4, status: 'certified_with_caveats' },
    { model: 'Credit Risk Scorer', score: 82.1, tested: 3, mitigated: 3, status: 'certified_robust' },
    { model: 'Product Recommender', score: 71.5, tested: 2, mitigated: 1, status: 'needs_improvement' },
    { model: 'AML Transaction Monitor', score: 84.8, tested: 1, mitigated: 1, status: 'certified_robust' },
    { model: 'Customer Sentiment Analyzer', score: 65.0, tested: 0, mitigated: 0, status: 'not_tested' },
  ]

  const sevColors = { critical: 'bg-red-100 text-red-800', high: 'bg-orange-100 text-orange-800', medium: 'bg-yellow-100 text-yellow-800' }
  const typeColors = { evasion: 'bg-red-50 text-red-700', poisoning: 'bg-purple-50 text-purple-700', extraction: 'bg-blue-50 text-blue-700', inference: 'bg-teal-50 text-teal-700' }
  const certColors = { certified_robust: 'bg-green-100 text-green-800', certified_with_caveats: 'bg-yellow-100 text-yellow-800', needs_improvement: 'bg-orange-100 text-orange-800', not_tested: 'bg-gray-100 text-gray-800' }

  const tabs = [
    { key: 'dashboard', label: 'Security Dashboard' },
    { key: 'models', label: 'ML Models' },
    { key: 'attacks', label: 'Attack Results' },
    { key: 'defenses', label: 'Defenses' },
    { key: 'reports', label: 'Robustness Reports' },
  ]

  return (
    <div role="region" aria-label="ARTSecurity"  className="space-y-6" data-tenant={tenant?.id}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ART — ML Model Security</h1>
          <p className="text-gray-500 mt-1">Adversarial Robustness Toolbox: evasion, poisoning, extraction & inference defense</p>
        </div>
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">IBM ART v1.20</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">ML Models</p>
          <p className="text-3xl font-bold text-blue-600">{dashboard.totalModels}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Attacks Tested</p>
          <p className="text-3xl font-bold text-red-600">{dashboard.totalAttacks}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Mitigated</p>
          <p className="text-3xl font-bold text-green-600">{dashboard.mitigated}/{dashboard.totalAttacks}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Avg Robustness</p>
          <p className="text-3xl font-bold text-purple-600">{dashboard.avgRobustness}%</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Active Defenses</p>
          <p className="text-3xl font-bold text-teal-600">{dashboard.totalDefenses}</p>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex space-x-4">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === tab.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3">Attack Type Distribution</h3>
            {Object.entries(dashboard.attackTypes).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${typeColors[type]}`}>{type}</span>
                <span className="font-medium">{count} attacks</span>
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3">Certification Status</h3>
            {Object.entries(dashboard.certificationSummary).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className={`px-2 py-1 rounded text-xs font-medium ${certColors[status]}`}>{status.replace(/_/g, ' ')}</span>
                <span className="font-medium">{count} models</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'models' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map((m, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex justify-between items-start">
                <h4 className="font-semibold text-sm">{m.name}</h4>
                <span className={`px-2 py-1 rounded text-xs font-medium ${m.status === 'deployed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{m.status}</span>
              </div>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Type</dt><dd className="font-mono text-xs">{m.type}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Accuracy</dt><dd>{(m.accuracy * 100).toFixed(1)}%</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Purpose</dt><dd className="text-xs">{m.purpose}</dd></div>
              </dl>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'attacks' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">Attack</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Target</th>
                <th className="px-4 py-3 text-left">Severity</th>
                <th className="px-4 py-3 text-left">Success Rate</th>
                <th className="px-4 py-3 text-left">Accuracy Drop</th>
                <th className="px-4 py-3 text-left">Mitigated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {attacks.map((a, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 font-medium">{a.name}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs ${typeColors[a.type]}`}>{a.type}</span></td>
                  <td className="px-4 py-3 text-xs font-mono">{a.model}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${sevColors[a.severity]}`}>{a.severity}</span></td>
                  <td className="px-4 py-3">{(a.successRate * 100).toFixed(0)}%</td>
                  <td className="px-4 py-3 text-red-600">{a.origAcc !== a.advAcc ? `-${((a.origAcc - a.advAcc) * 100).toFixed(1)}%` : '—'}</td>
                  <td className="px-4 py-3">{a.mitigated ? <span className="text-green-600 font-medium">Yes</span> : <span className="text-red-600 font-medium">No</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'defenses' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">Defense</th>
                <th className="px-4 py-3 text-left">Model</th>
                <th className="px-4 py-3 text-left">Clean Acc</th>
                <th className="px-4 py-3 text-left">Robust Acc</th>
                <th className="px-4 py-3 text-left">Trade-off</th>
                <th className="px-4 py-3 text-left">Defends Against</th>
                <th className="px-4 py-3 text-left">Overhead</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {defenses.map((d, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 font-medium">{d.name}</td>
                  <td className="px-4 py-3">{d.model}</td>
                  <td className="px-4 py-3">{(d.cleanAcc * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3">{(d.robustAcc * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-orange-600">{d.cleanAcc > d.robustAcc ? `-${((d.cleanAcc - d.robustAcc) * 100).toFixed(1)}%` : '0%'}</td>
                  <td className="px-4 py-3 text-xs">{d.attack}</td>
                  <td className="px-4 py-3">{d.overhead}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((r, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex justify-between items-start">
                <h4 className="font-semibold text-sm">{r.model}</h4>
                <span className={`px-2 py-1 rounded text-xs font-medium ${certColors[r.status]}`}>{r.status.replace(/_/g, ' ')}</span>
              </div>
              <div className="mt-3">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-3xl font-bold">{r.score}</span>
                  <span className="text-gray-500 text-sm">/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className={`h-2 rounded-full ${r.score > 80 ? 'bg-green-500' : r.score > 70 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{width: `${r.score}%`}}></div>
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-500">
                {r.tested} attacks tested, {r.mitigated} mitigated
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-gray-800 dark:to-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200">Technology Value — ART (Adversarial Robustness Toolbox)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm text-gray-700 dark:text-gray-300">
          <ul className="space-y-1">
            <li>• Protects fraud detection from evasion (adversarial transactions bypass detection)</li>
            <li>• Prevents model poisoning via tampered training data injection</li>
            <li>• Detects model extraction (competitor stealing your fraud model via queries)</li>
          </ul>
          <ul className="space-y-1">
            <li>• Guards customer PII against inference attacks (membership, attribute)</li>
            <li>• Robustness certification for CBN/NDPR regulatory compliance</li>
            <li>• Red team / blue team framework for continuous ML security auditing</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default ARTSecurity
