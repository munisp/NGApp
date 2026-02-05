/**
 * Bank Integration Manager
 * 
 * Initializes and manages all bank integrations.
 * Provides a unified interface for accessing bank services.
 */

import { BankIntegrationFactory } from './base';
import { GTBankIntegration } from './gtbank';
import { AccessBankIntegration } from './access-bank';
import { ZenithBankIntegration } from './zenith-bank';

/**
 * Initialize all bank integrations
 */
export function initializeBankIntegrations(): void {
  // GTBank Integration
  if (process.env.GTBANK_API_KEY && process.env.GTBANK_API_SECRET) {
    const gtbank = new GTBankIntegration(
      process.env.GTBANK_API_KEY,
      process.env.GTBANK_API_SECRET
    );
    BankIntegrationFactory.registerIntegration('058', gtbank);
    console.log('[Bank Integration] GTBank initialized');
  } else {
    console.warn('[Bank Integration] GTBank credentials not configured');
  }

  // Access Bank Integration
  if (process.env.ACCESS_BANK_API_KEY && process.env.ACCESS_BANK_API_SECRET) {
    const accessBank = new AccessBankIntegration(
      process.env.ACCESS_BANK_API_KEY,
      process.env.ACCESS_BANK_API_SECRET
    );
    BankIntegrationFactory.registerIntegration('044', accessBank);
    console.log('[Bank Integration] Access Bank initialized');
  } else {
    console.warn('[Bank Integration] Access Bank credentials not configured');
  }

  // Zenith Bank Integration
  if (process.env.ZENITH_BANK_API_KEY && process.env.ZENITH_BANK_API_SECRET) {
    const zenithBank = new ZenithBankIntegration(
      process.env.ZENITH_BANK_API_KEY,
      process.env.ZENITH_BANK_API_SECRET
    );
    BankIntegrationFactory.registerIntegration('057', zenithBank);
    console.log('[Bank Integration] Zenith Bank initialized');
  } else {
    console.warn('[Bank Integration] Zenith Bank credentials not configured');
  }

  const registeredBanks = BankIntegrationFactory.getAllBankCodes();
  console.log(`[Bank Integration] ${registeredBanks.length} bank(s) registered: ${registeredBanks.join(', ')}`);
}

/**
 * Get bank integration by bank code
 */
export function getBankIntegration(bankCode: string) {
  return BankIntegrationFactory.getIntegration(bankCode);
}

/**
 * Get all registered bank codes
 */
export function getRegisteredBankCodes(): string[] {
  return BankIntegrationFactory.getAllBankCodes();
}

/**
 * Get all bank integrations
 */
export function getAllBankIntegrations() {
  return BankIntegrationFactory.getAllIntegrations();
}

/**
 * Check if a bank is supported
 */
export function isBankSupported(bankCode: string): boolean {
  return BankIntegrationFactory.getIntegration(bankCode) !== null;
}

// Export all bank integration classes and interfaces
export { BaseBankIntegration, BankIntegrationFactory } from './base';
export { GTBankIntegration } from './gtbank';
export { AccessBankIntegration } from './access-bank';
export { ZenithBankIntegration } from './zenith-bank';

export type {
  BankAccount,
  BankTransaction,
  BankTransferRequest,
  BankTransferResponse,
  AccountLinkingRequest,
  AccountLinkingResponse,
  BankBalanceResponse,
} from './base';
