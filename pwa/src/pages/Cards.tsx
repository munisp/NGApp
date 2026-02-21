import React, { useState } from 'react';

const Cards: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  const cards = [
    {
      id: '1',
      type: 'virtual',
      brand: 'Verve',
      lastFour: '4532',
      expiryDate: '12/26',
      balance: 50000,
      status: 'active',
      color: 'from-blue-600 to-blue-800',
    },
    {
      id: '2',
      type: 'virtual',
      brand: 'Mastercard',
      lastFour: '8901',
      expiryDate: '06/25',
      balance: 25000,
      status: 'active',
      color: 'from-purple-600 to-purple-800',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="page-title mb-0">My Cards</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          + Create Card
        </button>
      </div>

      {/* Card Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card) => (
          <div
            key={card.id}
            onClick={() => setSelectedCard(card.id)}
            className={`cursor-pointer transition-transform ${
              selectedCard === card.id ? 'scale-105' : ''
            }`}
          >
            <div className={`bg-gradient-to-r ${card.color} rounded-2xl p-6 text-white shadow-lg`}>
              <div className="flex justify-between items-start mb-8">
                <div>
                  <p className="text-sm opacity-80">Virtual Card</p>
                  <p className="font-semibold">{card.brand}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${
                  card.status === 'active' ? 'bg-green-400/30' : 'bg-red-400/30'
                }`}>
                  {card.status}
                </span>
              </div>
              
              <p className="text-2xl font-mono tracking-wider mb-6">
                **** **** **** {card.lastFour}
              </p>
              
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs opacity-80">Balance</p>
                  <p className="text-lg font-semibold">NGN {card.balance.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-80">Expires</p>
                  <p className="font-mono">{card.expiryDate}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Card Actions */}
      {selectedCard && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Card Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button className="p-4 bg-gray-50 rounded-lg text-center hover:bg-gray-100">
              <span className="text-2xl">💳</span>
              <p className="text-sm font-medium mt-2">View Details</p>
            </button>
            <button className="p-4 bg-gray-50 rounded-lg text-center hover:bg-gray-100">
              <span className="text-2xl">💰</span>
              <p className="text-sm font-medium mt-2">Fund Card</p>
            </button>
            <button className="p-4 bg-gray-50 rounded-lg text-center hover:bg-gray-100">
              <span className="text-2xl">🔒</span>
              <p className="text-sm font-medium mt-2">Freeze Card</p>
            </button>
            <button className="p-4 bg-gray-50 rounded-lg text-center hover:bg-gray-100">
              <span className="text-2xl">⚙️</span>
              <p className="text-sm font-medium mt-2">Settings</p>
            </button>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Card Transactions</h2>
        <div className="space-y-3">
          {[
            { merchant: 'Netflix', amount: 4500, date: 'Jan 15, 2024', card: '4532' },
            { merchant: 'Amazon', amount: 15000, date: 'Jan 12, 2024', card: '8901' },
            { merchant: 'Spotify', amount: 1500, date: 'Jan 10, 2024', card: '4532' },
          ].map((tx, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  💳
                </div>
                <div className="ml-3">
                  <p className="font-medium">{tx.merchant}</p>
                  <p className="text-sm text-gray-500">Card ****{tx.card} - {tx.date}</p>
                </div>
              </div>
              <p className="font-medium">-NGN {tx.amount.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Create Card Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold mb-4">Create Virtual Card</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Card Type</label>
                <select className="input-field">
                  <option value="verve">Verve (Local)</option>
                  <option value="mastercard">Mastercard (International)</option>
                  <option value="visa">Visa (International)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Funding</label>
                <div className="flex">
                  <span className="input-field rounded-r-none w-16 bg-gray-50 text-center">NGN</span>
                  <input
                    type="number"
                    className="input-field rounded-l-none flex-1"
                    placeholder="Minimum 1,000"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Card Fee:</strong> NGN 1,500 (one-time)
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
                Create Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cards;
