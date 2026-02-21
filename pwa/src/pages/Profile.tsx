import React from 'react';
import { useAuthStore } from '../stores/authStore';

const Profile: React.FC = () => {
  const { user } = useAuthStore();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">My Profile</h1><p className="text-slate-500 mt-1">Manage your personal information</p></div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto shadow-lg shadow-indigo-200">
          {user?.firstName?.[0]}{user?.lastName?.[0]}
        </div>
        <h2 className="text-xl font-bold text-slate-900 mt-4">{user?.firstName} {user?.lastName}</h2>
        <p className="text-slate-500 text-sm">{user?.email}</p>
        <div className="flex justify-center gap-2 mt-3">
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${user?.kycStatus === 'verified' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {user?.kycStatus === 'verified' ? 'Verified' : 'Pending Verification'}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-semibold text-slate-900">Personal Information</h2>
          <button className="text-indigo-600 text-sm font-semibold hover:text-indigo-500">Edit</button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3.5 bg-slate-50 rounded-xl"><p className="text-xs text-slate-400 mb-1">First Name</p><p className="text-sm font-semibold text-slate-900">{user?.firstName || 'John'}</p></div>
            <div className="p-3.5 bg-slate-50 rounded-xl"><p className="text-xs text-slate-400 mb-1">Last Name</p><p className="text-sm font-semibold text-slate-900">{user?.lastName || 'Doe'}</p></div>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-xl"><p className="text-xs text-slate-400 mb-1">Email Address</p><p className="text-sm font-semibold text-slate-900">{user?.email || 'john.doe@example.com'}</p></div>
          <div className="p-3.5 bg-slate-50 rounded-xl"><p className="text-xs text-slate-400 mb-1">Phone Number</p><p className="text-sm font-semibold text-slate-900">{user?.phone || '+234 801 234 5678'}</p></div>
          <div className="p-3.5 bg-slate-50 rounded-xl"><p className="text-xs text-slate-400 mb-1">Date of Birth</p><p className="text-sm font-semibold text-slate-900">January 15, 1990</p></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-semibold text-slate-900">Address</h2>
          <button className="text-indigo-600 text-sm font-semibold hover:text-indigo-500">Edit</button>
        </div>
        <div className="p-3.5 bg-slate-50 rounded-xl space-y-1">
          <p className="text-sm font-semibold text-slate-900">123 Main Street</p>
          <p className="text-sm text-slate-600">Victoria Island</p>
          <p className="text-sm text-slate-600">Lagos, Nigeria</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Linked Accounts</h2>
        <div className="space-y-2">
          {[{ bank: 'GTBank', acct: '****4532', color: 'from-orange-400 to-orange-500' },{ bank: 'Access Bank', acct: '****8901', color: 'from-indigo-400 to-indigo-500' }].map((item) => (
            <div key={item.acct} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center`}>
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" /></svg>
                </div>
                <div><p className="text-sm font-semibold text-slate-900">{item.bank}</p><p className="text-xs text-slate-400 font-mono">{item.acct}</p></div>
              </div>
              <button className="text-red-500 text-xs font-semibold hover:text-red-400">Remove</button>
            </div>
          ))}
          <button className="w-full p-3.5 border-2 border-dashed border-slate-200 rounded-xl text-indigo-600 text-sm font-semibold hover:border-indigo-300 hover:bg-indigo-50/30 transition-all">+ Link New Account</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Account Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[{ value: '156', label: 'Transactions', color: 'text-indigo-600 bg-indigo-50' },{ value: '2.5M', label: 'Total Sent', color: 'text-emerald-600 bg-emerald-50' },{ value: '1.8M', label: 'Total Received', color: 'text-violet-600 bg-violet-50' },{ value: '12', label: 'Beneficiaries', color: 'text-amber-600 bg-amber-50' }].map((stat) => (
            <div key={stat.label} className={`text-center p-4 rounded-xl ${stat.color.split(' ')[1]}`}>
              <p className={`text-xl font-bold ${stat.color.split(' ')[0]}`}>{stat.value}</p>
              <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Profile;
