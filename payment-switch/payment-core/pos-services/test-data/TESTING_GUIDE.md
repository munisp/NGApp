
# Comprehensive Testing Guide for Real-Time POS Payment Processing

This document provides a complete guide for testing and verifying the end-to-end real-time POS payment processing pipeline. It includes sample transaction payloads, expected log outputs, and a testing script to automate the verification process.

## 1. Overview

The testing process is designed to validate the entire data flow, from the moment a transaction is received by the `POS Gateway` to its final settlement through the `BankAdapter`. The key stages of verification are:

1.  **Ingestion**: Verifying that the `POS Gateway` correctly receives and ingests transactions into Fluvio.
2.  **Stream Processing**: Ensuring the Fluvio SmartModule correctly validates, enriches, and scores transactions.
3.  **Workflow Orchestration**: Confirming that the `Fluvio Consumer` and `Temporal Workflow` correctly process the transaction and interact with other services.
4.  **Bank Settlement**: Verifying that the `BankAdapter` is called with the correct information.

## 2. Test Scenarios

We have defined several test scenarios to cover different use cases:

*   **Normal Transaction**: A standard, low-risk transaction.
*   **High-Value Transaction**: A transaction with a large amount that requires additional scrutiny.
*   **Suspicious High-Risk Transaction**: A transaction that should be blocked by the fraud detection system.
*   **Invalid Transaction**: A transaction with malformed data that should be rejected.
*   **Batch Transaction**: A batch of multiple transactions sent in a single request.

### 2.1. Sample Transaction Payloads

The `sample-transactions.json` file contains the detailed JSON payloads for each of these scenarios. These payloads are used by the testing script to simulate real-world transactions.

### 2.2. Expected Log Outputs

The `expected-log-outputs.md` document provides the expected log messages at each stage of the pipeline for each test scenario. This is crucial for verifying that each component is behaving as expected.

## 3. End-to-End Testing Script

The `test-pos-pipeline.sh` script automates the end-to-end testing process. It performs the following steps:

1.  **Verifies Service Health**: Checks that all required services (`POS Gateway`, `BankAdapter`, `Fluvio`, etc.) are running.
2.  **Gets Service Endpoints**: Retrieves the external IP address or sets up port-forwarding for the `POS Gateway`.
3.  **Tests Health Endpoints**: Ensures that the `POS Gateway` is healthy and ready to receive requests.
4.  **Sends Test Transactions**: Sends the sample transaction payloads to the `POS Gateway` for each test scenario.
5.  **Verifies Logs**: Checks the logs of the `POS Gateway` and `Fluvio Consumer` to confirm that the transactions are being processed.
6.  **Checks Prometheus Metrics**: Fetches and displays key metrics from the `POS Gateway`.
7.  **Tests Batch Processing**: Sends a batch of transactions to test the batch processing endpoint.

### 3.1. How to Run the Script

1.  **Ensure you are in the correct directory**:

    ```bash
    cd /home/ubuntu/nextgen-payment-switch/pos-services/test-data
    ```

2.  **Make the script executable**:

    ```bash
    chmod +x test-pos-pipeline.sh
    ```

3.  **Run the script**:

    ```bash
    ./test-pos-pipeline.sh
    ```

### 3.2. Interpreting the Output

The script will provide real-time feedback on the success or failure of each step. Successful steps will be marked with a green `✓`, while errors will be marked with a red `✗`.

## 4. Manual Verification

In addition to the automated script, you should also perform the following manual verification steps:

*   **Check Temporal UI**: Open the Temporal Web UI to view the execution status of the `POSPaymentWorkflow` for each transaction. Verify that the workflows are completing successfully and that the input and output are correct.
*   **Check Grafana Dashboards**: Open your Grafana instance to view the real-time metrics for the POS payment system. Check the dashboards for transaction throughput, latency, error rates, and fraud scores.
*   **Verify TigerBeetle Ledger**: Connect to your TigerBeetle cluster and verify that the financial transactions have been correctly recorded in the ledger.
*   **Check Bank Reconciliation**: For successful transactions, verify that the reconciliation process with the respective banks is initiated and completed successfully.

## 5. Conclusion

This comprehensive testing guide provides all the necessary tools and documentation to thoroughly test and verify the real-time POS payment processing system. By following these steps, you can ensure that the system is ready for production and can handle the demands of a large-scale payment platform.
