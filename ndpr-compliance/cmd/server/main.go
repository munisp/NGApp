package main

import (
	"log"
	"net/http"
	"os"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8107" }
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"healthy","service":"ndpr-compliance"}`))
	})
	log.Printf("NDPR Compliance service starting on port %s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil { log.Fatal(err) }
}
