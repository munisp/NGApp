#!/bin/bash

# P2M Diagram
cat > /home/ubuntu/p2m_flow.mmd << 'EOF'
sequenceDiagram
    participant Customer as Customer
    participant POS as POS Terminal
    participant Gateway as Payment Gateway
    participant Fraud as Fraud Detection
    participant Bio as Biometric Auth
    participant VPA as VPA Service
    participant Workflow as Workflow Orchestrator
    participant Settlement as Settlement Service
    participant Notify as Notification Service
    participant Merchant as Merchant
    
    Customer->>POS: Scan QR Code
    POS->>Gateway: POST /api/v1/payments/initiate
    Gateway->>Fraud: Check Fraud Score
    Fraud-->>Gateway: Score: 0.08 (LOW RISK)
    Gateway->>Bio: Request Biometric Auth
    Bio->>Customer: Fingerprint Prompt
    Customer-->>Bio: Provide Fingerprint
    Bio-->>Gateway: Auth Successful
    Gateway->>VPA: Resolve VPA
    VPA-->>Gateway: Account Details
    Gateway->>Workflow: Start Payment Workflow
    Workflow->>Settlement: Record for Settlement
    Settlement-->>Workflow: Recorded
    Workflow-->>Gateway: Payment Completed
    Gateway->>Notify: Send Notifications
    Notify->>Customer: SMS: Payment Successful
    Notify->>Merchant: Email: Payment Received
    Gateway-->>POS: Success Response
    POS-->>Customer: Print Receipt
EOF

# P2B Diagram
cat > /home/ubuntu/p2b_flow.mmd << 'EOF'
sequenceDiagram
    participant Client as Client (Web Portal)
    participant API as Unified API Gateway
    participant Gateway as Payment Gateway
    participant Fraud as Fraud Detection
    participant Workflow as Workflow Orchestrator
    participant Instant as Instant Settlement
    participant Settlement as Settlement Service
    participant Notify as Notification Service
    participant Designer as Freelancer
    
    Client->>API: POST /api/v1/payments/initiate
    API->>Gateway: Forward Request
    Gateway->>Fraud: Check Fraud Score
    Fraud-->>Gateway: Score: 0.12 (LOW RISK)
    Gateway->>Workflow: Start Payment Workflow
    Workflow->>Instant: Check Eligibility
    Instant-->>Workflow: Eligible for Instant Settlement
    Instant->>Designer: Credit Funds Immediately
    Workflow->>Settlement: Record Transaction
    Settlement-->>Workflow: Recorded
    Workflow-->>Gateway: Payment Completed
    Gateway->>Notify: Send Notifications
    Notify->>Client: Email: Payment Sent
    Notify->>Designer: Email: Payment Received
    Gateway-->>API: Success Response
    API-->>Client: Show Confirmation
EOF

# B2P Diagram
cat > /home/ubuntu/b2p_flow.mmd << 'EOF'
sequenceDiagram
    participant Company as Company (HR System)
    participant Batch as Batch Processing Service
    participant Gateway as Payment Gateway
    participant Fraud as Fraud Detection
    participant Workflow as Workflow Orchestrator (Parent)
    participant Child as Child Workflows
    participant Settlement as Settlement Service
    participant Notify as Notification Service
    participant Employees as Employees
    
    Company->>Batch: Upload Salary Batch File
    Batch->>Gateway: Parse & Create Payment Requests
    Gateway->>Fraud: Screen Each Payment
    Fraud-->>Gateway: All Payments Approved
    Gateway->>Workflow: Start Parent Workflow
    Workflow->>Child: Create Child Workflows (100 employees)
    Child->>Settlement: Process Individual Payments
    Settlement-->>Child: Payments Recorded
    Child-->>Workflow: All Children Completed
    Workflow-->>Gateway: Batch Processing Complete
    Gateway->>Notify: Send Notifications
    Notify->>Employees: SMS: Salary Credited
    Gateway-->>Batch: Success Response
    Batch-->>Company: Batch Processed Successfully
EOF

# B2B Diagram
cat > /home/ubuntu/b2b_flow.mmd << 'EOF'
sequenceDiagram
    participant Mfg as Manufacturer (ERP)
    participant API as Unified API Gateway
    participant Gateway as Payment Gateway
    participant Fraud as Fraud Detection
    participant Workflow as Workflow Orchestrator
    participant Settlement as Settlement Service
    participant Adapter as Integration Adapter
    participant Bank as Supplier's Bank
    participant Notify as Notification Service
    participant Supplier as Supplier
    
    Mfg->>API: POST /api/v1/payments/initiate (High Value)
    API->>Gateway: Forward Request
    Gateway->>Fraud: Check Corporate Fraud
    Fraud-->>Gateway: Score: 0.05 (VERY LOW RISK)
    Gateway->>Workflow: Start B2B Payment Workflow
    Workflow->>Settlement: Process Payment
    Settlement->>Adapter: Communicate with Supplier Bank
    Adapter->>Bank: Transfer Funds
    Bank-->>Adapter: Transfer Confirmed
    Adapter-->>Settlement: Settlement Complete
    Settlement-->>Workflow: Payment Settled
    Workflow-->>Gateway: Payment Completed
    Gateway->>Notify: Send Secure Notifications
    Notify->>Mfg: Email: Payment Sent
    Notify->>Supplier: Email: Payment Received
    Gateway-->>API: Success Response
    API-->>Mfg: Update ERP System
EOF

echo "Rendering diagrams..."
manus-render-diagram /home/ubuntu/p2m_flow.mmd /home/ubuntu/p2m_flow.png
manus-render-diagram /home/ubuntu/p2b_flow.mmd /home/ubuntu/p2b_flow.png
manus-render-diagram /home/ubuntu/b2p_flow.mmd /home/ubuntu/b2p_flow.png
manus-render-diagram /home/ubuntu/b2b_flow.mmd /home/ubuntu/b2b_flow.png

echo "All diagrams created successfully!"
ls -lh /home/ubuntu/*_flow.png
