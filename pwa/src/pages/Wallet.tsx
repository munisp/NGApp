import React, { useState } from 'react';
import { Link } from 'react-router-dom';

interface WalletBalance {
  currency: string;
  balance: number;
  flag: string;
  name: string;
}

const Wallet: React.FC = () => {
  const [selectedCurrency, setSelectedCurrency] = useState('NGN');

  const wallets: WalletBalance[] = [
    { currency: 'NGN', balance: 250000, flag: '\u{1F1F3}\u{1F1EC}', name: 'Nigerian Naira' },
    { currency: 'USD', balance: 500, flag: '\u{1F1FA}\u{1F1F8}', name: 'US Dollar' },
    { currency: 'GBP', balance: 200, flag: '\u{1F1EC}\u{1F1E7}', name: 'British Pound' },
    { currency: 'EUR', balance: 150, flag: '\u{1F1EA}\u{1F1FA}', name: 'Euro' },
    { currency: 'GHS', balance: 1000, flag: '\u{1F1EC}\u{1F1ED}', name: 'Ghanaian Cedi' },
    { currency: 'KES', balance: 5000, flag: '\u{1F1F0}\u{1F1EA}', name: 'Kenyan Shilling' },
  ];

  const rates: Record<string, number> = { NGN: 1, USD: 1550, GBP: 1980, EUR: 1700, GHS: 125, KES: 11 };
  const totalInNGN = wallets.reduce((acc, w) => acc + w.balance * (rates[w.currency] || 1), 0);

  const recentActivity = [
    { name: 'Sent to John Doe', amount: -25000, currency: 'NGN', date: 'Jan 15, 2024' },
    { name: 'Received from Jane', amount: 10000, currency: 'NGN', date: 'Jan 14, 2024' },
    { name: 'USD Top-up', amount: 100, currency: 'USD', date: 'Jan 13, 2024' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Wallet</h1>
        <p className="text-slate-500 mt-1">Manage your multi-currency wallets</p>
      </div>

      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative">
          <p className="text-indigo-200 text-sm font-medium">Total Balance (NGN equivalent)</p>
          <h2 className="text-3xl font-bold mt-1 tracking-tight">NGN {totalInNGN.toLocaleString()}</h2>
          <div className="mt-5 flex gap-3">
            <Link to="/send" className="text-sm bg-white px-5 py-2.5 rounded-xl text-indigo-700 hover:bg-indigo-50 transition-colors font-semibold">Send</Link>
            <Link to="/receive" className="text-sm bg-white/15 backdrop-blur-sm px-5 py-2.5 rounded-xl hover:bg-white/25 transition-colors font-medium">Receive</Link>
            <button className="text-sm bg-white/15 backdrop-blur-sm px-5 py-2.5 rounded-xl hover:bg-white/25 transition-colors font-medium">Add Money</button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-slate-900 mb-3">Currency Wallets</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {wallets.map((wallet) => (
            <button key={wallet.currency} onClick={() => setSelectedCurrency(wallet.currency)}
              className={`p-4 bg-white rounded-2xl border text-left transition-all duration-200 hover:shadow-md ${selectedCurrency === wallet.currency ? 'border-indigo-300 ring-2 ring-indigo-100 shadow-md' : 'border-slate-100 hover:border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{wallet.flag}</span>
                  <div>
                    <p className="font-semibold text-slate-900">{wallet.currency}</p>
                    <p className="text-xs text-slate-500">{wallet.name}</p>
                  </div>
                </div>
                <p className="text-lg font-bold text-slate-900 tabular-nums">{wallet.balance.toLocaleString()}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <button className="w-full p-4 bg-white rounded-2xl border-2 border-dashed border-slate-200 text-indigo-600 font-medium hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200">
        + Add New Currency Wallet
      </button>

      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">Recent Activity</h2>
          <Link to="/transactions" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">View all</Link>
        </div>
        <div className="space-y-2">
          {recentActivity.map((tx, i) => (
            <div key={i} className="flex items-center justify-between p-3.5 rounded-xl hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.amount > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d={tx.amount > 0 ? 'M19 14l-7 7m0 0l-7-7m7 7V3' : 'M5 10l7-7m0 0l7 7m-7-7v18'} />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{tx.name}</p>
                  <p className="text-xs text-slate-500">{tx.date}</p>
                </div>
              </div>
              <p className={`text-sm font-bold tabular-nums ${tx.amount > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                {tx.amount > 0 ? '+' : '-'}{tx.currency} {Math.abs(tx.amount).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Wallet;
