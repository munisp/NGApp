import { useState } from 'react'
import { useTenant } from '../contexts/TenantContext'

const MCMCRisk = () => {
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('individual')

  const creditResults = [
    { id: 'C001', name: 'Adamu Ibrahim', meanPd: 0.028, stdPd: 0.008, var95: 0.042, var99: 0.058, expectedLoss: 42000, grade: 'AA', ci: [0.012, 0.048], acceptance: 0.38 },
    { id: 'C002', name: 'Fatima Bello', meanPd: 0.089, stdPd: 0.022, var95: 0.128, var99: 0.165, expectedLoss: 7120, grade: 'A', ci: [0.048, 0.138], acceptance: 0.35 },
    { id: 'C003', name: 'Chinedu Okafor', meanPd: 0.018, stdPd: 0.006, var95: 0.029, var99: 0.038, expectedLoss: 13500, grade: 'AAA', ci: [0.007, 0.032], acceptance: 0.41 },
    { id: 'C004', name: 'Aisha Mohammed', meanPd: 0.312, stdPd: 0.045, var95: 0.395, var99: 0.428, expectedLoss: 28080, grade: 'BB', ci: [0.225, 0.405], acceptance: 0.32 },
    { id: 'C005', name: 'Emeka Nwosu', meanPd: 0.022, stdPd: 0.007, var95: 0.035, var99: 0.045, expectedLoss: 11000, grade: 'AA', ci: [0.009, 0.038], acceptance: 0.39 },
    { id: 'C006', name: 'Grace Adeyemi', meanPd: 0.095, stdPd: 0.028, var95: 0.148, var99: 0.185, expectedLoss: 2375, grade: 'A', ci: [0.042, 0.155], acceptance: 0.34 },
    { id: 'C007', name: 'Bola Ogundimu', meanPd: 0.185, stdPd: 0.035, var95: 0.248, var99: 0.295, expectedLoss: 25900, grade: 'BBB', ci: [0.118, 0.258], acceptance: 0.33 },
    { id: 'C008', name: 'Ngozi Eze', meanPd: 0.015, stdPd: 0.005, var95: 0.024, var99: 0.032, expectedLoss: 9375, grade: 'AAA', ci: [0.006, 0.027], acceptance: 0.42 },
  ]

  const portfolio = {
    totalExposure: 9750000,
    expectedLoss: 139350,
    unexpectedLoss: 250830,
    var95: 553720,
    var99: 824284,
    concentrationRisk: 3750,
    diversificationBenefit: 20902,
  }

  const stressTests = [
    { name: 'CBN Stress Test — Mild Recession', severity: 'moderate', pdMult: 1.5, lgdMult: 1.2, loss: 250830, lossPct: 2.57 },
    { name: 'Naira Devaluation (30%)', severity: 'severe', pdMult: 2.0, lgdMult: 1.5, loss: 418050, lossPct: 4.29 },
    { name: 'Oil Price Collapse', severity: 'extreme', pdMult: 3.0, lgdMult: 1.8, loss: 752490, lossPct: 7.72 },
    { name: 'Pandemic Lockdown', severity: 'extreme', pdMult: 2.5, lgdMult: 2.0, loss: 696750, lossPct: 7.15 },
  ]

  const riskContributions = [
    { segment: 'premium', exposure: 7000000, expectedLoss: 75875, contributionPct: 54.5 },
    { segment: 'standard', exposure: 700000, expectedLoss: 61100, contributionPct: 43.8 },
    { segment: 'basic', exposure: 50000, expectedLoss: 2375, contributionPct: 1.7 },
  ]

  const gradeColors = { AAA: 'bg-emerald-100 text-emerald-800', AA: 'bg-green-100 text-green-800', A: 'bg-lime-100 text-lime-800', BBB: 'bg-yellow-100 text-yellow-800', BB: 'bg-orange-100 text-orange-800', B: 'bg-red-100 text-red-800', CCC: 'bg-red-200 text-red-900' }
  const severityColors = { moderate: 'bg-yellow-100 text-yellow-800', severe: 'bg-orange-100 text-orange-800', extreme: 'bg-red-100 text-red-800' }

  const tabs = [
    { key: 'individual', label: 'Credit Risk Scores' },
    { key: 'portfolio', label: 'Portfolio Risk' },
    { key: 'stress', label: 'Stress Testing' },
  ]

  return (
    <div className="space-y-6" data-tenant={tenant?.id}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">GNN + MCMC — Probabilistic Risk</h1>
          <p className="text-gray-500 mt-1">Bayesian credit risk via Metropolis-Hastings MCMC with Beta(2,20) prior</p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">5,000 MCMC Iterations</span>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">1,000 Burn-in</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Portfolio Exposure</p>
          <p className="text-3xl font-bold text-blue-600">₦{(portfolio.totalExposure / 1000000).toFixed(1)}M</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Expected Loss</p>
          <p className="text-3xl font-bold text-orange-600">₦{(portfolio.expectedLoss / 1000).toFixed(0)}K</p>
          <p className="text-xs text-gray-400">{(portfolio.expectedLoss / portfolio.totalExposure * 100).toFixed(2)}% of exposure</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">VaR (99%)</p>
          <p className="text-3xl font-bold text-red-600">₦{(portfolio.var99 / 1000).toFixed(0)}K</p>
          <p className="text-xs text-gray-400">worst-case loss at 99% confidence</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Diversification Benefit</p>
          <p className="text-3xl font-bold text-green-600">₦{(portfolio.diversificationBenefit / 1000).toFixed(0)}K</p>
          <p className="text-xs text-gray-400">risk reduction from diversification</p>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex space-x-4">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === tab.key ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Individual Credit Risk */}
      {activeTab === 'individual' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">MCMC Credit Risk Assessment</h3>
            <p className="text-sm text-gray-500">Metropolis-Hastings with Normal(0, 0.02) proposal, Beta(2,20) prior</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Grade</th>
                  <th className="px-4 py-3 text-left">Mean PD</th>
                  <th className="px-4 py-3 text-left">95% CI</th>
                  <th className="px-4 py-3 text-left">VaR 99</th>
                  <th className="px-4 py-3 text-left">Expected Loss</th>
                  <th className="px-4 py-3 text-left">Acceptance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {creditResults.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 font-medium">{r.name}<span className="text-xs text-gray-400 ml-2">{r.id}</span></td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-bold ${gradeColors[r.grade]}`}>{r.grade}</span></td>
                    <td className="px-4 py-3">{(r.meanPd * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3 text-xs">[{(r.ci[0] * 100).toFixed(1)}%, {(r.ci[1] * 100).toFixed(1)}%]</td>
                    <td className="px-4 py-3">{(r.var99 * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3">₦{r.expectedLoss.toLocaleString()}</td>
                    <td className="px-4 py-3">{(r.acceptance * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Portfolio Risk */}
      {activeTab === 'portfolio' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-4">Risk Contribution by Segment</h3>
            <div className="space-y-3">
              {riskContributions.map((rc, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <span className="w-24 text-sm font-medium capitalize">{rc.segment}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-4">
                    <div className={`h-4 rounded-full ${i === 0 ? 'bg-blue-500' : i === 1 ? 'bg-orange-500' : 'bg-green-500'}`}
                      style={{width: `${rc.contributionPct}%`}}></div>
                  </div>
                  <span className="w-16 text-sm text-right">{rc.contributionPct.toFixed(1)}%</span>
                  <span className="w-24 text-sm text-right text-gray-500">₦{(rc.expectedLoss / 1000).toFixed(0)}K EL</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h4 className="font-semibold mb-2">Risk Metrics</h4>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Unexpected Loss</dt><dd className="font-medium">₦{(portfolio.unexpectedLoss / 1000).toFixed(0)}K</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">VaR (95%)</dt><dd className="font-medium">₦{(portfolio.var95 / 1000).toFixed(0)}K</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Concentration (HHI)</dt><dd className="font-medium">{portfolio.concentrationRisk.toFixed(0)}</dd></div>
              </dl>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h4 className="font-semibold mb-2">MCMC Configuration</h4>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Algorithm</dt><dd className="font-medium">Metropolis-Hastings</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Prior</dt><dd className="font-medium">Beta(2, 20)</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Proposal</dt><dd className="font-medium">Normal(0, 0.02)</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Iterations</dt><dd className="font-medium">5,000 (1,000 burn-in)</dd></div>
              </dl>
            </div>
          </div>
        </div>
      )}

      {/* Stress Testing */}
      {activeTab === 'stress' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">CBN Regulatory Stress Tests</h3>
            <p className="text-sm text-gray-500">Monte Carlo simulated portfolio losses under adverse scenarios</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">Scenario</th>
                  <th className="px-4 py-3 text-left">Severity</th>
                  <th className="px-4 py-3 text-left">PD Multiplier</th>
                  <th className="px-4 py-3 text-left">LGD Multiplier</th>
                  <th className="px-4 py-3 text-left">Portfolio Loss</th>
                  <th className="px-4 py-3 text-left">Loss %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stressTests.map((st, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 font-medium">{st.name}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${severityColors[st.severity]}`}>{st.severity}</span></td>
                    <td className="px-4 py-3">{st.pdMult}x</td>
                    <td className="px-4 py-3">{st.lgdMult}x</td>
                    <td className="px-4 py-3 font-medium">₦{(st.loss / 1000).toFixed(0)}K</td>
                    <td className="px-4 py-3">{st.lossPct.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Technology Value */}
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-gray-800 dark:to-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-200">Technology Value — GNN + MCMC</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
          <div>
            <h4 className="font-medium text-amber-800 dark:text-amber-300">What MCMC Adds</h4>
            <ul className="mt-2 space-y-1 text-gray-700 dark:text-gray-300">
              <li>• Probabilistic credit scores with uncertainty quantification (not just point estimates)</li>
              <li>• Bayesian posterior updates as new data arrives — ideal for sparse African credit data</li>
              <li>• VaR/stress testing for CBN regulatory compliance</li>
              <li>• Chain diagnostics ensure convergence and reliability</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-amber-800 dark:text-amber-300">Combined GNN+MCMC</h4>
            <ul className="mt-2 space-y-1 text-gray-700 dark:text-gray-300">
              <li>• GNN encodes graph-structure risk signals (fraud rings, shared devices)</li>
              <li>• MCMC estimates posterior distributions of default probabilities</li>
              <li>• Together: graph-aware Bayesian credit scoring with full uncertainty</li>
              <li>• Portfolio-level risk aggregation with concentration/diversification analysis</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MCMCRisk
