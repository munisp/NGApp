package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
)

var middlewareConfig = map[string]interface{}{
	"kafka":      map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092"), "topics": []string{"kyc.bvn-verified", "kyc.nin-verified", "kyc.bvn-nin-linked", "kyc.verification-failed"}},
	"dapr":       map[string]interface{}{"app_id": "bvn-nin-verification-go", "url": envOr("DAPR_URL", "http://localhost:3500"), "pubsub": "bvn-nin-pubsub", "state_store": "bvn-nin-state"},
	"fluvio":     map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003"), "topics": []string{"bvn-verification-stream", "nin-verification-stream", "bvn-nin-linkage-stream"}},
	"temporal":   map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233"), "namespace": "bvn-nin-verification", "task_queue": "bvn-nin-pipeline", "workflows": []string{"BVNVerificationWorkflow", "NINVerificationWorkflow", "BVNNINLinkageWorkflow"}},
	"postgres":   map[string]interface{}{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": []string{"bvn_verifications", "nin_verifications", "bvn_nin_linkages"}},
	"keycloak":   map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client_id": "bvn-nin-verification", "roles": []string{"kyc_officer", "verification_admin"}},
	"permify":    map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476"), "schema": "bvn_nin_verification", "relations": []string{"can_verify", "can_admin"}},
	"redis":      map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379"), "keys": []string{"bvn:cache:{bvn}", "nin:cache:{nin}", "bvn-nin:link:{bvn}"}},
	"mojaloop":   map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002"), "purpose": "identity-oracle-bvn-nin"},
	"opensearch": map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200"), "indices": []string{"bvn-verifications", "nin-verifications", "bvn-nin-audit"}},
	"openappsec": map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000"), "policies": []string{"bvn-nin-api-protection", "pii-data-masking"}},
	"apisix":     map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080"), "routes": []string{"/v1/bvn/*", "/v1/nin/*"}, "plugins": []string{"jwt-auth", "rate-limiting", "ip-restriction"}},
	"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000"), "ledger": "verification-billing", "accounts": []string{"bvn-api-charges", "nin-api-charges"}},
	"lakehouse":  map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181"), "tables": []string{"bvn_verification_history", "nin_verification_history", "bvn_nin_linkage_analytics"}},
}

func envOr(k, d string) string {
	if v := os.Getenv(k); v != "" { return v }
	return d
}

type BVNVerification struct {
	ID            string  `json:"id"`
	BVN           string  `json:"bvn"`
	FirstName     string  `json:"firstName"`
	MiddleName    string  `json:"middleName"`
	LastName      string  `json:"lastName"`
	DOB           string  `json:"dateOfBirth"`
	Phone         string  `json:"phoneNumber"`
	Gender        string  `json:"gender"`
	Photo         string  `json:"photoBase64Hash"`
	LGA           string  `json:"lgaOfOrigin"`
	State         string  `json:"stateOfOrigin"`
	NINLinked     bool    `json:"ninLinked"`
	LinkedNIN     string  `json:"linkedNIN"`
	Verified      bool    `json:"verified"`
	MatchScore    float64 `json:"nameMatchScore"`
	VerifiedAt    string  `json:"verifiedAt"`
	CachedUntil   string  `json:"cachedUntil"`
	APIProvider   string  `json:"apiProvider"`
	ResponseTime  int     `json:"responseTimeMs"`
}

type NINVerification struct {
	ID            string  `json:"id"`
	NIN           string  `json:"nin"`
	FirstName     string  `json:"firstName"`
	MiddleName    string  `json:"middleName"`
	LastName      string  `json:"lastName"`
	DOB           string  `json:"dateOfBirth"`
	Phone         string  `json:"phoneNumber"`
	Gender        string  `json:"gender"`
	Photo         string  `json:"photoBase64Hash"`
	Address       string  `json:"residentialAddress"`
	BirthState    string  `json:"birthState"`
	BirthLGA      string  `json:"birthLGA"`
	BiometricHash string  `json:"biometricDataHash"`
	BVNLinked     bool    `json:"bvnLinked"`
	LinkedBVN     string  `json:"linkedBVN"`
	Verified      bool    `json:"verified"`
	MatchScore    float64 `json:"nameMatchScore"`
	VerifiedAt    string  `json:"verifiedAt"`
	APIProvider   string  `json:"apiProvider"`
	ResponseTime  int     `json:"responseTimeMs"`
}

type BVNNINLinkage struct {
	ID            string `json:"id"`
	BVN           string `json:"bvn"`
	NIN           string `json:"nin"`
	CustomerID    string `json:"customerId"`
	NameMatch     bool   `json:"namesMatch"`
	DOBMatch      bool   `json:"dobMatch"`
	GenderMatch   bool   `json:"genderMatch"`
	PhotoMatch    bool   `json:"photoSimilarityMatch"`
	PhotoScore    float64 `json:"photoSimilarityScore"`
	LinkStatus    string `json:"linkageStatus"`
	VerifiedAt    string `json:"verifiedAt"`
	Discrepancies []string `json:"discrepancies"`
}

var (
	bvnData = []BVNVerification{
		{ID: "BVNV-001", BVN: "22345678901", FirstName: "Amina", MiddleName: "Fatima", LastName: "Yusuf", DOB: "1991-03-15", Phone: "08012345678", Gender: "Female", Photo: "sha256:a3f8c2e1d9b4...", LGA: "Kosofe", State: "Lagos", NINLinked: true, LinkedNIN: "12345678901", Verified: true, MatchScore: 1.0, VerifiedAt: "2026-05-08T09:00:00Z", CachedUntil: "2026-05-09T09:00:00Z", APIProvider: "NIBSS-BVN-Validation", ResponseTime: 320},
		{ID: "BVNV-002", BVN: "33456789012", FirstName: "Chinedu", MiddleName: "", LastName: "Okeke", DOB: "1985-08-22", Phone: "08098765432", Gender: "Male", Photo: "sha256:b7d4e6f2a1c3...", LGA: "Nnewi North", State: "Anambra", NINLinked: false, LinkedNIN: "", Verified: true, MatchScore: 1.0, VerifiedAt: "2026-04-15T10:00:00Z", CachedUntil: "2026-04-16T10:00:00Z", APIProvider: "NIBSS-BVN-Validation", ResponseTime: 285},
		{ID: "BVNV-003", BVN: "44567890123", FirstName: "Oluwaseun", MiddleName: "David", LastName: "Adeyemi", DOB: "1998-12-01", Phone: "07012345678", Gender: "Male", Photo: "sha256:c1e9d3f7b2a5...", LGA: "Ibadan North", State: "Oyo", NINLinked: false, LinkedNIN: "", Verified: true, MatchScore: 1.0, VerifiedAt: "2026-05-01T12:00:00Z", CachedUntil: "2026-05-02T12:00:00Z", APIProvider: "NIBSS-BVN-Validation", ResponseTime: 410},
		{ID: "BVNV-004", BVN: "55678901234", FirstName: "Fatima", MiddleName: "Aisha", LastName: "Bello", DOB: "1993-06-10", Phone: "08056789012", Gender: "Female", Photo: "sha256:d2f0e4a8c6b1...", LGA: "Nassarawa", State: "Kano", NINLinked: true, LinkedNIN: "56789012345", Verified: true, MatchScore: 1.0, VerifiedAt: "2025-12-01T10:00:00Z", CachedUntil: "2025-12-02T10:00:00Z", APIProvider: "NIBSS-BVN-Validation", ResponseTime: 350},
	}
	ninData = []NINVerification{
		{ID: "NINV-001", NIN: "12345678901", FirstName: "Amina", MiddleName: "Fatima", LastName: "Yusuf", DOB: "1991-03-15", Phone: "08012345678", Gender: "Female", Photo: "sha256:a3f8c2e1d9b4...", Address: "15 Adeniyi Jones Avenue, Ikeja, Lagos", BirthState: "Lagos", BirthLGA: "Kosofe", BiometricHash: "sha256:bio_a3f8...", BVNLinked: true, LinkedBVN: "22345678901", Verified: true, MatchScore: 1.0, VerifiedAt: "2026-05-08T09:01:00Z", APIProvider: "NIMC-NIN-Verification", ResponseTime: 520},
		{ID: "NINV-002", NIN: "56789012345", FirstName: "Fatima", MiddleName: "Aisha", LastName: "Bello", DOB: "1993-06-10", Phone: "08056789012", Gender: "Female", Photo: "sha256:d2f0e4a8c6b1...", Address: "42 Katsina Road, Nassarawa GRA, Kano", BirthState: "Kano", BirthLGA: "Nassarawa", BiometricHash: "sha256:bio_d2f0...", BVNLinked: true, LinkedBVN: "55678901234", Verified: true, MatchScore: 1.0, VerifiedAt: "2025-12-01T10:02:00Z", APIProvider: "NIMC-NIN-Verification", ResponseTime: 480},
	}
	linkageData = []BVNNINLinkage{
		{ID: "LNK-001", BVN: "22345678901", NIN: "12345678901", CustomerID: "CUS-1045", NameMatch: true, DOBMatch: true, GenderMatch: true, PhotoMatch: true, PhotoScore: 0.96, LinkStatus: "verified", VerifiedAt: "2026-05-08T09:02:00Z", Discrepancies: []string{}},
		{ID: "LNK-002", BVN: "55678901234", NIN: "56789012345", CustomerID: "CUS-4055", NameMatch: true, DOBMatch: true, GenderMatch: true, PhotoMatch: true, PhotoScore: 0.91, LinkStatus: "verified", VerifiedAt: "2025-12-01T10:03:00Z", Discrepancies: []string{}},
	}
	mu sync.RWMutex
)

func main() {
	port := envOr("PORT", "8281")
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "healthy", "service": "bvn-nin-verification-go", "version": "1.0.0", "middleware": middlewareConfig})
	})
	http.HandleFunc("/api/bvn/verify", handleBVN)
	http.HandleFunc("/api/bvn/", handleBVNByID)
	http.HandleFunc("/api/nin/verify", handleNIN)
	http.HandleFunc("/api/nin/", handleNINByID)
	http.HandleFunc("/api/bvn-nin/linkage", handleLinkageList)
	http.HandleFunc("/api/bvn-nin/check", handleLinkageCheck)
	fmt.Printf("bvn-nin-verification-go listening on :%s\n", port)
	http.ListenAndServe(":"+port, nil)
}

func handleBVN(w http.ResponseWriter, r *http.Request) {
	if r.Method == "POST" {
		var req map[string]string
		json.NewDecoder(r.Body).Decode(&req)
		bvn := req["bvn"]
		mu.RLock(); defer mu.RUnlock()
		for _, b := range bvnData {
			if b.BVN == bvn { json.NewEncoder(w).Encode(b); return }
		}
		w.WriteHeader(404); json.NewEncoder(w).Encode(map[string]string{"error": "BVN not found in NIBSS records"})
		return
	}
	mu.RLock(); defer mu.RUnlock()
	json.NewEncoder(w).Encode(map[string]interface{}{"items": bvnData, "total": len(bvnData)})
}

func handleBVNByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/bvn/")
	mu.RLock(); defer mu.RUnlock()
	for _, b := range bvnData {
		if b.ID == id || b.BVN == id { json.NewEncoder(w).Encode(b); return }
	}
	w.WriteHeader(404)
}

func handleNIN(w http.ResponseWriter, r *http.Request) {
	if r.Method == "POST" {
		var req map[string]string
		json.NewDecoder(r.Body).Decode(&req)
		nin := req["nin"]
		mu.RLock(); defer mu.RUnlock()
		for _, n := range ninData {
			if n.NIN == nin { json.NewEncoder(w).Encode(n); return }
		}
		w.WriteHeader(404); json.NewEncoder(w).Encode(map[string]string{"error": "NIN not found in NIMC records"})
		return
	}
	mu.RLock(); defer mu.RUnlock()
	json.NewEncoder(w).Encode(map[string]interface{}{"items": ninData, "total": len(ninData)})
}

func handleNINByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/nin/")
	mu.RLock(); defer mu.RUnlock()
	for _, n := range ninData {
		if n.ID == id || n.NIN == id { json.NewEncoder(w).Encode(n); return }
	}
	w.WriteHeader(404)
}

func handleLinkageList(w http.ResponseWriter, r *http.Request) {
	mu.RLock(); defer mu.RUnlock()
	json.NewEncoder(w).Encode(map[string]interface{}{"items": linkageData, "total": len(linkageData)})
}

func handleLinkageCheck(w http.ResponseWriter, r *http.Request) {
	var req map[string]string
	json.NewDecoder(r.Body).Decode(&req)
	bvn, nin := req["bvn"], req["nin"]
	mu.RLock(); defer mu.RUnlock()
	for _, l := range linkageData {
		if l.BVN == bvn && l.NIN == nin { json.NewEncoder(w).Encode(l); return }
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"bvn": bvn, "nin": nin, "linkageStatus": "not_linked", "action": "Customer must link BVN to NIN per CBN directive"})
}
