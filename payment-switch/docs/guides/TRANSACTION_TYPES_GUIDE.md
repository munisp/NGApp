
_No response_render=
---

## 2. P2M (Person-to-Merchant) Transactions

**Use Case**: A customer pays for groceries at a supermarket by scanning a QR code at the point-of-sale (POS) terminal.

### Service Flow

1.  **POS Service**: The customer scans a QR code, and the POS terminal initiates a payment request.
2.  **Payment Gateway**: Receives the request and validates the transaction details.
3.  **Fraud Detection Service**: The transaction is sent for real-time fraud analysis.
4.  **Biometric Auth Service**: For high-value transactions, a biometric authentication (e.g., fingerprint) is requested from the customer's mobile device.
5.  **VPA Service**: The customer's Virtual Payment Address (VPA) is resolved to their bank account.
6.  **Workflow Orchestrator**: A Temporal workflow is initiated to manage the payment process.
7.  **Settlement Service**: The transaction is recorded for settlement in the next window.
8.  **Notification Service**: A confirmation SMS is sent to the customer and the merchant.

### Key Services Involved

- **POS Service**: Manages the interaction with the merchant's point-of-sale system.
- **Payment Gateway**: The primary entry point for the transaction.
- **Fraud Detection Service**: Assesses the risk of the transaction.
- **Biometric Auth Service**: Provides an additional layer of security.
- **VPA Service**: Maps the VPA to the underlying financial account.
- **Workflow Orchestrator**: Ensures the transaction is processed reliably.
- **Settlement Service**: Aggregates the transaction for settlement.
- **Notification Service**: Provides real-time feedback to the user and the customer.
---

## 3. P2B (Person-to-Business) Transactions

**Use Case**: A freelance graphic designer receives a payment from a client for a completed project.

### Service Flow

1.  **Unified API Gateway**: The client initiates the payment through a web portal, which sends a request to the Unified API Gateway.
2.  **Payment Gateway**: The request is forwarded to the Payment Gateway for processing.
3.  **Fraud Detection Service**: The transaction is analyzed for potential fraud.
4.  **Workflow Orchestrator**: A Temporal workflow is started to manage the payment.
5.  **Instant Settlement Service**: For eligible transactions, the payment is settled instantly, and the funds are immediately available in the designer's account.
6.  **Settlement Service**: If not settled instantly, the transaction is added to the next settlement batch.
7.  **Notification Service**: Both the client and the designer receive an email notification confirming the payment.

### Key Services Involved

- **Unified API Gateway**: Provides a single, secure entry point for all API requests.
- **Payment Gateway**: Orchestrates the payment processing.
- **Fraud Detection Service**: Mitigates the risk of fraudulent transactions.
- **Workflow Orchestrator**: Ensures the payment is processed reliably.
- **Instant Settlement Service**: Provides real-time settlement for time-sensitive payments.
- **Settlement Service**: Manages the standard settlement process.
- **Notification Service**: Keeps both parties informed of the transaction status.
---

## 4. B2P (Business-to-Person) Transactions

**Use Case**: A company pays monthly salaries to its employees.

### Service Flow

1.  **Batch Processing Service**: The company uploads a batch file containing employee account details and salary amounts.
2.  **Payment Gateway**: The batch file is parsed, and individual payment requests are created.
3.  **Fraud Detection Service**: Each payment is screened for anomalies or signs of fraud.
4.  **Workflow Orchestrator**: A parent Temporal workflow is initiated to manage the entire batch, with child workflows for each individual payment.
5.  **Settlement Service**: The payments are processed and recorded for settlement.
6.  **Notification Service**: Employees receive an SMS or email notification once the salary has been credited to their accounts.

### Key Services Involved

- **Batch Processing Service**: Enables efficient processing of multiple payments at once.
- **Payment Gateway**: The central hub for creating and managing payment requests.
- **Fraud Detection Service**: Ensures the legitimacy of the salary payments.
- **Workflow Orchestrator**: Provides a robust and scalable way to manage batch payments.
- **Settlement Service**: Handles the final settlement of funds.
- **Notification Service**: Keeps employees informed about their salary payments.
---

## 5. B2B (Business-to-Business) Transactions

**Use Case**: A manufacturer pays a supplier for a shipment of raw materials.

### Service Flow

1.  **Unified API Gateway**: The manufacturer initiates the payment through their ERP system, which is integrated with the Unified API Gateway.
2.  **Payment Gateway**: The payment request is received and validated.
3.  **Fraud Detection Service**: The transaction is analyzed for any signs of corporate fraud.
4.  **Workflow Orchestrator**: A Temporal workflow is started to manage the high-value B2B transaction.
5.  **Settlement Service**: The payment is processed and scheduled for settlement.
6.  **Integration Adapters**: The platform communicates with the supplier's financial institution through a dedicated integration adapter to ensure seamless interoperability.
7.  **Notification Service**: Both the manufacturer and the supplier receive a secure email notification with the transaction details.

### Key Services Involved

- **Unified API Gateway**: Provides a secure and standardized way to integrate with corporate ERP systems.
- **Payment Gateway**: Manages the core payment processing.
- **Fraud Detection Service**: Protects against high-value corporate fraud.
- **Workflow Orchestrator**: Ensures the reliable processing of large B2B payments.
- **Settlement Service**: Handles the final settlement of funds between the businesses.
- **Integration Adapters**: Enable seamless communication with different financial institutions and networks.
- **Notification Service**: Provides secure and reliable notifications for B2B transactions.
---

## Service Interaction Diagrams

### P2P Flow

![P2P Flow](/home/ubuntu/p2p_flow.png)

### P2M Flow

![P2M Flow](/home/ubuntu/p2m_flow.png)

### P2B Flow

![P2B Flow](/home/ubuntu/p2b_flow.png)

### B2P Flow

![B2P Flow](/home/ubuntu/b2p_flow.png)

### B2B Flow

![B2B Flow](/home/ubuntu/b2b_flow.png)

---

## API Request/Response Examples

## 1. P2P (Person-to-Person) API Examples

### Request

```json
{
  "source": {
    "type": "MSISDN",
    "identifier": "+1234567890"
  },
  "destination": {
    "type": "MSISDN",
    "identifier": "+0987654321"
  },
  "amount": {
    "currency": "USD",
    "value": 100.00
  },
  "transactionType": "P2P",
  "channel": "MOBILE"
}
```

### Response

```json
{
  "transactionId": "txn_1699012497",
  "status": "PENDING",
  "message": "Payment submitted successfully"
}
```
---

## 2. P2M (Person-to-Merchant) API Examples

### Request

```json
{
  "source": {
    "type": "VPA",
    "identifier": "customer@bank"
  },
  "destination": {
    "type": "MERCHANT_ID",
    "identifier": "merchant_12345"
  },
  "amount": {
    "currency": "USD",
    "value": 75.50
  },
  "transactionType": "P2M",
  "channel": "POS"
}
```

### Response

```json
{
  "transactionId": "txn_1699012530",
  "status": "COMPLETED",
  "message": "Payment successful"
}
```

---

## 3. P2B (Person-to-Business) API Examples

### Request

```json
{
  "source": {
    "type": "BANK_ACCOUNT",
    "identifier": "123456789"
  },
  "destination": {
    "type": "BUSINESS_ID",
    "identifier": "business_67890"
  },
  "amount": {
    "currency": "USD",
    "value": 500.00
  },
  "transactionType": "P2B",
  "channel": "WEB"
}
```

### Response

```json
{
  "transactionId": "txn_1699012560",
  "status": "COMPLETED",
  "message": "Payment successful"
}
```

---

## 4. B2P (Business-to-Person) API Examples

### Request (Batch)

```json
{
  "batchId": "batch_1699012590",
  "payments": [
    {
      "source": {
        "type": "BUSINESS_ID",
        "identifier": "business_12345"
      },
      "destination": {
        "type": "MSISDN",
        "identifier": "+1111111111"
      },
      "amount": {
        "currency": "USD",
        "value": 2500.00
      },
      "transactionType": "B2P",
      "channel": "BATCH"
    },
    {
      "source": {
        "type": "BUSINESS_ID",
        "identifier": "business_12345"
      },
      "destination": {
        "type": "MSISDN",
        "identifier": "+2222222222"
      },
      "amount": {
        "currency": "USD",
        "value": 3000.00
      },
      "transactionType": "B2P",
      "channel": "BATCH"
    }
  ]
}
```

### Response

```json
{
  "batchId": "batch_1699012590",
  "status": "PROCESSING",
  "message": "Batch submitted for processing"
}
```

---

## 5. B2B (Business-to-Business) API Examples

### Request

```json
{
  "source": {
    "type": "BUSINESS_ID",
    "identifier": "business_12345"
  },
  "destination": {
    "type": "BUSINESS_ID",
    "identifier": "business_67890"
  },
  "amount": {
    "currency": "USD",
    "value": 10000.00
  },
  "transactionType": "B2B",
  "channel": "API"
}
```

### Response

```json
{
  "transactionId": "txn_1699012620",
  "status": "COMPLETED",
  "message": "Payment successful"
}
```
```
