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
		port = "8090"
	}

	mux := http.NewServeMux()

	sessionStore := NewSessionStore()
	handler := NewUSSDHandler(sessionStore)

	mux.HandleFunc("/ussd", handler.HandleUSSD)
	mux.HandleFunc("/ussd/callback", handler.HandleCallback)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"ussd-gateway"}`))
	})

	log.Printf("USSD Gateway starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}
