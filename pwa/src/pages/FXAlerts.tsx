/**
 * FXAlerts - FX rate alerts and loyalty rewards program
 * Features: Rate alerts, rate history, loyalty tiers, rewards redemption
 */

import React, { useState, useEffect, useCallback } from 'react';

interface FXAlert {
  alert_id: string;
  source_currency: string;
  destination_currency: string;
  alert_type: string;
  threshold_value: number;
  current_value: number;
  status: string;
  created_at: string;
  expires_at?: string;
  triggered_at?: string;
}

interface RateHistory {
  date: string;
  rate: number;
}

interface LoyaltySummary {
  tier: string;
  total_points: number;
  available_points: number;
  lifetime_volume_usd: number;
  transfer_count: number;
  referral_count: number;
  member_since: string;
  benefits: {
    fee_discount_percent: number;
    priority_support: boolean;
    free_transfers_per_month: number;
    cashback_percent: number;
  };
  next_tier?: string;
  points_to_next_tier: number;
  recent_rewards: RewardTransaction[];
}

interface RewardTransaction {
  type: string;
  points: number;
  description: string;
  created_at: string;
}

const CURRENCY_PAIRS = [
  { from: 'GBP', to: 'NGN', flag: '🇬🇧→🇳🇬' },
  { from: 'USD', to: 'NGN', flag: '🇺🇸→🇳🇬' },
  { from: 'EUR', to: 'NGN', flag: '🇪🇺→🇳🇬' },
  { from: 'USD', to: 'GHS', flag: '🇺🇸→🇬🇭' },
  { from: 'USD', to: 'KES', flag: '🇺🇸→🇰🇪' },
  { from: 'USD', to: 'CNY', flag: '🇺🇸→🇨🇳' },
];

const TIER_INFO: Record<string, { color: string; icon: string; bgColor: string }> = {
  BRONZE: { color: 'text-amber-700', icon: '🥉', bgColor: 'bg-amber-100' },
  SILVER: { color: 'text-gray-500', icon: '🥈', bgColor: 'bg-gray-100' },
  GOLD: { color: 'text-yellow-500', icon: '🥇', bgColor: 'bg-yellow-100' },
  PLATINUM: { color: 'text-blue-500', icon: '💎', bgColor: 'bg-blue-100' },
  DIAMOND: { color: 'text-purple-500', icon: '👑', bgColor: 'bg-purple-100' },
};

const REWARD_ICONS: Record<string, string> = {
  TRANSFER_COMPLETED: '💸',
  REFERRAL_SIGNUP: '👥',
  REFERRAL_FIRST_TRANSFER: '🎉',
  STABLECOIN_USAGE: '🪙',
  OFF_PEAK_TRANSFER: '🌙',
  CHEAPEST_CORRIDOR: '💰',
  SAVINGS_GOAL_COMPLETED: '🎯',
  MILESTONE_REACHED: '🏆',
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const FXAlerts: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'alerts' | 'rates' | 'loyalty'>('alerts');
  const [alerts, setAlerts] = useState<FXAlert[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltySummary | null>(null);
  const [rateHistory, setRateHistory] = useState<RateHistory[]>([]);
  const [selectedPair, setSelectedPair] = useState(CURRENCY_PAIRS[0]);
  const [loading, setLoading] = useState(true);
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  
  const [newAlert, setNewAlert] = useState({
    source_currency: 'GBP',
    destination_currency: 'NGN',
    alert_type: 'RATE_ABOVE',
    threshold_value: '',
  });
  
  const [redeemPoints, setRedeemPoints] = useState('');
  const [redeemType, setRedeemType] = useState('CASHBACK');

  const fetchAlerts = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/fx-alerts`);
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      } else {
        setAlerts([
          {
            alert_id: 'alert-001',
            source_currency: 'GBP',
            destination_currency: 'NGN',
            alert_type: 'RATE_ABOVE',
            threshold_value: 2000,
            current_value: 1950.50,
            status: 'ACTIVE',
            created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
            expires_at: new Date(Date.now() + 86400000 * 27).toISOString(),
          },
          {
            alert_id: 'alert-002',
            source_currency: 'USD',
            destination_currency: 'NGN',
            alert_type: 'RATE_BELOW',
            threshold_value: 1500,
            current_value: 1535.00,
            status: 'ACTIVE',
            created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
          },
          {
            alert_id: 'alert-003',
            source_currency: 'EUR',
            destination_currency: 'NGN',
            alert_type: 'RATE_ABOVE',
            threshold_value: 1700,
            current_value: 1680.25,
            status: 'TRIGGERED',
            created_at: new Date(Date.now() - 86400000 * 14).toISOString(),
            triggered_at: new Date(Date.now() - 86400000 * 2).toISOString(),
          },
        ]);
      }
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLoyalty = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/loyalty/summary`);
      if (response.ok) {
        const data = await response.json();
        setLoyalty(data);
      } else {
        setLoyalty({
          tier: 'GOLD',
          total_points: 5250,
          available_points: 3750,
          lifetime_volume_usd: 12500,
          transfer_count: 47,
          referral_count: 3,
          member_since: new Date(Date.now() - 86400000 * 180).toISOString(),
          benefits: {
            fee_discount_percent: 10,
            priority_support: true,
            free_transfers_per_month: 3,
            cashback_percent: 0.25,
          },
          next_tier: 'PLATINUM',
          points_to_next_tier: 19750,
          recent_rewards: [
            { type: 'TRANSFER_COMPLETED', points: 10, description: 'Earned 10 points for TRANSFER_COMPLETED', created_at: new Date(Date.now() - 3600000).toISOString() },
            { type: 'STABLECOIN_USAGE', points: 15, description: 'Earned 15 points for STABLECOIN_USAGE', created_at: new Date(Date.now() - 86400000).toISOString() },
            { type: 'CHEAPEST_CORRIDOR', points: 5, description: 'Earned 5 points for CHEAPEST_CORRIDOR', created_at: new Date(Date.now() - 86400000).toISOString() },
            { type: 'REFERRAL_SIGNUP', points: 50, description: 'Earned 50 points for REFERRAL_SIGNUP', created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
          ],
        });
      }
    } catch {
      setLoyalty(null);
    }
  }, []);

  const fetchRateHistory = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/fx-alerts/history/${selectedPair.from}/${selectedPair.to}`);
      if (response.ok) {
        const data = await response.json();
        setRateHistory(data.history || []);
      } else {
        const baseRates: Record<string, number> = {
          'GBP-NGN': 1950.50,
          'USD-NGN': 1535.00,
          'EUR-NGN': 1680.25,
          'USD-GHS': 11.95,
          'USD-KES': 130.20,
          'USD-CNY': 7.25,
        };
        const baseRate = baseRates[`${selectedPair.from}-${selectedPair.to}`] || 1;
        const history = Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
          rate: baseRate * (1 + (Math.random() - 0.5) * 0.04),
        }));
        setRateHistory(history);
      }
    } catch {
      setRateHistory([]);
    }
  }, [selectedPair]);

  useEffect(() => {
    fetchAlerts();
    fetchLoyalty();
  }, [fetchAlerts, fetchLoyalty]);

  useEffect(() => {
    fetchRateHistory();
  }, [fetchRateHistory]);

  const handleCreateAlert = async () => {
    if (!newAlert.threshold_value) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/fx-alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_currency: newAlert.source_currency,
          destination_currency: newAlert.destination_currency,
          alert_type: newAlert.alert_type,
          threshold_value: parseFloat(newAlert.threshold_value),
        }),
      });
      
      if (response.ok) {
        fetchAlerts();
        setShowCreateAlert(false);
        setNewAlert({ source_currency: 'GBP', destination_currency: 'NGN', alert_type: 'RATE_ABOVE', threshold_value: '' });
      }
    } catch {
      const mockAlert: FXAlert = {
        alert_id: `alert-${Date.now()}`,
        source_currency: newAlert.source_currency,
        destination_currency: newAlert.destination_currency,
        alert_type: newAlert.alert_type,
        threshold_value: parseFloat(newAlert.threshold_value),
        current_value: 1950.50,
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
      };
      setAlerts(prev => [mockAlert, ...prev]);
      setShowCreateAlert(false);
      setNewAlert({ source_currency: 'GBP', destination_currency: 'NGN', alert_type: 'RATE_ABOVE', threshold_value: '' });
    }
  };

  const handleCancelAlert = async (alertId: string) => {
    try {
      await fetch(`${API_BASE_URL}/fx-alerts/${alertId}`, { method: 'DELETE' });
      fetchAlerts();
    } catch {
      setAlerts(prev => prev.map(a => a.alert_id === alertId ? { ...a, status: 'CANCELLED' } : a));
    }
  };

  const handleRedeem = async () => {
    if (!redeemPoints || !loyalty) return;
    const points = parseInt(redeemPoints);
    if (points > loyalty.available_points) return;
    
    try {
      await fetch(`${API_BASE_URL}/loyalty/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points, redemption_type: redeemType }),
      });
      fetchLoyalty();
    } catch {
      setLoyalty(prev => prev ? { ...prev, available_points: prev.available_points - points } : null);
    }
    setShowRedeemModal(false);
    setRedeemPoints('');
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatRate = (rate: number) => {
    return rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getAlertStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'TRIGGERED': return 'bg-blue-100 text-blue-800';
      case 'EXPIRED': return 'bg-gray-100 text-gray-600';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const minRate = rateHistory.length > 0 ? Math.min(...rateHistory.map(r => r.rate)) : 0;
  const maxRate = rateHistory.length > 0 ? Math.max(...rateHistory.map(r => r.rate)) : 0;
  const currentRate = rateHistory.length > 0 ? rateHistory[rateHistory.length - 1].rate : 0;
  const rateChange = rateHistory.length > 1 ? ((currentRate - rateHistory[0].rate) / rateHistory[0].rate) * 100 : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">FX Alerts & Rewards</h1>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { key: 'alerts', label: 'Rate Alerts', icon: '🔔' },
              { key: 'rates', label: 'Rate History', icon: '📈' },
              { key: 'loyalty', label: 'Loyalty Rewards', icon: '🎁' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'alerts' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-gray-500">Get notified when rates hit your target</p>
                <button
                  onClick={() => setShowCreateAlert(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  + New Alert
                </button>
              </div>
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No alerts set. Create an alert to get notified when rates change.</p>
                </div>
              ) : (
                alerts.filter(a => a.status !== 'CANCELLED').map(alert => (
                  <div key={alert.alert_id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <span className="text-xl mr-2">
                          {CURRENCY_PAIRS.find(p => p.from === alert.source_currency && p.to === alert.destination_currency)?.flag || '💱'}
                        </span>
                        <div>
                          <p className="font-semibold">{alert.source_currency}/{alert.destination_currency}</p>
                          <p className="text-sm text-gray-500">
                            {alert.alert_type === 'RATE_ABOVE' ? 'Alert when above' : 'Alert when below'} {formatRate(alert.threshold_value)}
                          </p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getAlertStatusColor(alert.status)}`}>
                        {alert.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <span className="text-gray-500">Current: </span>
                        <span className="font-medium">{formatRate(alert.current_value)}</span>
                        {alert.alert_type === 'RATE_ABOVE' ? (
                          <span className={`ml-2 ${alert.current_value >= alert.threshold_value ? 'text-green-600' : 'text-gray-400'}`}>
                            {alert.current_value >= alert.threshold_value ? '(Target reached!)' : `(${formatRate(alert.threshold_value - alert.current_value)} to go)`}
                          </span>
                        ) : (
                          <span className={`ml-2 ${alert.current_value <= alert.threshold_value ? 'text-green-600' : 'text-gray-400'}`}>
                            {alert.current_value <= alert.threshold_value ? '(Target reached!)' : `(${formatRate(alert.current_value - alert.threshold_value)} above target)`}
                          </span>
                        )}
                      </div>
                      {alert.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleCancelAlert(alert.alert_id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'rates' && (
            <div className="space-y-4">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {CURRENCY_PAIRS.map(pair => (
                  <button
                    key={`${pair.from}-${pair.to}`}
                    onClick={() => setSelectedPair(pair)}
                    className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                      selectedPair.from === pair.from && selectedPair.to === pair.to
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {pair.flag} {pair.from}/{pair.to}
                  </button>
                ))}
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Current Rate</p>
                  <p className="text-2xl font-bold">{formatRate(currentRate)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">30-Day Change</p>
                  <p className={`text-2xl font-bold ${rateChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {rateChange >= 0 ? '+' : ''}{rateChange.toFixed(2)}%
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">30-Day Range</p>
                  <p className="text-lg font-bold">{formatRate(minRate)} - {formatRate(maxRate)}</p>
                </div>
              </div>
              
              <div className="h-48 bg-gray-50 rounded-lg p-4">
                <div className="h-full flex items-end justify-between gap-1">
                  {rateHistory.slice(-30).map((point, index) => {
                    const height = maxRate > minRate 
                      ? ((point.rate - minRate) / (maxRate - minRate)) * 100 
                      : 50;
                    return (
                      <div
                        key={index}
                        className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                        style={{ height: `${Math.max(5, height)}%` }}
                        title={`${point.date}: ${formatRate(point.rate)}`}
                      ></div>
                    );
                  })}
                </div>
              </div>
              
              <div className="flex justify-between text-xs text-gray-500">
                <span>{rateHistory.length > 0 ? formatDate(rateHistory[0].date) : ''}</span>
                <span>{rateHistory.length > 0 ? formatDate(rateHistory[rateHistory.length - 1].date) : ''}</span>
              </div>
              
              <button
                onClick={() => { setNewAlert({ ...newAlert, source_currency: selectedPair.from, destination_currency: selectedPair.to }); setShowCreateAlert(true); }}
                className="w-full py-3 border border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50"
              >
                Set Alert for {selectedPair.from}/{selectedPair.to}
              </button>
            </div>
          )}

          {activeTab === 'loyalty' && loyalty && (
            <div className="space-y-6">
              <div className={`${TIER_INFO[loyalty.tier]?.bgColor || 'bg-gray-100'} rounded-xl p-6`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <span className="text-4xl mr-3">{TIER_INFO[loyalty.tier]?.icon || '🎖️'}</span>
                    <div>
                      <p className={`text-2xl font-bold ${TIER_INFO[loyalty.tier]?.color || 'text-gray-700'}`}>
                        {loyalty.tier} Member
                      </p>
                      <p className="text-sm text-gray-600">Member since {formatDate(loyalty.member_since)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-gray-900">{loyalty.available_points.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">Available Points</p>
                  </div>
                </div>
                
                {loyalty.next_tier && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{loyalty.tier}</span>
                      <span>{loyalty.next_tier}</span>
                    </div>
                    <div className="w-full bg-white bg-opacity-50 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${Math.min(100, (loyalty.total_points / (loyalty.total_points + loyalty.points_to_next_tier)) * 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{loyalty.points_to_next_tier.toLocaleString()} points to {loyalty.next_tier}</p>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Lifetime Volume</p>
                  <p className="text-xl font-bold">${loyalty.lifetime_volume_usd.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Total Transfers</p>
                  <p className="text-xl font-bold">{loyalty.transfer_count}</p>
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-3">Your Benefits</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>{loyalty.benefits.fee_discount_percent}% fee discount</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>{loyalty.benefits.cashback_percent}% cashback</span>
                  </div>
                  <div className="flex items-center">
                    <span className={`mr-2 ${loyalty.benefits.priority_support ? 'text-green-500' : 'text-gray-300'}`}>
                      {loyalty.benefits.priority_support ? '✓' : '○'}
                    </span>
                    <span>Priority support</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>{loyalty.benefits.free_transfers_per_month} free transfers/month</span>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">Recent Rewards</h4>
                  <button
                    onClick={() => setShowRedeemModal(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                  >
                    Redeem Points
                  </button>
                </div>
                <div className="space-y-2">
                  {loyalty.recent_rewards.map((reward, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <span className="text-xl mr-3">{REWARD_ICONS[reward.type] || '🎁'}</span>
                        <div>
                          <p className="font-medium">{reward.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</p>
                          <p className="text-xs text-gray-500">{formatDate(reward.created_at)}</p>
                        </div>
                      </div>
                      <span className="font-bold text-green-600">+{reward.points}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreateAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Create Rate Alert</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                  <select
                    value={newAlert.source_currency}
                    onChange={(e) => setNewAlert(prev => ({ ...prev, source_currency: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                  >
                    <option value="GBP">GBP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                  <select
                    value={newAlert.destination_currency}
                    onChange={(e) => setNewAlert(prev => ({ ...prev, destination_currency: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                  >
                    <option value="NGN">NGN</option>
                    <option value="GHS">GHS</option>
                    <option value="KES">KES</option>
                    <option value="CNY">CNY</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alert Type</label>
                <select
                  value={newAlert.alert_type}
                  onChange={(e) => setNewAlert(prev => ({ ...prev, alert_type: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                >
                  <option value="RATE_ABOVE">Rate goes above</option>
                  <option value="RATE_BELOW">Rate goes below</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Rate</label>
                <input
                  type="number"
                  value={newAlert.threshold_value}
                  onChange={(e) => setNewAlert(prev => ({ ...prev, threshold_value: e.target.value }))}
                  placeholder="e.g., 2000"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateAlert(false)}
                className="flex-1 py-3 border border-gray-300 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAlert}
                disabled={!newAlert.threshold_value}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300"
              >
                Create Alert
              </button>
            </div>
          </div>
        </div>
      )}

      {showRedeemModal && loyalty && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold mb-4">Redeem Points</h3>
            <p className="text-sm text-gray-500 mb-4">Available: {loyalty.available_points.toLocaleString()} points</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Points to Redeem</label>
                <input
                  type="number"
                  value={redeemPoints}
                  onChange={(e) => setRedeemPoints(e.target.value)}
                  max={loyalty.available_points}
                  placeholder="100"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Redemption Type</label>
                <select
                  value={redeemType}
                  onChange={(e) => setRedeemType(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                >
                  <option value="CASHBACK">Cashback ($0.01 per point)</option>
                  <option value="FEE_CREDIT">Fee Credit ($0.02 per point)</option>
                </select>
              </div>
              
              {redeemPoints && (
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    You'll receive: ${(parseInt(redeemPoints) * (redeemType === 'CASHBACK' ? 0.01 : 0.02)).toFixed(2)} {redeemType === 'CASHBACK' ? 'cashback' : 'in fee credits'}
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowRedeemModal(false); setRedeemPoints(''); }}
                className="flex-1 py-3 border border-gray-300 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRedeem}
                disabled={!redeemPoints || parseInt(redeemPoints) > loyalty.available_points}
                className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300"
              >
                Redeem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FXAlerts;
