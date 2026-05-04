# Crypto-to-Fiat Remittance Integration Architecture
## USA → Nigeria Corridor with Multi-Modal Last-Mile Delivery

**Document Version:** 1.0  
**Last Updated:** November 4, 2024  
**Author:** Payment Switch Engineering Team

---

## Executive Summary

This document outlines a comprehensive integration architecture for crypto-to-fiat remittances from the United States to Nigeria, leveraging the Payment Switch platform as the last-mile delivery infrastructure. The solution enables senders in the USA to transmit value via cryptocurrency (Bitcoin, USDT, USDC, etc.) with recipients in Nigeria receiving Nigerian Naira (NGN) through four flexible delivery channels: **(a) instant bank account opening**, **(b) deposit to existing bank accounts**, **(c) agent banking cash collection**, and **(d) bill payments**.

The architecture addresses critical challenges in cross-border remittances including high fees (averaging 6-7% globally), slow settlement times (2-5 business days), limited last-mile access in underbanked regions, and regulatory compliance across multiple jurisdictions. By combining blockchain technology for the transmission layer with Payment Switch's comprehensive last-mile infrastructure, the solution delivers near-instant settlement, transparent pricing (< 2% total fees), and universal accessibility across Nigeria's diverse financial landscape.

---

## Table of Contents

1. [Market Context & Problem Statement](#market-context--problem-statement)
2. [Solution Architecture Overview](#solution-architecture-overview)
3. [Integration Components](#integration-components)
4. [Last-Mile Delivery Options](#last-mile-delivery-options)
5. [End-to-End Transaction Flow](#end-to-end-transaction-flow)
6. [Technical Implementation](#technical-implementation)
7. [Regulatory & Compliance](#regulatory--compliance)
8. [Security & Risk Management](#security--risk-management)
9. [Economics & Pricing](#economics--pricing)
10. [Deployment Guide](#deployment-guide)

---

## Market Context & Problem Statement

### Global Remittance Market

The global remittance market represents one of the most significant financial flows in the world, with migrant workers sending approximately **$656 billion** to low and middle-income countries in 2023. Nigeria is the largest remittance recipient in Sub-Saharan Africa, receiving an estimated **$20 billion annually**, primarily from the United States, United Kingdom, and other diaspora communities.

Despite this massive volume, traditional remittance channels suffer from several critical inefficiencies that create opportunities for blockchain-based disruption.

### Traditional Remittance Challenges

**High Transaction Costs:** The global average cost of sending $200 is approximately **6.2%** of the transaction value, with Sub-Saharan Africa experiencing even higher rates at **7.9%**. For USA-to-Nigeria corridors, fees can range from **$15-30** for a $200 transfer, representing **7.5-15%** of the principal amount. These costs include sender fees, foreign exchange spreads, correspondent banking charges, and recipient collection fees.

**Slow Settlement Times:** Traditional wire transfers and money transfer operators (MTOs) like Western Union or MoneyGram typically require **2-5 business days** for funds to become available to recipients. This delay stems from correspondent banking relationships, manual compliance checks, and batch processing systems that operate on business day schedules.

**Limited Last-Mile Access:** Nigeria has a significant unbanked and underbanked population, with only **45%** of adults having formal bank accounts. Rural areas face particular challenges with limited bank branch presence, making cash collection through agent networks essential for financial inclusion.

**Foreign Exchange Volatility:** The Nigerian Naira experiences significant volatility against major currencies, with official and parallel market rates often diverging substantially. Recipients face uncertainty about the exact amount they will receive, and timing of conversion can significantly impact the final value.

**Regulatory Complexity:** Cross-border remittances must navigate multiple regulatory frameworks including USA FinCEN regulations, Nigerian Central Bank foreign exchange controls, anti-money laundering (AML) requirements, and know-your-customer (KYC) compliance across both jurisdictions.

### Cryptocurrency Opportunity

Cryptocurrency offers a compelling solution to many of these challenges by providing a **borderless, 24/7, programmable** transmission layer that can settle transactions in minutes rather than days. Bitcoin, Ethereum, and stablecoins like USDT and USDC enable near-instant value transfer across borders without requiring correspondent banking relationships or traditional foreign exchange infrastructure.

However, cryptocurrency alone does not solve the "last-mile problem" of converting digital assets into usable local currency and delivering funds through channels accessible to recipients in Nigeria. This is where Payment Switch integration becomes critical, bridging the gap between the crypto transmission layer and Nigeria's diverse financial ecosystem.

---

## Solution Architecture Overview

### High-Level Architecture

The crypto-to-fiat remittance solution consists of five primary layers working in concert to enable end-to-end value transfer from USA senders to Nigerian recipients.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USA SENDER LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Crypto Wallet│  │ Remittance   │  │ Mobile App   │              │
│  │ (MetaMask)   │  │ Platform UI  │  │ (iOS/Android)│              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                  │                  │                       │
│         └──────────────────┴──────────────────┘                       │
│                            │                                          │
└────────────────────────────┼──────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CRYPTO TRANSMISSION LAYER                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Blockchain Networks (Bitcoin, Ethereum, Polygon, etc.)      │  │
│  │  • USDT (Tether) - ERC-20, TRC-20                           │  │
│  │  • USDC (Circle) - ERC-20, Polygon                          │  │
│  │  • Bitcoin (BTC) - Native blockchain                         │  │
│  │  • Lightning Network (instant BTC)                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  CRYPTO-TO-FIAT BRIDGE LAYER                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Payment Switch Crypto Gateway                                │  │
│  │  • Crypto wallet management (hot/cold)                        │  │
│  │  • On-chain transaction monitoring                            │  │
│  │  • Crypto-to-NGN conversion (liquidity pools)                │  │
│  │  • Rate locking & hedging                                     │  │
│  │  • Compliance screening (AML/CFT)                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   PAYMENT SWITCH CORE LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Payment      │  │ Fraud        │  │ Workflow     │              │
│  │ Gateway      │  │ Detection    │  │ Orchestrator │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                  │                  │                       │
│  ┌──────┴──────────────────┴──────────────────┴───────┐              │
│  │         TigerBeetle Ledger (NGN accounts)          │              │
│  └────────────────────────────────────────────────────┘              │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NIGERIA LAST-MILE LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ (A) Bank     │  │ (B) Existing │  │ (C) Agent    │              │
│  │ Account      │  │ Account      │  │ Banking      │              │
│  │ Opening      │  │ Deposit      │  │ Cash Out     │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                  │                  │                       │
│         │         ┌────────┴──────────┐       │                       │
│         │         │ (D) Bill Payments │       │                       │
│         │         └───────────────────┘       │                       │
│         │                  │                  │                       │
│  ┌──────┴──────────────────┴──────────────────┴───────┐              │
│  │  Integration APIs (NIBSS, Banks, Agents, Billers)  │              │
│  └────────────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

### Architecture Layers Explained

**USA Sender Layer:** This layer encompasses the user interfaces through which senders initiate remittance transactions. Senders can interact through crypto wallets (MetaMask, Trust Wallet, Coinbase Wallet), dedicated remittance platform web/mobile applications, or embedded widgets within existing financial services. The sender layer handles user authentication, transaction initiation, and provides real-time status updates throughout the remittance lifecycle.

**Crypto Transmission Layer:** This layer leverages public blockchain networks to transmit value across borders. The architecture supports multiple blockchain networks to provide flexibility in speed, cost, and sender preference. Bitcoin offers the most established network with highest liquidity, Ethereum provides smart contract capabilities and broad stablecoin support, Polygon offers low-cost fast transactions, and Lightning Network enables instant Bitcoin micropayments. Stablecoins (USDT, USDC) are particularly attractive for remittances as they eliminate cryptocurrency price volatility during transmission.

**Crypto-to-Fiat Bridge Layer:** This is the critical integration point where Payment Switch receives cryptocurrency and converts it to Nigerian Naira. The bridge operates hot wallets for immediate transaction processing and cold wallets for secure storage of reserves. On-chain monitoring detects incoming crypto transactions in real-time, triggering the conversion process. Liquidity pools or exchange integrations provide crypto-to-NGN conversion at competitive rates. Rate locking mechanisms protect recipients from volatility between transaction initiation and settlement. Compliance screening ensures all transactions meet AML/CFT requirements before processing.

**Payment Switch Core Layer:** Once cryptocurrency is converted to NGN, the Payment Switch core infrastructure manages the fiat currency lifecycle. The payment gateway routes transactions to appropriate last-mile channels based on recipient preferences. Fraud detection analyzes transaction patterns to identify suspicious activity. The workflow orchestrator manages complex multi-step processes like bank account opening or agent network coordination. TigerBeetle ledger maintains double-entry accounting for all NGN balances, ensuring financial integrity and enabling instant settlement.

**Nigeria Last-Mile Layer:** This layer delivers NGN to recipients through four flexible channels, each addressing different recipient needs and circumstances. Bank account opening enables recipients without existing accounts to receive funds and access the formal banking system. Existing account deposits serve the banked population with instant credit to their accounts. Agent banking provides cash collection points in areas without bank branches, critical for financial inclusion. Bill payment integration allows recipients to directly pay utilities, mobile airtime, school fees, and other obligations without requiring a bank account.

---

## Integration Components

### Component 1: Crypto Gateway Service

The Crypto Gateway Service is the entry point for blockchain-based remittances, responsible for monitoring multiple blockchain networks, detecting incoming transactions, and initiating the conversion process.

**Key Responsibilities:**

**Wallet Management:** The service operates a hierarchical deterministic (HD) wallet structure that generates unique deposit addresses for each transaction. This enables precise tracking of which sender initiated which transaction and prevents address reuse that could compromise privacy. Hot wallets hold working capital for immediate liquidity (typically 5-10% of daily volume), while cold wallets secure the majority of reserves in offline storage with multi-signature requirements.

**On-Chain Monitoring:** The service runs full nodes or connects to reliable blockchain infrastructure providers (Infura, Alchemy, QuickNode) to monitor blockchain networks in real-time. When a transaction is detected to a monitored address, the service waits for the appropriate number of confirmations (typically 1 confirmation for stablecoins, 3-6 for Bitcoin) before considering the transaction final. This balance between speed and security is configurable based on transaction size and risk tolerance.

**Transaction Validation:** Each detected transaction undergoes validation to ensure it meets minimum amount thresholds, originates from a non-sanctioned address (OFAC screening), and includes proper memo/reference data if required. Invalid transactions are either refunded (minus network fees) or held for manual review depending on the nature of the issue.

**Rate Calculation:** Upon receiving a valid crypto transaction, the service calculates the NGN equivalent based on real-time exchange rates from multiple sources (Binance, Coinbase, Kraken, local Nigerian exchanges). The service applies a small spread (typically 0.5-1%) to cover conversion risk and provides rate guarantees for a specified period (e.g., 15 minutes) to protect recipients from volatility during processing.

**Conversion Execution:** Depending on liquidity strategy, the service either executes immediate market orders on cryptocurrency exchanges to convert to fiat, draws from pre-funded NGN liquidity pools, or uses over-the-counter (OTC) desks for large transactions. The goal is to minimize slippage while maintaining sufficient liquidity to process transactions without delay.

**Technical Stack:**
- **Language:** Go (high performance, excellent concurrency)
- **Blockchain Libraries:** go-ethereum (Ethereum), btcd (Bitcoin), Polygon SDK
- **Database:** PostgreSQL (transaction records), Redis (rate caching)
- **Message Queue:** Kafka (event streaming to Payment Switch core)

**API Endpoints:**

```
POST /api/v1/crypto/deposit-address
  Request: { userId, currency, network }
  Response: { address, memo, qrCode, expiresAt }

GET /api/v1/crypto/transaction/{txHash}
  Response: { status, confirmations, amountCrypto, amountNGN, rate }

POST /api/v1/crypto/quote
  Request: { amountCrypto, currency, network }
  Response: { amountNGN, rate, fees, expiresAt }
```

---

### Component 2: KYC/AML Compliance Service

Regulatory compliance is non-negotiable in the remittance industry. The KYC/AML Compliance Service ensures all transactions and participants meet regulatory requirements in both USA and Nigerian jurisdictions.

**Key Responsibilities:**

**Identity Verification:** The service integrates with identity verification providers (Jumio, Onfido, Smile Identity for Nigeria) to verify sender and recipient identities. For senders in the USA, this typically requires government-issued ID, proof of address, and Social Security Number or Tax ID. For recipients in Nigeria, the service accepts National Identity Number (NIN), Bank Verification Number (BVN), International Passport, or Driver's License. Biometric verification (facial recognition, fingerprint) provides additional assurance for high-value transactions.

**Sanctions Screening:** All parties are screened against global sanctions lists including OFAC (Office of Foreign Assets Control), UN Security Council sanctions, EU sanctions, and Nigerian-specific watchlists. Cryptocurrency addresses are checked against known illicit addresses using blockchain analytics tools (Chainalysis, Elliptic, CipherTrace). Any matches trigger automatic transaction holds pending manual review.

**Transaction Monitoring:** The service applies rule-based and machine learning models to detect suspicious transaction patterns. Rules flag transactions exceeding thresholds (e.g., $10,000 single transaction, $50,000 cumulative per month), unusual geographic patterns (sender location inconsistent with stated residence), or rapid succession of transactions. ML models identify more subtle patterns like structuring (breaking large amounts into smaller transactions to avoid reporting), unusual recipient networks, or behavioral anomalies.

**Regulatory Reporting:** The service generates required regulatory reports including Currency Transaction Reports (CTRs) for transactions exceeding $10,000, Suspicious Activity Reports (SARs) for potentially illicit activity, and maintains comprehensive audit trails for all transactions. For Nigerian compliance, the service reports to the Central Bank of Nigeria (CBN) and Economic and Financial Crimes Commission (EFCC) as required.

**Risk Scoring:** Each transaction receives a risk score (0-100) based on multiple factors including sender/recipient history, transaction amount, destination country, payment method, and behavioral patterns. Low-risk transactions (score < 30) process automatically, medium-risk (30-70) may require additional documentation, and high-risk (> 70) undergo manual review.

**Technical Stack:**
- **Language:** Python (rich ecosystem for ML and data analysis)
- **ML Framework:** TensorFlow, scikit-learn (anomaly detection models)
- **Identity Verification:** Jumio SDK, Smile Identity API
- **Sanctions Screening:** Dow Jones Risk & Compliance, ComplyAdvantage
- **Blockchain Analytics:** Chainalysis API, Elliptic API

**API Endpoints:**

```
POST /api/v1/compliance/kyc/verify
  Request: { userId, documentType, documentImage, selfie }
  Response: { verificationId, status, riskScore }

POST /api/v1/compliance/screen
  Request: { userId, transactionId, amount, cryptoAddress }
  Response: { approved, riskScore, flags, requiredActions }

GET /api/v1/compliance/status/{userId}
  Response: { kycStatus, kycLevel, restrictions, expiresAt }
```

---

### Component 3: Liquidity Management Service

Efficient liquidity management is critical for maintaining competitive pricing and ensuring instant settlement. The Liquidity Management Service optimizes capital allocation across crypto reserves, NGN working capital, and exchange relationships.

**Key Responsibilities:**

**Inventory Management:** The service maintains real-time visibility into crypto holdings (BTC, USDT, USDC) across hot wallets, cold wallets, and exchange accounts, as well as NGN balances in TigerBeetle ledger, Nigerian bank accounts, and agent network floats. Automated rebalancing ensures optimal distribution based on transaction patterns and risk parameters.

**Exchange Integration:** The service connects to multiple cryptocurrency exchanges (Binance, Coinbase, Kraken, local Nigerian exchanges like Quidax, Luno) to execute crypto-to-fiat conversions. Smart order routing selects the best execution venue based on liquidity, fees, and settlement speed. The service maintains pre-funded accounts on exchanges to enable instant execution without deposit delays.

**Rate Aggregation:** Real-time rate feeds from multiple sources are aggregated and weighted to determine fair market rates. The service applies spread adjustments based on market volatility, liquidity depth, and operational costs. Rate guarantees are honored through hedging strategies or by holding sufficient inventory to absorb short-term price movements.

**Hedging Strategies:** For large transaction volumes, the service employs hedging strategies to minimize exposure to cryptocurrency price volatility. This may include holding stablecoin reserves (USDT, USDC) to reduce conversion needs, using futures contracts to lock in exchange rates, or maintaining balanced crypto/fiat positions that naturally hedge each other.

**Capital Efficiency:** The service optimizes capital allocation to minimize idle funds while ensuring sufficient liquidity for peak demand. Predictive analytics forecast transaction volumes based on historical patterns, day of week, holidays, and economic events. Automated alerts notify operators when reserves approach minimum thresholds, triggering capital replenishment procedures.

**Technical Stack:**
- **Language:** Go (performance-critical operations)
- **Exchange APIs:** CCXT library (unified exchange interface)
- **Database:** PostgreSQL (inventory records), TimescaleDB (rate history)
- **Analytics:** Python (forecasting models), Apache Spark (big data processing)

**API Endpoints:**

```
GET /api/v1/liquidity/inventory
  Response: { cryptoBalances, fiatBalances, totalValueUSD }

POST /api/v1/liquidity/convert
  Request: { fromCurrency, toCurrency, amount, strategy }
  Response: { executionId, rate, fee, estimatedSettlement }

GET /api/v1/liquidity/rates
  Request: { currencyPair, amount }
  Response: { bid, ask, spread, sources, timestamp }
```

---

### Component 4: Last-Mile Integration Service

The Last-Mile Integration Service is the bridge between Payment Switch core infrastructure and Nigeria's diverse financial ecosystem, enabling the four delivery channels.

**Key Responsibilities:**

**Bank Integration:** The service connects to Nigerian banks through multiple channels. For real-time transfers, it uses the Nigeria Inter-Bank Settlement System (NIBSS) Instant Payment (NIP) platform, which enables instant account-to-account transfers across all Nigerian banks. For batch transfers, it uses NIBSS Electronic Funds Transfer (NEFT). The service maintains direct API integrations with major banks (GTBank, Access Bank, Zenith Bank, First Bank) for enhanced features like account opening and balance inquiries.

**Agent Network Integration:** Nigeria has extensive agent banking networks operated by banks and fintech companies (OPay, PalmPay, Kuda, Moniepoint). The service integrates with agent network APIs to enable cash disbursement at thousands of locations across Nigeria. Recipients receive SMS notifications with unique collection codes that agents verify before dispensing cash. The service manages agent float monitoring, settlement reconciliation, and fraud detection specific to agent transactions.

**Bill Payment Integration:** The service connects to bill payment aggregators (Interswitch, Flutterwave, Paystack) and direct biller APIs to enable payment of utilities (electricity, water), telecommunications (airtime, data bundles), cable TV subscriptions, school fees, and government services. Recipients can specify bill payments as their preferred disbursement method, with funds directly credited to their service accounts.

**Account Opening Integration:** For recipients without bank accounts, the service orchestrates the account opening process through partner banks that offer digital account opening. The service collects required KYC information from recipients, submits applications through bank APIs, monitors application status, and automatically disburses funds once accounts are activated. This typically completes within 24-48 hours for standard accounts.

**Status Tracking:** The service provides real-time status updates throughout the last-mile delivery process. Recipients receive SMS and push notifications at each stage: funds received, conversion completed, disbursement initiated, funds available. For cash collection, recipients receive agent location details and collection codes. For bank deposits, recipients receive transaction references for their records.

**Technical Stack:**
- **Language:** Node.js (excellent for API integrations)
- **Integration Framework:** tRPC (type-safe API client/server)
- **Database:** PostgreSQL (transaction records), Redis (status caching)
- **Messaging:** Twilio (SMS), Firebase Cloud Messaging (push notifications)

**API Endpoints:**

```
POST /api/v1/lastmile/bank-transfer
  Request: { recipientAccount, bank, amount, reference }
  Response: { transferId, status, estimatedSettlement }

POST /api/v1/lastmile/agent-cash
  Request: { recipientPhone, amount, location }
  Response: { collectionCode, agentLocations, expiresAt }

POST /api/v1/lastmile/bill-payment
  Request: { billerCode, accountNumber, amount, billType }
  Response: { paymentId, status, receiptUrl }

POST /api/v1/lastmile/account-opening
  Request: { recipientInfo, preferredBank, initialDeposit }
  Response: { applicationId, status, estimatedCompletion }
```

---

## Last-Mile Delivery Options

### Option A: Instant Bank Account Opening

This option serves recipients who do not have existing bank accounts but wish to receive funds through the formal banking system. The service partners with Nigerian banks that offer digital account opening to create accounts remotely and disburse funds instantly upon activation.

**Target Audience:** Unbanked recipients who want to enter the formal financial system, typically younger demographics comfortable with digital services, or recipients who anticipate receiving regular remittances and want a permanent account.

**Process Flow:**

1. **Recipient Selection:** When initiating a remittance, the sender selects "Open New Bank Account" as the delivery method and provides the recipient's contact information (phone number, email).

2. **Recipient Notification:** The recipient receives an SMS and email with a secure link to complete the account opening process. The message explains that someone has sent them money and they need to open a bank account to receive it.

3. **KYC Data Collection:** The recipient clicks the link and is guided through a mobile-optimized account opening form. Required information includes full name, date of birth, residential address, phone number, email, and government-issued ID (NIN, BVN, passport, or driver's license). The recipient uploads a photo of their ID and takes a selfie for biometric verification.

4. **Identity Verification:** The system verifies the recipient's identity using Nigeria-specific verification services (Smile Identity, Youverify). For BVN-based verification, the system queries the Central Bank of Nigeria's BVN database to confirm identity details. For NIN-based verification, the system queries the National Identity Management Commission (NIMC) database. Biometric matching ensures the selfie matches the ID photo.

5. **Bank Selection:** The recipient selects their preferred bank from a list of partner banks (e.g., Kuda, VFD Microfinance Bank, Rubies Bank, Sparkle). Each bank offers different features such as debit card availability, branch access, or digital-only services. The system displays key features and fees for each bank to help the recipient choose.

6. **Account Creation:** The system submits the account opening application to the selected bank's API. Partner banks offering instant account opening can activate accounts within minutes for standard savings accounts. The recipient receives an account number immediately upon approval.

7. **Fund Disbursement:** Once the account is activated, the system automatically initiates a bank transfer using NIBSS NIP to credit the account with the remittance amount. The recipient receives SMS notification that funds are available and can immediately use their new account for transactions.

8. **Account Activation:** The recipient can download the bank's mobile app, set up their PIN, and begin using their account immediately. Most partner banks issue virtual debit cards instantly, with physical cards mailed to the recipient's address within 5-7 business days.

**Technical Implementation:**

```typescript
// Account Opening API Call
POST /api/v1/lastmile/account-opening

Request:
{
  "recipientInfo": {
    "firstName": "Oluwaseun",
    "lastName": "Adeyemi",
    "phone": "+2348012345678",
    "email": "oluwaseun@example.com",
    "dateOfBirth": "1995-03-15",
    "address": "15 Ogunlana Drive, Surulere, Lagos",
    "identificationType": "BVN",
    "identificationNumber": "22234567890",
    "selfieImage": "base64_encoded_image"
  },
  "preferredBank": "KUDA_BANK",
  "initialDeposit": 50000.00,
  "currency": "NGN",
  "senderReference": "REM-USA-20241104-001"
}

Response:
{
  "applicationId": "ACCT-20241104-12345",
  "status": "PENDING_VERIFICATION",
  "estimatedCompletion": "2024-11-04T14:30:00Z",
  "trackingUrl": "https://paymentswitch.com/track/ACCT-20241104-12345"
}

// Status Update Webhook
POST https://remittance-platform.com/webhooks/account-status

{
  "applicationId": "ACCT-20241104-12345",
  "status": "ACCOUNT_ACTIVATED",
  "accountNumber": "1234567890",
  "bankCode": "090267",
  "bankName": "Kuda Microfinance Bank",
  "accountName": "OLUWASEUN ADEYEMI",
  "activatedAt": "2024-11-04T14:15:00Z",
  "disbursementStatus": "COMPLETED",
  "disbursementReference": "NIP-20241104-67890"
}
```

**Partner Banks for Instant Account Opening:**

- **Kuda Bank:** Digital-only bank with instant account opening, no monthly fees, free transfers
- **VFD Microfinance Bank:** Offers high-interest savings accounts, instant virtual cards
- **Rubies Bank:** Focused on underbanked populations, low minimum balance requirements
- **Sparkle:** Digital bank with instant account opening and cryptocurrency integration

**Advantages:**
- Provides recipients with permanent banking infrastructure for future remittances
- Enables recipients to access broader financial services (savings, loans, investments)
- Reduces reliance on cash-based systems
- Creates audit trail for compliance purposes

**Challenges:**
- Requires recipient to complete KYC process, which may be unfamiliar or intimidating
- Some recipients may not have required identification documents
- Account opening may take 24-48 hours for banks without instant activation
- Recipient must learn to use mobile banking apps

**Compliance Considerations:**
- Partner banks must be licensed by Central Bank of Nigeria
- Account opening must comply with CBN KYC requirements
- Recipient identity verification must meet regulatory standards
- Transaction reporting requirements apply to the bank, not the remittance service

---

### Option B: Deposit to Existing Bank Account

This is the most straightforward option for recipients who already have Nigerian bank accounts. Funds are transferred directly to the recipient's existing account using Nigeria's real-time payment infrastructure.

**Target Audience:** Banked recipients with existing accounts at any Nigerian bank, typically urban populations, salaried workers, or anyone with prior banking relationships.

**Process Flow:**

1. **Account Details Collection:** The sender provides the recipient's bank account details including account number (typically 10 digits), bank name or bank code (NIBSS bank code), and optionally the account name for verification.

2. **Account Verification:** Before processing the transfer, the system performs account name inquiry using NIBSS NIP Name Enquiry service. This queries the recipient's bank to retrieve the account name associated with the provided account number. The system displays the account name to the sender for confirmation, preventing errors from typos or incorrect account numbers.

3. **Transfer Initiation:** Once the sender confirms the account details are correct, the system initiates a NIBSS NIP transfer. NIP (NIBSS Instant Payment) is Nigeria's real-time inter-bank payment system that enables instant transfers between all Nigerian banks 24/7/365.

4. **Real-Time Settlement:** The transfer settles instantly (typically within 5-30 seconds), with funds immediately available in the recipient's account. The system receives a transfer confirmation from NIBSS including a unique transaction reference (session ID) that serves as proof of payment.

5. **Recipient Notification:** The recipient receives an SMS alert from their bank notifying them of the credit to their account. Additionally, the Payment Switch system sends a notification with transaction details including sender information (if permitted), amount received, and transaction reference.

6. **Confirmation to Sender:** The sender receives confirmation that the transfer completed successfully, including the transaction reference, timestamp, and recipient account name. This provides peace of mind that funds reached the intended recipient.

**Technical Implementation:**

```typescript
// Bank Transfer API Call
POST /api/v1/lastmile/bank-transfer

Request:
{
  "recipientAccount": "0123456789",
  "bankCode": "058",
  "amount": 50000.00,
  "currency": "NGN",
  "narration": "Remittance from John Doe (USA)",
  "senderReference": "REM-USA-20241104-002",
  "beneficiaryName": "OLUWASEUN ADEYEMI" // Optional, for verification
}

Response:
{
  "transferId": "TRF-20241104-12345",
  "status": "PROCESSING",
  "sessionId": "NIP20241104123456789012", // NIBSS session ID
  "estimatedSettlement": "2024-11-04T10:05:00Z"
}

// Transfer Completion Webhook
POST https://remittance-platform.com/webhooks/transfer-status

{
  "transferId": "TRF-20241104-12345",
  "status": "COMPLETED",
  "sessionId": "NIP20241104123456789012",
  "completedAt": "2024-11-04T10:04:32Z",
  "recipientAccountName": "OLUWASEUN ADEYEMI",
  "bankResponse": "Transaction successful"
}
```

**Supported Banks:**

The system supports transfers to all Nigerian banks connected to NIBSS NIP, including:

- **Commercial Banks:** GTBank, Access Bank, Zenith Bank, First Bank, UBA, Fidelity Bank, Union Bank, Sterling Bank, Stanbic IBTC, Ecobank, Wema Bank, Polaris Bank
- **Microfinance Banks:** Kuda, VFD, Rubies, Sparkle, Moniepoint MFB, PalmPay
- **Digital Banks:** OPay, Kuda, Carbon, FairMoney

**Advantages:**
- Fastest delivery method (5-30 seconds settlement)
- No additional KYC required from recipient
- Funds immediately available for recipient to use
- Lowest operational cost
- Works with any Nigerian bank account

**Challenges:**
- Requires recipient to have existing bank account
- Sender must obtain correct account details from recipient
- Account name verification helps but typos can still cause failed transfers
- Some recipients may prefer not to disclose bank account details

**Compliance Considerations:**
- Transfers above NGN 1,000,000 (~$1,200) may trigger additional bank scrutiny
- Recipient's bank performs its own AML monitoring
- Transaction records maintained by both Payment Switch and recipient's bank
- Sender and recipient information included in NIBSS transaction data

---

### Option C: Agent Banking Cash Collection

Agent banking provides cash disbursement through a network of retail agents (shops, pharmacies, mobile money agents) across Nigeria, critical for recipients in areas without bank branches or those who prefer cash.

**Target Audience:** Unbanked or underbanked recipients, rural populations without nearby bank branches, recipients who prefer cash transactions, or those who need funds immediately without waiting for account opening.

**Process Flow:**

1. **Agent Network Selection:** The sender selects "Cash Collection" as the delivery method. The system prompts for the recipient's phone number and optionally their location (city, state) to identify nearby agents.

2. **Collection Code Generation:** The system generates a unique collection code (typically 8-12 alphanumeric characters) that serves as the authorization for the recipient to collect cash. This code is securely generated and valid for a limited time (e.g., 7-30 days) to prevent fraud.

3. **Recipient Notification:** The recipient receives an SMS containing the collection code, amount available for collection, sender information (if permitted), and instructions for collection. The SMS includes a link to view nearby agent locations on a map.

4. **Agent Location:** The recipient can view agent locations through a mobile-optimized web page or USSD menu. Agents are displayed with addresses, operating hours, distance from recipient's location, and current cash availability status. The system prioritizes agents with sufficient float to disburse the requested amount.

5. **Identity Verification at Agent:** The recipient visits a selected agent location and provides the collection code along with a government-issued ID (NIN slip, voter's card, driver's license, or passport). The agent enters the collection code into their agent app or USSD system.

6. **Biometric Verification (Optional):** For high-value transactions or enhanced security, the agent may capture the recipient's fingerprint or photo using their smartphone. The system matches this against the biometric data collected during sender KYC or recipient registration.

7. **Cash Disbursement:** Upon successful verification, the agent's system displays the recipient's name, amount to disburse, and transaction reference. The agent counts out the cash and hands it to the recipient. The recipient confirms receipt by signing the agent's device or providing a PIN.

8. **Transaction Confirmation:** Both the recipient and sender receive SMS confirmation that cash was collected, including the agent location, timestamp, and transaction reference. The agent's float is debited in real-time, and the transaction is recorded in the agent network's ledger.

9. **Agent Settlement:** Agents are settled daily or weekly for all disbursements made, with funds transferred to their bank accounts or mobile money wallets. The system tracks agent float levels and alerts agents when replenishment is needed.

**Technical Implementation:**

```typescript
// Agent Cash Disbursement API Call
POST /api/v1/lastmile/agent-cash

Request:
{
  "recipientPhone": "+2348012345678",
  "recipientName": "OLUWASEUN ADEYEMI",
  "amount": 50000.00,
  "currency": "NGN",
  "senderReference": "REM-USA-20241104-003",
  "preferredLocation": {
    "state": "Lagos",
    "lga": "Surulere",
    "latitude": 6.4969,
    "longitude": 3.3561
  },
  "expiryDays": 14
}

Response:
{
  "disbursementId": "CASH-20241104-12345",
  "collectionCode": "PS-ABCD-1234",
  "status": "PENDING_COLLECTION",
  "amount": 50000.00,
  "expiresAt": "2024-11-18T23:59:59Z",
  "agentLocations": [
    {
      "agentId": "AGT-12345",
      "agentName": "Mama Chinedu Provisions",
      "address": "23 Adeniran Ogunsanya Street, Surulere, Lagos",
      "phone": "+2348098765432",
      "distance": 0.8, // km
      "operatingHours": "Mon-Sat 8:00-20:00, Sun 10:00-18:00",
      "floatAvailable": true
    },
    {
      "agentId": "AGT-67890",
      "agentName": "OPay Agent - Bode Thomas",
      "address": "45 Bode Thomas Street, Surulere, Lagos",
      "phone": "+2348087654321",
      "distance": 1.2,
      "operatingHours": "24/7",
      "floatAvailable": true
    }
  ]
}

// Collection Completion Webhook
POST https://remittance-platform.com/webhooks/cash-collection

{
  "disbursementId": "CASH-20241104-12345",
  "collectionCode": "PS-ABCD-1234",
  "status": "COLLECTED",
  "collectedAt": "2024-11-04T15:30:00Z",
  "agentId": "AGT-12345",
  "agentName": "Mama Chinedu Provisions",
  "agentLocation": "23 Adeniran Ogunsanya Street, Surulere, Lagos",
  "recipientIdType": "NIN",
  "recipientIdNumber": "12345678901", // Masked for privacy
  "biometricVerified": true
}
```

**Partner Agent Networks:**

- **OPay:** 500,000+ agents across Nigeria, 24/7 availability, mobile app-based
- **PalmPay:** 300,000+ agents, strong rural presence, USSD and app support
- **Moniepoint:** 1,000,000+ agents (largest network), deep rural penetration
- **Kuda Agent Network:** 50,000+ agents, urban focus, high-value transactions
- **Bank Agent Networks:** GTBank, Access Bank, Zenith Bank each operate 10,000-50,000 agents

**Advantages:**
- Serves unbanked and underbanked populations
- No bank account required
- Cash immediately available upon collection
- Wide geographic coverage including rural areas
- Familiar model for recipients accustomed to mobile money agents

**Challenges:**
- Agent float management (agents may run out of cash during peak periods)
- Security risks of carrying cash for recipients
- Higher operational costs (agent commissions)
- Requires recipient to travel to agent location
- Potential for fraud if collection codes are compromised

**Compliance Considerations:**
- Agents must be registered with Central Bank of Nigeria
- Agent networks must maintain AML/CFT compliance programs
- Transaction limits apply (typically NGN 500,000 per transaction, NGN 2,000,000 per day)
- Recipient identity verification required for transactions above NGN 50,000
- Agent networks must report suspicious activities to EFCC

---

### Option D: Bill Payments

Bill payment integration allows recipients to directly pay utilities, telecommunications, and other services without receiving cash or bank deposits, ideal for recipients who want to use remittances for specific expenses.

**Target Audience:** Recipients who want to pay specific bills (electricity, water, mobile airtime, cable TV, school fees), families supporting dependents' expenses, or recipients who prefer not to handle cash.

**Process Flow:**

1. **Bill Selection:** The sender or recipient selects "Pay Bills" as the delivery method and chooses the bill type (electricity, water, mobile airtime, cable TV, internet, school fees, government services).

2. **Biller Information:** The recipient provides the necessary account details for the selected bill type. For electricity, this is the meter number and distribution company (IKEDC, EKEDC, AEDC, etc.). For mobile airtime, this is the phone number and network operator (MTN, Airtel, Glo, 9mobile). For cable TV, this is the smartcard number and provider (DSTV, GOtv, Startimes). For school fees, this is the student ID and institution.

3. **Account Verification:** The system queries the biller's API to verify the account details and retrieve the account name or customer information. For example, querying an electricity meter number returns the customer name and address, allowing the sender to confirm they're paying the correct bill.

4. **Amount Specification:** The sender specifies the amount to pay. For prepaid services (electricity, mobile airtime), this is the recharge amount. For postpaid services (cable TV subscriptions, school fees), the system can retrieve the outstanding balance and allow the sender to pay the full amount or a partial payment.

5. **Payment Execution:** The system initiates the bill payment through the biller's API or through bill payment aggregators (Interswitch, Flutterwave, Paystack). The payment settles in real-time, with the recipient's service account credited immediately.

6. **Service Activation:** For prepaid services, the service is activated immediately. Electricity meters are recharged with the purchased units, mobile phones receive airtime credit, and cable TV subscriptions are extended. For postpaid services, the payment reduces the outstanding balance.

7. **Confirmation:** Both sender and recipient receive confirmation of the bill payment including the service type, account number, amount paid, and transaction reference. For electricity, the confirmation includes the number of units purchased. For mobile airtime, the confirmation includes the new balance.

8. **Receipt Generation:** The system generates a digital receipt that can be downloaded or emailed, providing proof of payment for record-keeping purposes.

**Technical Implementation:**

```typescript
// Bill Payment API Call
POST /api/v1/lastmile/bill-payment

Request:
{
  "billType": "ELECTRICITY",
  "billerCode": "IKEDC", // Ikeja Electric Distribution Company
  "accountNumber": "1234567890", // Meter number
  "amount": 10000.00,
  "currency": "NGN",
  "senderReference": "REM-USA-20241104-004",
  "recipientPhone": "+2348012345678", // For notification
  "recipientEmail": "oluwaseun@example.com"
}

Response:
{
  "paymentId": "BILL-20241104-12345",
  "status": "PROCESSING",
  "billType": "ELECTRICITY",
  "billerName": "Ikeja Electric Distribution Company",
  "accountNumber": "1234567890",
  "accountName": "OLUWASEUN ADEYEMI",
  "amount": 10000.00,
  "estimatedUnits": 45.5, // kWh (estimated based on current tariff)
  "estimatedCompletion": "2024-11-04T10:05:00Z"
}

// Payment Completion Webhook
POST https://remittance-platform.com/webhooks/bill-payment

{
  "paymentId": "BILL-20241104-12345",
  "status": "COMPLETED",
  "completedAt": "2024-11-04T10:04:15Z",
  "billType": "ELECTRICITY",
  "billerName": "Ikeja Electric Distribution Company",
  "accountNumber": "1234567890",
  "accountName": "OLUWASEUN ADEYEMI",
  "amountPaid": 10000.00,
  "unitsReceived": 45.5,
  "token": "1234-5678-9012-3456-7890", // Electricity recharge token
  "receiptUrl": "https://paymentswitch.com/receipts/BILL-20241104-12345.pdf",
  "billerReference": "IKEDC-20241104-67890"
}
```

**Supported Bill Types:**

**Electricity Distribution Companies:**
- Ikeja Electric (IKEDC) - Lagos
- Eko Electricity Distribution (EKEDC) - Lagos
- Abuja Electricity Distribution (AEDC) - Abuja, Niger, Kogi, Nasarawa
- Port Harcourt Electricity Distribution (PHED) - Rivers, Bayelsa, Cross River, Akwa Ibom
- Enugu Electricity Distribution (EEDC) - Enugu, Ebonyi, Abia, Anambra, Imo
- Ibadan Electricity Distribution (IBEDC) - Oyo, Osun, Ogun, Kwara
- Jos Electricity Distribution (JED) - Plateau, Bauchi, Gombe, Benue
- Kaduna Electricity Distribution (KAEDCO) - Kaduna, Kebbi, Sokoto, Zamfara
- Kano Electricity Distribution (KEDCO) - Kano, Jigawa, Katsina
- Benin Electricity Distribution (BEDC) - Edo, Delta, Ondo, Ekiti
- Yola Electricity Distribution (YEDC) - Adamawa, Borno, Taraba, Yobe

**Mobile Network Operators:**
- MTN Nigeria (largest network, 70M+ subscribers)
- Airtel Nigeria (50M+ subscribers)
- Glo Mobile (55M+ subscribers)
- 9mobile (formerly Etisalat, 12M+ subscribers)

**Cable TV Providers:**
- DSTV (MultiChoice) - Premium satellite TV
- GOtv (MultiChoice) - Affordable satellite TV
- Startimes - Budget satellite TV

**Internet Service Providers:**
- Spectranet, Smile, Swift, Coollink, Tizeti

**Education:**
- School fees payment for universities, polytechnics, secondary schools
- JAMB (Joint Admissions and Matriculation Board) fees
- WAEC (West African Examinations Council) fees

**Government Services:**
- Tax payments (Federal Inland Revenue Service)
- Vehicle registration and licensing
- Passport fees
- Court fees

**Advantages:**
- No bank account required
- Funds directly applied to intended purpose (reduces risk of misuse)
- Immediate service activation for prepaid services
- Convenient for senders who want to ensure funds are used for specific expenses
- Reduces recipient's burden of visiting payment centers

**Challenges:**
- Limited to specific bill types (not general-purpose)
- Recipient must provide accurate account details
- Some billers have unreliable APIs causing payment delays
- Refunds can be complicated if payment fails after funds are debited

**Compliance Considerations:**
- Bill payments generally have lower AML risk than cash disbursements
- Transaction limits still apply based on sender/recipient KYC levels
- Biller APIs must be secure and reliable
- Payment records maintained for audit purposes

---

## End-to-End Transaction Flow

### Complete Transaction Lifecycle

This section traces a complete remittance transaction from initiation in the USA through final delivery in Nigeria, illustrating how all components work together.

**Scenario:** John Doe in New York sends $200 to his cousin Oluwaseun Adeyemi in Lagos, Nigeria. John uses USDT (Tether stablecoin on Ethereum) for the transfer, and Oluwaseun chooses to receive funds via bank deposit to his existing GTBank account.

**Step 1: Sender Initiation (USA)**

John accesses the remittance platform's web application and logs into his account. He navigates to "Send Money" and enters the following details:

- Recipient: Oluwaseun Adeyemi
- Destination Country: Nigeria
- Send Amount: $200 USD
- Payment Method: Cryptocurrency (USDT)
- Delivery Method: Bank Deposit

The platform displays a quote showing:
- Send Amount: $200 USD
- Exchange Rate: 1 USD = 1,550 NGN (mid-market rate)
- Platform Fee: $3 (1.5%)
- Crypto Network Fee: $2 (Ethereum gas fee)
- Total Cost: $205 USD
- Recipient Receives: 305,350 NGN (after fees)
- Delivery Time: 5-30 minutes

John confirms the transaction and proceeds to payment.

**Step 2: Cryptocurrency Payment (Blockchain)**

The platform generates a unique USDT deposit address for this transaction: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4`

John opens his MetaMask wallet and initiates a transfer of 200 USDT to the provided address. He sets a moderate gas price (30 Gwei) to ensure confirmation within 5-10 minutes. MetaMask estimates the gas fee at 0.0015 ETH (~$2).

Transaction details:
- From: John's wallet (0x123...)
- To: Payment Switch deposit address (0x742...)
- Amount: 200 USDT
- Gas Price: 30 Gwei
- Gas Limit: 65,000
- Transaction Hash: 0xabc123...

John confirms the transaction in MetaMask, and it is broadcast to the Ethereum network.

**Step 3: On-Chain Monitoring (Crypto Gateway)**

The Crypto Gateway Service detects the incoming transaction within 15 seconds of broadcast. The service:

1. Identifies the transaction hash (0xabc123...) and confirms it's sent to the monitored address
2. Extracts transaction details: amount (200 USDT), sender address (0x123...), block number
3. Waits for 12 block confirmations (~3 minutes on Ethereum) to ensure finality
4. Updates transaction status in the database: "CRYPTO_RECEIVED"

Once confirmed, the service publishes an event to Kafka:

```json
{
  "eventType": "CRYPTO_RECEIVED",
  "transactionId": "REM-20241104-12345",
  "cryptoCurrency": "USDT",
  "cryptoAmount": 200.00,
  "network": "ETHEREUM",
  "txHash": "0xabc123...",
  "confirmations": 12,
  "timestamp": "2024-11-04T10:03:00Z"
}
```

**Step 4: Compliance Screening (KYC/AML Service)**

The KYC/AML Compliance Service receives the event and performs automated screening:

1. **Sender Verification:** Confirms John's KYC status is valid (verified within last 12 months)
2. **Sanctions Screening:** Checks John's wallet address (0x123...) against OFAC sanctions list and blockchain analytics databases (Chainalysis, Elliptic) - no matches found
3. **Transaction Monitoring:** Evaluates transaction against rules:
   - Amount: $200 (below $10,000 CTR threshold)
   - Frequency: John's 3rd transaction this month (normal pattern)
   - Destination: Nigeria (medium-risk country, but transaction size is low)
   - Risk Score: 25 (low risk)
4. **Recipient Screening:** Checks Oluwaseun's details against sanctions lists - no matches found

The service approves the transaction automatically and publishes an event:

```json
{
  "eventType": "COMPLIANCE_APPROVED",
  "transactionId": "REM-20241104-12345",
  "riskScore": 25,
  "approvedBy": "AUTOMATED",
  "timestamp": "2024-11-04T10:03:30Z"
}
```

**Step 5: Crypto-to-Fiat Conversion (Liquidity Service)**

The Liquidity Management Service receives the compliance approval and initiates conversion:

1. **Rate Calculation:** Queries multiple sources for USDT/NGN rates:
   - Binance P2P: 1 USDT = 1,555 NGN
   - Luno Nigeria: 1 USDT = 1,550 NGN
   - Quidax: 1 USDT = 1,548 NGN
   - Weighted average: 1 USDT = 1,551 NGN
   - Applied spread (0.5%): 1 USDT = 1,543 NGN (final rate)

2. **Conversion Execution:** The service has two options:
   - **Option A:** Sell 200 USDT on Binance for USD, then buy NGN (requires 2 trades, higher fees)
   - **Option B:** Draw from pre-funded NGN liquidity pool (instant, no slippage)
   
   The service chooses Option B for speed and efficiency.

3. **Ledger Update:** Credits 308,600 NGN to an internal suspense account in TigerBeetle ledger:
   ```
   Debit: Crypto Inventory (200 USDT)
   Credit: NGN Suspense Account (308,600 NGN)
   ```

4. **Fee Deduction:** Deducts platform fee (3,250 NGN, equivalent to $3 at 1,550 rate):
   ```
   Debit: NGN Suspense Account (3,250 NGN)
   Credit: Revenue Account (3,250 NGN)
   ```

5. **Net Amount:** 305,350 NGN available for disbursement to recipient

The service publishes an event:

```json
{
  "eventType": "CONVERSION_COMPLETED",
  "transactionId": "REM-20241104-12345",
  "cryptoAmount": 200.00,
  "cryptoCurrency": "USDT",
  "fiatAmount": 305350.00,
  "fiatCurrency": "NGN",
  "exchangeRate": 1543.00,
  "fee": 3250.00,
  "timestamp": "2024-11-04T10:04:00Z"
}
```

**Step 6: Recipient Notification (Last-Mile Service)**

The Last-Mile Integration Service receives the conversion event and notifies the recipient:

SMS to Oluwaseun (+2348012345678):
```
You have received NGN 305,350.00 from John Doe (USA).
To receive funds, please provide your bank details:
- Bank Name
- Account Number
Click: https://paymentswitch.com/receive/REM-20241104-12345
```

Oluwaseun clicks the link and enters his bank details:
- Bank: GTBank (Guaranty Trust Bank)
- Account Number: 0123456789

**Step 7: Account Verification (Last-Mile Service)**

The service performs NIBSS NIP Name Enquiry to verify the account:

```typescript
// NIBSS NIP Name Enquiry Request
{
  "accountNumber": "0123456789",
  "bankCode": "058" // GTBank code
}

// NIBSS Response
{
  "accountNumber": "0123456789",
  "accountName": "ADEYEMI OLUWASEUN MICHAEL",
  "bankCode": "058",
  "bankName": "Guaranty Trust Bank",
  "kycLevel": "3", // Fully verified account
  "bvn": "221234567890" // Masked BVN
}
```

The system displays the account name to Oluwaseun for confirmation. He confirms it's correct.

**Step 8: Bank Transfer Execution (Last-Mile Service)**

The service initiates a NIBSS NIP transfer:

```typescript
// NIBSS NIP Transfer Request
{
  "sessionId": "NIP20241104123456789012", // Unique session ID
  "sourceAccountNumber": "PAYMENT_SWITCH_POOL",
  "sourceBankCode": "999", // Payment Switch as PSP
  "destinationAccountNumber": "0123456789",
  "destinationBankCode": "058",
  "amount": 305350.00,
  "narration": "Remittance from John Doe (USA)",
  "paymentReference": "REM-20241104-12345"
}

// NIBSS Response (within 5-30 seconds)
{
  "sessionId": "NIP20241104123456789012",
  "responseCode": "00", // Success
  "responseDescription": "Transaction successful",
  "destinationAccountName": "ADEYEMI OLUWASEUN MICHAEL",
  "transactionDate": "2024-11-04T10:04:32Z"
}
```

The transfer completes successfully. GTBank credits Oluwaseun's account with NGN 305,350.00.

**Step 9: Confirmation & Notifications**

**Recipient Notification (SMS from GTBank):**
```
Acct: 0123456789
Amt: NGN 305,350.00 CR
Desc: Remittance from John Doe (USA)
Bal: NGN 1,250,350.00
Date: 04-Nov-2024 10:04 AM
```

**Recipient Notification (SMS from Payment Switch):**
```
Your remittance of NGN 305,350.00 has been deposited to your GTBank account (...6789).
Transaction Reference: REM-20241104-12345
Thank you for using Payment Switch!
```

**Sender Notification (Email to John):**
```
Subject: Remittance Completed - REM-20241104-12345

Hi John,

Your remittance to Oluwaseun Adeyemi has been completed successfully!

Transaction Details:
- Amount Sent: $200 USD
- Amount Received: NGN 305,350.00
- Exchange Rate: 1 USD = 1,526.75 NGN (effective rate after fees)
- Delivery Method: Bank Deposit (GTBank)
- Recipient Account: ...6789
- Transaction Reference: REM-20241104-12345
- Completed At: Nov 4, 2024 10:04 AM WAT

Total Time: 4 minutes 32 seconds

View Receipt: https://paymentswitch.com/receipts/REM-20241104-12345

Thank you for using Payment Switch!
```

**Step 10: Ledger Reconciliation**

The TigerBeetle ledger records the complete transaction:

```
Transaction: REM-20241104-12345

Entry 1: Crypto Receipt
  Debit: Crypto Inventory - USDT (200.00 USDT)
  Credit: Crypto Liability (200.00 USDT)

Entry 2: Crypto-to-Fiat Conversion
  Debit: Crypto Liability (200.00 USDT)
  Debit: Conversion Spread Revenue (1,600 NGN)
  Credit: NGN Suspense Account (308,600 NGN)

Entry 3: Platform Fee
  Debit: NGN Suspense Account (3,250 NGN)
  Credit: Platform Fee Revenue (3,250 NGN)

Entry 4: Bank Transfer
  Debit: NGN Suspense Account (305,350 NGN)
  Credit: NIBSS Settlement Account (305,350 NGN)

Entry 5: NIBSS Settlement (T+1)
  Debit: NIBSS Settlement Account (305,350 NGN)
  Credit: Bank Account - GTBank (305,350 NGN)

Net Position:
- Crypto Inventory: -200 USDT
- Revenue: 4,850 NGN ($3.13 at spot rate)
- NGN Liquidity: -305,350 NGN (to be replenished)
```

**Transaction Complete:** Total time from crypto payment to bank credit: **4 minutes 32 seconds**

---

## Technical Implementation

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     REMITTANCE PLATFORM (USA)                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Frontend (React + TypeScript)                                │  │
│  │  • Sender dashboard                                           │  │
│  │  • Transaction initiation                                     │  │
│  │  • Crypto wallet integration (WalletConnect, MetaMask)       │  │
│  │  • Real-time status tracking                                  │  │
│  └────────────────────────┬─────────────────────────────────────┘  │
│                           │                                          │
│  ┌────────────────────────┴─────────────────────────────────────┐  │
│  │  Backend API (Node.js + Express)                              │  │
│  │  • User authentication & authorization                        │  │
│  │  • Transaction management                                     │  │
│  │  • Webhook handling                                           │  │
│  │  • Reporting & analytics                                      │  │
│  └────────────────────────┬─────────────────────────────────────┘  │
└────────────────────────────┼──────────────────────────────────────────┘
                             │
                             │ HTTPS/WebSocket
                             │
┌────────────────────────────┴──────────────────────────────────────────┐
│                    PAYMENT SWITCH PLATFORM                             │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  API Gateway (Apache APISIX)                                  │  │
│  │  • Rate limiting                                              │  │
│  │  • Authentication (OAuth 2.0, API keys)                       │  │
│  │  • Request routing                                            │  │
│  │  • SSL/TLS termination                                        │  │
│  └────────────────────────┬─────────────────────────────────────┘  │
│                           │                                          │
│  ┌────────────────────────┴─────────────────────────────────────┐  │
│  │  Service Mesh (Istio)                                         │  │
│  │  • Service discovery                                          │  │
│  │  • Load balancing                                             │  │
│  │  • Circuit breaking                                           │  │
│  │  • Mutual TLS                                                 │  │
│  └────────────────────────┬─────────────────────────────────────┘  │
│                           │                                          │
│  ┌────────────────────────┴─────────────────────────────────────┐  │
│  │  Microservices Layer                                          │  │
│  │                                                                │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │  │
│  │  │ Crypto Gateway  │  │ KYC/AML Service │  │ Liquidity    │ │  │
│  │  │ Service (Go)    │  │ (Python)        │  │ Service (Go) │ │  │
│  │  └────────┬────────┘  └────────┬────────┘  └──────┬───────┘ │  │
│  │           │                     │                   │          │  │
│  │  ┌────────┴────────┐  ┌────────┴────────┐  ┌──────┴───────┐ │  │
│  │  │ Last-Mile       │  │ Fraud Detection │  │ Workflow     │ │  │
│  │  │ Service (Node)  │  │ (Python ML)     │  │ Orchestrator │ │  │
│  │  └────────┬────────┘  └────────┬────────┘  └──────┬───────┘ │  │
│  │           │                     │                   │          │  │
│  └───────────┼─────────────────────┼───────────────────┼──────────┘  │
│              │                     │                   │             │
│  ┌───────────┴─────────────────────┴───────────────────┴──────────┐  │
│  │  Data Layer                                                     │  │
│  │                                                                 │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐           │  │
│  │  │ PostgreSQL  │  │ TigerBeetle  │  │ Redis      │           │  │
│  │  │ (metadata)  │  │ (ledger)     │  │ (cache)    │           │  │
│  │  └─────────────┘  └──────────────┘  └────────────┘           │  │
│  │                                                                 │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐           │  │
│  │  │ Kafka       │  │ Prometheus   │  │ Jaeger     │           │  │
│  │  │ (events)    │  │ (metrics)    │  │ (tracing)  │           │  │
│  │  └─────────────┘  └──────────────┘  └────────────┘           │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTPS/API Calls
                             │
┌────────────────────────────┴──────────────────────────────────────────┐
│                  NIGERIA FINANCIAL INFRASTRUCTURE                      │
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ NIBSS NIP    │  │ Agent        │  │ Bill Payment │               │
│  │ (Bank        │  │ Networks     │  │ Aggregators  │               │
│  │ Transfers)   │  │ (Cash)       │  │ (Utilities)  │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                  │                  │                        │
│  ┌──────┴──────────────────┴──────────────────┴───────┐               │
│  │  Nigerian Banks & Financial Institutions           │               │
│  │  • GTBank, Access, Zenith, First Bank, UBA, etc.  │               │
│  │  • Kuda, OPay, PalmPay, Moniepoint (digital)      │               │
│  └────────────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
```

### API Specifications

**Base URL:** `https://api.paymentswitch.com/v1`

**Authentication:** Bearer token (JWT) or API key

**Rate Limits:**
- Standard tier: 100 requests/minute
- Premium tier: 1,000 requests/minute
- Enterprise tier: 10,000 requests/minute

#### Endpoint 1: Create Remittance Transaction

```
POST /remittance/create
```

**Request Headers:**
```
Authorization: Bearer {jwt_token}
Content-Type: application/json
X-Idempotency-Key: {unique_key} // Prevents duplicate transactions
```

**Request Body:**
```json
{
  "sender": {
    "userId": "USER-12345",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "+1234567890",
    "country": "USA"
  },
  "recipient": {
    "firstName": "Oluwaseun",
    "lastName": "Adeyemi",
    "phone": "+2348012345678",
    "email": "oluwaseun@example.com",
    "country": "NGA"
  },
  "amount": {
    "value": 200.00,
    "currency": "USD"
  },
  "paymentMethod": "CRYPTO",
  "cryptoDetails": {
    "currency": "USDT",
    "network": "ETHEREUM"
  },
  "deliveryMethod": "BANK_DEPOSIT", // or AGENT_CASH, BILL_PAYMENT, ACCOUNT_OPENING
  "deliveryDetails": {
    "bankCode": "058", // Required for BANK_DEPOSIT
    "accountNumber": "0123456789" // Required for BANK_DEPOSIT
  },
  "purpose": "FAMILY_SUPPORT", // For compliance
  "metadata": {
    "sourceApp": "web",
    "userAgent": "Mozilla/5.0...",
    "ipAddress": "203.0.113.1"
  }
}
```

**Response (201 Created):**
```json
{
  "transactionId": "REM-20241104-12345",
  "status": "PENDING_PAYMENT",
  "cryptoDepositAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4",
  "cryptoDepositQR": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "quote": {
    "sendAmount": 200.00,
    "sendCurrency": "USD",
    "receiveAmount": 305350.00,
    "receiveCurrency": "NGN",
    "exchangeRate": 1526.75,
    "fees": {
      "platformFee": 3.00,
      "networkFee": 2.00,
      "totalFee": 5.00
    },
    "expiresAt": "2024-11-04T10:15:00Z"
  },
  "estimatedDeliveryTime": "5-30 minutes",
  "trackingUrl": "https://paymentswitch.com/track/REM-20241104-12345",
  "createdAt": "2024-11-04T10:00:00Z"
}
```

#### Endpoint 2: Get Transaction Status

```
GET /remittance/{transactionId}
```

**Response (200 OK):**
```json
{
  "transactionId": "REM-20241104-12345",
  "status": "COMPLETED",
  "timeline": [
    {
      "status": "CREATED",
      "timestamp": "2024-11-04T10:00:00Z",
      "description": "Transaction created"
    },
    {
      "status": "CRYPTO_RECEIVED",
      "timestamp": "2024-11-04T10:03:00Z",
      "description": "Cryptocurrency received (200 USDT)",
      "details": {
        "txHash": "0xabc123...",
        "confirmations": 12
      }
    },
    {
      "status": "COMPLIANCE_APPROVED",
      "timestamp": "2024-11-04T10:03:30Z",
      "description": "Compliance screening passed"
    },
    {
      "status": "CONVERSION_COMPLETED",
      "timestamp": "2024-11-04T10:04:00Z",
      "description": "Converted to NGN 305,350.00"
    },
    {
      "status": "DISBURSEMENT_INITIATED",
      "timestamp": "2024-11-04T10:04:15Z",
      "description": "Bank transfer initiated"
    },
    {
      "status": "COMPLETED",
      "timestamp": "2024-11-04T10:04:32Z",
      "description": "Funds delivered to recipient",
      "details": {
        "deliveryMethod": "BANK_DEPOSIT",
        "bankName": "GTBank",
        "accountNumber": "...6789",
        "nipSessionId": "NIP20241104123456789012"
      }
    }
  ],
  "sender": {
    "name": "John Doe",
    "country": "USA"
  },
  "recipient": {
    "name": "Oluwaseun Adeyemi",
    "phone": "+2348012345678",
    "country": "NGA"
  },
  "amounts": {
    "sent": {
      "value": 200.00,
      "currency": "USD"
    },
    "received": {
      "value": 305350.00,
      "currency": "NGN"
    },
    "exchangeRate": 1526.75
  },
  "fees": {
    "platformFee": 3.00,
    "networkFee": 2.00,
    "totalFee": 5.00,
    "currency": "USD"
  },
  "receiptUrl": "https://paymentswitch.com/receipts/REM-20241104-12345.pdf"
}
```

#### Endpoint 3: Get Exchange Rate Quote

```
GET /remittance/quote
```

**Query Parameters:**
```
sendAmount=200
sendCurrency=USD
receiveCurrency=NGN
paymentMethod=CRYPTO
deliveryMethod=BANK_DEPOSIT
```

**Response (200 OK):**
```json
{
  "sendAmount": 200.00,
  "sendCurrency": "USD",
  "receiveAmount": 305350.00,
  "receiveCurrency": "NGN",
  "exchangeRate": 1526.75,
  "fees": {
    "platformFee": 3.00,
    "platformFeePercentage": 1.5,
    "networkFee": 2.00,
    "totalFee": 5.00
  },
  "estimatedDeliveryTime": "5-30 minutes",
  "expiresAt": "2024-11-04T10:15:00Z",
  "rateBreakdown": {
    "midMarketRate": 1550.00,
    "appliedSpread": 0.5,
    "effectiveRate": 1543.00,
    "feeDeduction": 16.25
  }
}
```

#### Endpoint 4: Verify Bank Account (Nigeria)

```
POST /lastmile/verify-account
```

**Request Body:**
```json
{
  "accountNumber": "0123456789",
  "bankCode": "058"
}
```

**Response (200 OK):**
```json
{
  "accountNumber": "0123456789",
  "accountName": "ADEYEMI OLUWASEUN MICHAEL",
  "bankCode": "058",
  "bankName": "Guaranty Trust Bank",
  "verified": true,
  "kycLevel": "3"
}
```

#### Endpoint 5: Get Agent Locations

```
GET /lastmile/agent-locations
```

**Query Parameters:**
```
latitude=6.4969
longitude=3.3561
radius=5 // km
limit=10
```

**Response (200 OK):**
```json
{
  "agents": [
    {
      "agentId": "AGT-12345",
      "agentName": "Mama Chinedu Provisions",
      "network": "OPay",
      "address": "23 Adeniran Ogunsanya Street, Surulere, Lagos",
      "phone": "+2348098765432",
      "location": {
        "latitude": 6.4969,
        "longitude": 3.3561
      },
      "distance": 0.8,
      "operatingHours": "Mon-Sat 8:00-20:00, Sun 10:00-18:00",
      "floatAvailable": true,
      "rating": 4.7,
      "transactionsCompleted": 1250
    }
  ],
  "total": 25,
  "page": 1,
  "pageSize": 10
}
```

#### Endpoint 6: Webhook Configuration

```
POST /webhooks/configure
```

**Request Body:**
```json
{
  "url": "https://remittance-platform.com/webhooks/paymentswitch",
  "events": [
    "transaction.created",
    "transaction.crypto_received",
    "transaction.completed",
    "transaction.failed"
  ],
  "secret": "whsec_abc123..." // For signature verification
}
```

**Webhook Payload Example:**
```json
{
  "event": "transaction.completed",
  "transactionId": "REM-20241104-12345",
  "timestamp": "2024-11-04T10:04:32Z",
  "data": {
    "status": "COMPLETED",
    "sendAmount": 200.00,
    "sendCurrency": "USD",
    "receiveAmount": 305350.00,
    "receiveCurrency": "NGN",
    "deliveryMethod": "BANK_DEPOSIT",
    "completedAt": "2024-11-04T10:04:32Z"
  },
  "signature": "sha256=abc123..." // HMAC-SHA256 signature
}
```

---

## Regulatory & Compliance

### USA Regulatory Framework

**FinCEN Registration:** The remittance platform must register as a Money Services Business (MSB) with the Financial Crimes Enforcement Network (FinCEN). This requires filing Form 103 (Registration of Money Services Business) and renewing every two years. State-level money transmitter licenses are also required in most US states.

**Bank Secrecy Act (BSA) Compliance:** The platform must implement a comprehensive BSA/AML program including:
- Customer Identification Program (CIP) to verify sender identities
- Customer Due Diligence (CDD) to understand the nature and purpose of customer relationships
- Enhanced Due Diligence (EDD) for high-risk customers
- Suspicious Activity Report (SAR) filing for transactions exhibiting red flags
- Currency Transaction Report (CTR) filing for transactions exceeding $10,000

**OFAC Sanctions Screening:** All senders, recipients, and cryptocurrency addresses must be screened against the Office of Foreign Assets Control (OFAC) Specially Designated Nationals (SDN) list and other sanctions programs. Matches must be investigated and potentially blocked.

**State Licensing:** Most US states require separate money transmitter licenses. Key states include:
- New York (BitLicense for crypto-related activities)
- California (Money Transmission Act)
- Texas (Money Services Act)
- Florida (Money Services Businesses)

### Nigeria Regulatory Framework

**Central Bank of Nigeria (CBN) Licensing:** The Payment Switch platform or its Nigerian partner must obtain appropriate licensing from CBN. Options include:
- Payment Service Provider (PSP) license for operating payment infrastructure
- International Money Transfer Operator (IMTO) license for receiving cross-border remittances
- Switching and Processing license for interbank transaction routing

**Economic and Financial Crimes Commission (EFCC) Compliance:** The platform must cooperate with EFCC investigations and report suspicious transactions that may indicate money laundering, terrorism financing, or other financial crimes.

**Foreign Exchange Regulations:** Nigeria has strict foreign exchange controls administered by CBN. Key requirements:
- All foreign exchange transactions must be reported to CBN
- Exchange rates must be within acceptable bands of official rates
- Large transactions may require additional documentation (e.g., Form A for imports)
- Recipients may need to provide proof of purpose for large remittances

**Know Your Customer (KYC) Requirements:** Nigerian financial regulations require identity verification using:
- Bank Verification Number (BVN) - unique identifier linked to biometric data
- National Identity Number (NIN) - government-issued identity number
- Valid government-issued ID (passport, driver's license, voter's card)

**Transaction Limits:** CBN imposes limits on certain transaction types:
- Agent banking: NGN 500,000 per transaction, NGN 2,000,000 per day
- Mobile money: NGN 1,000,000 per transaction, NGN 5,000,000 per day
- Bank transfers: Generally no limits for fully verified accounts

### Cryptocurrency Regulations

**USA Cryptocurrency Regulations:** Cryptocurrency businesses must comply with:
- FinCEN guidance treating cryptocurrency exchanges as MSBs
- SEC regulations if tokens are deemed securities
- CFTC regulations for cryptocurrency derivatives
- State-level BitLicense requirements (New York)

**Nigeria Cryptocurrency Stance:** Nigeria's regulatory position on cryptocurrency has evolved:
- 2021: CBN prohibited banks from facilitating cryptocurrency transactions
- 2022-2023: CBN began exploring regulatory framework for digital assets
- 2024: CBN issued guidelines for cryptocurrency operations under pilot programs

The Payment Switch platform navigates this by:
- Operating cryptocurrency transactions outside Nigerian banking system
- Converting cryptocurrency to fiat before touching Nigerian financial infrastructure
- Ensuring all Nigerian disbursements are in NGN through licensed channels

### Data Privacy & Protection

**USA Data Privacy:** Compliance with:
- Gramm-Leach-Bliley Act (GLBA) for financial data protection
- State privacy laws (California Consumer Privacy Act, etc.)
- Data breach notification requirements

**Nigeria Data Protection:** Compliance with:
- Nigeria Data Protection Regulation (NDPR) 2019
- Data localization requirements for certain data types
- Consent requirements for data processing

---

## Security & Risk Management

### Security Architecture

**Multi-Layer Security Model:**

1. **Network Security**
   - DDoS protection (Cloudflare, AWS Shield)
   - Web Application Firewall (WAF) to block malicious requests
   - IP whitelisting for administrative access
   - VPN for internal service communication

2. **Application Security**
   - OAuth 2.0 / OpenID Connect for user authentication
   - API key authentication for service-to-service communication
   - JWT tokens with short expiration (15 minutes) and refresh tokens
   - Rate limiting to prevent abuse (100-10,000 requests/minute based on tier)
   - Input validation and sanitization to prevent injection attacks

3. **Data Security**
   - Encryption at rest (AES-256) for all databases
   - Encryption in transit (TLS 1.3) for all network communication
   - Field-level encryption for sensitive data (PII, financial details)
   - Tokenization of card numbers and bank account details
   - Hardware Security Modules (HSM) for cryptographic key management

4. **Cryptocurrency Security**
   - Hot wallet: 5-10% of daily volume, multi-signature (2-of-3)
   - Cold wallet: 90-95% of reserves, offline storage, multi-signature (3-of-5)
   - Address whitelisting for large transfers
   - Time-locked transactions for additional security
   - Regular security audits of smart contracts

5. **Operational Security**
   - Role-Based Access Control (RBAC) with principle of least privilege
   - Multi-Factor Authentication (MFA) required for all administrative access
   - Audit logging of all sensitive operations
   - Security Information and Event Management (SIEM) for threat detection
   - Regular penetration testing and vulnerability assessments

### Risk Management Framework

**Transaction Risk Scoring:**

Each transaction receives a risk score (0-100) based on:

- **Sender Risk (0-30 points)**
  - KYC completeness: Fully verified (0), partially verified (10), unverified (30)
  - Transaction history: Established user (0), new user (15)
  - Behavioral patterns: Consistent (0), unusual (20)

- **Transaction Risk (0-40 points)**
  - Amount: < $500 (0), $500-$2,000 (10), $2,000-$10,000 (20), > $10,000 (40)
  - Frequency: Normal (0), high frequency (20)
  - Time pattern: Business hours (0), unusual hours (10)

- **Recipient Risk (0-20 points)**
  - Destination country: Low risk (0), medium risk (10), high risk (20)
  - Recipient verification: Verified (0), unverified (15)
  - Relationship to sender: Established (0), new (10)

- **Cryptocurrency Risk (0-10 points)**
  - Source address: Clean (0), flagged (10), sanctioned (block)
  - Mixing service usage: No (0), yes (10)

**Risk-Based Actions:**

- **Low Risk (0-30):** Automatic approval, instant processing
- **Medium Risk (31-60):** Additional verification required, may delay processing
- **High Risk (61-80):** Manual review required, processing delayed 24-48 hours
- **Critical Risk (81-100):** Transaction blocked, potential SAR filing

**Fraud Detection Models:**

Machine Learning models detect fraud patterns:

- **Supervised Learning:** Trained on historical fraud cases to identify known patterns
- **Unsupervised Learning:** Detects anomalies and unusual patterns not seen before
- **Graph Neural Networks:** Identifies fraud rings and money laundering networks
- **Real-Time Scoring:** All transactions scored in < 100ms

**Dispute Resolution:**

- Sender disputes: Investigated within 5 business days
- Recipient disputes: Investigated within 3 business days
- Refund policy: Full refund if funds not delivered within 24 hours (excluding recipient delays)
- Chargeback handling: Cryptocurrency transactions are non-reversible, but platform may issue refunds at discretion

---

## Economics & Pricing

### Fee Structure

**Platform Fees:**

- **Percentage Fee:** 1.5% of transaction amount (minimum $3, maximum $50)
- **Network Fee:** Actual cryptocurrency network fee (varies by network and congestion)
  - Ethereum: $2-$20 depending on gas prices
  - Polygon: $0.01-$0.50
  - Bitcoin: $1-$10 depending on mempool congestion
  - Lightning Network: $0.01-$0.10

**Delivery Method Fees:**

- **Bank Deposit:** Included in platform fee
- **Agent Cash Collection:** Additional NGN 500-1,000 ($0.60-$1.20) agent commission
- **Bill Payment:** Included in platform fee
- **Account Opening:** Included in platform fee (partner banks may charge account maintenance fees)

**Foreign Exchange Spread:**

- **Mid-Market Rate:** Real-time rate from multiple sources (Binance, Coinbase, local exchanges)
- **Applied Spread:** 0.5% markup on mid-market rate
- **Example:** If mid-market rate is 1,550 NGN/USD, applied rate is 1,542.25 NGN/USD

**Total Cost Example (USA → Nigeria, $200):**

```
Send Amount:           $200.00
Platform Fee (1.5%):   $  3.00
Network Fee (ETH):     $  2.00
Total Cost:            $205.00

Exchange Rate:         1,542.25 NGN/USD
Gross NGN:             308,450.00 NGN
Platform Fee (NGN):    4,627.00 NGN
Net to Recipient:      303,823.00 NGN

Effective Rate:        1,519.12 NGN/USD (including all fees)
Total Fee Percentage:  2.5%
```

**Comparison with Traditional Remittance:**

| Provider | Send $200 | Fee | Recipient Gets | Effective Rate | Total Cost % |
|----------|-----------|-----|----------------|----------------|--------------|
| **Payment Switch (Crypto)** | $205 | $5 | NGN 303,823 | 1,519 | 2.5% |
| Western Union | $214 | $14 | NGN 294,000 | 1,470 | 7.0% |
| MoneyGram | $212 | $12 | NGN 297,000 | 1,485 | 6.0% |
| Bank Wire | $220 | $20 | NGN 279,000 | 1,395 | 10.0% |
| Wise (TransferWise) | $207 | $7 | NGN 301,000 | 1,505 | 3.5% |

**Revenue Model:**

- **Transaction Fees:** Primary revenue source (1.5% per transaction)
- **Foreign Exchange Spread:** Secondary revenue (0.5% spread)
- **Interest on Float:** Tertiary revenue (interest on NGN liquidity pools)
- **Premium Features:** Enterprise API access, priority processing, dedicated support

**Unit Economics (per $200 transaction):**

```
Revenue:
  Platform Fee:       $3.00
  FX Spread:          $1.00
  Total Revenue:      $4.00

Costs:
  Crypto Network Fee: $2.00
  NIBSS Transfer Fee: $0.10
  Compliance Costs:   $0.20
  Infrastructure:     $0.30
  Customer Support:   $0.10
  Total Costs:        $2.70

Gross Profit:         $1.30
Gross Margin:         32.5%
```

**Break-Even Analysis:**

- Fixed Costs: $50,000/month (infrastructure, salaries, compliance)
- Variable Costs: $2.70 per transaction
- Revenue per Transaction: $4.00
- Contribution Margin: $1.30 per transaction
- Break-Even Volume: 38,462 transactions/month (~1,282 transactions/day)

**Scalability:**

- Target Volume: 10,000 transactions/day (300,000/month)
- Monthly Revenue: $1,200,000
- Monthly Costs: $860,000 (fixed + variable)
- Monthly Profit: $340,000
- Profit Margin: 28.3%

---

## Deployment Guide

### Prerequisites

**Infrastructure Requirements:**

- Kubernetes cluster (minimum 3 nodes, 8 CPU, 32GB RAM each)
- PostgreSQL database (managed service recommended: AWS RDS, Google Cloud SQL)
- Redis cluster (managed service recommended: AWS ElastiCache, Google Cloud Memorystore)
- Kafka cluster (managed service recommended: Confluent Cloud, AWS MSK)
- TigerBeetle deployment (self-hosted or managed)
- Object storage (AWS S3, Google Cloud Storage)

**External Services:**

- Blockchain infrastructure (Infura, Alchemy, QuickNode)
- Identity verification (Jumio, Smile Identity)
- Sanctions screening (Dow Jones, ComplyAdvantage)
- Blockchain analytics (Chainalysis, Elliptic)
- SMS gateway (Twilio, Africa's Talking)
- Email service (SendGrid, AWS SES)

**Nigerian Integrations:**

- NIBSS NIP access (requires PSP license)
- Agent network partnerships (OPay, PalmPay, Moniepoint)
- Bill payment aggregators (Interswitch, Flutterwave)
- Bank APIs (GTBank, Access, Zenith, etc.)

### Step 1: Infrastructure Setup

```bash
# Create Kubernetes namespace
kubectl create namespace payment-switch

# Deploy PostgreSQL (if not using managed service)
helm install postgresql bitnami/postgresql \
  --namespace payment-switch \
  --set auth.postgresPassword=<password> \
  --set primary.persistence.size=100Gi

# Deploy Redis
helm install redis bitnami/redis \
  --namespace payment-switch \
  --set auth.password=<password> \
  --set master.persistence.size=10Gi

# Deploy Kafka
helm install kafka bitnami/kafka \
  --namespace payment-switch \
  --set persistence.size=50Gi

# Deploy TigerBeetle
kubectl apply -f tigerbeetle-deployment.yaml
```

### Step 2: Deploy Payment Switch Services

```bash
# Clone repository
git clone https://github.com/payment-switch/platform.git
cd platform

# Configure environment variables
cp .env.example .env
# Edit .env with your configuration

# Build Docker images
docker build -t payment-switch/crypto-gateway:latest ./services/crypto-gateway
docker build -t payment-switch/kyc-aml:latest ./services/kyc-aml
docker build -t payment-switch/liquidity:latest ./services/liquidity
docker build -t payment-switch/lastmile:latest ./services/lastmile

# Push to container registry
docker push payment-switch/crypto-gateway:latest
docker push payment-switch/kyc-aml:latest
docker push payment-switch/liquidity:latest
docker push payment-switch/lastmile:latest

# Deploy services
kubectl apply -f k8s/crypto-gateway.yaml
kubectl apply -f k8s/kyc-aml.yaml
kubectl apply -f k8s/liquidity.yaml
kubectl apply -f k8s/lastmile.yaml

# Deploy API Gateway
kubectl apply -f k8s/apisix.yaml

# Deploy monitoring stack
kubectl apply -f k8s/prometheus.yaml
kubectl apply -f k8s/grafana.yaml
kubectl apply -f k8s/jaeger.yaml
```

### Step 3: Configure External Integrations

```bash
# Configure blockchain infrastructure
kubectl create secret generic blockchain-secrets \
  --from-literal=infura-api-key=<key> \
  --from-literal=alchemy-api-key=<key> \
  --namespace payment-switch

# Configure identity verification
kubectl create secret generic kyc-secrets \
  --from-literal=jumio-api-key=<key> \
  --from-literal=smile-api-key=<key> \
  --namespace payment-switch

# Configure NIBSS integration
kubectl create secret generic nibss-secrets \
  --from-literal=nibss-api-key=<key> \
  --from-literal=nibss-certificate=<cert> \
  --namespace payment-switch
```

### Step 4: Initialize Database Schema

```bash
# Run database migrations
kubectl run migration --rm -it --restart=Never \
  --image=payment-switch/migrations:latest \
  --namespace payment-switch \
  -- migrate up

# Seed initial data
kubectl run seed --rm -it --restart=Never \
  --image=payment-switch/migrations:latest \
  --namespace payment-switch \
  -- seed run
```

### Step 5: Verify Deployment

```bash
# Check pod status
kubectl get pods -n payment-switch

# Check service endpoints
kubectl get svc -n payment-switch

# Test API health
curl https://api.paymentswitch.com/health

# View logs
kubectl logs -f deployment/crypto-gateway -n payment-switch
```

### Step 6: Configure Monitoring & Alerts

```bash
# Access Grafana dashboard
kubectl port-forward svc/grafana 3000:3000 -n payment-switch
# Open http://localhost:3000

# Import dashboards
# - Crypto Gateway Dashboard
# - KYC/AML Dashboard
# - Liquidity Dashboard
# - Last-Mile Dashboard

# Configure Prometheus alerts
kubectl apply -f k8s/prometheus-alerts.yaml

# Configure alert routing (Slack, PagerDuty)
kubectl apply -f k8s/alertmanager-config.yaml
```

---

## Conclusion

This crypto-to-fiat remittance integration architecture demonstrates how Payment Switch can serve as comprehensive last-mile infrastructure for blockchain-based cross-border payments. By combining cryptocurrency's borderless transmission capabilities with Payment Switch's deep integration into Nigeria's financial ecosystem, the solution delivers fast, affordable, and accessible remittances to recipients regardless of their banking status or location.

The four delivery options (bank account opening, existing account deposit, agent banking, bill payments) ensure universal accessibility, serving everyone from urban banked populations to rural unbanked communities. Advanced fraud detection, comprehensive compliance, and robust security protect all participants while maintaining regulatory adherence in both USA and Nigerian jurisdictions.

With sub-second settlement times, transparent pricing (< 2% total fees), and 24/7 availability, this solution represents a significant improvement over traditional remittance channels that charge 6-10% and take 2-5 business days. As cryptocurrency adoption grows and blockchain infrastructure matures, Payment Switch's flexible architecture positions it to scale this model to additional corridors and use cases across the global remittance market.

---

**Document Version:** 1.0  
**Last Updated:** November 4, 2024  
**Author:** Payment Switch Engineering Team  
**Contact:** integrations@paymentswitch.com
