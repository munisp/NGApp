import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  flag: string;
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  last_updated: number;
}

export interface CurrencyAccount {
  id: string;
  currency_code: string;
  balance: number;
  created_at: number;
  is_primary: boolean;
}

export interface CurrencyConversion {
  id: string;
  from_currency: string;
  to_currency: string;
  from_amount: number;
  to_amount: number;
  exchange_rate: number;
  fee: number;
  timestamp: number;
}

const CURRENCIES_STORAGE_KEY = "currencies";
const ACCOUNTS_STORAGE_KEY = "currency_accounts";
const CONVERSIONS_STORAGE_KEY = "currency_conversions";
const RATES_STORAGE_KEY = "exchange_rates";

// Supported currencies
export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸" },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺" },
  { code: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", flag: "🇯🇵" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", flag: "🇨🇳" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", flag: "🇨🇦" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", flag: "🇦🇺" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", flag: "🇨🇭" },
  { code: "INR", name: "Indian Rupee", symbol: "₹", flag: "🇮🇳" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", flag: "🇳🇬" },
  { code: "ZAR", name: "South African Rand", symbol: "R", flag: "🇿🇦" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", flag: "🇰🇪" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "GH₵", flag: "🇬🇭" },
];

/**
 * Get currency by code
 */
export function getCurrencyByCode(code: string): Currency | undefined {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code);
}

/**
 * Get all currency accounts
 */
export async function getCurrencyAccounts(): Promise<CurrencyAccount[]> {
  try {
    const accountsJson = await AsyncStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!accountsJson) return [];
    return JSON.parse(accountsJson);
  } catch (error) {
    console.error("Failed to get currency accounts:", error);
    return [];
  }
}

/**
 * Save currency accounts
 */
async function saveCurrencyAccounts(accounts: CurrencyAccount[]): Promise<void> {
  try {
    await AsyncStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch (error) {
    console.error("Failed to save currency accounts:", error);
    throw error;
  }
}

/**
 * Create a new currency account
 */
export async function createCurrencyAccount(currencyCode: string): Promise<CurrencyAccount> {
  const accounts = await getCurrencyAccounts();
  
  // Check if account already exists
  const existing = accounts.find((a) => a.currency_code === currencyCode);
  if (existing) {
    throw new Error(`Account for ${currencyCode} already exists`);
  }
  
  const newAccount: CurrencyAccount = {
    id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    currency_code: currencyCode,
    balance: 0,
    created_at: Date.now(),
    is_primary: accounts.length === 0, // First account is primary
  };
  
  accounts.push(newAccount);
  await saveCurrencyAccounts(accounts);
  
  return newAccount;
}

/**
 * Update currency account balance
 */
export async function updateAccountBalance(accountId: string, newBalance: number): Promise<boolean> {
  const accounts = await getCurrencyAccounts();
  const account = accounts.find((a) => a.id === accountId);
  
  if (!account) return false;
  
  account.balance = newBalance;
  await saveCurrencyAccounts(accounts);
  
  return true;
}

/**
 * Set primary currency account
 */
export async function setPrimaryCurrencyAccount(accountId: string): Promise<boolean> {
  const accounts = await getCurrencyAccounts();
  
  // Remove primary flag from all accounts
  accounts.forEach((a) => (a.is_primary = false));
  
  // Set new primary
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return false;
  
  account.is_primary = true;
  await saveCurrencyAccounts(accounts);
  
  return true;
}

/**
 * Get primary currency account
 */
export async function getPrimaryCurrencyAccount(): Promise<CurrencyAccount | null> {
  const accounts = await getCurrencyAccounts();
  return accounts.find((a) => a.is_primary) || null;
}

/**
 * Fetch exchange rate from API (mock implementation)
 */
async function fetchExchangeRate(from: string, to: string): Promise<number> {
  // In production, this would call a real exchange rate API
  // For now, we'll use mock rates
  const mockRates: Record<string, Record<string, number>> = {
    USD: { EUR: 0.92, GBP: 0.79, JPY: 149.50, CNY: 7.24, CAD: 1.36, AUD: 1.53, CHF: 0.88, INR: 83.12, NGN: 1580.00, ZAR: 18.75, KES: 129.50, GHS: 15.80 },
    EUR: { USD: 1.09, GBP: 0.86, JPY: 162.50, CNY: 7.87, CAD: 1.48, AUD: 1.66, CHF: 0.96, INR: 90.35, NGN: 1717.00, ZAR: 20.38, KES: 140.75, GHS: 17.17 },
    GBP: { USD: 1.27, EUR: 1.16, JPY: 189.50, CNY: 9.18, CAD: 1.73, AUD: 1.94, CHF: 1.12, INR: 105.50, NGN: 2005.00, ZAR: 23.78, KES: 164.25, GHS: 20.05 },
    NGN: { USD: 0.00063, EUR: 0.00058, GBP: 0.00050, JPY: 0.095, CNY: 0.0046, CAD: 0.00086, AUD: 0.00097, CHF: 0.00056, INR: 0.053, ZAR: 0.012, KES: 0.082, GHS: 0.010 },
  };
  
  const rate = mockRates[from]?.[to];
  if (!rate) {
    // If no direct rate, calculate through USD
    const fromToUSD = mockRates[from]?.USD || 1;
    const usdToTo = mockRates.USD?.[to] || 1;
    return fromToUSD * usdToTo;
  }
  
  return rate;
}

/**
 * Get exchange rate
 */
export async function getExchangeRate(from: string, to: string): Promise<ExchangeRate> {
  try {
    // Try to get cached rate
    const ratesJson = await AsyncStorage.getItem(RATES_STORAGE_KEY);
    const rates: ExchangeRate[] = ratesJson ? JSON.parse(ratesJson) : [];
    
    const cacheKey = `${from}_${to}`;
    const cached = rates.find((r) => `${r.from}_${r.to}` === cacheKey);
    
    // Use cached rate if less than 1 hour old
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    if (cached && cached.last_updated > oneHourAgo) {
      return cached;
    }
    
    // Fetch new rate
    const rate = await fetchExchangeRate(from, to);
    
    const newRate: ExchangeRate = {
      from,
      to,
      rate,
      last_updated: Date.now(),
    };
    
    // Update cache
    const updatedRates = rates.filter((r) => `${r.from}_${r.to}` !== cacheKey);
    updatedRates.push(newRate);
    await AsyncStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(updatedRates));
    
    return newRate;
  } catch (error) {
    console.error("Failed to get exchange rate:", error);
    throw error;
  }
}

/**
 * Calculate conversion fee (0.5% of amount)
 */
function calculateConversionFee(amount: number): number {
  return amount * 0.005;
}

/**
 * Convert currency
 */
export async function convertCurrency(
  fromCurrency: string,
  toCurrency: string,
  amount: number
): Promise<{
  converted_amount: number;
  exchange_rate: number;
  fee: number;
  total_cost: number;
}> {
  if (fromCurrency === toCurrency) {
    return {
      converted_amount: amount,
      exchange_rate: 1,
      fee: 0,
      total_cost: amount,
    };
  }
  
  const rateData = await getExchangeRate(fromCurrency, toCurrency);
  const convertedAmount = amount * rateData.rate;
  const fee = calculateConversionFee(amount);
  const totalCost = amount + fee;
  
  return {
    converted_amount: convertedAmount,
    exchange_rate: rateData.rate,
    fee,
    total_cost: totalCost,
  };
}

/**
 * Execute currency conversion
 */
export async function executeCurrencyConversion(
  fromAccountId: string,
  toAccountId: string,
  amount: number
): Promise<CurrencyConversion> {
  const accounts = await getCurrencyAccounts();
  
  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);
  
  if (!fromAccount || !toAccount) {
    throw new Error("Invalid account");
  }
  
  // Calculate conversion
  const conversion = await convertCurrency(fromAccount.currency_code, toAccount.currency_code, amount);
  
  // Check balance
  if (fromAccount.balance < conversion.total_cost) {
    throw new Error("Insufficient balance");
  }
  
  // Execute conversion
  fromAccount.balance -= conversion.total_cost;
  toAccount.balance += conversion.converted_amount;
  
  await saveCurrencyAccounts(accounts);
  
  // Record conversion
  const conversionRecord: CurrencyConversion = {
    id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    from_currency: fromAccount.currency_code,
    to_currency: toAccount.currency_code,
    from_amount: amount,
    to_amount: conversion.converted_amount,
    exchange_rate: conversion.exchange_rate,
    fee: conversion.fee,
    timestamp: Date.now(),
  };
  
  // Save conversion history
  const conversionsJson = await AsyncStorage.getItem(CONVERSIONS_STORAGE_KEY);
  const conversions: CurrencyConversion[] = conversionsJson ? JSON.parse(conversionsJson) : [];
  conversions.push(conversionRecord);
  await AsyncStorage.setItem(CONVERSIONS_STORAGE_KEY, JSON.stringify(conversions));
  
  return conversionRecord;
}

/**
 * Get conversion history
 */
export async function getConversionHistory(limit: number = 50): Promise<CurrencyConversion[]> {
  try {
    const conversionsJson = await AsyncStorage.getItem(CONVERSIONS_STORAGE_KEY);
    if (!conversionsJson) return [];
    
    const conversions: CurrencyConversion[] = JSON.parse(conversionsJson);
    return conversions.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  } catch (error) {
    console.error("Failed to get conversion history:", error);
    return [];
  }
}

/**
 * Get total portfolio value in primary currency
 */
export async function getTotalPortfolioValue(): Promise<{
  total: number;
  currency: string;
  breakdown: Array<{ currency: string; balance: number; value_in_primary: number }>;
}> {
  const accounts = await getCurrencyAccounts();
  const primary = await getPrimaryCurrencyAccount();
  
  if (!primary) {
    return { total: 0, currency: "USD", breakdown: [] };
  }
  
  const breakdown: Array<{ currency: string; balance: number; value_in_primary: number }> = [];
  let total = 0;
  
  for (const account of accounts) {
    if (account.currency_code === primary.currency_code) {
      breakdown.push({
        currency: account.currency_code,
        balance: account.balance,
        value_in_primary: account.balance,
      });
      total += account.balance;
    } else {
      const conversion = await convertCurrency(account.currency_code, primary.currency_code, account.balance);
      breakdown.push({
        currency: account.currency_code,
        balance: account.balance,
        value_in_primary: conversion.converted_amount,
      });
      total += conversion.converted_amount;
    }
  }
  
  return {
    total,
    currency: primary.currency_code,
    breakdown,
  };
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currencyCode: string): string {
  const currency = getCurrencyByCode(currencyCode);
  if (!currency) return `${amount.toFixed(2)}`;
  
  return `${currency.symbol}${amount.toFixed(2)}`;
}

/**
 * Delete currency account
 */
export async function deleteCurrencyAccount(accountId: string): Promise<boolean> {
  const accounts = await getCurrencyAccounts();
  const account = accounts.find((a) => a.id === accountId);
  
  if (!account) return false;
  
  // Cannot delete primary account if it's the only one
  if (account.is_primary && accounts.length === 1) {
    throw new Error("Cannot delete the only account");
  }
  
  // Cannot delete account with balance
  if (account.balance > 0) {
    throw new Error("Cannot delete account with balance. Convert or withdraw funds first.");
  }
  
  const filtered = accounts.filter((a) => a.id !== accountId);
  
  // If deleted account was primary, set first account as primary
  if (account.is_primary && filtered.length > 0) {
    filtered[0].is_primary = true;
  }
  
  await saveCurrencyAccounts(filtered);
  return true;
}
