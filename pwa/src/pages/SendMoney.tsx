import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  inverseRate: number;
  lastUpdated: string;
  provider: string;
  validUntil: string;
}

interface FeeBreakdown {
  transferFee: number;
  exchangeMargin: number;
  networkFee: number;
  totalFees: number;
  feePercentage: number;
}

interface DeliveryEstimate {
  method: string;
  estimatedTime: string;
  minHours: number;
  maxHours: number;
  available: boolean;
}

interface RateLock {
  id: string;
  rate: number;
  lockedAt: string;
  expiresAt: string;
  isLocked: boolean;
  remainingSeconds: number;
}

const SendMoney: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    recipient: '',
    recipientType: 'phone',
    recipientName: '',
    amount: '',
    currency: 'GBP',
    destinationCurrency: 'NGN',
    note: '',
    deliveryMethod: 'bank_transfer',
  });

  // FX Transparency State
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
  const [feeBreakdown, setFeeBreakdown] = useState<FeeBreakdown | null>(null);
  const [deliveryEstimates, setDeliveryEstimates] = useState<DeliveryEstimate[]>([]);
  const [rateLock, setRateLock] = useState<RateLock | null>(null);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [rateRefreshCountdown, setRateRefreshCountdown] = useState(30);
  const [showRateHistory, setShowRateHistory] = useState(false);

  // Mock exchange rates (in production, fetch from exchange-rate service)
  const EXCHANGE_RATES: Record<string, Record<string, number>> = {
    GBP: { NGN: 1950.50, GHS: 15.20, KES: 165.30, ZAR: 23.45, USD: 1.27 },
    USD: { NGN: 1535.00, GHS: 11.95, KES: 130.20, ZAR: 18.45, GBP: 0.79 },
    EUR: { NGN: 1680.25, GHS: 13.10, KES: 142.50, ZAR: 20.15, GBP: 0.86 },
    NGN: { GHS: 0.0078, KES: 0.085, ZAR: 0.012, USD: 0.00065, GBP: 0.00051 },
  };

  // Fee structure by corridor
  const FEE_STRUCTURE: Record<string, { fixed: number; percentage: number; margin: number }> = {
    'GBP-NGN': { fixed: 0.99, percentage: 0.5, margin: 0.3 },
    'USD-NGN': { fixed: 2.99, percentage: 0.5, margin: 0.4 },
    'EUR-NGN': { fixed: 1.99, percentage: 0.5, margin: 0.35 },
    'NGN-GHS': { fixed: 100, percentage: 1.0, margin: 0.5 },
    'NGN-KES': { fixed: 150, percentage: 1.0, margin: 0.5 },
    default: { fixed: 50, percentage: 1.5, margin: 0.5 },
  };

  // Delivery methods with estimates
  const DELIVERY_METHODS: Record<string, DeliveryEstimate[]> = {
    NGN: [
      { method: 'bank_transfer', estimatedTime: 'Instant - 30 mins', minHours: 0, maxHours: 0.5, available: true },
      { method: 'mobile_money', estimatedTime: 'Instant', minHours: 0, maxHours: 0.1, available: true },
      { method: 'cash_pickup', estimatedTime: '1 - 4 hours', minHours: 1, maxHours: 4, available: true },
    ],
    GHS: [
      { method: 'bank_transfer', estimatedTime: '1 - 2 hours', minHours: 1, maxHours: 2, available: true },
      { method: 'mobile_money', estimatedTime: 'Instant - 30 mins', minHours: 0, maxHours: 0.5, available: true },
      { method: 'cash_pickup', estimatedTime: '2 - 6 hours', minHours: 2, maxHours: 6, available: true },
    ],
    KES: [
      { method: 'bank_transfer', estimatedTime: '1 - 3 hours', minHours: 1, maxHours: 3, available: true },
      { method: 'mobile_money', estimatedTime: 'Instant', minHours: 0, maxHours: 0.1, available: true },
      { method: 'cash_pickup', estimatedTime: '4 - 8 hours', minHours: 4, maxHours: 8, available: false },
    ],
    default: [
      { method: 'bank_transfer', estimatedTime: '1 - 2 business days', minHours: 24, maxHours: 48, available: true },
    ],
  };

  // Fetch exchange rate
  const fetchExchangeRate = useCallback(() => {
    setIsLoadingRate(true);
    
    // Simulate API call
    setTimeout(() => {
      const from = formData.currency;
      const to = formData.destinationCurrency;
      const baseRate = EXCHANGE_RATES[from]?.[to] || 1;
      
      // Add small random variation to simulate live rates
      const variation = (Math.random() - 0.5) * 0.02 * baseRate;
      const rate = baseRate + variation;
      
      setExchangeRate({
        from,
        to,
        rate: parseFloat(rate.toFixed(4)),
        inverseRate: parseFloat((1 / rate).toFixed(8)),
        lastUpdated: new Date().toISOString(),
        provider: 'Market Rate',
        validUntil: new Date(Date.now() + 30000).toISOString(),
      });
      
      setIsLoadingRate(false);
      setRateRefreshCountdown(30);
    }, 500);
  }, [formData.currency, formData.destinationCurrency]);

  // Calculate fees
  const calculateFees = useCallback(() => {
    const amount = parseFloat(formData.amount) || 0;
    if (amount <= 0) {
      setFeeBreakdown(null);
      return;
    }

    const corridor = `${formData.currency}-${formData.destinationCurrency}`;
    const fees = FEE_STRUCTURE[corridor] || FEE_STRUCTURE.default;
    
    const transferFee = fees.fixed + (amount * fees.percentage / 100);
    const exchangeMargin = amount * fees.margin / 100;
    const networkFee = formData.deliveryMethod === 'cash_pickup' ? 2.00 : 0;
    const totalFees = transferFee + networkFee;
    
    setFeeBreakdown({
      transferFee: parseFloat(transferFee.toFixed(2)),
      exchangeMargin: parseFloat(exchangeMargin.toFixed(2)),
      networkFee: parseFloat(networkFee.toFixed(2)),
      totalFees: parseFloat(totalFees.toFixed(2)),
      feePercentage: parseFloat(((totalFees / amount) * 100).toFixed(2)),
    });
  }, [formData.amount, formData.currency, formData.destinationCurrency, formData.deliveryMethod]);

  // Update delivery estimates
  const updateDeliveryEstimates = useCallback(() => {
    const estimates = DELIVERY_METHODS[formData.destinationCurrency] || DELIVERY_METHODS.default;
    setDeliveryEstimates(estimates);
  }, [formData.destinationCurrency]);

  // Lock rate
  const lockRate = () => {
    if (!exchangeRate) return;
    
    const lockDuration = 600; // 10 minutes
    setRateLock({
      id: `lock_${Date.now()}`,
      rate: exchangeRate.rate,
      lockedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + lockDuration * 1000).toISOString(),
      isLocked: true,
      remainingSeconds: lockDuration,
    });
  };

  // Unlock rate
  const unlockRate = () => {
    setRateLock(null);
    fetchExchangeRate();
  };

  // Effects
  useEffect(() => {
    fetchExchangeRate();
    updateDeliveryEstimates();
  }, [formData.currency, formData.destinationCurrency, fetchExchangeRate, updateDeliveryEstimates]);

  useEffect(() => {
    calculateFees();
  }, [formData.amount, formData.deliveryMethod, calculateFees]);

  // Rate refresh countdown
  useEffect(() => {
    if (rateLock?.isLocked) return;
    
    const interval = setInterval(() => {
      setRateRefreshCountdown((prev) => {
        if (prev <= 1) {
          fetchExchangeRate();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [rateLock, fetchExchangeRate]);

  // Rate lock countdown
  useEffect(() => {
    if (!rateLock?.isLocked) return;

    const interval = setInterval(() => {
      setRateLock((prev) => {
        if (!prev) return null;
        const remaining = prev.remainingSeconds - 1;
        if (remaining <= 0) {
          return null;
        }
        return { ...prev, remainingSeconds: remaining };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [rateLock?.isLocked]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Unlock rate if currency changes
    if ((name === 'currency' || name === 'destinationCurrency') && rateLock) {
      setRateLock(null);
    }
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

  // Calculate received amount
  const getReceivedAmount = () => {
    const amount = parseFloat(formData.amount) || 0;
    const rate = rateLock?.rate || exchangeRate?.rate || 1;
    return (amount * rate).toFixed(2);
  };

  // Format time remaining
  const formatTimeRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get delivery method label
  const getDeliveryMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      bank_transfer: 'Bank Transfer',
      mobile_money: 'Mobile Money',
      cash_pickup: 'Cash Pickup',
    };
    return labels[method] || method;
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name</label>
              <input
                type="text"
                name="recipientName"
                value={formData.recipientName}
                onChange={handleChange}
                className="input-field"
                placeholder="Full name as registered"
                required
              />
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
                  <option value="kuda">Kuda Bank</option>
                  <option value="opay">OPay</option>
                </select>
              </div>
            )}

            {/* Destination Country/Currency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
              <select
                name="destinationCurrency"
                value={formData.destinationCurrency}
                onChange={handleChange}
                className="input-field"
              >
                <option value="NGN">Nigeria (NGN)</option>
                <option value="GHS">Ghana (GHS)</option>
                <option value="KES">Kenya (KES)</option>
                <option value="ZAR">South Africa (ZAR)</option>
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Amount with FX Transparency */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">How much are you sending?</h2>
            
            {/* Amount Input */}
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
                    <option value="GBP">GBP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="NGN">NGN</option>
                  </select>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    className="input-field rounded-l-none flex-1"
                    placeholder="0.00"
                    min="1"
                    step="0.01"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">They receive</label>
                <div className="flex">
                  <span className="input-field rounded-r-none w-24 bg-gray-100 flex items-center justify-center font-medium">
                    {formData.destinationCurrency}
                  </span>
                  <input
                    type="text"
                    value={formData.amount ? parseFloat(getReceivedAmount()).toLocaleString() : ''}
                    className="input-field rounded-l-none flex-1 bg-gray-50 font-semibold text-green-600"
                    disabled
                  />
                </div>
              </div>
            </div>

            {/* Live Exchange Rate Display */}
            <div className={`p-4 rounded-lg border-2 ${rateLock?.isLocked ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">Exchange Rate</span>
                  {isLoadingRate && (
                    <span className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></span>
                  )}
                </div>
                {rateLock?.isLocked ? (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                      Rate Locked - {formatTimeRemaining(rateLock.remainingSeconds)}
                    </span>
                    <button
                      type="button"
                      onClick={unlockRate}
                      className="text-xs text-red-600 hover:text-red-700 underline"
                    >
                      Unlock
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">
                      Refreshes in {rateRefreshCountdown}s
                    </span>
                    <button
                      type="button"
                      onClick={fetchExchangeRate}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Refresh
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-2xl font-bold text-gray-900">
                    1 {formData.currency} = {(rateLock?.rate || exchangeRate?.rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {formData.destinationCurrency}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    Mid-market rate: {((rateLock?.rate || exchangeRate?.rate || 0) * 1.003).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {formData.destinationCurrency}
                  </p>
                </div>
                {!rateLock?.isLocked && exchangeRate && (
                  <button
                    type="button"
                    onClick={lockRate}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Lock Rate (10 min)
                  </button>
                )}
              </div>

              {/* Rate comparison */}
              <button
                type="button"
                onClick={() => setShowRateHistory(!showRateHistory)}
                className="text-xs text-blue-600 hover:text-blue-700 mt-2 underline"
              >
                {showRateHistory ? 'Hide' : 'Show'} rate comparison
              </button>
              
              {showRateHistory && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <p className="text-xs font-medium text-gray-700 mb-2">How we compare:</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Our rate</span>
                      <span className="font-medium text-green-600">{(rateLock?.rate || exchangeRate?.rate || 0).toFixed(2)} {formData.destinationCurrency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Banks (avg)</span>
                      <span className="text-gray-500">{((rateLock?.rate || exchangeRate?.rate || 0) * 0.95).toFixed(2)} {formData.destinationCurrency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Bureau de change</span>
                      <span className="text-gray-500">{((rateLock?.rate || exchangeRate?.rate || 0) * 0.92).toFixed(2)} {formData.destinationCurrency}</span>
                    </div>
                    <p className="text-green-600 font-medium mt-2">
                      You save up to {((rateLock?.rate || exchangeRate?.rate || 0) * 0.08 * (parseFloat(formData.amount) || 0)).toFixed(2)} {formData.destinationCurrency}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Fee Breakdown */}
            {feeBreakdown && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-gray-700">Fee Breakdown</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    {feeBreakdown.feePercentage}% total
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Transfer fee</span>
                    <span className="font-medium">{formData.currency} {feeBreakdown.transferFee.toFixed(2)}</span>
                  </div>
                  {feeBreakdown.networkFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cash pickup fee</span>
                      <span className="font-medium">{formData.currency} {feeBreakdown.networkFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Exchange margin (included in rate)</span>
                    <span>{formData.currency} {feeBreakdown.exchangeMargin.toFixed(2)}</span>
                  </div>
                  <hr className="my-2" />
                  <div className="flex justify-between font-semibold">
                    <span>Total fees</span>
                    <span className="text-blue-600">{formData.currency} {feeBreakdown.totalFees.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Delivery Method & Time Estimates */}
            <div className="p-4 bg-white border rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-3">Delivery Method</label>
              <div className="space-y-2">
                {deliveryEstimates.map((estimate) => (
                  <label
                    key={estimate.method}
                    className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                      formData.deliveryMethod === estimate.method
                        ? 'border-blue-500 bg-blue-50'
                        : estimate.available
                        ? 'border-gray-200 hover:border-gray-300'
                        : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="deliveryMethod"
                        value={estimate.method}
                        checked={formData.deliveryMethod === estimate.method}
                        onChange={handleChange}
                        disabled={!estimate.available}
                        className="mr-3"
                      />
                      <div>
                        <span className="font-medium">{getDeliveryMethodLabel(estimate.method)}</span>
                        {!estimate.available && (
                          <span className="ml-2 text-xs text-red-500">Unavailable</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-medium ${
                        estimate.minHours === 0 ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {estimate.estimatedTime}
                      </span>
                      {estimate.method === 'cash_pickup' && (
                        <p className="text-xs text-gray-500">+{formData.currency} 2.00</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Note */}
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

        {/* Step 3: Confirm with Full Transparency */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Confirm transfer</h2>
            
            {/* Recipient Summary */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Recipient</h3>
              <p className="font-semibold">{formData.recipientName}</p>
              <p className="text-sm text-gray-600">{formData.recipient}</p>
              <p className="text-xs text-gray-500 mt-1">
                {getDeliveryMethodLabel(formData.deliveryMethod)} to {formData.destinationCurrency === 'NGN' ? 'Nigeria' : formData.destinationCurrency === 'GHS' ? 'Ghana' : formData.destinationCurrency === 'KES' ? 'Kenya' : 'South Africa'}
              </p>
            </div>

            {/* Transfer Summary */}
            <div className="p-4 bg-white border-2 border-blue-200 rounded-lg space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">You send</span>
                <span className="font-semibold">{formData.currency} {parseFloat(formData.amount || '0').toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Transfer fee</span>
                <span className="text-gray-600">- {formData.currency} {feeBreakdown?.totalFees.toFixed(2) || '0.00'}</span>
              </div>
              <hr />
              <div className="flex justify-between">
                <span className="text-gray-600">Amount converted</span>
                <span className="font-medium">{formData.currency} {(parseFloat(formData.amount || '0') - (feeBreakdown?.totalFees || 0)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Exchange rate</span>
                <span className="text-gray-600">
                  1 {formData.currency} = {(rateLock?.rate || exchangeRate?.rate || 0).toFixed(2)} {formData.destinationCurrency}
                  {rateLock?.isLocked && <span className="ml-1 text-green-600">(locked)</span>}
                </span>
              </div>
              <hr />
              <div className="flex justify-between text-lg">
                <span className="font-semibold">They receive</span>
                <span className="font-bold text-green-600">
                  {formData.destinationCurrency} {parseFloat(getReceivedAmount()).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Estimated delivery</span>
                <span className="text-blue-600 font-medium">
                  {deliveryEstimates.find(e => e.method === formData.deliveryMethod)?.estimatedTime || 'N/A'}
                </span>
              </div>
            </div>

            {/* Total to Pay */}
            <div className="p-4 bg-blue-600 text-white rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-blue-100">Total to pay</span>
                <span className="text-2xl font-bold">
                  {formData.currency} {(parseFloat(formData.amount || '0') + (feeBreakdown?.totalFees || 0)).toFixed(2)}
                </span>
              </div>
            </div>

            {formData.note && (
              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-gray-600">Note: {formData.note}</p>
              </div>
            )}

            {/* Rate Lock Warning */}
            {rateLock?.isLocked && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center">
                <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-sm text-green-700">
                  Rate locked for {formatTimeRemaining(rateLock.remainingSeconds)}. Complete your transfer to guarantee this rate.
                </span>
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
