package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/mux"
)

// UPIAdapter handles UPI integration
func UPIAdapter(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "UPI Adapter: Processing UPI transaction")
}

// PixAdapter handles Pix integration
func PixAdapter(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "Pix Adapter: Processing Pix transaction")
}

// CIPSAdapter handles CIPS integration
func CIPSAdapter(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "CIPS Adapter: Processing CIPS transaction")
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"status":"healthy","service":"integration-adapters"}`)
}

func readyHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"status":"ready","service":"integration-adapters"}`)
}

func main() {
	router := mux.NewRouter()

	router.HandleFunc("/health", healthHandler).Methods("GET")
	router.HandleFunc("/ready", readyHandler).Methods("GET")
	router.HandleFunc("/upi/payment", UPIAdapter).Methods("POST")
	router.HandleFunc("/pix/payment", PixAdapter).Methods("POST")
	router.HandleFunc("/cips/payment", CIPSAdapter).Methods("POST")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Integration adapters listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, router))
}
