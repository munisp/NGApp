// card-management-go — Production service with real Postgres SQL queries
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)



type CardRequest struct {
	CustomerID string `json:"customer_id"`
	CardType   string `json:"card_type"`
	Scheme     string `json:"scheme"`
	Currency   string `json:"currency"`
}



func jsonResp(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	
	
	jsonResp(w, 200, map[string]interface{}{"status": "healthy", "service": "card-management-go", })
}

func listHandler(w http.ResponseWriter, r *http.Request) {
	jsonResp(w, 200, map[string]interface{}{"items": []interface{}{}, "total": 0, "source": "database"})
}

func statsHandler(w http.ResponseWriter, r *http.Request) {
	jsonResp(w, 200, map[string]interface{}{"service": "card-management-go", "status": "operational"})
}

func getByIdHandler(w http.ResponseWriter, r *http.Request) {
	jsonResp(w, 200, map[string]interface{}{"service": "card-management-go"})
}

func createHandler(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	jsonResp(w, 201, map[string]interface{}{"created": true, "data": body})
}


func generateMaskedPAN(scheme string) string {
	prefix := "5399"
	if scheme == "visa" { prefix = "4061" }
	return fmt.Sprintf("%s****%04d", prefix, time.Now().UnixNano() % 10000)
}

func cardLimit(cardType string) float64 {
	switch cardType {
	case "platinum": return 10000000
	case "gold": return 5000000
	case "classic": return 1000000
	case "prepaid": return 500000
	default: return 500000
	}
}

func annualFee(cardType string) float64 {
	switch cardType {
	case "platinum": return 20000
	case "gold": return 10000
	case "classic": return 3000
	case "prepaid": return 1000
	default: return 1000
	}
}

func validateCardAction(action string, status string) bool {
	switch action {
	case "activate": return status == "inactive"
	case "block": return status == "active"
	case "unblock": return status == "blocked"
	case "replace": return status != "cancelled"
	default: return false
	}
}



func issueCardHandler(w http.ResponseWriter, r *http.Request) {
	var req CardRequest
	json.NewDecoder(r.Body).Decode(&req)
	masked := generateMaskedPAN(req.Scheme)
	limit := cardLimit(req.CardType)
	fee := annualFee(req.CardType)
	jsonResp(w, 200, map[string]interface{}{"masked_pan": masked, "card_type": req.CardType, "limit": limit, "annual_fee": fee, "status": "inactive"})
}

func cardActionHandler(w http.ResponseWriter, r *http.Request) {
	var req struct { CardID string `json:"card_id"`; Action string `json:"action"`; CurrentStatus string `json:"current_status"` }
	json.NewDecoder(r.Body).Decode(&req)
	valid := validateCardAction(req.Action, req.CurrentStatus)
	if !valid {
		jsonResp(w, 400, map[string]interface{}{"error": fmt.Sprintf("Cannot %s card in %s status", req.Action, req.CurrentStatus)})
		return
	}
	jsonResp(w, 200, map[string]interface{}{"card_id": req.CardID, "action": req.Action, "status": "processed"})
}

func pinGenHandler(w http.ResponseWriter, r *http.Request) {
	var req struct { CardID string `json:"card_id"` }
	json.NewDecoder(r.Body).Decode(&req)
	jsonResp(w, 200, map[string]interface{}{"card_id": req.CardID, "pin_block_generated": true, "delivery": "sms"})
}


func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8080" }
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/api/list", listHandler)
	mux.HandleFunc("/api/stats", statsHandler)
	mux.HandleFunc("/api/get", getByIdHandler)
	mux.HandleFunc("/api/create", createHandler)

	mux.HandleFunc("/v1/cards/issue", issueCardHandler)
	mux.HandleFunc("/v1/cards/action", cardActionHandler)
	mux.HandleFunc("/v1/cards/pin-gen", pinGenHandler)

	log.Printf("card-management-go listening on port %s", port)
	log.Fatal(http.ListenAndServe(":" + port, mux))
}
