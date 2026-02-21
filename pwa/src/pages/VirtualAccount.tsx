import React, { useState } from 'react';

const VirtualAccount: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copied, setCopied] = useState('');

  const accounts = [
    { id: '1', bankName: 'Wema Bank', accountNumber: '7821234567', accountName: 'John Doe - RemitFlow', balance: 150000, status: 'active' },
    { id: '2', bankName: 'Providus Bank', accountNumber: '9801234567', accountName: 'John Doe - RemitFlow', balance: 75000, status: 'active' },
  ];

  const recentTransactions = [
    { id: '1', amount: 50000, sender: 'Jane Smith', date: '2024-01-15', bank: 'Wema Bank' },
    { id: '2', amount: 25000, sender: 'Mike Johnson', date: '2024-01-14', bank: 'Providus Bank' },
    { id: '3', amount: 100000, sender: 'Sarah Williams', date: '2024-01-12', bank: 'Wema Bank' },
  ];

  const handleCopy = (text: string) => { navigator.clipboard.writeText(text); setCopied(text); setTimeout(() => setCopied(''), 2000); };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-slate-900">Virtual Accounts</h1><p className="text-slate-500 mt-1">Receive funds via bank transfer</p></div>
        <button onClick={() => setShowCreateModal(true)} className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 text-sm">+ Create Account</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((account) => (
          <div key={account.id} className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-lg transition-shadow duration-200">
            <div className="flex justify-between items-start mb-4">
              <div><p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{account.bankName}</p><p className="text-lg font-mono font-bold text-slate-900 mt-1">{account.accountNumber}</p></div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">Active</span>
            </div>
            <p className="text-sm text-slate-500 mb-4">{account.accountName}</p>
            <div className="p-3.5 bg-indigo-50 rounded-xl mb-4"><p className="text-xs text-slate-500">Balance</p><p className="text-xl font-bold text-indigo-600">\u20a6{account.balance.toLocaleString()}</p></div>
            <div className="flex gap-2">
              <button onClick={() => handleCopy(account.accountNumber)} className="flex-1 py-2.5 bg-slate-50 text-sm font-medium text-slate-700 rounded-xl hover:bg-slate-100 transition-colors">{copied === account.accountNumber ? 'Copied!' : 'Copy Details'}</button>
              <button className="flex-1 py-2.5 bg-slate-50 text-sm font-medium text-slate-700 rounded-xl hover:bg-slate-100 transition-colors">Share</button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h2 className="text-base font-semibold text-slate-900 mb-4">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[{ step: 1, title: 'Share Account', desc: 'Share your virtual account details with anyone' },{ step: 2, title: 'Receive Transfer', desc: 'They transfer money from any bank' },{ step: 3, title: 'Instant Credit', desc: 'Money is instantly credited to your wallet' }].map((s) => (
            <div key={s.step} className="text-center p-4">
              <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-3"><span className="text-indigo-600 font-bold">{s.step}</span></div>
              <h3 className="font-semibold text-sm text-slate-900 mb-1">{s.title}</h3>
              <p className="text-xs text-slate-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h2 className="text-base font-semibold text-slate-900 mb-3">Recent Deposits</h2>
        <div className="space-y-2">
          {recentTransactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between p-3.5 rounded-xl hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                </div>
                <div><p className="text-sm font-semibold text-slate-900">From {tx.sender}</p><p className="text-xs text-slate-400">{tx.bank} - {tx.date}</p></div>
              </div>
              <p className="text-sm font-bold text-emerald-600 tabular-nums">+\u20a6{tx.amount.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Create Virtual Account</h2>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-2">Select Bank</label>
                <select className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none"><option value="">Choose a bank</option><option value="wema">Wema Bank</option><option value="providus">Providus Bank</option><option value="sterling">Sterling Bank</option></select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-2">Account Label (Optional)</label>
                <input type="text" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none" placeholder="e.g., Business Account" /></div>
              <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl"><p className="text-sm text-amber-800">Your BVN will be used to create this account.</p></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
              <button className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 hover:shadow-xl transition-all">Create Account</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VirtualAccount;
