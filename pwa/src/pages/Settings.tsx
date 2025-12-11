import React, { useState } from 'react';

const Settings: React.FC = () => {
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false,
    transactions: true,
    marketing: false,
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="page-title">Settings</h1>

      {/* Security */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Security</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">Change Password</p>
              <p className="text-sm text-gray-500">Update your account password</p>
            </div>
            <button className="btn-secondary text-sm">Change</button>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">Transaction PIN</p>
              <p className="text-sm text-gray-500">Set or change your 4-digit PIN</p>
            </div>
            <button className="btn-secondary text-sm">Update</button>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">Two-Factor Authentication</p>
              <p className="text-sm text-gray-500">Add an extra layer of security</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">Biometric Login</p>
              <p className="text-sm text-gray-500">Use fingerprint or face ID</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Notifications</h2>
        <div className="space-y-4">
          {[
            { key: 'email', label: 'Email Notifications', desc: 'Receive updates via email' },
            { key: 'push', label: 'Push Notifications', desc: 'Receive push notifications' },
            { key: 'sms', label: 'SMS Notifications', desc: 'Receive SMS alerts' },
            { key: 'transactions', label: 'Transaction Alerts', desc: 'Get notified for every transaction' },
            { key: 'marketing', label: 'Marketing', desc: 'Receive promotional offers' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={notifications[item.key as keyof typeof notifications]}
                  onChange={(e) => setNotifications({ ...notifications, [item.key]: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Preferences */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Preferences</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Currency</label>
            <select className="input-field">
              <option value="NGN">Nigerian Naira (NGN)</option>
              <option value="USD">US Dollar (USD)</option>
              <option value="GBP">British Pound (GBP)</option>
              <option value="EUR">Euro (EUR)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
            <select className="input-field">
              <option value="en">English</option>
              <option value="fr">French</option>
              <option value="yo">Yoruba</option>
              <option value="ig">Igbo</option>
              <option value="ha">Hausa</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Zone</label>
            <select className="input-field">
              <option value="WAT">West Africa Time (WAT)</option>
              <option value="GMT">Greenwich Mean Time (GMT)</option>
              <option value="EST">Eastern Standard Time (EST)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Account</h2>
        <div className="space-y-4">
          <button className="w-full p-3 text-left bg-gray-50 rounded-lg hover:bg-gray-100">
            <p className="font-medium">Download My Data</p>
            <p className="text-sm text-gray-500">Get a copy of your account data</p>
          </button>
          <button className="w-full p-3 text-left bg-red-50 rounded-lg hover:bg-red-100">
            <p className="font-medium text-red-600">Delete Account</p>
            <p className="text-sm text-red-500">Permanently delete your account and data</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
