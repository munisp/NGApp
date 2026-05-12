package main
import ("encoding/json";"fmt";"net/http";"os")
func main() {
	port := os.Getenv("PORT"); if port == "" { port = "8334" }
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { json.NewEncoder(w).Encode(map[string]interface{}{"status":"healthy","service":"account-closure-go","port":port}) })
	http.HandleFunc("/api/account-closure/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type","application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"service":"Account Closure","port":port,"status":"active"})
	})
	http.HandleFunc("/api/account-closure/middleware", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type","application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"kafka":map[string]interface{}{"topics":[]string{"account-closure.events"}},"dapr":map[string]interface{}{"stateStore":"account-closure-state"},"fluvio":map[string]interface{}{"topics":[]string{"account-closure-stream"}},"temporal":map[string]interface{}{"workflows":[]string{"account-closure-workflow"}},"postgres":map[string]interface{}{"tables":[]string{"account-closure_config"}},"keycloak":map[string]interface{}{"roles":[]string{"account-closure-admin"}},"permify":map[string]interface{}{"relations":[]string{"account-closure:can_manage"}},"redis":map[string]interface{}{"keys":[]string{"account-closure:cache"}},"mojaloop":map[string]interface{}{"oracle":"account-closure-oracle"},"opensearch":map[string]interface{}{"indices":[]string{"account-closure-events"}},"openappsec":map[string]interface{}{"policy":"account-closure-protection"},"apisix":map[string]interface{}{"route":"/api/account-closure/*"},"tigerbeetle":map[string]interface{}{"accounts":[]string{}},"lakehouse":map[string]interface{}{"tables":[]string{"account-closure_analytics"}}})
	})
	fmt.Printf("Account Closure on :%s\n", port); http.ListenAndServe(":"+port, nil)
}
