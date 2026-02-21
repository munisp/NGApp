import React, { useState } from 'react';

const ReceiveMoney: React.FC = () => {
  const [selectedMethod, setSelectedMethod] = useState('qr');
  const [amount, setAmount] = useState('');

  const methods = [
    { id: 'qr', name: 'QR Code', icon: '📱' },
    { id: 'link', name: 'Payment Link', icon: '🔗' },
    { id: 'account', name: 'Bank Transfer', icon: '🏦' },
  ];

  const virtualAccount = {
    bankName: 'Wema Bank',
    accountNumber: '7821234567',
    accountName: 'John Doe - Remittance',
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="page-title">Receive Money</h1>

      {/* Method Selection */}
      <div className="grid grid-cols-3 gap-4">
        {methods.map((method) => (
          <button
            key={method.id}
            onClick={() => setSelectedMethod(method.id)}
            className={`card text-center py-6 transition-all ${
              selectedMethod === method.id ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            <span className="text-3xl">{method.icon}</span>
            <p className="mt-2 text-sm font-medium text-gray-900">{method.name}</p>
          </button>
        ))}
      </div>

      {/* QR Code */}
      {selectedMethod === 'qr' && (
        <div className="card text-center">
          <h2 className="text-lg font-semibold mb-4">Scan to Pay</h2>
          <div className="w-48 h-48 bg-gray-100 mx-auto flex items-center justify-center rounded-lg">
            <div className="text-6xl">📱</div>
          </div>
          <p className="mt-4 text-sm text-gray-600">
            Show this QR code to receive payment instantly
          </p>
          
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Request specific amount (optional)
            </label>
            <div className="flex max-w-xs mx-auto">
              <span className="input-field rounded-r-none w-16 bg-gray-50 text-center">NGN</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-field rounded-l-none flex-1"
                placeholder="0.00"
              />
            </div>
          </div>

          <button className="btn-primary mt-4">
            Download QR Code
          </button>
        </div>
      )}

      {/* Payment Link */}
      {selectedMethod === 'link' && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Create Payment Link</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount
              </label>
              <div className="flex">
                <span className="input-field rounded-r-none w-16 bg-gray-50 text-center">NGN</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input-field rounded-l-none flex-1"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="What is this payment for?"
              />
            </div>

            <button className="btn-primary w-full">
              Generate Payment Link
            </button>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Your payment link:</p>
              <div className="flex items-center">
                <input
                  type="text"
                  value="https://pay.remittance.com/u/johndoe"
                  className="input-field flex-1 text-sm"
                  readOnly
                />
                <button className="btn-secondary ml-2">Copy</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bank Transfer */}
      {selectedMethod === 'account' && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Virtual Account Details</h2>
          
          <div className="p-4 bg-blue-50 rounded-lg space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Bank Name</span>
              <span className="font-medium">{virtualAccount.bankName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Account Number</span>
              <div className="flex items-center">
                <span className="font-medium font-mono">{virtualAccount.accountNumber}</span>
                <button className="ml-2 text-blue-600 text-sm">Copy</button>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Account Name</span>
              <span className="font-medium">{virtualAccount.accountName}</span>
            </div>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Transfer money to this account and it will be credited to your wallet automatically.
          </p>

          <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> This is a dedicated virtual account. Funds sent here will be 
              credited to your NGN wallet within minutes.
            </p>
          </div>

          <button className="btn-primary w-full mt-4">
            Share Account Details
          </button>
        </div>
      )}
    </div>
  );
};

export default ReceiveMoney;
