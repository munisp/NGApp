package main
import ("encoding/json";"fmt";"net/http";"os")
func main() {
	port := os.Getenv("PORT"); if port == "" { port = "8330" }
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { json.NewEncoder(w).Encode(map[string]interface{}{"status":"healthy","service":"i18n-service-go","port":port}) })
	http.HandleFunc("/api/i18n-service/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type","application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"service":"i18n Localization","port":port,"status":"active"})
	})
	http.HandleFunc("/api/i18n-service/middleware", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type","application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"kafka":map[string]interface{}{"topics":[]string{"i18n-service.events"}},"dapr":map[string]interface{}{"stateStore":"i18n-service-state"},"fluvio":map[string]interface{}{"topics":[]string{"i18n-service-stream"}},"temporal":map[string]interface{}{"workflows":[]string{"i18n-service-workflow"}},"postgres":map[string]interface{}{"tables":[]string{"i18n-service_config"}},"keycloak":map[string]interface{}{"roles":[]string{"i18n-service-admin"}},"permify":map[string]interface{}{"relations":[]string{"i18n-service:can_manage"}},"redis":map[string]interface{}{"keys":[]string{"i18n-service:cache"}},"mojaloop":map[string]interface{}{"oracle":"i18n-service-oracle"},"opensearch":map[string]interface{}{"indices":[]string{"i18n-service-events"}},"openappsec":map[string]interface{}{"policy":"i18n-service-protection"},"apisix":map[string]interface{}{"route":"/api/i18n-service/*"},"tigerbeetle":map[string]interface{}{"accounts":[]string{}},"lakehouse":map[string]interface{}{"tables":[]string{"i18n-service_analytics"}}})
	})
	fmt.Printf("i18n Localization on :%s\n", port); http.ListenAndServe(":"+port, nil)
}
