import React, { useState } from 'react';

const Airtime: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'airtime' | 'data'>('airtime');
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedBundle, setSelectedBundle] = useState('');

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`${activeTab === 'airtime' ? 'Airtime' : 'Data'} purchase initiated!`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="page-title">Airtime & Data</h1>

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
          disabled={!selectedNetwork || !phoneNumber || (activeTab === 'airtime' ? !amount : !selectedBundle)}
        >
          {activeTab === 'airtime' ? 'Buy Airtime' : 'Buy Data'}
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
