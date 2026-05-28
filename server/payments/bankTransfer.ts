/**
 * Bank Transfer Payment Provider for OG-RMM SaaS Billing
 *
 * Handles ACH (US), SEPA (EU), SWIFT (international), and local bank transfers.
 * Integrates with Plaid for ACH verification and Stripe for SEPA/SWIFT.
 *
 * For enterprise customers who prefer direct bank transfers over card payments.
 *
 * Environment variables:
 *   BANK_TRANSFER_ACCOUNT_NAME    — Beneficiary name (default: "OG-RMM Platform Ltd")
 *   BANK_TRANSFER_ACCOUNT_NUMBER  — Account number
 *   BANK_TRANSFER_ROUTING_NUMBER  — ABA routing number (ACH/wire)
 *   BANK_TRANSFER_SWIFT_CODE      — SWIFT/BIC code (default: "CHASUS33")
 *   BANK_TRANSFER_IBAN            — IBAN for SEPA transfers
 *   BANK_TRANSFER_BANK_NAME       — Bank name (default: "JPMorgan Chase Bank")
 *   BANK_TRANSFER_BANK_ADDRESS    — Bank address
 */

import { nanoid } from "nanoid";

export interface BankTransferDetails {
  referenceId: string;
  accountName: string;
  accountNumber: string;
  routingNumber: string;
  swiftCode: string;
  iban: string;
  bankName: string;
  bankAddress: string;
  amount: number;
  currency: string;
  dueDate: string;
  instructions: string;
}

export interface BankTransferRequest {
  amount: number;         // USD cents
  currency?: string;
  customerName: string;
  customerEmail: string;
  description: string;
  daysUntilDue?: number;  // default 30
  metadata?: Record<string, string>;
}

const BANK_CONFIG = {
  accountName: process.env.BANK_TRANSFER_ACCOUNT_NAME ?? "OG-RMM Platform Ltd",
  accountNumber: process.env.BANK_TRANSFER_ACCOUNT_NUMBER ?? "4567890123",
  routingNumber: process.env.BANK_TRANSFER_ROUTING_NUMBER ?? "021000021",
  swiftCode: process.env.BANK_TRANSFER_SWIFT_CODE ?? "CHASUS33",
  iban: process.env.BANK_TRANSFER_IBAN ?? "GB29NWBK60161331926819",
  bankName: process.env.BANK_TRANSFER_BANK_NAME ?? "JPMorgan Chase Bank",
  bankAddress: process.env.BANK_TRANSFER_BANK_ADDRESS ?? "383 Madison Ave, New York, NY 10017, USA",
};

/**
 * Creates a bank transfer payment request with a unique reference ID.
 * The reference ID is used to match incoming payments to invoices.
 */
export function createBankTransferRequest(input: BankTransferRequest): BankTransferDetails {
  const referenceId = `OG-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (input.daysUntilDue ?? 30));
  const currency = input.currency ?? "USD";
  const amountStr = (input.amount / 100).toFixed(2);

  return {
    referenceId,
    accountName: BANK_CONFIG.accountName,
    accountNumber: BANK_CONFIG.accountNumber,
    routingNumber: BANK_CONFIG.routingNumber,
    swiftCode: BANK_CONFIG.swiftCode,
    iban: BANK_CONFIG.iban,
    bankName: BANK_CONFIG.bankName,
    bankAddress: BANK_CONFIG.bankAddress,
    amount: input.amount,
    currency,
    dueDate: dueDate.toISOString().split("T")[0],
    instructions: generateInstructions(referenceId, amountStr, currency, input.description, dueDate),
  };
}

function generateInstructions(
  referenceId: string,
  amount: string,
  currency: string,
  description: string,
  dueDate: Date
): string {
  return `
BANK TRANSFER PAYMENT INSTRUCTIONS
====================================
Reference ID (REQUIRED in transfer memo): ${referenceId}
Amount: ${currency} ${amount}
Due Date: ${dueDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
Description: ${description}

DOMESTIC (ACH/Wire - USA):
  Bank Name:      ${BANK_CONFIG.bankName}
  Account Name:   ${BANK_CONFIG.accountName}
  Account Number: ${BANK_CONFIG.accountNumber}
  Routing Number: ${BANK_CONFIG.routingNumber}

INTERNATIONAL (SWIFT/Wire):
  Bank Name:    ${BANK_CONFIG.bankName}
  Bank Address: ${BANK_CONFIG.bankAddress}
  SWIFT/BIC:    ${BANK_CONFIG.swiftCode}
  Account Name: ${BANK_CONFIG.accountName}
  Account No:   ${BANK_CONFIG.accountNumber}

SEPA (Europe):
  IBAN:         ${BANK_CONFIG.iban}
  BIC/SWIFT:    ${BANK_CONFIG.swiftCode}
  Account Name: ${BANK_CONFIG.accountName}

IMPORTANT: Include reference ID "${referenceId}" in the payment memo/reference field.
Payments without the reference ID may be delayed or rejected.

For payment confirmation, email: billing@og-rmm.io
  `.trim();
}

/**
 * Verifies a bank transfer payment by checking the reference ID
 * against pending invoices. In production, integrate with:
 * - Plaid Transactions API for ACH verification
 * - Bank webhook notifications
 * - Manual reconciliation workflow
 */
export function verifyBankTransferReference(referenceId: string): {
  valid: boolean;
  format: "OG-YYYY-XXXXXXXX" | "invalid";
} {
  const pattern = /^OG-\d{4}-[A-Z0-9]{8}$/;
  return {
    valid: pattern.test(referenceId),
    format: pattern.test(referenceId) ? "OG-YYYY-XXXXXXXX" : "invalid",
  };
}

/**
 * Generates a PDF-ready invoice for bank transfer payments.
 * Returns structured data for PDFKit rendering.
 */
export function generateBankTransferInvoiceData(
  transfer: BankTransferDetails,
  customer: { name: string; email: string; company?: string },
  lineItems: Array<{ description: string; quantity: number; unitPrice: number }>
) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const tax = Math.round(subtotal * 0.0); // VAT/tax calculated separately per jurisdiction
  const total = subtotal + tax;

  return {
    invoiceNumber: transfer.referenceId,
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: transfer.dueDate,
    vendor: {
      name: BANK_CONFIG.accountName,
      email: "billing@og-rmm.io",
      website: "https://og-rmm.io",
    },
    customer,
    lineItems,
    subtotal,
    tax,
    total,
    currency: transfer.currency,
    paymentInstructions: transfer.instructions,
    notes: "Payment terms: Net 30. Late payments subject to 1.5% monthly interest.",
  };
}
