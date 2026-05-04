/**
 * NIBSS (Nigeria Inter-Bank Settlement System) Integration Service
 * 
 * Handles Nigerian bank account verification and instant payments via NIP
 * Supports 25+ Nigerian commercial banks
 */

import crypto from 'crypto';

// NIBSS API configuration
const NIBSS_API_URL = process.env.NIBSS_API_URL || 'https://api.nibss-plc.com.ng';
const NIBSS_API_KEY = process.env.NIBSS_API_KEY || '';
const NIBSS_INSTITUTION_CODE = process.env.NIBSS_INSTITUTION_CODE || '';

export interface BankAccount {
  accountNumber: string;
  accountName: string;
  bankCode: string;
  bankName: string;
  bvn?: string;
  currency: string;
}

export interface BankTransferRequest {
  fromAccount: string;
  toAccount: string;
  toBankCode: string;
  amount: number;
  narration: string;
  reference: string;
}

export interface BankTransferResponse {
  sessionId: string;
  reference: string;
  responseCode: string;
  responseMessage: string;
  amount: number;
  transactionDate: string;
}

export interface BankTransferStatus {
  reference: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'reversed';
  responseCode: string;
  responseMessage: string;
  amount?: number;
  completedAt?: Date;
}

/**
 * Verify bank account details via NIBSS Name Enquiry Service
 */
export async function verifyBankAccount(params: {
  accountNumber: string;
  bankCode: string;
}): Promise<BankAccount> {
  const requestId = crypto.randomUUID();
  
  const response = await fetch(`${NIBSS_API_URL}/nameenquiry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${NIBSS_API_KEY}`,
    },
    body: JSON.stringify({
      requestId,
      accountNumber: params.accountNumber,
      bankCode: params.bankCode,
      institutionCode: NIBSS_INSTITUTION_CODE,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`NIBSS verification error: ${error.message || response.statusText}`);
  }

  const data = await response.json();

  if (data.responseCode !== '00') {
    throw new Error(`Account verification failed: ${data.responseMessage}`);
  }

  return {
    accountNumber: params.accountNumber,
    accountName: data.accountName,
    bankCode: params.bankCode,
    bankName: data.bankName || getNigerianBankName(params.bankCode),
    bvn: data.bvn,
    currency: 'NGN',
  };
}

/**
 * Initiate instant bank transfer via NIBSS Instant Payment (NIP)
 */
export async function initiateTransfer(params: BankTransferRequest): Promise<BankTransferResponse> {
  const sessionId = crypto.randomUUID();
  
  const response = await fetch(`${NIBSS_API_URL}/nip/fundstransfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${NIBSS_API_KEY}`,
    },
    body: JSON.stringify({
      sessionId,
      fromAccount: params.fromAccount,
      toAccount: params.toAccount,
      toBankCode: params.toBankCode,
      amount: params.amount,
      narration: params.narration,
      paymentReference: params.reference,
      institutionCode: NIBSS_INSTITUTION_CODE,
      channelCode: '7', // Internet banking
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`NIBSS transfer error: ${error.message || response.statusText}`);
  }

  const data = await response.json();

  return {
    sessionId: data.sessionId || sessionId,
    reference: params.reference,
    responseCode: data.responseCode,
    responseMessage: data.responseMessage,
    amount: params.amount,
    transactionDate: data.transactionDate || new Date().toISOString(),
  };
}

/**
 * Query transfer status
 */
export async function getTransferStatus(params: {
  reference: string;
  sessionId: string;
}): Promise<BankTransferStatus> {
  const response = await fetch(`${NIBSS_API_URL}/nip/transactionstatus`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${NIBSS_API_KEY}`,
    },
    body: JSON.stringify({
      sessionId: params.sessionId,
      paymentReference: params.reference,
      institutionCode: NIBSS_INSTITUTION_CODE,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get transfer status: ${response.statusText}`);
  }

  const data = await response.json();

  // Map NIBSS response codes to status
  let status: BankTransferStatus['status'] = 'pending';
  
  if (data.responseCode === '00') {
    status = 'completed';
  } else if (data.responseCode === '09') {
    status = 'processing';
  } else if (data.responseCode === '51') {
    status = 'failed';
  } else if (data.responseCode === '56') {
    status = 'reversed';
  }

  return {
    reference: params.reference,
    status,
    responseCode: data.responseCode,
    responseMessage: data.responseMessage,
    amount: data.amount,
    completedAt: status === 'completed' ? new Date(data.transactionDate) : undefined,
  };
}

/**
 * Verify BVN (Bank Verification Number)
 */
export async function verifyBVN(params: {
  bvn: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string; // YYYY-MM-DD
}): Promise<{
  bvn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phoneNumber: string;
  verified: boolean;
  matchScore?: number;
}> {
  const requestId = crypto.randomUUID();

  const response = await fetch(`${NIBSS_API_URL}/bvnverification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${NIBSS_API_KEY}`,
    },
    body: JSON.stringify({
      requestId,
      bvn: params.bvn,
      firstName: params.firstName,
      lastName: params.lastName,
      dateOfBirth: params.dateOfBirth,
      institutionCode: NIBSS_INSTITUTION_CODE,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`BVN verification error: ${error.message || response.statusText}`);
  }

  const data = await response.json();

  if (data.responseCode !== '00') {
    throw new Error(`BVN verification failed: ${data.responseMessage}`);
  }

  // Calculate match score if comparison data was provided
  let matchScore: number | undefined;
  if (params.firstName || params.lastName || params.dateOfBirth) {
    let matches = 0;
    let total = 0;

    if (params.firstName) {
      total++;
      if (data.firstName?.toLowerCase() === params.firstName.toLowerCase()) matches++;
    }
    if (params.lastName) {
      total++;
      if (data.lastName?.toLowerCase() === params.lastName.toLowerCase()) matches++;
    }
    if (params.dateOfBirth) {
      total++;
      if (data.dateOfBirth === params.dateOfBirth) matches++;
    }

    matchScore = total > 0 ? (matches / total) * 100 : undefined;
  }

  return {
    bvn: params.bvn,
    firstName: data.firstName,
    lastName: data.lastName,
    dateOfBirth: data.dateOfBirth,
    phoneNumber: data.phoneNumber,
    verified: data.responseCode === '00',
    matchScore,
  };
}

/**
 * Get list of Nigerian banks with NIBSS codes
 */
export function getNigerianBanks(): Array<{
  code: string;
  name: string;
  shortName: string;
}> {
  return [
    { code: '044', name: 'Access Bank Plc', shortName: 'Access Bank' },
    { code: '063', name: 'Access Bank (Diamond) Plc', shortName: 'Diamond Bank' },
    { code: '050', name: 'Ecobank Nigeria Plc', shortName: 'Ecobank' },
    { code: '070', name: 'Fidelity Bank Plc', shortName: 'Fidelity Bank' },
    { code: '011', name: 'First Bank of Nigeria Limited', shortName: 'First Bank' },
    { code: '214', name: 'First City Monument Bank Plc', shortName: 'FCMB' },
    { code: '058', name: 'Guaranty Trust Bank Plc', shortName: 'GTBank' },
    { code: '030', name: 'Heritage Banking Company Ltd', shortName: 'Heritage Bank' },
    { code: '301', name: 'Jaiz Bank Plc', shortName: 'Jaiz Bank' },
    { code: '082', name: 'Keystone Bank Limited', shortName: 'Keystone Bank' },
    { code: '526', name: 'Parallex Bank Ltd', shortName: 'Parallex Bank' },
    { code: '076', name: 'Polaris Bank Limited', shortName: 'Polaris Bank' },
    { code: '101', name: 'Providus Bank', shortName: 'Providus Bank' },
    { code: '221', name: 'Stanbic IBTC Bank Plc', shortName: 'Stanbic IBTC' },
    { code: '068', name: 'Standard Chartered Bank Nigeria Ltd', shortName: 'Standard Chartered' },
    { code: '232', name: 'Sterling Bank Plc', shortName: 'Sterling Bank' },
    { code: '100', name: 'Suntrust Bank Nigeria Limited', shortName: 'Suntrust Bank' },
    { code: '032', name: 'Union Bank of Nigeria Plc', shortName: 'Union Bank' },
    { code: '033', name: 'United Bank For Africa Plc', shortName: 'UBA' },
    { code: '215', name: 'Unity Bank Plc', shortName: 'Unity Bank' },
    { code: '035', name: 'Wema Bank Plc', shortName: 'Wema Bank' },
    { code: '057', name: 'Zenith Bank Plc', shortName: 'Zenith Bank' },
    { code: '304', name: 'Globus Bank Limited', shortName: 'Globus Bank' },
    { code: '090175', name: 'Rubies MFB', shortName: 'Rubies MFB' },
    { code: '090267', name: 'Kuda Bank', shortName: 'Kuda' },
  ];
}

/**
 * Get bank name from code
 */
export function getNigerianBankName(code: string): string {
  const bank = getNigerianBanks().find(b => b.code === code);
  return bank?.name || 'Unknown Bank';
}

/**
 * Get bank code from name
 */
export function getNigerianBankCode(name: string): string | undefined {
  const bank = getNigerianBanks().find(
    b => b.name.toLowerCase().includes(name.toLowerCase()) ||
         b.shortName.toLowerCase().includes(name.toLowerCase())
  );
  return bank?.code;
}

/**
 * Validate Nigerian account number format
 */
export function validateAccountNumber(accountNumber: string): boolean {
  // Nigerian account numbers are typically 10 digits
  return /^\d{10}$/.test(accountNumber);
}

/**
 * Validate BVN format
 */
export function validateBVN(bvn: string): boolean {
  // BVN is 11 digits
  return /^\d{11}$/.test(bvn);
}

/**
 * Generate transfer reference
 */
export function generateTransferReference(prefix: string = 'REM'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

/**
 * Calculate NIBSS transfer fee
 */
export function calculateTransferFee(amount: number): number {
  // NIBSS NIP fees (as of 2024)
  if (amount <= 5000) {
    return 10; // ₦10
  } else if (amount <= 50000) {
    return 25; // ₦25
  } else {
    return 50; // ₦50
  }
}

/**
 * Check if transfer amount is within limits
 */
export function validateTransferAmount(amount: number): {
  valid: boolean;
  error?: string;
} {
  const MIN_AMOUNT = 100; // ₦100
  const MAX_AMOUNT = 10000000; // ₦10,000,000 (10 million)

  if (amount < MIN_AMOUNT) {
    return {
      valid: false,
      error: `Minimum transfer amount is ₦${MIN_AMOUNT.toLocaleString()}`,
    };
  }

  if (amount > MAX_AMOUNT) {
    return {
      valid: false,
      error: `Maximum transfer amount is ₦${MAX_AMOUNT.toLocaleString()}`,
    };
  }

  return { valid: true };
}

/**
 * Format amount for NIBSS API (kobo to naira)
 */
export function formatAmountForNIBSS(amountInNaira: number): number {
  // NIBSS expects amount in kobo (1 naira = 100 kobo)
  return Math.round(amountInNaira * 100);
}

/**
 * Parse amount from NIBSS API (kobo to naira)
 */
export function parseAmountFromNIBSS(amountInKobo: number): number {
  return amountInKobo / 100;
}

/**
 * Retry transfer with exponential backoff
 */
export async function retryTransfer(
  params: BankTransferRequest,
  maxRetries: number = 3
): Promise<BankTransferResponse> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await initiateTransfer(params);
    } catch (error) {
      lastError = error as Error;

      // Don't retry on client errors (invalid account, insufficient funds, etc.)
      if (error instanceof Error && error.message.includes('invalid')) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
