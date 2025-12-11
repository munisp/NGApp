import React, { useState } from 'react';
import { Link } from 'react-router-dom';

interface WalletBalance {
  currency: string;
  balance: number;
  flag: string;
}

const Wallet: React.FC = () => {
  const [selectedCurrency, setSelectedCurrency] = useState('NGN');

  const wallets: WalletBalance[] = [
    { currency: 'NGN', balance: 250000, flag: '🇳🇬' },
    { currency: 'USD', balance: 500, flag: '🇺🇸' },
    { currency: 'GBP', balance: 200, flag: '🇬🇧' },
    { currency: 'EUR', balance: 150, flag: '🇪🇺' },
    { currency: 'GHS', balance: 1000, flag: '🇬🇭' },
    { currency: 'KES', balance: 5000, flag: '🇰🇪' },
  ];

  const totalInNGN = wallets.reduce((acc, w) => {
    const rates: Record<string, number> = { NGN: 1, USD: 1550, GBP: 1980, EUR: 1700, GHS: 125, KES: 11 };
    return acc + w.balance * (rates[w.currency] || 1);
  }, 0);

  return (
    <div className="space-y-6">
      <h1 className="page-title">My Wallet</h1>

      {/* Total Balance Card */}
      <div className="card bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <p className="text-blue-100 text-sm">Total Balance (NGN equivalent)</p>
        <h2 className="text-3xl font-bold mt-1">NGN {totalInNGN.toLocaleString()}</h2>
        <div className="mt-4 flex space-x-3">
          <Link to="/send" className="btn-primary bg-white text-blue-600 hover:bg-blue-50">
            Send
          </Link>
          <Link to="/receive" className="btn-secondary bg-white/20 text-white hover:bg-white/30">
            Receive
          </Link>
          <button className="btn-secondary bg-white/20 text-white hover:bg-white/30">
            Add Money
          </button>
        </div>
      </div>

      {/* Currency Wallets */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Currency Wallets</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {wallets.map((wallet) => (
            <div
              key={wallet.currency}
              className={`card cursor-pointer transition-all ${
                selectedCurrency === wallet.currency ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setSelectedCurrency(wallet.currency)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{wallet.flag}</span>
                  <div>
                    <p className="font-semibold text-gray-900">{wallet.currency}</p>
                    <p className="text-sm text-gray-500">
                      {wallet.currency === 'NGN' ? 'Nigerian Naira' :
                       wallet.currency === 'USD' ? 'US Dollar' :
                       wallet.currency === 'GBP' ? 'British Pound' :
                       wallet.currency === 'EUR' ? 'Euro' :
                       wallet.currency === 'GHS' ? 'Ghanaian Cedi' :
                       'Kenyan Shilling'}
                    </p>
                  </div>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {wallet.balance.toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add New Currency */}
      <div className="card border-dashed border-2 border-gray-300 text-center py-8">
        <button className="text-blue-600 font-medium hover:text-blue-700">
          + Add New Currency Wallet
        </button>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                  {i % 2 === 0 ? '↓' : '↑'}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">
                    {i % 2 === 0 ? 'Received from John' : 'Sent to Jane'}
                  </p>
                  <p className="text-xs text-gray-500">Jan {15 - i}, 2024</p>
                </div>
              </div>
              <p className={`font-semibold ${i % 2 === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                {i % 2 === 0 ? '+' : '-'}NGN {(10000 * i).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
        <Link to="/transactions" className="block text-center text-blue-600 mt-4 text-sm">
          View all transactions
        </Link>
      </div>
    </div>
  );
};

export default Wallet;
