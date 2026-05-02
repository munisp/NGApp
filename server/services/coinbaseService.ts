/**
 * Coinbase Commerce Integration Service
 * 
 * Handles crypto payment processing and conversion via Coinbase Commerce API
 * Supports BTC, ETH, USDC, USDT
 */

import crypto from 'crypto';

// Coinbase Commerce API configuration
const COINBASE_API_URL = process.env.COINBASE_API_URL || 'https://api.commerce.coinbase.com';
const COINBASE_API_KEY = process.env.COINBASE_API_KEY || '';
const COINBASE_WEBHOOK_SECRET = process.env.COINBASE_WEBHOOK_SECRET || '';

export interface CryptoCharge {
  id: string;
  code: string;
  name: string;
  description: string;
  pricing_type: 'fixed_price' | 'no_price';
  local_price: {
    amount: string;
    currency: string;
  };
  addresses: {
    bitcoin?: string;
    ethereum?: string;
    usdc?: string;
    tether?: string;
  };
  pricing: {
    bitcoin?: { amount: string; currency: string };
    ethereum?: { amount: string; currency: string };
    usdc?: { amount: string; currency: string };
    tether?: { amount: string; currency: string };
  };
  hosted_url: string;
  created_at: string;
  expires_at: string;
  confirmed_at?: string;
  timeline: Array<{
    time: string;
    status: string;
    context?: string;
  }>;
  metadata: Record<string, any>;
}

export interface ExchangeRateQuote {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  amount: number;
  convertedAmount: number;
  fee: number;
  totalCost: number;
  expiresAt: Date;
}

export interface CryptoPaymentStatus {
  chargeId: string;
  status: 'pending' | 'confirmed' | 'completed' | 'failed' | 'expired';
  confirmations: number;
  transactionHash?: string;
  paidAmount?: string;
  paidCurrency?: string;
  convertedAmount?: number;
  convertedCurrency?: string;
}

/**
 * Create a crypto charge for payment
 */
export async function createCryptoCharge(params: {
  remittanceId: string;
  amount: number;
  currency: string; // USD, NGN, etc.
  cryptoCurrency?: string; // BTC, ETH, USDC, USDT (optional, allow all if not specified)
  description: string;
  metadata?: Record<string, any>;
}): Promise<CryptoCharge> {
  const response = await fetch(`${COINBASE_API_URL}/charges`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CC-Api-Key': COINBASE_API_KEY,
      'X-CC-Version': '2018-03-22',
    },
    body: JSON.stringify({
      name: `Remittance ${params.remittanceId}`,
      description: params.description,
      pricing_type: 'fixed_price',
      local_price: {
        amount: params.amount.toString(),
        currency: params.currency,
      },
      metadata: {
        remittanceId: params.remittanceId,
        ...params.metadata,
      },
      redirect_url: `${process.env.FRONTEND_URL}/remittance/${params.remittanceId}/success`,
      cancel_url: `${process.env.FRONTEND_URL}/remittance/${params.remittanceId}/cancel`,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Coinbase API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.data as CryptoCharge;
}

/**
 * Get charge status
 */
export async function getCryptoChargeStatus(chargeId: string): Promise<CryptoPaymentStatus> {
  const response = await fetch(`${COINBASE_API_URL}/charges/${chargeId}`, {
    method: 'GET',
    headers: {
      'X-CC-Api-Key': COINBASE_API_KEY,
      'X-CC-Version': '2018-03-22',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get charge status: ${response.statusText}`);
  }

  const data = await response.json();
  const charge = data.data as CryptoCharge;

  // Determine status from timeline
  const latestEvent = charge.timeline[charge.timeline.length - 1];
  let status: CryptoPaymentStatus['status'] = 'pending';
  
  if (latestEvent.status === 'COMPLETED') {
    status = 'completed';
  } else if (latestEvent.status === 'CONFIRMED') {
    status = 'confirmed';
  } else if (latestEvent.status === 'EXPIRED') {
    status = 'expired';
  } else if (latestEvent.status === 'FAILED') {
    status = 'failed';
  }

  // Extract payment details from the first payment
  const payments = charge.timeline.filter(e => e.status === 'NEW' && e.context);
  const payment = payments.length > 0 ? JSON.parse(payments[0].context || '{}') : null;

  return {
    chargeId: charge.id,
    status,
    confirmations: payment?.confirmations || 0,
    transactionHash: payment?.transaction?.hash,
    paidAmount: payment?.value?.crypto?.amount,
    paidCurrency: payment?.value?.crypto?.currency,
    convertedAmount: payment?.value?.local?.amount ? parseFloat(payment.value.local.amount) : undefined,
    convertedCurrency: payment?.value?.local?.currency,
  };
}

/**
 * Get exchange rate quote for crypto to fiat conversion
 */
export async function getExchangeRateQuote(params: {
  fromCurrency: string; // BTC, ETH, USDC, USDT
  toCurrency: string; // USD, NGN, etc.
  amount: number;
}): Promise<ExchangeRateQuote> {
  // Coinbase Commerce doesn't have a direct rate API, so we use the charge preview
  const response = await fetch(`${COINBASE_API_URL}/charges`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CC-Api-Key': COINBASE_API_KEY,
      'X-CC-Version': '2018-03-22',
    },
    body: JSON.stringify({
      name: 'Rate Quote',
      description: 'Exchange rate quote',
      pricing_type: 'fixed_price',
      local_price: {
        amount: params.amount.toString(),
        currency: params.toCurrency,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get exchange rate: ${response.statusText}`);
  }

  const data = await response.json();
  const charge = data.data as CryptoCharge;

  // Extract rate from pricing
  const cryptoKey = params.fromCurrency.toLowerCase() as keyof typeof charge.pricing;
  const cryptoPricing = charge.pricing[cryptoKey];

  if (!cryptoPricing) {
    throw new Error(`Currency ${params.fromCurrency} not supported`);
  }

  const cryptoAmount = parseFloat(cryptoPricing.amount);
  const rate = params.amount / cryptoAmount;
  
  // Coinbase fee is typically 1%
  const fee = cryptoAmount * 0.01;
  const totalCost = cryptoAmount + fee;

  return {
    fromCurrency: params.fromCurrency,
    toCurrency: params.toCurrency,
    rate,
    amount: cryptoAmount,
    convertedAmount: params.amount,
    fee,
    totalCost,
    expiresAt: new Date(charge.expires_at),
  };
}

/**
 * Convert crypto to fiat (initiate conversion)
 */
export async function convertCryptoToFiat(params: {
  chargeId: string;
  remittanceId: string;
}): Promise<{
  conversionId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  estimatedCompletionTime: Date;
}> {
  // Check charge status first
  const chargeStatus = await getCryptoChargeStatus(params.chargeId);

  if (chargeStatus.status !== 'confirmed' && chargeStatus.status !== 'completed') {
    throw new Error(`Cannot convert: charge status is ${chargeStatus.status}`);
  }

  // In production, this would trigger an actual conversion
  // For now, we simulate the conversion process
  const conversionId = `conv_${crypto.randomBytes(16).toString('hex')}`;
  
  // Coinbase typically completes conversions within 1 hour
  const estimatedCompletionTime = new Date(Date.now() + 60 * 60 * 1000);

  return {
    conversionId,
    status: 'processing',
    estimatedCompletionTime,
  };
}

/**
 * Get conversion status
 */
export async function getConversionStatus(conversionId: string): Promise<{
  conversionId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fiatAmount?: number;
  fiatCurrency?: string;
  completedAt?: Date;
  errorMessage?: string;
}> {
  // In production, this would query Coinbase's conversion API
  // For now, we simulate the status check
  
  // Simulate completed conversion after 1 hour
  return {
    conversionId,
    status: 'completed',
    fiatAmount: 500000, // Example: 500,000 NGN
    fiatCurrency: 'NGN',
    completedAt: new Date(),
  };
}

/**
 * Verify webhook signature from Coinbase
 */
export function verifyCoinbaseWebhook(
  payload: string,
  signature: string
): boolean {
  const hmac = crypto.createHmac('sha256', COINBASE_WEBHOOK_SECRET);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Handle Coinbase webhook event
 */
export async function handleCoinbaseWebhook(event: {
  id: string;
  type: string;
  data: CryptoCharge;
}): Promise<{
  remittanceId: string;
  status: string;
  shouldUpdateRemittance: boolean;
}> {
  const charge = event.data;
  const remittanceId = charge.metadata.remittanceId;

  if (!remittanceId) {
    throw new Error('No remittanceId in webhook metadata');
  }

  // Map Coinbase event types to remittance statuses
  const statusMap: Record<string, string> = {
    'charge:created': 'crypto_pending',
    'charge:confirmed': 'crypto_confirmed',
    'charge:failed': 'crypto_failed',
    'charge:delayed': 'crypto_delayed',
    'charge:pending': 'crypto_pending',
    'charge:resolved': 'crypto_completed',
  };

  const status = statusMap[event.type] || 'unknown';
  const shouldUpdateRemittance = status !== 'unknown';

  return {
    remittanceId,
    status,
    shouldUpdateRemittance,
  };
}

/**
 * Get supported cryptocurrencies
 */
export function getSupportedCryptocurrencies(): Array<{
  code: string;
  name: string;
  symbol: string;
  decimals: number;
}> {
  return [
    { code: 'BTC', name: 'Bitcoin', symbol: '₿', decimals: 8 },
    { code: 'ETH', name: 'Ethereum', symbol: 'Ξ', decimals: 18 },
    { code: 'USDC', name: 'USD Coin', symbol: 'USDC', decimals: 6 },
    { code: 'USDT', name: 'Tether', symbol: 'USDT', decimals: 6 },
  ];
}

/**
 * Validate crypto address format
 */
export function validateCryptoAddress(address: string, currency: string): boolean {
  const patterns: Record<string, RegExp> = {
    BTC: /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/,
    ETH: /^0x[a-fA-F0-9]{40}$/,
    USDC: /^0x[a-fA-F0-9]{40}$/, // ERC-20 on Ethereum
    USDT: /^0x[a-fA-F0-9]{40}$/, // ERC-20 on Ethereum
  };

  const pattern = patterns[currency];
  if (!pattern) {
    return false;
  }

  return pattern.test(address);
}
