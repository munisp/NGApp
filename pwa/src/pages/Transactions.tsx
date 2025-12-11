import React, { useState } from 'react';

interface Transaction {
  id: string;
  type: 'sent' | 'received' | 'airtime' | 'bill' | 'exchange';
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed';
  description: string;
  date: string;
  reference: string;
}

const Transactions: React.FC = () => {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const transactions: Transaction[] = [
    { id: '1', type: 'sent', amount: 50000, currency: 'NGN', status: 'completed', description: 'Transfer to John Doe', date: '2024-01-15 14:30', reference: 'TXN001234' },
    { id: '2', type: 'received', amount: 25000, currency: 'NGN', status: 'completed', description: 'From Jane Smith', date: '2024-01-14 10:15', reference: 'TXN001233' },
    { id: '3', type: 'airtime', amount: 2000, currency: 'NGN', status: 'completed', description: 'MTN Airtime', date: '2024-01-13 09:00', reference: 'TXN001232' },
    { id: '4', type: 'bill', amount: 15000, currency: 'NGN', status: 'completed', description: 'IKEDC Electricity', date: '2024-01-12 16:45', reference: 'TXN001231' },
    { id: '5', type: 'exchange', amount: 100, currency: 'USD', status: 'completed', description: 'USD to NGN', date: '2024-01-11 11:20', reference: 'TXN001230' },
    { id: '6', type: 'sent', amount: 75000, currency: 'NGN', status: 'pending', description: 'Transfer to Mike Johnson', date: '2024-01-10 08:30', reference: 'TXN001229' },
    { id: '7', type: 'received', amount: 100000, currency: 'NGN', status: 'completed', description: 'From Sarah Williams', date: '2024-01-09 15:00', reference: 'TXN001228' },
  ];

  const filteredTransactions = transactions.filter((tx) => {
    if (filter !== 'all' && tx.type !== filter) return false;
    if (searchQuery && !tx.description.toLowerCase().includes(searchQuery.toLowerCase()) && !tx.reference.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sent': return '↑';
      case 'received': return '↓';
      case 'airtime': return '📱';
      case 'bill': return '📄';
      case 'exchange': return '💱';
      default: return '•';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="page-title">Transaction History</h1>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {['all', 'sent', 'received', 'airtime', 'bill', 'exchange'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                  filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-full md:w-64"
            />
            <button className="btn-secondary">Export</button>
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="card">
        <div className="space-y-4">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No transactions found
            </div>
          ) : (
            filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <div className="flex items-center">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg ${
                    tx.type === 'received' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {getTypeIcon(tx.type)}
                  </div>
                  <div className="ml-4">
                    <p className="font-medium text-gray-900">{tx.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{tx.date}</span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500">{tx.reference}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${tx.type === 'received' ? 'text-green-600' : 'text-gray-900'}`}>
                    {tx.type === 'received' ? '+' : '-'}{tx.currency} {tx.amount.toLocaleString()}
                  </p>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mt-1 ${getStatusColor(tx.status)}`}>
                    {tx.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <p className="text-sm text-gray-500">
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </p>
          <div className="flex gap-2">
            <button className="btn-secondary" disabled>Previous</button>
            <button className="btn-secondary">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Transactions;
