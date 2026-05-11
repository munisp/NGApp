package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
)

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" { return v }
	return fallback
}

func middlewareConfig() map[string]interface{} {
	return map[string]interface{}{
		"kafka":{"broker":getEnv("KAFKA_BROKER","localhost:9092"),"topics":"apisix.routes,apisix.plugins,apisix.upstream-health"},
		"redis":{"url":getEnv("REDIS_URL","redis://localhost:6379"),"purpose":"route-cache,rate-limit-counters"},
		"postgres":{"url":getEnv("DATABASE_URL","postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"),"tables":"apisix_routes,apisix_upstreams,apisix_plugins"},
		"tigerbeetle":{"url":getEnv("TIGERBEETLE_URL","localhost:3000"),"purpose":"api-billing-metering"},
		"dapr":{"url":getEnv("DAPR_URL","http://localhost:3500"),"pubsub":"apisix-events"},
		"temporal":{"url":getEnv("TEMPORAL_URL","localhost:7233"),"workflow":"RouteDeploymentWorkflow"},
		"opensearch":{"url":getEnv("OPENSEARCH_URL","http://localhost:9200"),"index":"apisix-access-*"},
		"keycloak":{"url":getEnv("KEYCLOAK_URL","http://localhost:8080"),"realm":"54bank"},
		"permify":{"url":getEnv("PERMIFY_URL","http://localhost:3476"),"schema":"apisix:admin"},
		"fluvio":{"url":getEnv("FLUVIO_URL","localhost:9003"),"topic":"apisix-stream"},
		"mojaloop":{"url":getEnv("MOJALOOP_URL","http://localhost:4000"),"purpose":"mojaloop-route-management"},
		"apisix":{"url":getEnv("APISIX_URL","http://localhost:9080"),"role":"self-management"},
		"openappsec":{"url":getEnv("OPENAPPSEC_URL","http://localhost:8090"),"policy":"apisix-admin-protection"},
		"lakehouse":{"url":getEnv("LAKEHOUSE_URL","http://localhost:8206"),"tables":"api_traffic_analytics,route_performance"},
	}
}

func main() {
	port := getEnv("PORT", "8275")
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/routes", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": config["routes"], "total": 8})
	})
	mux.HandleFunc("/v1/upstreams", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": config["upstreams"], "total": 4})
	})
	mux.HandleFunc("/v1/plugins", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": config["plugins"], "total": 8})
	})
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{"status":"ok","service":"apisix-gateway-go","port":port,"middleware":middlewareConfig()})
	})
	log.Printf("APISIX Gateway Manager (Go) listening on :%s", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", port), mux))
}
