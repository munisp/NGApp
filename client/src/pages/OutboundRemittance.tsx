import React, { useState } from 'react';

interface Corridor {
  id: string;
  name: string;
  currency: string;
  category: string;
  fee: string;
}

const corridors: Corridor[] = [
  { id: 'NG-GH', name: 'Nigeria → Ghana', currency: 'GHS', category: 'West Africa Labor', fee: '$0.30' },
  { id: 'NG-GB', name: 'Nigeria → UK', currency: 'GBP', category: 'Education', fee: '$0.80' },
  { id: 'NG-US', name: 'Nigeria → USA', currency: 'USD', category: 'Education', fee: '$0.75' },
  { id: 'NG-CA', name: 'Nigeria → Canada', currency: 'CAD', category: 'Education', fee: '$0.85' },
  { id: 'NG-IN', name: 'Nigeria → India', currency: 'INR', category: 'Medical', fee: '$0.50' },
  { id: 'NG-CN', name: 'Nigeria → China', currency: 'CNY', category: 'Premium Business', fee: '$1.20' },
  { id: 'NG-KE', name: 'Nigeria → Kenya', currency: 'KES', category: 'General', fee: '$0.35' },
  { id: 'NG-SN', name: 'Nigeria → Senegal', currency: 'XOF', category: 'West Africa Labor', fee: '$0.40' },
  { id: 'NG-ZA', name: 'Nigeria → South Africa', currency: 'ZAR', category: 'General', fee: '$0.40' },
  { id: 'NG-AE', name: 'Nigeria → UAE', currency: 'AED', category: 'Premium Business', fee: '$1.00' },
];

type Step = 'corridor' | 'amount' | 'beneficiary' | 'review' | 'submitted';

export default function OutboundRemittance() {
  const [step, setStep] = useState<Step>('corridor');
  const [selectedCorridor, setSelectedCorridor] = useState<Corridor | null>(null);
  const [amount, setAmount] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryAccount, setBeneficiaryAccount] = useState('');
  const [purpose, setPurpose] = useState('family_support');
  const [transferId, setTransferId] = useState('');

  const handleSubmit = () => {
    setTransferId(`TRF-${Date.now()}`);
    setStep('submitted');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Send Money Abroad</h1>

      {/* Progress indicator */}
      <div className="flex items-center mb-8">
        {['corridor', 'amount', 'beneficiary', 'review'].map((s, i) => (
          <React.Fragment key={s}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === s ? 'bg-blue-600 text-white' :
              ['corridor', 'amount', 'beneficiary', 'review'].indexOf(step) > i ? 'bg-green-500 text-white' :
              'bg-gray-200 text-gray-500'
            }`}>{i + 1}</div>
            {i < 3 && <div className={`flex-1 h-1 mx-2 ${['corridor', 'amount', 'beneficiary', 'review'].indexOf(step) > i ? 'bg-green-500' : 'bg-gray-200'}`} />}
          </React.Fragment>
        ))}
      </div>

      {step === 'corridor' && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Select Destination</h2>
          {corridors.map((c) => (
            <button
              key={c.id}
              onClick={() => { setSelectedCorridor(c); setStep('amount'); }}
              className={`w-full p-4 rounded-lg border text-left transition ${
                selectedCorridor?.id === c.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{c.name}</p>
                  <p className="text-sm text-gray-500">{c.category} • {c.currency}</p>
                </div>
                <span className="text-green-600 text-sm font-medium">{c.fee}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {step === 'amount' && selectedCorridor && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Enter Amount</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">You send (NGN)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount in Naira"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Destination: {selectedCorridor.currency}</p>
            <p className="text-sm text-gray-600">Corridor fee: {selectedCorridor.fee}</p>
            <p className="text-sm text-green-600 font-medium">Estimated delivery: Same day</p>
          </div>
          <div className="flex space-x-3">
            <button onClick={() => setStep('corridor')} className="flex-1 p-3 border border-gray-300 rounded-lg">Back</button>
            <button onClick={() => setStep('beneficiary')} disabled={!amount} className="flex-1 p-3 bg-blue-600 text-white rounded-lg disabled:opacity-50">Continue</button>
          </div>
        </div>
      )}

      {step === 'beneficiary' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Beneficiary Details</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={beneficiaryName}
              onChange={(e) => setBeneficiaryName(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account / Mobile</label>
            <input
              type="text"
              value={beneficiaryAccount}
              onChange={(e) => setBeneficiaryAccount(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg">
              <option value="family_support">Family Support</option>
              <option value="education">Education/Tuition</option>
              <option value="medical">Medical</option>
              <option value="business">Business Payment</option>
              <option value="personal">Personal</option>
            </select>
          </div>
          <div className="flex space-x-3">
            <button onClick={() => setStep('amount')} className="flex-1 p-3 border border-gray-300 rounded-lg">Back</button>
            <button onClick={() => setStep('review')} disabled={!beneficiaryName || !beneficiaryAccount} className="flex-1 p-3 bg-blue-600 text-white rounded-lg disabled:opacity-50">Continue</button>
          </div>
        </div>
      )}

      {step === 'review' && selectedCorridor && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Review & Confirm</h2>
          <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-3">
            <div className="flex justify-between"><span className="text-gray-500">Corridor</span><span className="font-medium">{selectedCorridor.name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-medium">₦{Number(amount).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Currency</span><span className="font-medium">{selectedCorridor.currency}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Beneficiary</span><span className="font-medium">{beneficiaryName}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Account</span><span className="font-medium">{beneficiaryAccount}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Fee</span><span className="font-medium text-green-600">{selectedCorridor.fee}</span></div>
          </div>
          <p className="text-xs text-gray-500">
            This transfer is subject to AML/CFT/Sanctions compliance screening.
            Transfers to sanctioned countries will be blocked automatically.
          </p>
          <div className="flex space-x-3">
            <button onClick={() => setStep('beneficiary')} className="flex-1 p-3 border border-gray-300 rounded-lg">Back</button>
            <button onClick={handleSubmit} className="flex-1 p-3 bg-green-600 text-white rounded-lg font-medium">Confirm & Send</button>
          </div>
        </div>
      )}

      {step === 'submitted' && (
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Transfer Submitted</h2>
          <p className="text-gray-500">ID: {transferId}</p>
          <p className="text-sm text-gray-600">Your transfer is being processed through compliance screening.</p>
          <div className="bg-gray-50 p-4 rounded-lg text-left space-y-2">
            <p className="text-sm font-medium">Lifecycle Status:</p>
            {['A. Request Admitted', 'B. Workflow Created', 'C. Compliance Screening'].map((s) => (
              <div key={s} className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-green-500" />
                <span className="text-sm">{s}</span>
              </div>
            ))}
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-sm font-medium">D. Pricing & Funding</span>
            </div>
            {['E. Routing & Execution', 'F. Settlement', 'G. Audit'].map((s) => (
              <div key={s} className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-gray-300" />
                <span className="text-sm text-gray-400">{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
