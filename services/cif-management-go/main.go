package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
)

var port = getEnv("PORT", "8222")

var middlewareConfig = map[string]interface{}{
	"kafka":       map[string]string{"broker": getEnv("KAFKA_BROKER", "localhost:9092"), "topics": "cif.created,cif.updated,cif.address-verified,cif.kyc-refreshed"},
	"redis":       map[string]string{"url": getEnv("REDIS_URL", "redis://localhost:6379"), "purpose": "cif-cache,address-geocode-cache"},
	"postgres":    map[string]string{"url": getEnv("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "customers,addresses,contacts,relationships,kyc_documents"},
	"opensearch":  map[string]string{"url": getEnv("OPENSEARCH_URL", "http://localhost:9200"), "index": "customer-search"},
	"keycloak":    map[string]string{"url": getEnv("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "role": "customer-service,kyc-officer"},
	"permify":     map[string]string{"url": getEnv("PERMIFY_URL", "http://localhost:3476"), "schema": "cif:create,cif:update,cif:view-pii,cif:merge"},
	"dapr":        map[string]string{"url": getEnv("DAPR_URL", "http://localhost:3500"), "pubsub": "cif-events"},
	"fluvio":      map[string]string{"url": getEnv("FLUVIO_URL", "localhost:9003"), "topic": "cif-changes"},
	"temporal":    map[string]string{"url": getEnv("TEMPORAL_URL", "localhost:7233"), "workflow": "CIFMergeWorkflow,KYCRefreshWorkflow"},
	"mojaloop":    map[string]string{"url": getEnv("MOJALOOP_URL", "http://localhost:4000"), "purpose": "customer-lookup"},
	"tigerbeetle": map[string]string{"url": getEnv("TIGERBEETLE_URL", "localhost:3000"), "purpose": "customer-account-linkage"},
	"lakehouse":   map[string]string{"url": getEnv("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "customer_360_analytics"},
	"apisix":      map[string]string{"url": getEnv("APISIX_URL", "http://localhost:9080"), "route": "/cif/*"},
	"openappsec":  map[string]string{"url": getEnv("OPENAPPSEC_URL", "http://localhost:8090"), "policy": "pii-protection"},
}

type CIF struct {
	ID          string    `json:"id"`
	BVN         string    `json:"bvn"`
	FirstName   string    `json:"firstName"`
	LastName    string    `json:"lastName"`
	Email       string    `json:"email"`
	Phone       string    `json:"phone"`
	DOB         string    `json:"dateOfBirth"`
	Gender      string    `json:"gender"`
	KYCTier     int       `json:"kycTier"`
	Status      string    `json:"status"`
	Addresses   []Address `json:"addresses"`
	Contacts    []Contact `json:"contacts"`
	Relationships []Relationship `json:"relationships"`
	Documents   []KYCDoc  `json:"kycDocuments"`
	Accounts    int       `json:"accountCount"`
	TotalBalance float64  `json:"totalBalance"`
}

type Address struct {
	Type     string `json:"type"`
	Line1    string `json:"line1"`
	Line2    string `json:"line2"`
	City     string `json:"city"`
	State    string `json:"state"`
	Country  string `json:"country"`
	PostCode string `json:"postCode"`
	Verified bool   `json:"verified"`
	Primary  bool   `json:"isPrimary"`
}

type Contact struct {
	Type     string `json:"type"`
	Value    string `json:"value"`
	Verified bool   `json:"verified"`
	Primary  bool   `json:"isPrimary"`
}

type Relationship struct {
	Type       string `json:"type"`
	RelatedCIF string `json:"relatedCifId"`
	Name       string `json:"relatedName"`
}

type KYCDoc struct {
	Type     string `json:"type"`
	Number   string `json:"number"`
	Verified bool   `json:"verified"`
	Expiry   string `json:"expiryDate"`
}

var (
	cifs []CIF
	mu   sync.RWMutex
)

func init() {
	cifs = []CIF{
		{ID: "CIF-100", BVN: "22200100100", FirstName: "Adebayo", LastName: "Olumide", Email: "adebayo@email.com", Phone: "+2348012345678", DOB: "1985-03-15", Gender: "M", KYCTier: 3, Status: "active", Accounts: 3, TotalBalance: 4100000,
			Addresses: []Address{
				{Type: "residential", Line1: "15 Awolowo Road", Line2: "Ikoyi", City: "Lagos", State: "Lagos", Country: "NG", PostCode: "100001", Verified: true, Primary: true},
				{Type: "office", Line1: "123 Marina Street", City: "Lagos", State: "Lagos", Country: "NG", PostCode: "100002", Verified: true, Primary: false},
			},
			Contacts: []Contact{{Type: "mobile", Value: "+2348012345678", Verified: true, Primary: true}, {Type: "email", Value: "adebayo@email.com", Verified: true, Primary: true}},
			Relationships: []Relationship{{Type: "spouse", RelatedCIF: "CIF-101", Name: "Funke Olumide"}, {Type: "guarantor", RelatedCIF: "CIF-102", Name: "Emeka Uche"}},
			Documents: []KYCDoc{{Type: "NIN", Number: "12345678901", Verified: true, Expiry: ""}, {Type: "Passport", Number: "A12345678", Verified: true, Expiry: "2028-05-20"}, {Type: "Utility Bill", Number: "IKEDC-2026-001", Verified: true, Expiry: "2026-08-01"}},
		},
		{ID: "CIF-001", BVN: "22200200200", FirstName: "Aliko", LastName: "Dangote", Email: "ceo@dangote.com", Phone: "+2348099999999", DOB: "1957-04-10", Gender: "M", KYCTier: 3, Status: "active", Accounts: 12, TotalBalance: 48000000000,
			Addresses: []Address{{Type: "residential", Line1: "1 Alfred Rewane Road", City: "Lagos", State: "Lagos", Country: "NG", PostCode: "100001", Verified: true, Primary: true}},
			Contacts: []Contact{{Type: "mobile", Value: "+2348099999999", Verified: true, Primary: true}},
			Relationships: []Relationship{{Type: "company-director", RelatedCIF: "CIF-CORP-001", Name: "Dangote Industries Ltd"}},
			Documents: []KYCDoc{{Type: "NIN", Number: "99900100100", Verified: true, Expiry: ""}, {Type: "International Passport", Number: "B99999999", Verified: true, Expiry: "2030-12-31"}},
		},
		{ID: "CIF-200", BVN: "22200300300", FirstName: "Ngozi", LastName: "Eze", Email: "ngozi@email.com", Phone: "+2348055556666", DOB: "1992-11-22", Gender: "F", KYCTier: 2, Status: "active", Accounts: 1, TotalBalance: 1370000,
			Addresses: []Address{{Type: "residential", Line1: "45 Adeola Odeku Street", City: "Lagos", State: "Lagos", Country: "NG", PostCode: "100001", Verified: true, Primary: true}},
			Contacts: []Contact{{Type: "mobile", Value: "+2348055556666", Verified: true, Primary: true}},
			Relationships: []Relationship{},
			Documents: []KYCDoc{{Type: "NIN", Number: "33300200200", Verified: true, Expiry: ""}, {Type: "Voter Card", Number: "VC-LAG-123456", Verified: false, Expiry: ""}},
		},
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" { return v }
	return fallback
}

func jsonResponse(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "cif-management")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, 200, map[string]interface{}{
			"status": "healthy", "service": "cif-management",
			"cifs": map[string]int{"total": len(cifs)}, "middleware": middlewareConfig,
		})
	})
	mux.HandleFunc("/v1/customers", func(w http.ResponseWriter, r *http.Request) { jsonResponse(w, 200, map[string]interface{}{"items": cifs, "total": len(cifs)}) })
	mux.HandleFunc("/v1/stats", func(w http.ResponseWriter, r *http.Request) {
		totalAccounts := 0; totalBalance := 0.0; totalDocs := 0
		for _, c := range cifs { totalAccounts += c.Accounts; totalBalance += c.TotalBalance; totalDocs += len(c.Documents) }
		jsonResponse(w, 200, map[string]interface{}{
			"totalCIFs": len(cifs), "totalAccounts": totalAccounts, "totalBalance": totalBalance,
			"totalKYCDocuments": totalDocs, "avgKYCTier": 2.67,
			"addressTypes": []string{"residential", "office", "mailing", "permanent"},
		})
	})
	mux.HandleFunc("/v1/customers/", func(w http.ResponseWriter, r *http.Request) {
		id := r.URL.Path[len("/v1/customers/"):]
		for _, c := range cifs { if c.ID == id { jsonResponse(w, 200, c); return } }
		jsonResponse(w, 404, map[string]string{"error": "CIF not found"})
	})

	log.Printf("[cif-management] Listening on :%s with %d CIF records\n", port, len(cifs))
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
