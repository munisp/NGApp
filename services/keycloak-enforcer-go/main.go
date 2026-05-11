package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
)
func getEnv(key, fb string) string { if v:=os.Getenv(key);v!=""{return v}; return fb }
func middlewareConfig() map[string]interface{} {
	return map[string]interface{}{
		"kafka":map[string]interface{}{"broker":getEnv("KAFKA_BROKER","localhost:9092"),"topics":"keycloak.auth-events,keycloak.session-events"},
		"redis":map[string]interface{}{"url":getEnv("REDIS_URL","redis://localhost:6379"),"purpose":"token-cache,session-store"},
		"postgres":map[string]interface{}{"url":getEnv("DATABASE_URL","postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"),"tables":"kc_realms,kc_clients,kc_users,kc_roles"},
		"tigerbeetle":map[string]interface{}{"url":getEnv("TIGERBEETLE_URL","localhost:3000"),"purpose":"auth-billing"},
		"dapr":map[string]interface{}{"url":getEnv("DAPR_URL","http://localhost:3500"),"pubsub":"auth-events"},
		"temporal":map[string]interface{}{"url":getEnv("TEMPORAL_URL","localhost:7233"),"workflow":"UserOnboardingWorkflow"},
		"opensearch":map[string]interface{}{"url":getEnv("OPENSEARCH_URL","http://localhost:9200"),"index":"auth-events-*"},
		"keycloak":map[string]interface{}{"url":getEnv("KEYCLOAK_URL","http://localhost:8080"),"realm":"54bank","role":"enforcer"},
		"permify":map[string]interface{}{"url":getEnv("PERMIFY_URL","http://localhost:3476"),"schema":"keycloak:enforce"},
		"fluvio":map[string]interface{}{"url":getEnv("FLUVIO_URL","localhost:9003"),"topic":"auth-stream"},
		"mojaloop":map[string]interface{}{"url":getEnv("MOJALOOP_URL","http://localhost:4000"),"purpose":"mojaloop-auth"},
		"apisix":map[string]interface{}{"url":getEnv("APISIX_URL","http://localhost:9080"),"route":"/keycloak/*"},
		"openappsec":map[string]interface{}{"url":getEnv("OPENAPPSEC_URL","http://localhost:8090"),"policy":"auth-protection"},
		"lakehouse":map[string]interface{}{"url":getEnv("LAKEHOUSE_URL","http://localhost:8206"),"tables":"auth_events,session_analytics"},
	}
}
func main() {
	port := getEnv("PORT","8278")
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { json.NewEncoder(w).Encode(map[string]interface{}{"status":"ok","service":"keycloak-enforcer-go","port":port,"middleware":middlewareConfig()}) })
	log.Printf("Keycloak Enforcer (Go) listening on :%s", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s",port), mux))
}
