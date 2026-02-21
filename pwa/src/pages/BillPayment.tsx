import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOfflineStore, useIsOnline, usePendingCount } from '../stores/offlineStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const BillPayment: React.FC = () => {
  const navigate = useNavigate();
  const isOnline = useIsOnline();
  const pendingCount = usePendingCount();
  const { addPendingTransaction } = useOfflineStore();

  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [meterNumber, setMeterNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const paymentData = {
      category: selectedCategory,
      provider: selectedProvider,
      accountNumber: meterNumber,
      amount: parseFloat(amount) + 100, // Including service fee
    };

    try {
      if (!isOnline) {
        const txnId = addPendingTransaction({ type: 'bill_payment', data: paymentData });
        setSuccessMessage(`Payment queued for processing. Reference: ${txnId}`);
        setTimeout(() => navigate('/transactions'), 2000);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/bills/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData),
        signal: AbortSignal.timeout(30000),
      });

      if (response.ok) {
        const data = await response.json();
        setSuccessMessage(`Bill payment successful! Reference: ${data.reference}`);
        setTimeout(() => navigate('/transactions'), 2000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Payment failed');
      }
    } catch (err) {
      if (!isOnline || (err instanceof Error && err.name === 'AbortError')) {
        const txnId = addPendingTransaction({ type: 'bill_payment', data: paymentData });
        setSuccessMessage(`You're offline. Payment queued. Reference: ${txnId}`);
        setTimeout(() => navigate('/transactions'), 2000);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to process payment');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Bill Payment</h1>
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

          <button type="submit" className="btn-primary w-full py-3" disabled={isSubmitting}>
            {isSubmitting ? 'Processing...' : 'Pay Bill'}
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
