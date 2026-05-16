package main

import (
	"log"
	"net/http"
	"os"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8111" }
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"healthy","service":"native-mobile-ios"}`)
		)
	})
	log.Printf("Native Mobile iOS API starting on port %s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil { log.Fatal(err) }
}
