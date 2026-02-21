import React, { useState } from 'react';

const VirtualAccount: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const accounts = [
    {
      id: '1',
      bankName: 'Wema Bank',
      accountNumber: '7821234567',
      accountName: 'John Doe - Remittance',
      balance: 150000,
      status: 'active',
    },
    {
      id: '2',
      bankName: 'Providus Bank',
      accountNumber: '9801234567',
      accountName: 'John Doe - Remittance',
      balance: 75000,
      status: 'active',
    },
  ];

  const recentTransactions = [
    { id: '1', type: 'credit', amount: 50000, sender: 'Jane Smith', date: '2024-01-15', bank: 'Wema Bank' },
    { id: '2', type: 'credit', amount: 25000, sender: 'Mike Johnson', date: '2024-01-14', bank: 'Providus Bank' },
    { id: '3', type: 'credit', amount: 100000, sender: 'Sarah Williams', date: '2024-01-12', bank: 'Wema Bank' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="page-title mb-0">Virtual Accounts</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          + Create Account
        </button>
      </div>

      {/* Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((account) => (
          <div key={account.id} className="card">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm text-gray-500">{account.bankName}</p>
                <p className="text-lg font-mono font-semibold">{account.accountNumber}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                account.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {account.status}
              </span>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">{account.accountName}</p>
            
            <div className="p-3 bg-blue-50 rounded-lg mb-4">
              <p className="text-sm text-gray-600">Balance</p>
              <p className="text-xl font-bold text-blue-600">NGN {account.balance.toLocaleString()}</p>
            </div>

            <div className="flex gap-2">
              <button className="btn-secondary flex-1 text-sm">Copy Details</button>
              <button className="btn-secondary flex-1 text-sm">Share</button>
              <button className="btn-secondary text-sm">...</button>
            </div>
          </div>
        ))}
      </div>

      {/* How It Works */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">How Virtual Accounts Work</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-xl">1</span>
            </div>
            <h3 className="font-medium mb-1">Share Account</h3>
            <p className="text-sm text-gray-600">Share your virtual account details with anyone who wants to send you money</p>
          </div>
          <div className="text-center p-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-xl">2</span>
            </div>
            <h3 className="font-medium mb-1">Receive Transfer</h3>
            <p className="text-sm text-gray-600">They transfer money to your virtual account from any bank</p>
          </div>
          <div className="text-center p-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-xl">3</span>
            </div>
            <h3 className="font-medium mb-1">Instant Credit</h3>
            <p className="text-sm text-gray-600">Money is instantly credited to your wallet</p>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Recent Deposits</h2>
        <div className="space-y-3">
          {recentTransactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                  ↓
                </div>
                <div className="ml-3">
                  <p className="font-medium">From {tx.sender}</p>
                  <p className="text-sm text-gray-500">{tx.bank} - {tx.date}</p>
                </div>
              </div>
              <p className="font-semibold text-green-600">+NGN {tx.amount.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Create Account Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold mb-4">Create Virtual Account</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Bank</label>
                <select className="input-field">
                  <option value="">Choose a bank</option>
                  <option value="wema">Wema Bank</option>
                  <option value="providus">Providus Bank</option>
                  <option value="sterling">Sterling Bank</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Label (Optional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., Business Account"
                />
              </div>

              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  Your BVN will be used to create this account. Make sure your profile is complete.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button className="btn-primary flex-1">
                Create Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VirtualAccount;
