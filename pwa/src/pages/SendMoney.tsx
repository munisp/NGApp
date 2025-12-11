import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SendMoney: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    recipient: '',
    recipientType: 'phone',
    amount: '',
    currency: 'NGN',
    destinationCurrency: 'NGN',
    note: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
    } else {
      alert('Transfer initiated successfully!');
      navigate('/transactions');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="page-title">Send Money</h1>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {['Recipient', 'Amount', 'Confirm'].map((label, i) => (
          <div key={label} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step > i + 1 ? 'bg-green-500 text-white' :
              step === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {step > i + 1 ? '✓' : i + 1}
            </div>
            <span className={`ml-2 text-sm ${step === i + 1 ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
              {label}
            </span>
            {i < 2 && <div className="w-16 h-0.5 bg-gray-200 mx-4" />}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="card">
        {/* Step 1: Recipient */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Who are you sending to?</h2>
            
            <div className="flex space-x-4 mb-4">
              {['phone', 'email', 'bank'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData({ ...formData, recipientType: type })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    formData.recipientType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {type === 'phone' ? 'Phone' : type === 'email' ? 'Email' : 'Bank Account'}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.recipientType === 'phone' ? 'Phone Number' :
                 formData.recipientType === 'email' ? 'Email Address' : 'Account Number'}
              </label>
              <input
                type={formData.recipientType === 'email' ? 'email' : 'text'}
                name="recipient"
                value={formData.recipient}
                onChange={handleChange}
                className="input-field"
                placeholder={formData.recipientType === 'phone' ? '+234...' :
                            formData.recipientType === 'email' ? 'email@example.com' : 'Account number'}
                required
              />
            </div>

            {formData.recipientType === 'bank' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank</label>
                <select name="bank" className="input-field" required>
                  <option value="">Select bank</option>
                  <option value="gtb">GTBank</option>
                  <option value="access">Access Bank</option>
                  <option value="uba">UBA</option>
                  <option value="zenith">Zenith Bank</option>
                  <option value="first">First Bank</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Amount */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">How much are you sending?</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">You send</label>
                <div className="flex">
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    className="input-field rounded-r-none w-24"
                  >
                    <option value="NGN">NGN</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                    <option value="EUR">EUR</option>
                  </select>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    className="input-field rounded-l-none flex-1"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">They receive</label>
                <div className="flex">
                  <select
                    name="destinationCurrency"
                    value={formData.destinationCurrency}
                    onChange={handleChange}
                    className="input-field rounded-r-none w-24"
                  >
                    <option value="NGN">NGN</option>
                    <option value="GHS">GHS</option>
                    <option value="KES">KES</option>
                    <option value="ZAR">ZAR</option>
                  </select>
                  <input
                    type="text"
                    value={formData.amount ? (parseFloat(formData.amount) * 1).toLocaleString() : ''}
                    className="input-field rounded-l-none flex-1 bg-gray-50"
                    disabled
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Exchange rate</span>
                <span className="font-medium">1 {formData.currency} = 1 {formData.destinationCurrency}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-600">Transfer fee</span>
                <span className="font-medium">NGN 50.00</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
              <textarea
                name="note"
                value={formData.note}
                onChange={handleChange}
                className="input-field"
                rows={2}
                placeholder="Add a note for the recipient"
              />
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Confirm transfer</h2>
            
            <div className="p-4 bg-gray-50 rounded-lg space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Recipient</span>
                <span className="font-medium">{formData.recipient}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount</span>
                <span className="font-medium">{formData.currency} {parseFloat(formData.amount || '0').toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">They receive</span>
                <span className="font-medium">{formData.destinationCurrency} {parseFloat(formData.amount || '0').toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Fee</span>
                <span className="font-medium">NGN 50.00</span>
              </div>
              <hr />
              <div className="flex justify-between text-lg">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-blue-600">
                  {formData.currency} {(parseFloat(formData.amount || '0') + 50).toLocaleString()}
                </span>
              </div>
            </div>

            {formData.note && (
              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-gray-600">Note: {formData.note}</p>
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="btn-secondary"
            >
              Back
            </button>
          ) : (
            <div />
          )}
          <button type="submit" className="btn-primary">
            {step === 3 ? 'Confirm & Send' : 'Continue'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SendMoney;
