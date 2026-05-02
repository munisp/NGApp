# Next Generation Payment Switch: API Specifications

## 1. Introduction

This document provides the API specifications for the Next Generation Payment Switch. It defines the RESTful APIs for the various services in the system, including the API Gateway, payment processing services, and administrative interfaces.

## 2. API Gateway (Apache APISIX)

The API Gateway serves as the single entry point for all external API requests. It provides a unified and secure interface to the underlying microservices.

### 2.1. Payment Initiation API

This API is used to initiate a payment from any of the supported channels.

- **Endpoint:** `/payments`
- **Method:** `POST`
- **Request Body:**

```json
{
  "source": {
    "type": "MOBILE",
    "identifier": "+1-555-123-4567"
  },
  "destination": {
    "type": "MERCHANT",
    "identifier": "merchant-123"
  },
  "amount": {
    "currency": "USD",
    "value": "10.00"
  },
  "transactionType": "P2M"
}
```

- **Response:**

```json
{
  "transactionId": "txn-abcdef-123456",
  "status": "PENDING"
}
```

### 2.2. Transaction Status API

This API is used to check the status of a payment transaction.

- **Endpoint:** `/payments/{transactionId}`
- **Method:** `GET`
- **Response:**

```json
{
  "transactionId": "txn-abcdef-123456",
  "status": "COMPLETED",
  "timestamp": "2025-11-03T12:00:00Z"
}
```

## 3. Mojaloop API

The Mojaloop API is used for interoperable payment switching between participating financial institutions.

### 3.1. Get Parties

- **Endpoint:** `/parties/{type}/{id}`
- **Method:** `GET`
- **Description:** Retrieves information about a party (e.g., a customer or merchant).

### 3.2. Post Quotes

- **Endpoint:** `/quotes`
- **Method:** `POST`
- **Description:** Requests a quote for a payment, including any fees.

### 3.3. Post Transfers

- **Endpoint:** `/transfers`
- **Method:** `POST`
- **Description:** Initiates a payment transfer between two parties.

## 4. TigerBeetle API

TigerBeetle provides a low-level API for creating and managing accounts and transfers.

### 4.1. Create Accounts

- **Endpoint:** `/accounts`
- **Method:** `POST`
- **Description:** Creates one or more new accounts in the ledger.

### 4.2. Create Transfers

- **Endpoint:** `/transfers`
- **Method:** `POST`
- **Description:** Creates one or more new transfers between accounts.

## 5. Temporal API

Temporal provides an API for starting, querying, and signaling workflows.

### 5.1. Start Workflow

- **Endpoint:** `/workflows/{workflowType}`
- **Method:** `POST`
- **Description:** Starts a new workflow instance.

### 5.2. Query Workflow

- **Endpoint:** `/workflows/{workflowId}/query/{queryType}`
- **Method:** `GET`
- **Description:** Queries the state of a running workflow.

### 5.3. Signal Workflow

- **Endpoint:** `/workflows/{workflowId}/signal/{signalName}`
- **Method:** `POST`
- **Description:** Sends a signal to a running workflow.
