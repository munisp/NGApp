/**
 * WASM Integration for EscrowProtect PWA
 * 
 * This module provides high-performance client-side processing using
 * Rust-compiled WebAssembly modules for:
 * - OCR preprocessing (image enhancement for text extraction)
 * - Commerce detection (Nigerian price patterns, seller signals)
 * - Risk scoring (transaction risk assessment)
 * - Currency conversion (multi-currency support)
 */

// Note: WASM module types are defined inline where used
// The actual WASM module is loaded dynamically at runtime

// Result types
export interface PriceDetection {
  amount: number;
  currency: string;
  original_text: string;
  confidence: number;
  normalized: string;
}

export interface CommerceSignals {
  is_commerce: boolean;
  confidence: number;
  prices: PriceDetection[];
  seller_signals: string[];
  buyer_signals: string[];
  locations: string[];
  contact_info: string[];
  currency_detected: string;
}

export interface RiskFactor {
  name: string;
  weight: number;
  value: number;
  description: string;
}

export interface RiskAssessment {
  score: number;
  level: string;
  factors: RiskFactor[];
  recommendation: string;
}

export interface ExchangeResult {
  from_amount: number;
  from_currency: string;
  to_amount: number;
  to_currency: string;
  rate: number;
  fee: number;
  fee_percentage: number;
  timestamp: string;
}

// WASM module state
let wasmModule: any = null;
let wasmLoading: Promise<void> | null = null;
let wasmAvailable = false;

/**
 * Initialize WASM module
 * Falls back to JavaScript implementations if WASM is not available
 */
export async function initWasm(): Promise<boolean> {
  if (wasmModule) {
    return wasmAvailable;
  }

  if (wasmLoading) {
    await wasmLoading;
    return wasmAvailable;
  }

  wasmLoading = (async () => {
    try {
      // Try to load WASM module dynamically
      // This will fail gracefully if the WASM module is not available
      const wasmPath = '/wasm/escrow_wasm.js';
      const wasm = await import(/* @vite-ignore */ wasmPath);
      if (wasm.default) {
        await wasm.default();
      }
      wasmModule = wasm;
      wasmAvailable = true;
      console.log('[WASM] Module loaded successfully');
    } catch (error) {
      // WASM not available - this is expected in development
      // JavaScript fallbacks will be used instead
      console.info('[WASM] Using JavaScript fallbacks (WASM module not available)');
      wasmAvailable = false;
    }
  })();

  await wasmLoading;
  return wasmAvailable;
}

/**
 * Check if WASM is available
 */
export function isWasmAvailable(): boolean {
  return wasmAvailable;
}

// ============================================
// Image Processing (OCR Preprocessing)
// ============================================

/**
 * Convert image to grayscale for OCR preprocessing
 */
export function toGrayscale(imageData: ImageData): ImageData {
  if (wasmAvailable && wasmModule) {
    const processor = new wasmModule.ImageProcessor(imageData.width, imageData.height);
    const result = processor.to_grayscale(new Uint8Array(imageData.data));
    return new ImageData(new Uint8ClampedArray(result), imageData.width, imageData.height);
  }

  // JavaScript fallback
  const data = new Uint8ClampedArray(imageData.data);
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
  return new ImageData(data, imageData.width, imageData.height);
}

/**
 * Enhance image contrast for better OCR
 */
export function enhanceContrast(imageData: ImageData, factor: number = 1.5): ImageData {
  if (wasmAvailable && wasmModule) {
    const processor = new wasmModule.ImageProcessor(imageData.width, imageData.height);
    const result = processor.enhance_contrast(new Uint8Array(imageData.data), factor);
    return new ImageData(new Uint8ClampedArray(result), imageData.width, imageData.height);
  }

  // JavaScript fallback
  const data = new Uint8ClampedArray(imageData.data);
  const mid = 128;
  for (let i = 0; i < data.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      const adjusted = mid + (data[i + j] - mid) * factor;
      data[i + j] = Math.max(0, Math.min(255, Math.round(adjusted)));
    }
  }
  return new ImageData(data, imageData.width, imageData.height);
}

// ============================================
// Commerce Detection
// ============================================

/**
 * Detect commerce signals in text (prices, seller signals, etc.)
 */
export function detectCommerce(text: string, minConfidence: number = 0.5): CommerceSignals {
  if (wasmAvailable && wasmModule) {
    const detector = new wasmModule.CommerceDetector(minConfidence);
    return detector.detect(text);
  }

  // JavaScript fallback - simplified detection
  return detectCommerceJS(text, minConfidence);
}

/**
 * JavaScript fallback for commerce detection
 */
function detectCommerceJS(text: string, minConfidence: number): CommerceSignals {
  const textLower = text.toLowerCase();
  const prices: PriceDetection[] = [];
  const sellerSignals: string[] = [];
  const buyerSignals: string[] = [];
  const locations: string[] = [];
  const contactInfo: string[] = [];

  // Nigerian Naira patterns
  const ngnPatterns = [
    /₦\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
    /NGN\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
    /(\d+(?:\.\d+)?)\s*k\b/gi,
  ];

  for (const pattern of ngnPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      let amount = parseFloat(match[1].replace(/,/g, ''));
      if (match[0].toLowerCase().includes('k')) {
        amount *= 1000;
      }
      if (amount >= 100 && amount <= 100000000) {
        prices.push({
          amount,
          currency: 'NGN',
          original_text: match[0],
          confidence: 0.9,
          normalized: `₦${amount.toLocaleString()}`,
        });
      }
    }
  }

  // Seller signals
  const sellerPatterns = [
    /dm\s*(for|to)\s*(price|order|buy)/i,
    /available\s*(now|in\s*stock)/i,
    /delivery\s*(available|nationwide)/i,
    /whatsapp/i,
  ];
  for (const pattern of sellerPatterns) {
    if (pattern.test(textLower)) {
      const match = textLower.match(pattern);
      if (match) sellerSignals.push(match[0]);
    }
  }

  // Buyer signals
  const buyerPatterns = [/how\s*much/i, /price\s*\??/i, /interested/i];
  for (const pattern of buyerPatterns) {
    if (pattern.test(textLower)) {
      const match = textLower.match(pattern);
      if (match) buyerSignals.push(match[0]);
    }
  }

  // Nigerian locations
  const nigerianLocations = ['lagos', 'abuja', 'port harcourt', 'ibadan', 'kano', 'lekki', 'ikeja'];
  for (const location of nigerianLocations) {
    if (textLower.includes(location)) {
      locations.push(location);
    }
  }

  // Phone numbers
  const phonePattern = /(?:\+?234|0)[789]\d{9}/g;
  const phones = text.match(phonePattern);
  if (phones) contactInfo.push(...phones);

  // Calculate confidence
  let confidence = 0;
  if (prices.length > 0) confidence += 0.4;
  confidence += Math.min(sellerSignals.length * 0.15, 0.3);
  if (locations.length > 0) confidence += 0.1;
  if (contactInfo.length > 0) confidence += 0.15;
  if (buyerSignals.length > 0) confidence += 0.05;

  return {
    is_commerce: confidence >= minConfidence,
    confidence,
    prices,
    seller_signals: sellerSignals,
    buyer_signals: buyerSignals,
    locations,
    contact_info: contactInfo,
    currency_detected: prices.length > 0 ? prices[0].currency : 'NGN',
  };
}

// ============================================
// Risk Scoring
// ============================================

export interface TransactionRiskInput {
  amount: number;
  seller_transaction_count?: number;
  buyer_transaction_count?: number;
  transactions_per_hour?: number;
  is_new_device?: boolean;
  is_unusual_location?: boolean;
  hour_of_day?: number;
}

/**
 * Calculate risk score for a transaction
 */
export function calculateRisk(transaction: TransactionRiskInput): RiskAssessment {
  if (wasmAvailable && wasmModule) {
    const scorer = new wasmModule.RiskScorer();
    return scorer.calculate_risk(JSON.stringify(transaction));
  }

  // JavaScript fallback
  return calculateRiskJS(transaction);
}

/**
 * JavaScript fallback for risk scoring
 */
function calculateRiskJS(transaction: TransactionRiskInput): RiskAssessment {
  const factors: RiskFactor[] = [];
  let totalScore = 0;

  // Amount risk
  const amountRisk = transaction.amount > 500000 ? 0.8 : transaction.amount > 100000 ? 0.5 : 0.2;
  totalScore += amountRisk * 0.25;
  factors.push({
    name: 'Transaction Amount',
    weight: 0.25,
    value: amountRisk,
    description: `₦${transaction.amount.toLocaleString()}`,
  });

  // Seller history
  if (transaction.seller_transaction_count !== undefined) {
    const sellerRisk = transaction.seller_transaction_count < 5 ? 0.7 : 0.2;
    totalScore += sellerRisk * 0.2;
    factors.push({
      name: 'Seller History',
      weight: 0.2,
      value: sellerRisk,
      description: `${transaction.seller_transaction_count} previous transactions`,
    });
  }

  // Device risk
  if (transaction.is_new_device !== undefined) {
    const deviceRisk = transaction.is_new_device ? 0.7 : 0.1;
    totalScore += deviceRisk * 0.1;
    factors.push({
      name: 'Device',
      weight: 0.1,
      value: deviceRisk,
      description: transaction.is_new_device ? 'New device' : 'Known device',
    });
  }

  const level = totalScore > 0.7 ? 'HIGH' : totalScore > 0.4 ? 'MEDIUM' : 'LOW';
  const recommendation =
    level === 'HIGH'
      ? 'Additional verification recommended'
      : level === 'MEDIUM'
        ? 'Proceed with standard checks'
        : 'Low risk - proceed normally';

  return {
    score: totalScore,
    level,
    factors,
    recommendation,
  };
}

// ============================================
// Currency Conversion
// ============================================

const DEFAULT_RATES: Record<string, Record<string, number>> = {
  NGN: { USD: 0.00063, GHS: 0.0078, KES: 0.081, ZAR: 0.011 },
  USD: { NGN: 1580, GHS: 12.5, KES: 129, ZAR: 18.5 },
  GHS: { NGN: 128, USD: 0.08, KES: 10.3, ZAR: 1.48 },
  KES: { NGN: 12.3, USD: 0.0078, GHS: 0.097, ZAR: 0.14 },
  ZAR: { NGN: 85.4, USD: 0.054, GHS: 0.68, KES: 7.0 },
};

/**
 * Convert between currencies
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): ExchangeResult {
  if (wasmAvailable && wasmModule) {
    const converter = new wasmModule.CurrencyConverter();
    return converter.convert(amount, fromCurrency, toCurrency);
  }

  // JavaScript fallback
  return convertCurrencyJS(amount, fromCurrency, toCurrency);
}

/**
 * JavaScript fallback for currency conversion
 */
function convertCurrencyJS(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): ExchangeResult {
  if (fromCurrency === toCurrency) {
    return {
      from_amount: amount,
      from_currency: fromCurrency,
      to_amount: amount,
      to_currency: toCurrency,
      rate: 1,
      fee: 0,
      fee_percentage: 0,
      timestamp: new Date().toISOString(),
    };
  }

  const rate = DEFAULT_RATES[fromCurrency]?.[toCurrency] || 1;
  const feePercentage = 0.025; // 2.5% cross-border fee
  const fee = amount * feePercentage;
  const toAmount = (amount - fee) * rate;

  return {
    from_amount: amount,
    from_currency: fromCurrency,
    to_amount: toAmount,
    to_currency: toCurrency,
    rate,
    fee,
    fee_percentage: feePercentage,
    timestamp: new Date().toISOString(),
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Generate a unique escrow ID
 */
export function generateEscrowId(): string {
  if (wasmAvailable && wasmModule) {
    return wasmModule.generate_escrow_id();
  }

  // JavaScript fallback
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ESC-${timestamp}-${random}`.toUpperCase();
}

/**
 * Generate an RMA number for returns
 */
export function generateRmaNumber(): string {
  if (wasmAvailable && wasmModule) {
    return wasmModule.generate_rma_number();
  }

  // JavaScript fallback
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `RMA-${timestamp}-${random}`.toUpperCase();
}

// Auto-initialize WASM on module load
if (typeof window !== 'undefined') {
  initWasm().catch(console.error);
}
