package main

import (
	"fmt"
	"log"
	"net/http"

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

func main() {
	router := mux.NewRouter()

	router.HandleFunc("/upi/payment", UPIAdapter).Methods("POST")
	router.HandleFunc("/pix/payment", PixAdapter).Methods("POST")
	router.HandleFunc("/cips/payment", CIPSAdapter).Methods("POST")

	log.Fatal(http.ListenAndServe(":8080", router))
}
