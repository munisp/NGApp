import React, { useState } from 'react';

interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  change: number;
  flag: string;
}

const ExchangeRates: React.FC = () => {
  const [baseCurrency, setBaseCurrency] = useState('NGN');
  const [amount, setAmount] = useState('1000');
  const [targetCurrency, setTargetCurrency] = useState('USD');

  const rates: ExchangeRate[] = [
    { from: 'NGN', to: 'USD', rate: 0.000645, change: 0.5, flag: '🇺🇸' },
    { from: 'NGN', to: 'GBP', rate: 0.000505, change: -0.3, flag: '🇬🇧' },
    { from: 'NGN', to: 'EUR', rate: 0.000588, change: 0.2, flag: '🇪🇺' },
    { from: 'NGN', to: 'GHS', rate: 0.008, change: 1.2, flag: '🇬🇭' },
    { from: 'NGN', to: 'KES', rate: 0.091, change: -0.1, flag: '🇰🇪' },
    { from: 'NGN', to: 'ZAR', rate: 0.012, change: 0.8, flag: '🇿🇦' },
    { from: 'NGN', to: 'XOF', rate: 0.386, change: 0.0, flag: '🇸🇳' },
    { from: 'NGN', to: 'XAF', rate: 0.386, change: 0.0, flag: '🇨🇲' },
  ];

  const getRate = (from: string, to: string): number => {
    if (from === to) return 1;
    const rate = rates.find(r => r.from === from && r.to === to);
    if (rate) return rate.rate;
    const inverseRate = rates.find(r => r.from === to && r.to === from);
    if (inverseRate) return 1 / inverseRate.rate;
    return 0;
  };

  const convertedAmount = parseFloat(amount || '0') * getRate(baseCurrency, targetCurrency);

  return (
    <div className="space-y-6">
      <h1 className="page-title">Exchange Rates</h1>

      {/* Currency Converter */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Currency Converter</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">You have</label>
            <div className="flex">
              <select
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value)}
                className="input-field rounded-r-none w-24"
              >
                <option value="NGN">NGN</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
              </select>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-field rounded-l-none flex-1"
              />
            </div>
          </div>
          
          <div className="flex justify-center">
            <button
              onClick={() => {
                const temp = baseCurrency;
                setBaseCurrency(targetCurrency);
                setTargetCurrency(temp);
              }}
              className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-200"
            >
              ⇄
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">You get</label>
            <div className="flex">
              <select
                value={targetCurrency}
                onChange={(e) => setTargetCurrency(e.target.value)}
                className="input-field rounded-r-none w-24"
              >
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="GHS">GHS</option>
                <option value="KES">KES</option>
                <option value="ZAR">ZAR</option>
              </select>
              <input
                type="text"
                value={convertedAmount.toFixed(2)}
                className="input-field rounded-l-none flex-1 bg-gray-50"
                readOnly
              />
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
          <span className="text-gray-600">Rate: </span>
          <span className="font-medium">1 {baseCurrency} = {getRate(baseCurrency, targetCurrency).toFixed(6)} {targetCurrency}</span>
        </div>
      </div>

      {/* Live Rates */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Live Rates (NGN Base)</h2>
          <span className="text-sm text-gray-500">Updated 2 mins ago</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Currency</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Rate</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">24h Change</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((rate) => (
                <tr key={rate.to} className="border-b hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">{rate.flag}</span>
                      <div>
                        <p className="font-medium">{rate.to}</p>
                        <p className="text-sm text-gray-500">
                          {rate.to === 'USD' ? 'US Dollar' :
                           rate.to === 'GBP' ? 'British Pound' :
                           rate.to === 'EUR' ? 'Euro' :
                           rate.to === 'GHS' ? 'Ghanaian Cedi' :
                           rate.to === 'KES' ? 'Kenyan Shilling' :
                           rate.to === 'ZAR' ? 'South African Rand' :
                           rate.to === 'XOF' ? 'West African CFA' :
                           'Central African CFA'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right font-mono">
                    {(1 / rate.rate).toFixed(2)}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className={`inline-flex items-center ${rate.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {rate.change >= 0 ? '↑' : '↓'} {Math.abs(rate.change)}%
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button className="text-blue-600 text-sm font-medium hover:text-blue-700">
                      Exchange
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rate Alerts */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Rate Alerts</h2>
        <p className="text-gray-600 mb-4">Get notified when rates reach your target</p>
        
        <div className="flex flex-col md:flex-row gap-4">
          <select className="input-field md:w-32">
            <option>USD/NGN</option>
            <option>GBP/NGN</option>
            <option>EUR/NGN</option>
          </select>
          <input
            type="number"
            placeholder="Target rate"
            className="input-field flex-1"
          />
          <button className="btn-primary">Set Alert</button>
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">No active alerts. Set one above to get notified.</p>
        </div>
      </div>
    </div>
  );
};

export default ExchangeRates;
