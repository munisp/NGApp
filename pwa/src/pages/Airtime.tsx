import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOfflineStore, useIsOnline, usePendingCount } from '../stores/offlineStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const Airtime: React.FC = () => {
  const navigate = useNavigate();
  const isOnline = useIsOnline();
  const pendingCount = usePendingCount();
  const { addPendingTransaction } = useOfflineStore();

  const [activeTab, setActiveTab] = useState<'airtime' | 'data'>('airtime');
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedBundle, setSelectedBundle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const networks = [
    { id: 'mtn', name: 'MTN', color: 'bg-yellow-400' },
    { id: 'glo', name: 'Glo', color: 'bg-green-500' },
    { id: 'airtel', name: 'Airtel', color: 'bg-red-500' },
    { id: '9mobile', name: '9mobile', color: 'bg-green-700' },
  ];

  const quickAmounts = [100, 200, 500, 1000, 2000, 5000];

  const dataBundles = [
    { id: '1', name: '1GB', validity: '1 Day', price: 350 },
    { id: '2', name: '2GB', validity: '2 Days', price: 600 },
    { id: '3', name: '3GB', validity: '7 Days', price: 1000 },
    { id: '4', name: '5GB', validity: '30 Days', price: 1500 },
    { id: '5', name: '10GB', validity: '30 Days', price: 2500 },
    { id: '6', name: '20GB', validity: '30 Days', price: 5000 },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const purchaseData = {
      phone: phoneNumber,
      provider: selectedNetwork,
      type: activeTab,
      amount: activeTab === 'airtime' ? parseFloat(amount) : dataBundles.find(b => b.id === selectedBundle)?.price || 0,
      planId: activeTab === 'data' ? selectedBundle : undefined,
    };

    try {
      if (!isOnline) {
        const txnId = addPendingTransaction({ type: 'airtime', data: purchaseData });
        setSuccessMessage(`Purchase queued for processing. Reference: ${txnId}`);
        setTimeout(() => navigate('/transactions'), 2000);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/airtime/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(purchaseData),
        signal: AbortSignal.timeout(30000),
      });

      if (response.ok) {
        const data = await response.json();
        setSuccessMessage(`${activeTab === 'airtime' ? 'Airtime' : 'Data'} purchase successful! Reference: ${data.reference}`);
        setTimeout(() => navigate('/transactions'), 2000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Purchase failed');
      }
    } catch (err) {
      if (!isOnline || (err instanceof Error && err.name === 'AbortError')) {
        const txnId = addPendingTransaction({ type: 'airtime', data: purchaseData });
        setSuccessMessage(`You're offline. Purchase queued. Reference: ${txnId}`);
        setTimeout(() => navigate('/transactions'), 2000);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to process purchase');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Airtime & Data</h1>
        {!isOnline && (
          <div className="flex items-center px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
            <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2 animate-pulse" />
            Offline Mode
          </div>
        )}
      </div>

      {pendingCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <span className="text-blue-600 font-semibold">{pendingCount}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900">Pending Transactions</p>
              <p className="text-xs text-blue-700">Will sync when you're back online</p>
            </div>
          </div>
          <button onClick={() => navigate('/transactions?filter=pending')} className="text-sm text-blue-600 hover:text-blue-800 font-medium">View</button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <svg className="w-5 h-5 text-red-500 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-800">{error}</p>
            <button onClick={() => setError(null)} className="text-xs text-red-600 hover:text-red-800 mt-1">Dismiss</button>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
          <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-green-800">{successMessage}</p>
        </div>
      )}

      {/* Tab Selection */}
      <div className="flex bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('airtime')}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'airtime' ? 'bg-white shadow text-blue-600' : 'text-gray-600'
          }`}
        >
          Buy Airtime
        </button>
        <button
          onClick={() => setActiveTab('data')}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'data' ? 'bg-white shadow text-blue-600' : 'text-gray-600'
          }`}
        >
          Buy Data
        </button>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">
        {/* Network Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Select Network</label>
          <div className="grid grid-cols-4 gap-3">
            {networks.map((network) => (
              <button
                key={network.id}
                type="button"
                onClick={() => setSelectedNetwork(network.id)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedNetwork === network.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-10 h-10 ${network.color} rounded-full mx-auto mb-2`} />
                <p className="text-sm font-medium text-center">{network.name}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Phone Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="input-field"
            placeholder="08012345678"
            required
          />
        </div>

        {/* Airtime Amount */}
        {activeTab === 'airtime' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Amount</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(amt.toString())}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                    amount === amt.toString()
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  NGN {amt.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="flex">
              <span className="input-field rounded-r-none w-16 bg-gray-50 text-center">NGN</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-field rounded-l-none flex-1"
                placeholder="Enter amount"
                required
              />
            </div>
          </div>
        )}

        {/* Data Bundles */}
        {activeTab === 'data' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Select Data Bundle</label>
            <div className="grid grid-cols-2 gap-3">
              {dataBundles.map((bundle) => (
                <button
                  key={bundle.id}
                  type="button"
                  onClick={() => setSelectedBundle(bundle.id)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    selectedBundle === bundle.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-semibold text-lg">{bundle.name}</p>
                  <p className="text-sm text-gray-500">{bundle.validity}</p>
                  <p className="text-blue-600 font-medium mt-1">NGN {bundle.price.toLocaleString()}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              {activeTab === 'airtime' ? 'Airtime Amount' : 'Data Bundle'}
            </span>
            <span className="font-medium">
              {activeTab === 'airtime'
                ? `NGN ${parseFloat(amount || '0').toLocaleString()}`
                : dataBundles.find(b => b.id === selectedBundle)?.name || '-'}
            </span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-gray-600">Service Fee</span>
            <span className="font-medium">NGN 0.00</span>
          </div>
          <hr className="my-2" />
          <div className="flex justify-between">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-blue-600">
              NGN {activeTab === 'airtime'
                ? parseFloat(amount || '0').toLocaleString()
                : (dataBundles.find(b => b.id === selectedBundle)?.price || 0).toLocaleString()}
            </span>
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary w-full py-3"
          disabled={isSubmitting || !selectedNetwork || !phoneNumber || (activeTab === 'airtime' ? !amount : !selectedBundle)}
        >
          {isSubmitting ? 'Processing...' : (activeTab === 'airtime' ? 'Buy Airtime' : 'Buy Data')}
        </button>
      </form>

      {/* Recent Purchases */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Recent Purchases</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-yellow-400 rounded-full" />
                <div className="ml-3">
                  <p className="text-sm font-medium">MTN {i % 2 === 0 ? 'Data' : 'Airtime'}</p>
                  <p className="text-xs text-gray-500">08012345678</p>
                </div>
              </div>
              <p className="font-medium">NGN {(1000 * i).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Airtime;
