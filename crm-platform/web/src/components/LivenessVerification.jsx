import { useState, useCallback, useRef, useEffect } from 'react';
import { Shield, Camera, CheckCircle, XCircle, AlertTriangle, Eye, Scan, Fingerprint, RefreshCw } from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';

const SPOOF_LABELS = {
  none: 'No spoofing detected',
  printed_photo: 'Printed Photo',
  screen_replay: 'Screen Replay',
  paper_mask: 'Paper Mask',
  '3d_mask': '3D Mask',
  deepfake: 'Deepfake',
  high_quality_photo: 'High-Quality Photo',
};

const CHALLENGE_ACTIONS = {
  blink: 'Please blink your eyes',
  turn_left: 'Turn your head to the left',
  turn_right: 'Turn your head to the right',
  nod: 'Nod your head up and down',
  smile: 'Please smile',
  raise_eyebrows: 'Raise your eyebrows',
  open_mouth: 'Open your mouth',
};

const SEED_HISTORY = [
  { id: 'lv-001', method: 'passive', is_live: true, confidence: 0.92, spoof_type: 'none', timestamp: '2026-05-04T18:30:00Z', user: 'Adebayo Okonkwo' },
  { id: 'lv-002', method: 'active', is_live: true, confidence: 0.97, spoof_type: 'none', timestamp: '2026-05-04T17:45:00Z', user: 'Chinwe Obi' },
  { id: 'lv-003', method: 'passive', is_live: false, confidence: 0.34, spoof_type: 'printed_photo', timestamp: '2026-05-04T16:20:00Z', user: 'Unknown' },
  { id: 'lv-004', method: 'passive', is_live: false, confidence: 0.21, spoof_type: 'screen_replay', timestamp: '2026-05-04T15:10:00Z', user: 'Unknown' },
  { id: 'lv-005', method: 'active', is_live: true, confidence: 0.89, spoof_type: 'none', timestamp: '2026-05-04T14:00:00Z', user: 'Emeka Nwosu' },
  { id: 'lv-006', method: 'passive', is_live: false, confidence: 0.18, spoof_type: 'deepfake', timestamp: '2026-05-04T12:30:00Z', user: 'Unknown' },
];

export default function LivenessVerification() {
  const { data: apiHistory } = useApiData('liveness-checks', () => fetch('/api/liveness/checks').then(r => r.json()), { fallback: SEED_HISTORY });
  const [activeTab, setActiveTab] = useState('passive');
  const [status, setStatus] = useState('idle'); // idle, checking, passed, failed
  const [result, setResult] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [landmarks, setLandmarks] = useState(null);
  const [history, setHistory] = useState(apiHistory);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [statsView, setStatsView] = useState('overview');
  const videoRef = useRef(null);

  const filteredHistory = history.filter(h =>
    h.user.toLowerCase().includes(search.toLowerCase()) ||
    h.spoof_type.toLowerCase().includes(search.toLowerCase()) ||
    h.method.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: history.length,
    passed: history.filter(h => h.is_live).length,
    failed: history.filter(h => !h.is_live).length,
    avgConfidence: (history.reduce((sum, h) => sum + h.confidence, 0) / history.length).toFixed(2),
    spoofTypes: history.filter(h => !h.is_live).reduce((acc, h) => {
      acc[h.spoof_type] = (acc[h.spoof_type] || 0) + 1;
      return acc;
    }, {}),
  };

  const simulatePassiveCheck = useCallback(() => {
    setStatus('checking');
    setResult(null);
    setTimeout(() => {
      const isLive = Math.random() > 0.3;
      const newResult = {
        session_id: `lv-${Date.now()}`,
        is_live: isLive,
        confidence: isLive ? 0.85 + Math.random() * 0.14 : 0.1 + Math.random() * 0.3,
        method: 'passive',
        spoof_type: isLive ? 'none' : ['printed_photo', 'screen_replay', 'deepfake', 'high_quality_photo'][Math.floor(Math.random() * 4)],
        anti_spoof_scores: {
          texture_analysis: (0.5 + Math.random() * 0.5).toFixed(3),
          moire_detection: (0.6 + Math.random() * 0.4).toFixed(3),
          depth_estimation: (0.4 + Math.random() * 0.5).toFixed(3),
          color_consistency: (0.5 + Math.random() * 0.4).toFixed(3),
          reflection_check: (0.5 + Math.random() * 0.4).toFixed(3),
          frequency_domain: (0.5 + Math.random() * 0.4).toFixed(3),
          deepfake_score: (0.6 + Math.random() * 0.3).toFixed(3),
          overall_score: isLive ? (0.7 + Math.random() * 0.29).toFixed(3) : (0.1 + Math.random() * 0.3).toFixed(3),
        },
        landmarks: { point_count: 68, confidence: 0.87 },
        processing_ms: 45 + Math.floor(Math.random() * 80),
      };
      setResult(newResult);
      setStatus(isLive ? 'passed' : 'failed');
      setHistory(prev => [{ id: newResult.session_id, method: 'passive', is_live: isLive, confidence: parseFloat(newResult.confidence.toFixed(2)), spoof_type: newResult.spoof_type, timestamp: new Date().toISOString(), user: 'Current User' }, ...prev]);
    }, 1500);
  }, []);

  const simulateActiveChallenge = useCallback(() => {
    setStatus('checking');
    setResult(null);
    const actions = ['blink', 'turn_left', 'smile'].slice(0, 2 + Math.floor(Math.random() * 2));
    setChallenge({ challenge_id: `ch-${Date.now()}`, actions, timeout: 30 });
    setTimeout(() => {
      const isLive = Math.random() > 0.2;
      const newResult = {
        session_id: `lv-${Date.now()}`,
        is_live: isLive,
        confidence: isLive ? 0.88 + Math.random() * 0.11 : 0.15 + Math.random() * 0.25,
        method: 'active',
        spoof_type: isLive ? 'none' : ['3d_mask', 'deepfake', 'screen_replay'][Math.floor(Math.random() * 3)],
        anti_spoof_scores: {
          texture_analysis: (0.6 + Math.random() * 0.4).toFixed(3),
          moire_detection: (0.7 + Math.random() * 0.3).toFixed(3),
          depth_estimation: (0.5 + Math.random() * 0.5).toFixed(3),
          blink_detection: (0.6 + Math.random() * 0.4).toFixed(3),
          micro_expression: (0.5 + Math.random() * 0.4).toFixed(3),
          color_consistency: (0.5 + Math.random() * 0.4).toFixed(3),
          temporal_coherence: (0.5 + Math.random() * 0.45).toFixed(3),
          deepfake_score: (0.6 + Math.random() * 0.35).toFixed(3),
          overall_score: isLive ? (0.75 + Math.random() * 0.24).toFixed(3) : (0.1 + Math.random() * 0.3).toFixed(3),
        },
        processing_ms: 120 + Math.floor(Math.random() * 200),
      };
      setResult(newResult);
      setStatus(isLive ? 'passed' : 'failed');
      setChallenge(null);
      setHistory(prev => [{ id: newResult.session_id, method: 'active', is_live: isLive, confidence: parseFloat(newResult.confidence.toFixed(2)), spoof_type: newResult.spoof_type, timestamp: new Date().toISOString(), user: 'Current User' }, ...prev]);
    }, 4000);
  }, []);

  const tabs = [
    { id: 'passive', label: 'Passive Liveness', icon: Eye },
    { id: 'active', label: 'Active Liveness', icon: Camera },
    { id: 'match', label: 'Face Match', icon: Scan },
    { id: 'history', label: 'Audit Log', icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Liveness & Anti-Spoofing</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Facial liveness detection, anti-spoofing classification, and face matching</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
            {stats.passed}/{stats.total} Live
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            {stats.failed} Spoofed
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Checks', value: stats.total, icon: Shield, color: 'sky' },
          { label: 'Live (Passed)', value: stats.passed, icon: CheckCircle, color: 'emerald' },
          { label: 'Spoof (Blocked)', value: stats.failed, icon: XCircle, color: 'red' },
          { label: 'Avg Confidence', value: `${(stats.avgConfidence * 100).toFixed(0)}%`, icon: Fingerprint, color: 'violet' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={`w-4 h-4 text-${kpi.color}-500`} />
              <span className="text-xs text-gray-500 dark:text-gray-400">{kpi.label}</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* Passive Liveness */}
      {activeTab === 'passive' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Passive Liveness Check</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Single-image analysis — texture, depth, frequency, color, deepfake detection</p>
            </div>
            <button onClick={simulatePassiveCheck} disabled={status === 'checking'}
              className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 text-sm font-medium">
              {status === 'checking' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              {status === 'checking' ? 'Analyzing...' : 'Run Passive Check'}
            </button>
          </div>

          {result && result.method === 'passive' && (
            <div className={`rounded-lg border-2 p-4 ${result.is_live ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-red-500 bg-red-50 dark:bg-red-900/10'}`}>
              <div className="flex items-center gap-3 mb-4">
                {result.is_live ? <CheckCircle className="w-6 h-6 text-emerald-600" /> : <XCircle className="w-6 h-6 text-red-600" />}
                <div>
                  <p className={`font-semibold ${result.is_live ? 'text-emerald-800 dark:text-emerald-400' : 'text-red-800 dark:text-red-400'}`}>
                    {result.is_live ? 'LIVE — Passed' : `SPOOF DETECTED — ${SPOOF_LABELS[result.spoof_type] || result.spoof_type}`}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Confidence: {(result.confidence * 100).toFixed(1)}% • {result.processing_ms}ms</p>
                </div>
              </div>

              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Anti-Spoofing Scores</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(result.anti_spoof_scores).filter(([k]) => k !== 'overall_score').map(([key, val]) => (
                  <div key={key} className="text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{key.replace(/_/g, ' ')}</div>
                    <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`absolute left-0 top-0 h-full rounded-full ${parseFloat(val) >= 0.65 ? 'bg-emerald-500' : parseFloat(val) >= 0.4 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${parseFloat(val) * 100}%` }} />
                    </div>
                    <div className="text-xs font-mono mt-1 text-gray-700 dark:text-gray-300">{(parseFloat(val) * 100).toFixed(0)}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Liveness */}
      {activeTab === 'active' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Liveness Check</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Challenge-response — blink, head turn, nod, smile detection across video frames</p>
            </div>
            <button onClick={simulateActiveChallenge} disabled={status === 'checking'}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm font-medium">
              {status === 'checking' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              {status === 'checking' ? 'Recording...' : 'Start Active Check'}
            </button>
          </div>

          {challenge && (
            <div className="bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800 rounded-lg p-4">
              <h4 className="font-medium text-violet-800 dark:text-violet-400 mb-3">Challenge Actions</h4>
              <div className="space-y-2">
                {challenge.actions.map((action, i) => (
                  <div key={action} className="flex items-center gap-3 text-sm">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-violet-200 dark:bg-violet-800 text-violet-800 dark:text-violet-200 text-xs font-bold">{i + 1}</span>
                    <span className="text-gray-700 dark:text-gray-300">{CHALLENGE_ACTIONS[action] || action}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">Timeout: {challenge.timeout}s</p>
            </div>
          )}

          {result && result.method === 'active' && (
            <div className={`rounded-lg border-2 p-4 ${result.is_live ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-red-500 bg-red-50 dark:bg-red-900/10'}`}>
              <div className="flex items-center gap-3 mb-4">
                {result.is_live ? <CheckCircle className="w-6 h-6 text-emerald-600" /> : <XCircle className="w-6 h-6 text-red-600" />}
                <div>
                  <p className={`font-semibold ${result.is_live ? 'text-emerald-800 dark:text-emerald-400' : 'text-red-800 dark:text-red-400'}`}>
                    {result.is_live ? 'LIVE — Passed' : `SPOOF DETECTED — ${SPOOF_LABELS[result.spoof_type] || result.spoof_type}`}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Confidence: {(result.confidence * 100).toFixed(1)}% • {result.processing_ms}ms</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(result.anti_spoof_scores).filter(([k]) => k !== 'overall_score').map(([key, val]) => (
                  <div key={key} className="text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{key.replace(/_/g, ' ')}</div>
                    <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`absolute left-0 top-0 h-full rounded-full ${parseFloat(val) >= 0.65 ? 'bg-emerald-500' : parseFloat(val) >= 0.4 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${parseFloat(val) * 100}%` }} />
                    </div>
                    <div className="text-xs font-mono mt-1 text-gray-700 dark:text-gray-300">{(parseFloat(val) * 100).toFixed(0)}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Face Match */}
      {activeTab === 'match' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Face Matching (Two Images)</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Compare two facial images using 128-dimensional feature embeddings and 68-point landmark geometry</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Image 1 (Reference)</p>
              <p className="text-xs text-gray-400 mt-1">Upload or capture face image</p>
            </div>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Image 2 (Verification)</p>
              <p className="text-xs text-gray-400 mt-1">Upload or capture face image</p>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Match Pipeline</h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center text-xs">
              {['Face Detection', '68-Point Landmarks', '128-d Feature Extraction', 'Cosine Similarity'].map((step, i) => (
                <div key={step} className="flex items-center gap-2">
                  {i > 0 && <span className="text-gray-400 hidden sm:block">→</span>}
                  <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                    <p className="font-medium text-gray-700 dark:text-gray-300">{step}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Audit Log / History */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Liveness Audit Log</h2>
            <input type="text" placeholder="Search by user, method, spoof type..." value={search} onChange={e => setSearch(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white w-64" />
          </div>

          {/* Spoofing type breakdown */}
          {Object.keys(stats.spoofTypes).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.spoofTypes).map(([type, count]) => (
                <span key={type} className="px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                  {SPOOF_LABELS[type] || type}: {count}
                </span>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                  <th className="pb-2 pr-4">Session</th>
                  <th className="pb-2 pr-4">User</th>
                  <th className="pb-2 pr-4">Method</th>
                  <th className="pb-2 pr-4">Result</th>
                  <th className="pb-2 pr-4">Confidence</th>
                  <th className="pb-2 pr-4">Spoof Type</th>
                  <th className="pb-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map(h => (
                  <tr key={h.id} onClick={() => setExpandedId(expandedId === h.id ? null : h.id)}
                    className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer">
                    <td className="py-2 pr-4 font-mono text-xs text-gray-500">{h.id}</td>
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">{h.user}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${h.method === 'active' ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400' : 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400'}`}>
                        {h.method}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {h.is_live
                        ? <span className="flex items-center gap-1 text-emerald-600"><CheckCircle className="w-3.5 h-3.5" /> Live</span>
                        : <span className="flex items-center gap-1 text-red-600"><XCircle className="w-3.5 h-3.5" /> Spoof</span>}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${h.confidence >= 0.65 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${h.confidence * 100}%` }} />
                        </div>
                        <span className="text-xs font-mono">{(h.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-xs">{SPOOF_LABELS[h.spoof_type] || h.spoof_type}</td>
                    <td className="py-2 text-xs text-gray-500">{new Date(h.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredHistory.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No matching liveness checks found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
