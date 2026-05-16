package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8092"
	}

	mux := http.NewServeMux()
	handler := NewPaymentHandler()

	mux.HandleFunc("/api/v1/payments/initiate", handler.InitiatePayment)
	mux.HandleFunc("/api/v1/payments/callback", handler.PaymentCallback)
	mux.HandleFunc("/api/v1/payments/status/", handler.GetPaymentStatus)
	mux.HandleFunc("/api/v1/payments/recurring", handler.SetupRecurring)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"mobile-money-service"}`))
	})

	log.Printf("Mobile Money Service starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}
