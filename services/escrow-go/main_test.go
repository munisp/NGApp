package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHealthz(t *testing.T) {
	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	healthz(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["service"] != "escrow-go" {
		t.Fatalf("expected service escrow-go, got %v", resp["service"])
	}
	mw, ok := resp["middleware"].(map[string]interface{})
	if !ok || mw == nil {
		t.Fatal("expected middleware config in healthz response")
	}
	requiredMiddleware := []string{"kafka", "redis", "postgres", "opensearch", "keycloak", "permify", "dapr", "fluvio", "temporal", "mojaloop", "tigerbeetle", "lakehouse", "apisix", "openappsec"}
	for _, m := range requiredMiddleware {
		if _, found := mw[m]; !found {
			t.Errorf("missing middleware: %s", m)
		}
	}
}

func TestListEscrowAccounts(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/escrow/accounts", nil)
	w := httptest.NewRecorder()
	handleAccounts(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	items, ok := resp["items"].([]interface{})
	if !ok {
		t.Fatal("expected items array")
	}
	if len(items) < 1 {
		t.Fatal("expected at least 1 escrow account")
	}
}

func TestCreateEscrowAccount(t *testing.T) {
	body := `{"buyer":"TestBuyer","seller":"TestSeller","amount":5000000,"currency":"NGN","condition":"unit test"}`
	req := httptest.NewRequest("POST", "/v1/escrow/accounts", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleAccounts(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["buyer"] != "TestBuyer" {
		t.Errorf("expected buyer TestBuyer, got %v", resp["buyer"])
	}
	if resp["status"] != "draft" {
		t.Errorf("expected status draft, got %v", resp["status"])
	}
}

func TestEscrowStats(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/escrow/stats", nil)
	w := httptest.NewRecorder()
	handleStats(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if _, ok := resp["totalAccounts"]; !ok {
		t.Error("expected totalAccounts in stats")
	}
	if _, ok := resp["totalHeldValue"]; !ok {
		t.Error("expected totalHeldValue in stats")
	}
}
