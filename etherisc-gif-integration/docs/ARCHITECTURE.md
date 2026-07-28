# Etherisc GIF Integration Architecture

## Overview

This document describes the architecture for integrating Etherisc Generic Insurance Framework (GIF) with the insurance platform to enable blockchain-based parametric insurance products.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Insurance Platform                            │
│                                                                      │
│  ┌──────────────────────┐         ┌──────────────────────┐        │
│  │  Traditional         │         │  Parametric          │        │
│  │  Insurance           │         │  Insurance           │        │
│  │  (Existing)          │         │  (Etherisc GIF)      │        │
│  └──────────────────────┘         └──────────────────────┘        │
│                                              │                      │
└──────────────────────────────────────────────┼──────────────────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
         ┌──────────▼─────────┐    ┌──────────▼─────────┐    ┌──────────▼─────────┐
         │  Backend Service   │    │  Oracle Service    │    │  Blockchain Sync   │
         │  (Go)              │    │  (Go)              │    │  (Go)              │
         │                    │    │                    │    │                    │
         │  - Policy Purchase │    │  - Weather Data    │    │  - Event Listener  │
         │  - Claim Trigger   │    │  - Flight Data     │    │  - State Sync      │
         │  - Wallet Mgmt     │    │  - IoT Data        │    │  - Transaction Log │
         └──────────┬─────────┘    └──────────┬─────────┘    └──────────┬─────────┘
                    │                          │                          │
                    └──────────────────────────┼──────────────────────────┘
                                               │
                    ┌──────────────────────────▼──────────────────────────┐
                    │           Polygon Blockchain (EVM)                  │
                    │                                                     │
                    │  ┌─────────────────────────────────────────────┐  │
                    │  │        Etherisc GIF Smart Contracts         │  │
                    │  │                                             │  │
                    │  │  ┌──────────────┐  ┌──────────────┐       │  │
                    │  │  │  GIF Core    │  │  Products    │       │  │
                    │  │  │  Contracts   │  │  - Flight    │       │  │
                    │  │  │              │  │  - Crop      │       │  │
                    │  │  │  - Registry  │  │  - Weather   │       │  │
                    │  │  │  - Policy    │  │              │       │  │
                    │  │  │  - Pool      │  │              │       │  │
                    │  │  └──────────────┘  └──────────────┘       │  │
                    │  │                                             │  │
                    │  │  ┌──────────────┐  ┌──────────────┐       │  │
                    │  │  │  Oracles     │  │  Risk Pools  │       │  │
                    │  │  │              │  │              │       │  │
                    │  │  │  - Weather   │  │  - Flight    │       │  │
                    │  │  │  - Flight    │  │  - Crop      │       │  │
                    │  │  │  - IoT       │  │  - Weather   │       │  │
                    │  │  └──────────────┘  └──────────────┘       │  │
                    │  └─────────────────────────────────────────────┘  │
                    └─────────────────────────────────────────────────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
         ┌──────────▼─────────┐    ┌──────────▼─────────┐    ┌──────────▼─────────┐
         │  PostgreSQL        │    │  TigerBeetle       │    │  Kafka             │
         │                    │    │                    │    │                    │
         │  - Policies        │    │  - Premiums        │    │  - Events          │
         │  - Claims          │    │  - Payouts         │    │  - Notifications   │
         │  - Transactions    │    │  - Balances        │    │                    │
         └────────────────────┘    └────────────────────┘    └────────────────────┘
```

## Components

### 1. Smart Contracts (Solidity)

#### **GIF Core Contracts** (from Etherisc)
- **Registry**: Component registration and management
- **Policy Module**: Policy lifecycle management
- **Pool Module**: Risk pool management
- **Query Module**: Oracle query management

#### **Custom Product Contracts**
- **FlightDelayProduct**: Flight delay parametric insurance
- **CropInsuranceProduct**: Crop insurance based on weather data
- **WeatherInsuranceProduct**: Weather-based parametric insurance

#### **Custom Oracle Contracts**
- **WeatherOracle**: Weather data oracle (NiMet integration)
- **FlightOracle**: Flight data oracle (Nigerian airports)
- **IoTOracle**: IoT sensor data oracle (soil moisture, temperature)

#### **Risk Pool Contracts**
- **FlightDelayPool**: Capital pool for flight delay insurance
- **CropInsurancePool**: Capital pool for crop insurance
- **WeatherInsurancePool**: Capital pool for weather insurance

### 2. Oracle Service (Go)

**Purpose**: Fetch external data and submit to blockchain oracles

**Data Sources**:
- **NiMet API**: Nigerian Meteorological Agency (weather data)
- **FlightAware API**: Flight tracking data
- **IoT Sensors**: Soil moisture, temperature, humidity sensors

**Functions**:
- Fetch data from external sources
- Validate and format data
- Submit data to oracle smart contracts
- Monitor oracle requests from smart contracts

**Technology**: Go, ethclient (go-ethereum), cron scheduler

### 3. Backend Service (Go)

**Purpose**: Bridge between platform and blockchain

**Functions**:
- **Policy Purchase**: Create blockchain policy when customer purchases
- **Claim Trigger**: Monitor conditions and trigger claims
- **Wallet Management**: Manage customer wallets and private keys
- **Transaction Management**: Submit and monitor blockchain transactions
- **Payment Gateway**: Convert fiat to cryptocurrency (USDC/DAI)

**Technology**: Go, ethclient, Temporal workflows

### 4. Blockchain Sync Service (Go)

**Purpose**: Synchronize blockchain state with platform database

**Functions**:
- **Event Listener**: Listen to smart contract events
- **State Sync**: Sync policy, claim, payout state to PostgreSQL
- **Transaction Log**: Log all blockchain transactions
- **Balance Tracking**: Track customer and pool balances

**Technology**: Go, ethclient, PostgreSQL, Kafka

### 5. Database Schema (PostgreSQL)

**Tables**:
- `blockchain_policies`: Blockchain policy records
- `blockchain_claims`: Blockchain claim records
- `blockchain_transactions`: All blockchain transactions
- `blockchain_wallets`: Customer wallet addresses
- `blockchain_pools`: Risk pool information
- `oracle_data`: Oracle data submissions

### 6. Integration Points

#### **With Existing Platform**

**Policy Service**:
- When customer purchases parametric policy → Create blockchain policy
- Sync blockchain policy state to traditional policy table

**Payment Service**:
- Accept fiat payment → Convert to USDC/DAI → Transfer to smart contract
- When payout triggered → Convert USDC/DAI to fiat → Transfer to customer

**Customer Service**:
- Generate blockchain wallet for each customer
- Store wallet address (encrypted private key in secure vault)

**Notification Service**:
- Listen to blockchain events → Send notifications (SMS/WhatsApp/Email)

**TigerBeetle**:
- Record premium payments in ledger
- Record payouts in ledger
- Reconcile blockchain transactions with ledger

**ERPNext**:
- Sync blockchain policies to Sales Invoices
- Sync blockchain payouts to Journal Entries

## Data Flow

### Policy Purchase Flow

```
1. Customer selects parametric product (e.g., Flight Delay Insurance)
2. Customer enters details (flight number, date, coverage amount)
3. Platform calculates premium
4. Customer pays premium (fiat via Paystack/Flutterwave)
5. Backend Service converts fiat to USDC
6. Backend Service calls smart contract: createPolicy()
7. Smart contract creates policy on blockchain
8. Blockchain Sync Service detects PolicyCreated event
9. Blockchain Sync Service syncs policy to PostgreSQL
10. Notification Service sends confirmation to customer
11. TigerBeetle records premium payment
12. ERPNext creates Sales Invoice
```

### Claim Trigger Flow

```
1. Oracle Service fetches external data (e.g., flight delay status)
2. Oracle Service submits data to oracle smart contract
3. Smart contract evaluates trigger condition (e.g., delay > 2 hours)
4. If condition met, smart contract triggers payout
5. Smart contract transfers USDC from risk pool to customer wallet
6. Blockchain Sync Service detects PayoutTriggered event
7. Blockchain Sync Service syncs payout to PostgreSQL
8. Backend Service converts USDC to fiat
9. Backend Service transfers fiat to customer bank account
10. Notification Service sends payout confirmation to customer
11. TigerBeetle records payout
12. ERPNext creates Journal Entry
```

## Smart Contract Design

### FlightDelayProduct Contract

```solidity
contract FlightDelayProduct is Product {
    struct FlightPolicy {
        bytes32 policyId;
        address customer;
        string flightNumber;
        uint256 departureTime;
        uint256 coverageAmount;
        uint256 premium;
        uint256 delayThreshold; // in minutes
        bool claimed;
    }
    
    mapping(bytes32 => FlightPolicy) public policies;
    
    function createPolicy(
        string memory flightNumber,
        uint256 departureTime,
        uint256 coverageAmount,
        uint256 delayThreshold
    ) external payable returns (bytes32 policyId);
    
    function triggerClaim(bytes32 policyId, uint256 actualDepartureTime) external;
    
    function payout(bytes32 policyId) internal;
}
```

### WeatherOracle Contract

```solidity
contract WeatherOracle is Oracle {
    struct WeatherData {
        uint256 timestamp;
        string location;
        int256 temperature; // in Celsius * 100
        uint256 rainfall; // in mm * 100
        uint256 humidity; // in percentage * 100
        bool verified;
    }
    
    mapping(bytes32 => WeatherData) public weatherData;
    
    function submitWeatherData(
        string memory location,
        int256 temperature,
        uint256 rainfall,
        uint256 humidity
    ) external onlyOracleOperator returns (bytes32 dataId);
    
    function getWeatherData(string memory location, uint256 timestamp) 
        external view returns (WeatherData memory);
}
```

## Security

### Wallet Management

**Customer Wallets**:
- Generate HD wallet for each customer
- Store encrypted private key in HashiCorp Vault
- Use hardware security module (HSM) for production

**Platform Wallet**:
- Multi-sig wallet for platform operations
- Requires 3 out of 5 signatures for critical operations
- Separate wallets for each product (flight, crop, weather)

### Smart Contract Security

**Audits**:
- Security audit by OpenZeppelin or Trail of Bits
- Bug bounty program

**Access Control**:
- Role-based access control (RBAC)
- Only authorized addresses can trigger payouts
- Only oracle operators can submit data

**Upgradability**:
- Use OpenZeppelin upgradeable contracts
- Proxy pattern for contract upgrades
- Time-lock for upgrades (48 hours)

### Oracle Security

**Data Validation**:
- Multiple oracle sources (redundancy)
- Median of multiple data points
- Outlier detection and rejection

**Oracle Reputation**:
- Track oracle accuracy
- Penalize inaccurate oracles
- Reward accurate oracles

## Gas Optimization

**Blockchain**: Polygon (low gas fees, ~$0.01 per transaction)

**Optimizations**:
- Batch transactions when possible
- Use events instead of storage for logs
- Optimize data structures (use bytes32 instead of string)
- Use libraries for common functions

**Expected Gas Costs**:
- Policy creation: ~100,000 gas (~$0.02)
- Payout trigger: ~50,000 gas (~$0.01)
- Oracle data submission: ~30,000 gas (~$0.006)

## Scalability

**Layer 2**: Deploy on Polygon (Ethereum layer 2)

**Off-Chain Computation**:
- Complex calculations done off-chain
- Only final results submitted to blockchain

**State Channels**:
- Use state channels for high-frequency updates
- Settle on-chain periodically

## Monitoring

**Blockchain Monitoring**:
- Monitor all smart contract events
- Track gas prices and transaction status
- Alert on failed transactions

**Oracle Monitoring**:
- Monitor oracle data freshness
- Track oracle response time
- Alert on stale data

**Financial Monitoring**:
- Track risk pool balances
- Monitor premium collection
- Track payout amounts

## Compliance

**Regulatory**:
- Engage with NAICOM for blockchain insurance approval
- Ensure compliance with securities regulations
- KYC/AML for cryptocurrency transactions

**Data Privacy**:
- Store PII off-chain (PostgreSQL)
- Only store policy IDs and amounts on-chain
- Encrypt sensitive data

## Disaster Recovery

**Blockchain**:
- Blockchain is immutable and distributed (no single point of failure)
- Multiple RPC endpoints for redundancy

**Backend Services**:
- Kubernetes with 3+ replicas
- Automatic failover
- Regular backups of PostgreSQL

**Wallet Recovery**:
- Mnemonic phrase backup (encrypted)
- Multi-sig recovery mechanism
- Regular wallet balance audits

## Performance Targets

| Metric | Target |
|--------|--------|
| **Policy Creation Time** | < 30 seconds |
| **Claim Trigger Time** | < 1 minute |
| **Payout Time** | < 5 minutes |
| **Oracle Data Freshness** | < 5 minutes |
| **Transaction Success Rate** | > 99% |
| **System Availability** | > 99.9% |

## Cost Estimates

### Implementation Costs

| Item | Cost (₦) |
|------|----------|
| **Smart Contract Development** | 50M |
| **Oracle Development** | 30M |
| **Backend Services** | 40M |
| **Security Audit** | 20M |
| **Testing & QA** | 10M |
| **Total** | **150M** |

### Monthly Operating Costs

| Item | Cost (₦) |
|------|----------|
| **Gas Fees (Polygon)** | 5M |
| **Oracle Data Feeds** | 10M |
| **Infrastructure (Kubernetes)** | 5M |
| **Total** | **20M** |

## Roadmap

### Phase 1: Pilot (Month 1-3)
- Deploy GIF core contracts on Polygon testnet
- Implement Flight Delay Insurance product
- Implement Flight Oracle
- Backend service for policy purchase and claim trigger
- Launch pilot with 100 customers

### Phase 2: Expansion (Month 4-6)
- Deploy to Polygon mainnet
- Implement Crop Insurance product
- Implement Weather Oracle
- Integrate with IoT sensors
- Scale to 1,000 customers

### Phase 3: Full Launch (Month 7-9)
- Implement Weather Insurance product
- Implement IoT Oracle
- Full integration with platform
- Launch to all customers

### Phase 4: Optimization (Month 10-12)
- Optimize gas costs
- Implement state channels
- Add more parametric products
- International expansion

## Success Criteria

✅ **Technical**:
- Smart contracts deployed and audited
- 99.9% uptime
- < 30 second policy creation time
- < 5 minute payout time

✅ **Business**:
- 1,000+ policies issued in first 6 months
- 95%+ customer satisfaction
- 250% ROI in Year 1
- Zero security incidents

✅ **Regulatory**:
- NAICOM approval for blockchain insurance
- Full KYC/AML compliance
- Data privacy compliance
