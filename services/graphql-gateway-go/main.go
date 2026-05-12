package main
import ("encoding/json";"fmt";"net/http";"os")
func main() {
	port := os.Getenv("PORT"); if port == "" { port = "8347" }
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { json.NewEncoder(w).Encode(map[string]interface{}{"status":"healthy","service":"graphql-gateway-go","port":port}) })
	http.HandleFunc("/api/graphql-gateway/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type","application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"service":"GraphQL Gateway","port":port,"status":"active"})
	})
	http.HandleFunc("/api/graphql-gateway/middleware", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type","application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"kafka":map[string]interface{}{"topics":[]string{"graphql-gateway.events"}},"dapr":map[string]interface{}{"stateStore":"graphql-gateway-state"},"fluvio":map[string]interface{}{"topics":[]string{"graphql-gateway-stream"}},"temporal":map[string]interface{}{"workflows":[]string{"graphql-gateway-workflow"}},"postgres":map[string]interface{}{"tables":[]string{"graphql-gateway_config"}},"keycloak":map[string]interface{}{"roles":[]string{"graphql-gateway-admin"}},"permify":map[string]interface{}{"relations":[]string{"graphql-gateway:can_manage"}},"redis":map[string]interface{}{"keys":[]string{"graphql-gateway:cache"}},"mojaloop":map[string]interface{}{"oracle":"graphql-gateway-oracle"},"opensearch":map[string]interface{}{"indices":[]string{"graphql-gateway-events"}},"openappsec":map[string]interface{}{"policy":"graphql-gateway-protection"},"apisix":map[string]interface{}{"route":"/api/graphql-gateway/*"},"tigerbeetle":map[string]interface{}{"accounts":[]string{}},"lakehouse":map[string]interface{}{"tables":[]string{"graphql-gateway_analytics"}}})
	})
	fmt.Printf("GraphQL Gateway on :%s\n", port); http.ListenAndServe(":"+port, nil)
}
