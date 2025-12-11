import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const Dashboard: React.FC = () => {
  const { user } = useAuthStore();

  const quickActions = [
    { name: 'Send Money', href: '/send', icon: '💸', color: 'bg-blue-500' },
    { name: 'Receive Money', href: '/receive', icon: '📥', color: 'bg-green-500' },
    { name: 'Buy Airtime', href: '/airtime', icon: '📱', color: 'bg-purple-500' },
    { name: 'Pay Bills', href: '/bills', icon: '📄', color: 'bg-orange-500' },
  ];

  const recentTransactions = [
    { id: 1, type: 'sent', recipient: 'John Doe', amount: 50000, currency: 'NGN', date: '2024-01-15' },
    { id: 2, type: 'received', sender: 'Jane Smith', amount: 25000, currency: 'NGN', date: '2024-01-14' },
    { id: 3, type: 'airtime', network: 'MTN', amount: 2000, currency: 'NGN', date: '2024-01-13' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="card">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="text-gray-600 mt-1">Here's what's happening with your account today.</p>
      </div>

      {/* Balance Card */}
      <div className="card bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <p className="text-blue-100 text-sm">Total Balance</p>
        <h2 className="text-3xl font-bold mt-1">NGN 250,000.00</h2>
        <div className="mt-4 flex space-x-4">
          <Link to="/wallet" className="text-sm bg-white/20 px-4 py-2 rounded-lg hover:bg-white/30">
            View Wallet
          </Link>
          <Link to="/send" className="text-sm bg-white px-4 py-2 rounded-lg text-blue-600 hover:bg-blue-50">
            Send Money
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.name}
              to={action.href}
              className="card hover:shadow-md transition-shadow text-center"
            >
              <div className={`w-12 h-12 ${action.color} rounded-full flex items-center justify-center mx-auto text-2xl`}>
                {action.icon}
              </div>
              <p className="mt-3 text-sm font-medium text-gray-900">{action.name}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Exchange Rates */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Exchange Rates</h2>
          <Link to="/exchange-rates" className="text-sm text-blue-600 hover:text-blue-700">
            View all
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">USD/NGN</p>
            <p className="text-lg font-semibold">1,550.00</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">GBP/NGN</p>
            <p className="text-lg font-semibold">1,980.00</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">EUR/NGN</p>
            <p className="text-lg font-semibold">1,700.00</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">GHS/NGN</p>
            <p className="text-lg font-semibold">125.00</p>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
          <Link to="/transactions" className="text-sm text-blue-600 hover:text-blue-700">
            View all
          </Link>
        </div>
        <div className="space-y-3">
          {recentTransactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  tx.type === 'received' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  {tx.type === 'received' ? '↓' : '↑'}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">
                    {tx.type === 'sent' && `Sent to ${tx.recipient}`}
                    {tx.type === 'received' && `Received from ${tx.sender}`}
                    {tx.type === 'airtime' && `${tx.network} Airtime`}
                  </p>
                  <p className="text-xs text-gray-500">{tx.date}</p>
                </div>
              </div>
              <p className={`font-semibold ${tx.type === 'received' ? 'text-green-600' : 'text-gray-900'}`}>
                {tx.type === 'received' ? '+' : '-'}{tx.currency} {tx.amount.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
