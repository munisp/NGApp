package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"go.temporal.io/sdk/client"
)

// JourneyRunner is a CLI tool to execute user journey workflows
// It can be used to validate that all journeys work end-to-end in the sandbox

func main() {
	// Parse command line flags
	journey := flag.Int("journey", 0, "Journey number to run (1-20)")
	listJourneys := flag.Bool("list", false, "List all available journeys")
	runAll := flag.Bool("all", false, "Run all journeys")
	temporalAddr := flag.String("temporal", "temporal.payment-switch.svc.cluster.local:7233", "Temporal server address")
	namespace := flag.String("namespace", "default", "Temporal namespace")
	taskQueue := flag.String("queue", "orchestrator-workers", "Temporal task queue")
	flag.Parse()

	if *listJourneys {
		printJourneyList()
		return
	}

	// Create Temporal client
	c, err := client.Dial(client.Options{
		HostPort:  *temporalAddr,
		Namespace: *namespace,
	})
	if err != nil {
		log.Fatalf("Failed to create Temporal client: %v", err)
	}
	defer c.Close()

	ctx := context.Background()

	if *runAll {
		runAllJourneys(ctx, c, *taskQueue)
		return
	}

	if *journey < 1 || *journey > 20 {
		fmt.Println("Please specify a journey number between 1 and 20")
		fmt.Println("Use -list to see all available journeys")
		os.Exit(1)
	}

	runJourney(ctx, c, *taskQueue, *journey)
}

func printJourneyList() {
	journeys := []struct {
		num         int
		name        string
		description string
		components  string
	}{
		{1, "AdminProvisionOrganization", "Admin logs in and provisions a new participant organization", "Keycloak, Permify, APISIX, Onboarding, Kafka, Lakehouse"},
		{2, "ParticipantKYBActivation", "Participant completes KYB and is approved to join the network", "KYB (Ballerine), Docling, PaddleOCR, LLaVA, Compliance, Kafka, Lakehouse"},
		{3, "UserKYCProductAccess", "Individual user completes KYC and is granted product access", "KYC, Identity Verification, AML, Permify, Kafka, Lakehouse"},
		{4, "MerchantPOSOnboarding", "Merchant onboarding + store creation + POS enablement", "Onboarding, KYB, Document Storage, POS Service, Sandbox, Kafka, Lakehouse"},
		{5, "DeveloperSandboxAccess", "Developer creates API token, gets metered access, and tests in sandbox", "Monetization, Token, Metering, Sandbox, APISIX, Redis, Kafka, Lakehouse"},
		{6, "P2PTransferMojaloop", "P2P transfer using Mojaloop APIs backed by TigerBeetle ledger", "Mojaloop, TigerBeetle, Fraud Detection, Kafka, Fluvio, Lakehouse"},
		{7, "QRCodePayment", "Merchant payment via QR code end-to-end", "QR Service, Payment Processing, TigerBeetle, Notifications, Kafka, Lakehouse"},
		{8, "RemittanceFXTransfer", "Remittance/FX transfer across corridors with FX risk checks", "Remittance, FX Risk, Routing, TigerBeetle, Kafka, Lakehouse"},
		{9, "DisputeChargeback", "Dispute/chargeback lifecycle", "Disputes, Document Storage, Compliance, TigerBeetle, Notifications, Kafka, Lakehouse"},
		{10, "Reconciliation", "Reconciliation: compare ledger vs processor vs bank settlement", "Reconciliation, Lakehouse, TigerBeetle, Alerts, Kafka"},
		{11, "SettlementCycle", "Settlement cycle and central bank reporting", "Settlement, National/Regulatory Reporting, TigerBeetle, RustFS, Kafka, Lakehouse"},
		{12, "InstantSettlement", "Instant settlement path for eligible transactions", "Instant Settlement, TigerBeetle, Kafka, Fluvio, Lakehouse"},
		{13, "FraudScoringCaseManagement", "Fraud scoring at authorization time + case management", "Fraud Detection (Python), Rule Engine, AML Case Management, Kafka, Lakehouse"},
		{14, "BatchAnalyticsPipeline", "Batch analytics: daily metrics pipeline", "Spark, Delta Lake, RustFS, Temporal Schedule, Lakehouse"},
		{15, "StreamingAnalyticsPipeline", "Streaming analytics: domain events → Flink → Delta Lake", "Kafka, Flink, Delta Lake, RustFS, Lakehouse"},
		{16, "WebhookIntegration", "Webhook integration for external partners", "Webhooks, Retry Service, Idempotency, Audit, Kafka, Lakehouse"},
		{17, "SecurityPosture", "Security posture journey: WAF policy + anomaly alerting", "OpenAppSec, APISIX, Observability, Alerts, Kafka, Lakehouse"},
		{18, "DRFailoverDrill", "Disaster recovery failover drill", "DR Service, Health Checks, RustFS, Notifications, Kafka, Lakehouse"},
		{19, "DataGovernancePIIMasking", "Data governance / PII masking workflow for analytics exports", "PII Masking, Export, Permify, Compliance, RustFS, Kafka, Lakehouse"},
		{20, "ConformanceIntegrationTesting", "Conformance & integration testing journey", "Mojaloop Conformance, Integration Testing Portal, Sandbox, Kafka, Lakehouse"},
	}

	fmt.Println("\n=== PAYMENT SWITCH PLATFORM - TOP 20 USER JOURNEYS ===\n")
	fmt.Println("These journeys are based on EXISTING implemented components in the platform.")
	fmt.Println("Each journey exercises real services and middleware integrations.\n")

	for _, j := range journeys {
		fmt.Printf("Journey %2d: %s\n", j.num, j.name)
		fmt.Printf("           %s\n", j.description)
		fmt.Printf("           Components: %s\n\n", j.components)
	}

	fmt.Println("\nUsage:")
	fmt.Println("  journey_runner -journey 1    # Run journey 1")
	fmt.Println("  journey_runner -all          # Run all journeys")
	fmt.Println("  journey_runner -list         # List all journeys")
}

func runJourney(ctx context.Context, c client.Client, taskQueue string, journeyNum int) {
	fmt.Printf("\n=== Running Journey %d ===\n\n", journeyNum)

	workflowID := fmt.Sprintf("journey-%d-%d", journeyNum, time.Now().UnixNano())

	var workflowName string
	var input interface{}

	switch journeyNum {
	case 1:
		workflowName = "Journey1_AdminProvisionOrganizationWorkflow"
		input = map[string]interface{}{
			"AdminUserID":      "admin-001",
			"OrganizationName": "Test Bank Ltd",
			"OrganizationType": "bank",
			"Country":          "NG",
			"ContactEmail":     "admin@testbank.com",
			"ContactPhone":     "+2341234567890",
		}
	case 2:
		workflowName = "Journey2_ParticipantKYBActivationWorkflow"
		input = map[string]interface{}{
			"OrganizationID": "org-001",
			"BusinessName":   "Test Fintech Ltd",
			"RegistrationNo": "RC123456",
			"TaxID":          "TIN123456",
			"Documents":      []string{"doc1.pdf", "doc2.pdf"},
			"Directors":      []string{"John Doe", "Jane Smith"},
			"Country":        "NG",
		}
	case 3:
		workflowName = "Journey3_UserKYCProductAccessWorkflow"
		input = map[string]interface{}{
			"UserID":         "user-001",
			"OrganizationID": "org-001",
			"FullName":       "John Doe",
			"DateOfBirth":    "1990-01-15",
			"IDType":         "national_id",
			"IDNumber":       "NIN123456789",
			"IDDocument":     "id_doc.jpg",
			"SelfieImage":    "selfie.jpg",
			"Address":        "123 Main St, Lagos",
			"Country":        "NG",
		}
	case 4:
		workflowName = "Journey4_MerchantPOSOnboardingWorkflow"
		input = map[string]interface{}{
			"OrganizationID": "org-001",
			"MerchantName":   "Test Store",
			"MerchantType":   "retail",
			"Documents":      []string{"business_reg.pdf"},
			"POSType":        "physical",
			"Locations": []map[string]interface{}{
				{"name": "Main Store", "address": "123 Main St"},
			},
		}
	case 5:
		workflowName = "Journey5_DeveloperSandboxAccessWorkflow"
		input = map[string]interface{}{
			"DeveloperID":    "dev-001",
			"OrganizationID": "org-001",
			"AppName":        "Test App",
			"PlanType":       "starter",
			"Scopes":         []string{"payments:read", "payments:write"},
		}
	case 6:
		workflowName = "Journey6_P2PTransferMojaloopWorkflow"
		input = map[string]interface{}{
			"PayerID":         "user-001",
			"PayeeID":         "user-002",
			"Amount":          10000,
			"Currency":        "NGN",
			"PayerFSPID":      "fsp-001",
			"PayeeFSPID":      "fsp-002",
			"TransactionType": "p2p",
		}
	case 7:
		workflowName = "Journey7_QRCodePaymentWorkflow"
		input = map[string]interface{}{
			"MerchantID": "merchant-001",
			"Amount":     5000,
			"Currency":   "NGN",
			"CustomerID": "user-001",
			"QRType":     "dynamic",
			"ExpiresIn":  300,
		}
	case 8:
		workflowName = "Journey8_RemittanceFXTransferWorkflow"
		input = map[string]interface{}{
			"SenderID":        "user-001",
			"RecipientID":     "user-003",
			"SendAmount":      100000,
			"SendCurrency":    "NGN",
			"ReceiveCurrency": "USD",
			"Corridor":        "NG-US",
			"Purpose":         "family_support",
		}
	case 9:
		workflowName = "Journey9_DisputeChargebackWorkflow"
		input = map[string]interface{}{
			"TransactionID": "txn-001",
			"CustomerID":    "user-001",
			"MerchantID":    "merchant-001",
			"Reason":        "unauthorized_transaction",
			"Amount":        5000,
			"Evidence":      []string{"screenshot.png"},
		}
	case 10:
		workflowName = "Journey10_ReconciliationWorkflow"
		input = map[string]interface{}{
			"ReconciliationType": "daily",
			"StartDate":          time.Now().AddDate(0, 0, -1),
			"EndDate":            time.Now(),
			"Sources":            []string{"ledger", "processor", "bank"},
		}
	case 11:
		workflowName = "Journey11_SettlementCycleWorkflow"
		input = map[string]interface{}{
			"SettlementDate": time.Now(),
			"Currency":       "NGN",
			"SettlementType": "net",
			"Participants":   []string{"fsp-001", "fsp-002", "fsp-003"},
		}
	case 12:
		workflowName = "Journey12_InstantSettlementWorkflow"
		input = map[string]interface{}{
			"TransactionID": "txn-002",
			"MerchantID":    "merchant-001",
			"Amount":        10000,
			"Currency":      "NGN",
		}
	case 13:
		workflowName = "Journey13_FraudScoringCaseManagementWorkflow"
		input = map[string]interface{}{
			"TransactionID": "txn-003",
			"UserID":        "user-001",
			"MerchantID":    "merchant-001",
			"Amount":        50000,
			"Currency":      "NGN",
			"DeviceInfo":    map[string]interface{}{"device_id": "dev-123"},
			"Location":      map[string]interface{}{"lat": 6.5244, "lng": 3.3792},
		}
	case 14:
		workflowName = "Journey14_BatchAnalyticsPipelineWorkflow"
		input = map[string]interface{}{
			"PipelineType": "daily_metrics",
			"StartDate":    time.Now().AddDate(0, 0, -1),
			"EndDate":      time.Now(),
			"Metrics":      []string{"transaction_volume", "success_rate", "avg_amount"},
		}
	case 15:
		workflowName = "Journey15_StreamingAnalyticsPipelineWorkflow"
		input = map[string]interface{}{
			"StreamName":   "transaction-stream",
			"SourceTopics": []string{"payment.completed", "transfer.completed"},
			"OutputTable":  "fact_realtime_transactions",
			"WindowSize":   60000000000, // 1 minute in nanoseconds
			"Aggregations": []string{"count", "sum", "avg"},
		}
	case 16:
		workflowName = "Journey16_WebhookIntegrationWorkflow"
		input = map[string]interface{}{
			"PartnerID":      "partner-001",
			"EventType":      "payment.completed",
			"Payload":        map[string]interface{}{"transaction_id": "txn-001", "amount": 5000},
			"IdempotencyKey": fmt.Sprintf("idem-%d", time.Now().UnixNano()),
		}
	case 17:
		workflowName = "Journey17_SecurityPostureWorkflow"
		input = map[string]interface{}{
			"PolicyType": "waf_update",
			"PolicyConfig": map[string]interface{}{
				"mode":       "prevention",
				"rules":      []string{"sql_injection", "xss", "rce"},
				"log_level":  "info",
			},
			"ApplyTo": []string{"payment-api", "onboarding-api"},
		}
	case 18:
		workflowName = "Journey18_DRFailoverDrillWorkflow"
		input = map[string]interface{}{
			"DrillType":    "planned",
			"TargetRegion": "us-west-2",
			"Services":     []string{"payment-api", "ledger-service", "notification-service"},
		}
	case 19:
		workflowName = "Journey19_DataGovernancePIIMaskingWorkflow"
		input = map[string]interface{}{
			"RequestType": "export",
			"DatasetName": "fact_transactions",
			"RequestedBy": "analyst-001",
			"Purpose":     "quarterly_report",
			"Fields":      []string{"customer_name", "email", "phone"},
			"MaskingRules": map[string]string{
				"customer_name": "partial",
				"email":         "hash",
				"phone":         "redact",
			},
		}
	case 20:
		workflowName = "Journey20_ConformanceIntegrationTestingWorkflow"
		input = map[string]interface{}{
			"TestSuite":     "mojaloop_conformance",
			"ParticipantID": "fsp-001",
			"Environment":   "sandbox",
			"TestCases":     []string{"party_lookup", "quote_request", "transfer_execute"},
		}
	default:
		fmt.Printf("Journey %d not implemented\n", journeyNum)
		return
	}

	// Start workflow
	options := client.StartWorkflowOptions{
		ID:        workflowID,
		TaskQueue: taskQueue,
	}

	we, err := c.ExecuteWorkflow(ctx, options, workflowName, input)
	if err != nil {
		log.Fatalf("Failed to start workflow: %v", err)
	}

	fmt.Printf("Started workflow: %s\n", we.GetID())
	fmt.Printf("Run ID: %s\n", we.GetRunID())

	// Wait for result
	var result interface{}
	err = we.Get(ctx, &result)
	if err != nil {
		log.Fatalf("Workflow failed: %v", err)
	}

	resultJSON, _ := json.MarshalIndent(result, "", "  ")
	fmt.Printf("\nResult:\n%s\n", string(resultJSON))
}

func runAllJourneys(ctx context.Context, c client.Client, taskQueue string) {
	fmt.Println("\n=== Running All 20 User Journeys ===\n")

	results := make(map[int]string)

	for i := 1; i <= 20; i++ {
		fmt.Printf("Running Journey %d...\n", i)

		// Run each journey with a timeout
		journeyCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
		
		func() {
			defer cancel()
			defer func() {
				if r := recover(); r != nil {
					results[i] = fmt.Sprintf("PANIC: %v", r)
				}
			}()

			runJourney(journeyCtx, c, taskQueue, i)
			results[i] = "SUCCESS"
		}()

		if results[i] == "" {
			results[i] = "TIMEOUT"
		}
	}

	// Print summary
	fmt.Println("\n=== Journey Execution Summary ===\n")
	successCount := 0
	for i := 1; i <= 20; i++ {
		status := results[i]
		if status == "SUCCESS" {
			successCount++
		}
		fmt.Printf("Journey %2d: %s\n", i, status)
	}
	fmt.Printf("\nTotal: %d/20 journeys completed successfully\n", successCount)
}
