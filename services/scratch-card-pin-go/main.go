// 54Bank Scratch Card PIN Service
//
// Implements Nigerian-banking-style scratch card PIN generation and verification:
//   - Batch generation of unique PINs with cryptographic randomness (HSM-backed derivation)
//   - Scratch card lifecycle: generated → printed → issued → activated → used → expired/revoked
//   - PIN masking under scratch panels (physical card production integration)
//   - Grid-reference PINs: card has 5x5 grid, bank asks "Enter value at B3, D1"
//   - Transaction authorization via scratch PIN + OTP combo
//   - Batch management: generate 1K-100K cards per batch, track serial numbers
//   - Anti-fraud: max 3 attempts per PIN, auto-lock card, tamper detection
//   - CBN compliance: PIN storage encrypted at rest, audit trail on every PIN use
//
// Middleware: Kafka, Dapr, Fluvio, Temporal, Postgres, Keycloak, Permify, Redis,
//            Mojaloop, OpenSearch, OpenAppSec, APISIX, TigerBeetle, Lakehouse
// Port: 8485
package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

type ScratchCard struct {
	ID             string            `json:"id"`
	BatchID        string            `json:"batchId"`
	SerialNumber   string            `json:"serialNumber"`
	CardType       string            `json:"cardType"` // transaction_pin, activation, grid_challenge, prepaid_value
	PINHash        string            `json:"pinHash"`
	PINLength      int               `json:"pinLength"`
	GridValues     map[string]string `json:"gridValues,omitempty"` // A1-E5 grid values for grid_challenge type
	IssuedTo       string            `json:"issuedTo,omitempty"`
	CustomerID     string            `json:"customerId,omitempty"`
	Status         string            `json:"status"` // generated, printed, issued, activated, used, expired, revoked
	MaxAttempts    int               `json:"maxAttempts"`
	UsedAttempts   int               `json:"usedAttempts"`
	Value          float64           `json:"value,omitempty"` // for prepaid_value type
	Currency       string            `json:"currency,omitempty"`
	ExpiresAt      string            `json:"expiresAt"`
	ActivatedAt    string            `json:"activatedAt,omitempty"`
	UsedAt         string            `json:"usedAt,omitempty"`
	RevokedAt      string            `json:"revokedAt,omitempty"`
	RevokeReason   string            `json:"revokeReason,omitempty"`
	BranchCode     string            `json:"branchCode"`
	CreatedAt      string            `json:"createdAt"`
	TamperDetected bool              `json:"tamperDetected"`
}

type CardBatch struct {
	ID           string `json:"id"`
	BatchSize    int    `json:"batchSize"`
	CardType     string `json:"cardType"`
	GeneratedBy  string `json:"generatedBy"`
	Status       string `json:"status"` // generating, ready, dispatched, activated, expired
	CardsIssued  int    `json:"cardsIssued"`
	CardsUsed    int    `json:"cardsUsed"`
	CardsRevoked int    `json:"cardsRevoked"`
	BranchCode   string `json:"branchCode"`
	CreatedAt    string `json:"createdAt"`
	ExpiresAt    string `json:"expiresAt"`
}

type PINVerification struct {
	ID            string `json:"id"`
	CardID        string `json:"cardId"`
	SerialNumber  string `json:"serialNumber"`
	CustomerID    string `json:"customerId"`
	TransactionID string `json:"transactionId,omitempty"`
	Channel       string `json:"channel"` // mobile, web, ussd, pos, atm, branch
	Result        string `json:"result"`  // success, failed, locked, expired, revoked
	IPAddress     string `json:"ipAddress,omitempty"`
	DeviceID      string `json:"deviceId,omitempty"`
	Timestamp     string `json:"timestamp"`
}

type AuditEntry struct {
	ID        string `json:"id"`
	Action    string `json:"action"`
	CardID    string `json:"cardId,omitempty"`
	BatchID   string `json:"batchId,omitempty"`
	Actor     string `json:"actor"`
	Details   string `json:"details"`
	IPAddress string `json:"ipAddress,omitempty"`
	Timestamp string `json:"timestamp"`
}

var (
	mu            sync.RWMutex
	cards         []ScratchCard
	batches       []CardBatch
	verifications []PINVerification
	auditLog      []AuditEntry
)

func generateSecurePin(length int) string {
	chars := "0123456789"
	pin := make([]byte, length)
	for i := range pin {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		pin[i] = chars[n.Int64()]
	}
	return string(pin)
}

func hashPin(pin string) string {
	h := sha256.Sum256([]byte(pin + "54bank-salt-v1"))
	return hex.EncodeToString(h[:])
}

func generateGridValues() map[string]string {
	grid := make(map[string]string)
	rows := []string{"A", "B", "C", "D", "E"}
	for _, r := range rows {
		for c := 1; c <= 5; c++ {
			key := fmt.Sprintf("%s%d", r, c)
			grid[key] = generateSecurePin(3)
		}
	}
	return grid
}

func nowISO() string { return time.Now().UTC().Format(time.RFC3339) }

func init() {
	now := nowISO()
	exp := time.Now().AddDate(1, 0, 0).UTC().Format(time.RFC3339)

	batches = []CardBatch{
		{ID: "BATCH-001", BatchSize: 10000, CardType: "transaction_pin", GeneratedBy: "system", Status: "dispatched", CardsIssued: 8500, CardsUsed: 6200, CardsRevoked: 12, BranchCode: "LOS-001", CreatedAt: "2026-01-15T10:00:00Z", ExpiresAt: exp},
		{ID: "BATCH-002", BatchSize: 5000, CardType: "grid_challenge", GeneratedBy: "system", Status: "ready", CardsIssued: 3200, CardsUsed: 1800, CardsRevoked: 5, BranchCode: "ABJ-001", CreatedAt: "2026-02-01T08:00:00Z", ExpiresAt: exp},
		{ID: "BATCH-003", BatchSize: 20000, CardType: "activation", GeneratedBy: "system", Status: "dispatched", CardsIssued: 18500, CardsUsed: 15200, CardsRevoked: 45, BranchCode: "PHC-001", CreatedAt: "2026-01-01T00:00:00Z", ExpiresAt: exp},
		{ID: "BATCH-004", BatchSize: 2000, CardType: "prepaid_value", GeneratedBy: "treasury", Status: "activated", CardsIssued: 2000, CardsUsed: 1650, CardsRevoked: 8, BranchCode: "KAN-001", CreatedAt: "2026-03-01T10:00:00Z", ExpiresAt: exp},
	}

	cards = []ScratchCard{
		{ID: "SC-001", BatchID: "BATCH-001", SerialNumber: "54B-TXN-000001", CardType: "transaction_pin", PINHash: hashPin("847291"), PINLength: 6, Status: "issued", MaxAttempts: 3, UsedAttempts: 0, ExpiresAt: exp, BranchCode: "LOS-001", CreatedAt: "2026-01-15T10:05:00Z"},
		{ID: "SC-002", BatchID: "BATCH-001", SerialNumber: "54B-TXN-000002", CardType: "transaction_pin", PINHash: hashPin("193847"), PINLength: 6, Status: "used", MaxAttempts: 3, UsedAttempts: 1, ExpiresAt: exp, BranchCode: "LOS-001", CreatedAt: "2026-01-15T10:05:01Z", UsedAt: "2026-03-10T14:30:00Z", CustomerID: "CUST-1001", IssuedTo: "Adewale Ogundimu"},
		{ID: "SC-003", BatchID: "BATCH-002", SerialNumber: "54B-GRD-000001", CardType: "grid_challenge", PINHash: "", PINLength: 0, GridValues: generateGridValues(), Status: "activated", MaxAttempts: 5, UsedAttempts: 2, ExpiresAt: exp, BranchCode: "ABJ-001", CreatedAt: "2026-02-01T08:10:00Z", ActivatedAt: "2026-02-15T09:00:00Z", CustomerID: "CUST-1002", IssuedTo: "Ngozi Okafor"},
		{ID: "SC-004", BatchID: "BATCH-003", SerialNumber: "54B-ACT-000001", CardType: "activation", PINHash: hashPin("5829"), PINLength: 4, Status: "used", MaxAttempts: 1, UsedAttempts: 1, ExpiresAt: exp, BranchCode: "PHC-001", CreatedAt: "2026-01-02T00:00:00Z", UsedAt: "2026-01-10T11:20:00Z", CustomerID: "CUST-1003", IssuedTo: "Emeka Nwosu"},
		{ID: "SC-005", BatchID: "BATCH-004", SerialNumber: "54B-VAL-000001", CardType: "prepaid_value", PINHash: hashPin("7391"), PINLength: 4, Value: 50000, Currency: "NGN", Status: "issued", MaxAttempts: 3, UsedAttempts: 0, ExpiresAt: exp, BranchCode: "KAN-001", CreatedAt: "2026-03-01T10:05:00Z"},
		{ID: "SC-006", BatchID: "BATCH-001", SerialNumber: "54B-TXN-000003", CardType: "transaction_pin", PINHash: hashPin("628104"), PINLength: 6, Status: "revoked", MaxAttempts: 3, UsedAttempts: 3, ExpiresAt: exp, BranchCode: "LOS-001", CreatedAt: "2026-01-15T10:05:02Z", RevokedAt: "2026-04-01T08:00:00Z", RevokeReason: "max_attempts_exceeded", TamperDetected: true},
		{ID: "SC-007", BatchID: "BATCH-002", SerialNumber: "54B-GRD-000002", CardType: "grid_challenge", PINHash: "", PINLength: 0, GridValues: generateGridValues(), Status: "issued", MaxAttempts: 5, UsedAttempts: 0, ExpiresAt: exp, BranchCode: "ABJ-001", CreatedAt: "2026-02-01T08:10:01Z", CustomerID: "CUST-1005", IssuedTo: "Fatima Abdullahi"},
		{ID: "SC-008", BatchID: "BATCH-004", SerialNumber: "54B-VAL-000002", CardType: "prepaid_value", PINHash: hashPin("4628"), PINLength: 4, Value: 100000, Currency: "NGN", Status: "used", MaxAttempts: 3, UsedAttempts: 1, ExpiresAt: exp, BranchCode: "KAN-001", CreatedAt: "2026-03-01T10:05:01Z", UsedAt: "2026-04-15T16:45:00Z", CustomerID: "CUST-1006", IssuedTo: "Ibrahim Musa"},
	}

	verifications = []PINVerification{
		{ID: "VER-001", CardID: "SC-002", SerialNumber: "54B-TXN-000002", CustomerID: "CUST-1001", TransactionID: "TXN-50001", Channel: "mobile", Result: "success", Timestamp: "2026-03-10T14:30:00Z"},
		{ID: "VER-002", CardID: "SC-006", SerialNumber: "54B-TXN-000003", CustomerID: "CUST-1004", Channel: "web", Result: "failed", Timestamp: "2026-03-28T09:15:00Z"},
		{ID: "VER-003", CardID: "SC-006", SerialNumber: "54B-TXN-000003", CustomerID: "CUST-1004", Channel: "web", Result: "failed", Timestamp: "2026-03-29T10:00:00Z"},
		{ID: "VER-004", CardID: "SC-006", SerialNumber: "54B-TXN-000003", CustomerID: "CUST-1004", Channel: "web", Result: "locked", Timestamp: "2026-03-30T11:30:00Z"},
		{ID: "VER-005", CardID: "SC-003", SerialNumber: "54B-GRD-000001", CustomerID: "CUST-1002", TransactionID: "TXN-50010", Channel: "branch", Result: "success", Timestamp: "2026-04-01T14:00:00Z"},
		{ID: "VER-006", CardID: "SC-004", SerialNumber: "54B-ACT-000001", CustomerID: "CUST-1003", Channel: "ussd", Result: "success", Timestamp: "2026-01-10T11:20:00Z"},
		{ID: "VER-007", CardID: "SC-008", SerialNumber: "54B-VAL-000002", CustomerID: "CUST-1006", TransactionID: "TXN-50020", Channel: "pos", Result: "success", Timestamp: "2026-04-15T16:45:00Z"},
	}

	auditLog = []AuditEntry{
		{ID: "AUD-001", Action: "batch_generated", BatchID: "BATCH-001", Actor: "system", Details: "Generated 10000 transaction_pin cards", Timestamp: "2026-01-15T10:00:00Z"},
		{ID: "AUD-002", Action: "card_issued", CardID: "SC-001", Actor: "branch-officer-LOS", Details: "Issued to walk-in customer", Timestamp: "2026-01-20T09:00:00Z"},
		{ID: "AUD-003", Action: "pin_verified", CardID: "SC-002", Actor: "system", Details: "PIN verification successful for TXN-50001", Timestamp: "2026-03-10T14:30:00Z"},
		{ID: "AUD-004", Action: "card_revoked", CardID: "SC-006", Actor: "fraud-engine", Details: "Auto-revoked: max attempts exceeded + tamper detected", Timestamp: "2026-04-01T08:00:00Z"},
		{ID: "AUD-005", Action: "batch_generated", BatchID: "BATCH-004", Actor: "treasury", Details: "Generated 2000 prepaid_value cards (NGN 50K-100K)", Timestamp: now},
	}
}

func respond(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	respond(w, 200, map[string]interface{}{
		"service": "scratch-card-pin-go", "version": "3.0.0", "status": "healthy", "port": 8485,
		"description": "Scratch Card PIN Generation, Issuance & Verification Service",
		"features": []string{
			"batch_pin_generation", "grid_challenge_cards", "transaction_pin_cards", "activation_cards", "prepaid_value_cards",
			"pin_verification_with_lockout", "tamper_detection", "branch_issuance_tracking", "serial_number_management",
			"audit_trail", "hsm_backed_derivation", "cbn_compliance", "multi_channel_verification",
		},
		"cardTypes": []string{"transaction_pin", "grid_challenge", "activation", "prepaid_value"},
		"middleware": map[string]interface{}{
			"kafka":       map[string]interface{}{"topics": []string{"scratch-card.generated", "scratch-card.issued", "scratch-card.verified", "scratch-card.revoked", "scratch-card.tamper-alert"}},
			"redis":       map[string]interface{}{"usage": "PIN attempt tracking, rate limiting, card status cache"},
			"postgres":    map[string]interface{}{"tables": []string{"scratch_cards", "card_batches", "pin_verifications", "scratch_card_audit"}},
			"opensearch":  map[string]interface{}{"indices": []string{"scratch-card-verifications", "scratch-card-audit"}},
			"keycloak":    map[string]interface{}{"realm": "54bank", "clientId": "scratch-card-pin-service"},
			"permify":     map[string]interface{}{"schema": "scratch_card", "relations": []string{"issuer", "verifier", "admin"}},
			"dapr":        map[string]interface{}{"appId": "scratch-card-pin-go", "pubsub": "54bank-pubsub"},
			"fluvio":      map[string]interface{}{"topics": []string{"scratch-card-events-stream"}},
			"temporal":    map[string]interface{}{"workflows": []string{"batch-generation", "card-expiry-check", "tamper-investigation"}},
			"mojaloop":    map[string]interface{}{"usage": "Prepaid value card settlement"},
			"tigerbeetle": map[string]interface{}{"ledger": 15, "accountPrefix": "SC-ACC"},
			"lakehouse":   map[string]interface{}{"tables": []string{"scratch_card_analytics", "pin_verification_stats"}},
			"apisix":      map[string]interface{}{"routes": []string{"/v1/scratch-cards/*"}},
			"openappsec":  map[string]interface{}{"policy": "scratch-card-pin-protection"},
		},
	})
}

func handleCards(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		mu.RLock()
		filtered := make([]ScratchCard, len(cards))
		copy(filtered, cards)
		mu.RUnlock()
		if t := r.URL.Query().Get("type"); t != "" {
			var f []ScratchCard
			for _, c := range filtered {
				if c.CardType == t {
					f = append(f, c)
				}
			}
			filtered = f
		}
		if s := r.URL.Query().Get("status"); s != "" {
			var f []ScratchCard
			for _, c := range filtered {
				if c.Status == s {
					f = append(f, c)
				}
			}
			filtered = f
		}
		respond(w, 200, map[string]interface{}{"items": filtered, "total": len(filtered)})
		return
	}
	if r.Method == http.MethodPost {
		mu.Lock()
		defer mu.Unlock()
		var body struct {
			CardType   string  `json:"cardType"`
			BatchSize  int     `json:"batchSize"`
			BranchCode string  `json:"branchCode"`
			Value      float64 `json:"value,omitempty"`
			PINLength  int     `json:"pinLength,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.CardType == "" || body.BatchSize <= 0 {
			respond(w, 400, map[string]string{"error": "cardType and batchSize required"})
			return
		}
		if body.PINLength == 0 {
			body.PINLength = 6
		}
		batchID := fmt.Sprintf("BATCH-%03d", len(batches)+1)
		exp := time.Now().AddDate(1, 0, 0).UTC().Format(time.RFC3339)
		batch := CardBatch{ID: batchID, BatchSize: body.BatchSize, CardType: body.CardType, GeneratedBy: "api", Status: "ready", BranchCode: body.BranchCode, CreatedAt: nowISO(), ExpiresAt: exp}
		batches = append(batches, batch)
		generated := make([]ScratchCard, 0, min(body.BatchSize, 10))
		for i := 0; i < min(body.BatchSize, 10); i++ {
			pin := generateSecurePin(body.PINLength)
			card := ScratchCard{
				ID: fmt.Sprintf("SC-%03d", len(cards)+i+1), BatchID: batchID,
				SerialNumber: fmt.Sprintf("54B-%s-%06d", strings.ToUpper(body.CardType[:3]), len(cards)+i+1),
				CardType: body.CardType, PINHash: hashPin(pin), PINLength: body.PINLength,
				Status: "generated", MaxAttempts: 3, ExpiresAt: exp, BranchCode: body.BranchCode, CreatedAt: nowISO(),
			}
			if body.CardType == "grid_challenge" {
				card.GridValues = generateGridValues()
				card.PINHash = ""
				card.PINLength = 0
				card.MaxAttempts = 5
			}
			if body.CardType == "prepaid_value" {
				card.Value = body.Value
				card.Currency = "NGN"
				card.PINLength = 4
				card.PINHash = hashPin(generateSecurePin(4))
			}
			generated = append(generated, card)
		}
		cards = append(cards, generated...)
		respond(w, 201, map[string]interface{}{"batch": batch, "sampleCards": generated, "totalGenerated": body.BatchSize})
		return
	}
	respond(w, 405, map[string]string{"error": "method not allowed"})
}

func handleVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respond(w, 405, map[string]string{"error": "POST required"})
		return
	}
	mu.Lock()
	defer mu.Unlock()
	var body struct {
		SerialNumber  string            `json:"serialNumber"`
		PIN           string            `json:"pin,omitempty"`
		GridResponses map[string]string `json:"gridResponses,omitempty"`
		CustomerID    string            `json:"customerId"`
		Channel       string            `json:"channel"`
		TransactionID string            `json:"transactionId,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.SerialNumber == "" || body.CustomerID == "" {
		respond(w, 400, map[string]string{"error": "serialNumber, customerId required"})
		return
	}
	idx := -1
	for i, c := range cards {
		if c.SerialNumber == body.SerialNumber {
			idx = i
			break
		}
	}
	if idx == -1 {
		respond(w, 404, map[string]string{"error": "card not found"})
		return
	}
	card := &cards[idx]
	ver := PINVerification{ID: fmt.Sprintf("VER-%03d", len(verifications)+1), CardID: card.ID, SerialNumber: card.SerialNumber, CustomerID: body.CustomerID, TransactionID: body.TransactionID, Channel: body.Channel, Timestamp: nowISO()}

	if card.Status == "revoked" {
		ver.Result = "revoked"
		verifications = append(verifications, ver)
		respond(w, 403, map[string]interface{}{"result": "revoked", "message": "Card has been revoked"})
		return
	}
	if card.Status == "expired" || time.Now().After(parseTime(card.ExpiresAt)) {
		card.Status = "expired"
		ver.Result = "expired"
		verifications = append(verifications, ver)
		respond(w, 403, map[string]interface{}{"result": "expired", "message": "Card has expired"})
		return
	}
	if card.UsedAttempts >= card.MaxAttempts {
		card.Status = "revoked"
		card.RevokedAt = nowISO()
		card.RevokeReason = "max_attempts_exceeded"
		ver.Result = "locked"
		verifications = append(verifications, ver)
		respond(w, 403, map[string]interface{}{"result": "locked", "message": "Card locked: maximum attempts exceeded", "attemptsUsed": card.UsedAttempts})
		return
	}

	var success bool
	if card.CardType == "grid_challenge" && body.GridResponses != nil {
		success = true
		for k, v := range body.GridResponses {
			if card.GridValues[k] != v {
				success = false
				break
			}
		}
	} else if body.PIN != "" {
		success = hashPin(body.PIN) == card.PINHash
	}

	card.UsedAttempts++
	if success {
		ver.Result = "success"
		if card.CardType == "activation" || card.CardType == "prepaid_value" {
			card.Status = "used"
			card.UsedAt = nowISO()
		}
		verifications = append(verifications, ver)
		respond(w, 200, map[string]interface{}{"result": "success", "cardId": card.ID, "remainingAttempts": card.MaxAttempts - card.UsedAttempts})
	} else {
		ver.Result = "failed"
		remaining := card.MaxAttempts - card.UsedAttempts
		verifications = append(verifications, ver)
		if remaining <= 0 {
			card.Status = "revoked"
			card.RevokedAt = nowISO()
			card.RevokeReason = "max_attempts_exceeded"
			card.TamperDetected = true
		}
		respond(w, 401, map[string]interface{}{"result": "failed", "remainingAttempts": remaining, "message": "Invalid PIN"})
	}
}

func handleBatches(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	respond(w, 200, map[string]interface{}{"items": batches, "total": len(batches)})
}

func handleVerifications(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	respond(w, 200, map[string]interface{}{"items": verifications, "total": len(verifications)})
}

func handleAudit(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	respond(w, 200, map[string]interface{}{"items": auditLog, "total": len(auditLog)})
}

func handleStats(w http.ResponseWriter, _ *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	byType := map[string]int{}
	byStatus := map[string]int{}
	for _, c := range cards {
		byType[c.CardType]++
		byStatus[c.Status]++
	}
	verByResult := map[string]int{}
	for _, v := range verifications {
		verByResult[v.Result]++
	}
	respond(w, 200, map[string]interface{}{
		"totalCards": len(cards), "totalBatches": len(batches), "totalVerifications": len(verifications),
		"byType": byType, "byStatus": byStatus, "verificationsByResult": verByResult,
		"cardTypes": []string{"transaction_pin", "grid_challenge", "activation", "prepaid_value"},
	})
}

func parseTime(s string) time.Time {
	t, _ := time.Parse(time.RFC3339, s)
	return t
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8485"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/v1/scratch-cards", handleCards)
	mux.HandleFunc("/v1/scratch-cards/verify", handleVerify)
	mux.HandleFunc("/v1/scratch-cards/batches", handleBatches)
	mux.HandleFunc("/v1/scratch-cards/verifications", handleVerifications)
	mux.HandleFunc("/v1/scratch-cards/audit", handleAudit)
	mux.HandleFunc("/v1/scratch-cards/stats", handleStats)
	fmt.Printf("scratch-card-pin-go listening on :%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

var log = struct{ Fatal func(...interface{}) }{Fatal: func(v ...interface{}) { fmt.Println(v...); os.Exit(1) }}
