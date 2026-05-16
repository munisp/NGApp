# Payment Service Integration Design

## 1. Goal
To implement a production-ready Payment Service in Go that handles the complete workflow for paying blockchain policy premiums, including fiat-to-crypto conversion, integration with fiat payment gateways (Paystack/Flutterwave), crypto exchanges (Binance/Coinbase), and internal crypto wallet management.

## 2. Architecture
The service will follow a **Clean Architecture** and **Microservice** pattern, utilizing **Temporal** for reliable, long-running payment orchestration.

| Layer | Description | Key Components |
| :--- | :--- | :--- |
| **Transport** | Handles external communication (HTTP API, Webhooks). | `handler/http.go` |
| **Workflow** | Orchestrates the business process using Temporal. | `workflow/payment_workflow.go`, `activity/activities.go` |
| **Service** | Contains core business logic and coordinates repositories/external interfaces. | `service/payment_service.go` |
| **Adapter** | Interfaces for external systems and data access. | `adapter/fiat_gateway.go`, `adapter/crypto_exchange.go`, `adapter/wallet_manager.go`, `repository/payment_repo.go` |
| **Domain** | Core data structures and business entities. | `domain/models.go` |

## 3. Key Features and Implementation Details

### 3.1. Data Models (`domain/models.go`)

| Model | Fields | Description |
| :--- | :--- | :--- |
| `Payment` | `ID`, `PolicyID`, `AmountFiat`, `CurrencyFiat`, `AmountCrypto`, `CurrencyCrypto`, `Status`, `CreatedAt`, `UpdatedAt` | Main payment record. |
| `Transaction` | `ID`, `PaymentID`, `Type` (FiatIn, CryptoPurchase, CryptoTransfer), `Status`, `ExternalRef` | Record of individual steps. |
| `Wallet` | `ID`, `OwnerID`, `Address`, `Balance`, `Currency` | Internal wallet management. |

### 3.2. Payment Workflow (`workflow/payment_workflow.go`)

The `PremiumPaymentWorkflow` will manage the state and execution of the payment process:

1.  **Activity: InitiateFiatPayment**: Calls `FiatGateway` to get a payment link/reference.
2.  **Signal/Activity: WaitForFiatConfirmation**: The workflow waits for a signal triggered by the Paystack/Flutterwave webhook.
3.  **Activity: PurchaseCrypto**: Calls `CryptoExchange` to buy the required amount of USDC.
4.  **Activity: TransferCrypto**: Calls `WalletManager` to transfer USDC to the target policy premium wallet.
5.  **Activity: NotifyPolicyService**: Calls the GIF/Policy service to mark the premium as paid.

### 3.3. External Service Interfaces (`adapter/`)

Interfaces will be defined to allow easy swapping of providers (e.g., Paystack to Flutterwave, Binance to Coinbase).

*   **`FiatGateway` Interface**: `InitiatePayment(amount, currency) (reference, paymentURL, error)`, `VerifyPayment(reference) (status, error)`.
*   **`CryptoExchange` Interface**: `BuyCrypto(fiatAmount, fiatCurrency, cryptoCurrency) (cryptoAmount, transactionID, error)`.
*   **`WalletManager` Interface**: `Transfer(fromWalletID, toAddress, amount, currency) (txHash, error)`.

## 4. API Endpoints

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/payments` | Initiates a new premium payment. |
| `POST` | `/api/v1/webhooks/fiat-gateway` | Receives payment confirmation webhooks from Paystack/Flutterwave. |
| `GET` | `/api/v1/payments/{id}` | Retrieves the status of a payment. |

## 5. Technology Stack
*   **Language**: Go (Golang)
*   **Orchestration**: Temporal
*   **Web Framework**: Standard library `net/http` or a lightweight router (e.g., `gorilla/mux`)
*   **Database**: PostgreSQL (Repository layer will be defined, but a simple in-memory mock will be used for the implementation to focus on business logic)
*   **Observability**: Prometheus (metrics), Zap (structured logging)
*   **Deployment**: Docker, Kubernetes (manifests)
*   **Configuration**: Viper or environment variables

## 6. Next Steps
1.  Set up the Go project structure.
2.  Define domain models.
3.  Implement interfaces and mock adapters.
4.  Implement the Temporal workflow and activities.
5.  Implement the HTTP handlers and main service logic.
6.  Add observability and deployment artifacts.
7.  Final review and packaging.
