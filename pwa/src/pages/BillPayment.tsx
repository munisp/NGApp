import React, { useState } from 'react';

const BillPayment: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [meterNumber, setMeterNumber] = useState('');
  const [amount, setAmount] = useState('');

  const categories = [
    { id: 'electricity', name: 'Electricity', icon: '⚡' },
    { id: 'water', name: 'Water', icon: '💧' },
    { id: 'internet', name: 'Internet', icon: '🌐' },
    { id: 'cable', name: 'Cable TV', icon: '📺' },
    { id: 'education', name: 'Education', icon: '🎓' },
    { id: 'insurance', name: 'Insurance', icon: '🛡️' },
  ];

  const providers: Record<string, { id: string; name: string }[]> = {
    electricity: [
      { id: 'ikedc', name: 'IKEDC (Ikeja Electric)' },
      { id: 'ekedc', name: 'EKEDC (Eko Electric)' },
      { id: 'aedc', name: 'AEDC (Abuja Electric)' },
      { id: 'phedc', name: 'PHEDC (Port Harcourt)' },
    ],
    water: [
      { id: 'lagos-water', name: 'Lagos Water Corporation' },
      { id: 'fcta-water', name: 'FCTA Water Board' },
    ],
    internet: [
      { id: 'spectranet', name: 'Spectranet' },
      { id: 'smile', name: 'Smile' },
      { id: 'swift', name: 'Swift Networks' },
    ],
    cable: [
      { id: 'dstv', name: 'DSTV' },
      { id: 'gotv', name: 'GOtv' },
      { id: 'startimes', name: 'StarTimes' },
    ],
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Bill payment initiated!');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="page-title">Bill Payment</h1>

      {/* Category Selection */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Select Category</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setSelectedProvider('');
              }}
              className={`p-4 rounded-lg border-2 text-center transition-all ${
                selectedCategory === cat.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-2xl">{cat.icon}</span>
              <p className="text-xs font-medium mt-2">{cat.name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Provider Selection */}
      {selectedCategory && providers[selectedCategory] && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Select Provider</h2>
          <div className="grid grid-cols-2 gap-3">
            {providers[selectedCategory].map((provider) => (
              <button
                key={provider.id}
                onClick={() => setSelectedProvider(provider.id)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  selectedProvider === provider.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium">{provider.name}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Payment Form */}
      {selectedProvider && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="text-lg font-semibold">Payment Details</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {selectedCategory === 'electricity' ? 'Meter Number' :
               selectedCategory === 'cable' ? 'Smart Card Number' :
               selectedCategory === 'internet' ? 'Account ID' : 'Account Number'}
            </label>
            <input
              type="text"
              value={meterNumber}
              onChange={(e) => setMeterNumber(e.target.value)}
              className="input-field"
              placeholder="Enter your account/meter number"
              required
            />
          </div>

          {meterNumber && (
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Account Name:</strong> John Doe
              </p>
              <p className="text-sm text-green-800">
                <strong>Address:</strong> 123 Main Street, Lagos
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
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

          {/* Summary */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Bill Amount</span>
              <span className="font-medium">NGN {parseFloat(amount || '0').toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-600">Service Fee</span>
              <span className="font-medium">NGN 100.00</span>
            </div>
            <hr className="my-2" />
            <div className="flex justify-between">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-blue-600">
                NGN {(parseFloat(amount || '0') + 100).toLocaleString()}
              </span>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full py-3">
            Pay Bill
          </button>
        </form>
      )}

      {/* Recent Payments */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Recent Payments</h2>
        <div className="space-y-3">
          {[
            { provider: 'IKEDC', type: 'Electricity', amount: 15000, date: 'Jan 12, 2024' },
            { provider: 'DSTV', type: 'Cable TV', amount: 21000, date: 'Jan 5, 2024' },
            { provider: 'Spectranet', type: 'Internet', amount: 12000, date: 'Jan 1, 2024' },
          ].map((payment, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">{payment.provider}</p>
                <p className="text-sm text-gray-500">{payment.type} - {payment.date}</p>
              </div>
              <p className="font-medium">NGN {payment.amount.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BillPayment;
