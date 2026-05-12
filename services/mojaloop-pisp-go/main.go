package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8310" }

	consents := []map[string]interface{}{
		{"id": "CONSENT-001", "pisp": "PayStack", "dfsp": "54Bank", "customer_id": "CUST-001",
			"scopes": []string{"accounts.read", "transfers.initiate"}, "status": "active",
			"credential_type": "FIDO2", "created_at": "2026-05-01T10:00:00Z"},
		{"id": "CONSENT-002", "pisp": "Flutterwave", "dfsp": "54Bank", "customer_id": "CUST-002",
			"scopes": []string{"accounts.read", "balances.read"}, "status": "active",
			"credential_type": "OTP", "created_at": "2026-05-03T14:30:00Z"},
	}

	thirdPartyTxns := []map[string]interface{}{
		{"id": "3P-TXN-001", "pisp": "PayStack", "payer_dfsp": "54Bank", "payee_dfsp": "AccessBank",
			"amount": 250000, "currency": "NGN", "status": "committed",
			"authorization_type": "FIDO2", "challenge": "base64...", "latency_ms": 890},
		{"id": "3P-TXN-002", "pisp": "Flutterwave", "payer_dfsp": "54Bank", "payee_dfsp": "GTBank",
			"amount": 1500000, "currency": "NGN", "status": "pending_authorization"},
	}

	mw := map[string]interface{}{
		"kafka": map[string]interface{}{"topics": []string{"mojaloop.pisp.consents", "mojaloop.pisp.transfers"}},
		"dapr": map[string]interface{}{"stateStore": "pisp-state"},
		"fluvio": map[string]interface{}{"topics": []string{"pisp-stream"}},
		"temporal": map[string]interface{}{"workflows": []string{"pisp-consent-flow", "pisp-transfer-flow"}},
		"postgres": map[string]interface{}{"tables": []string{"pisp_consents", "pisp_transactions"}},
		"keycloak": map[string]interface{}{"roles": []string{"pisp-admin", "pisp-initiator"}},
		"permify": map[string]interface{}{"relations": []string{"pisp:can_initiate"}},
		"redis": map[string]interface{}{"keys": []string{"pisp:consent:cache"}},
		"mojaloop": map[string]interface{}{"api": "thirdparty-api/v1.0"},
		"opensearch": map[string]interface{}{"indices": []string{"pisp-transactions"}},
		"openappsec": map[string]interface{}{"policy": "pisp-protection"},
		"apisix": map[string]interface{}{"route": "/api/mojaloop-pisp/*"},
		"tigerbeetle": map[string]interface{}{"accounts": []string{"pisp_escrow"}},
		"lakehouse": map[string]interface{}{"tables": []string{"pisp_analytics"}},
	}

	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "healthy", "service": "mojaloop-pisp-go", "port": port})
	})
	http.HandleFunc("/api/mojaloop-pisp/consents", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(consents)
	})
	http.HandleFunc("/api/mojaloop-pisp/transactions", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(thirdPartyTxns)
	})
	http.HandleFunc("/api/mojaloop-pisp/middleware", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(mw)
	})
	fmt.Printf("Mojaloop PISP on :%s\n", port)
	http.ListenAndServe(":"+port, nil)
}
