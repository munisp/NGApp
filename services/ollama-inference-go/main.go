package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8308" }

	type Model struct {
		ID string `json:"id"`; Name string `json:"name"`; Size string `json:"size"`
		Quant string `json:"quantization"`; Ctx int `json:"context_window"`
		Uses []string `json:"use_cases"`; Latency int `json:"avg_latency_ms"`; TPS int `json:"tokens_per_sec"`
	}
	type Endpoint struct {
		ID string `json:"id"`; Name string `json:"name"`; Model string `json:"model"`
		Prompt string `json:"system_prompt"`; Max int `json:"max_tokens"`
	}

	models := []Model{
		{ID: "OLL-001", Name: "llama3.1:70b-instruct-q4_K_M", Size: "40GB", Quant: "Q4_K_M", Ctx: 131072,
			Uses: []string{"compliance_qa", "regulatory_analysis", "aml_narrative"}, Latency: 1200, TPS: 45},
		{ID: "OLL-002", Name: "codellama:34b-instruct-q5_K_M", Size: "23GB", Quant: "Q5_K_M", Ctx: 16384,
			Uses: []string{"sql_generation", "api_generation", "code_review"}, Latency: 800, TPS: 60},
		{ID: "OLL-003", Name: "mistral:7b-instruct-v0.3-q8_0", Size: "7.7GB", Quant: "Q8_0", Ctx: 32768,
			Uses: []string{"entity_extraction", "sentiment_analysis", "classification"}, Latency: 180, TPS: 120},
		{ID: "OLL-004", Name: "nomic-embed-text:v1.5", Size: "274MB", Quant: "F16", Ctx: 8192,
			Uses: []string{"document_embedding", "semantic_search", "similarity"}, Latency: 25, TPS: 500},
	}
	endpoints := []Endpoint{
		{ID: "EP-001", Name: "compliance-qa", Model: "llama3.1:70b-instruct-q4_K_M",
			Prompt: "You are a Nigerian banking compliance expert.", Max: 2048},
		{ID: "EP-002", Name: "str-narrative-generator", Model: "llama3.1:70b-instruct-q4_K_M",
			Prompt: "Generate a STR narrative from transaction data.", Max: 4096},
		{ID: "EP-003", Name: "entity-extractor", Model: "mistral:7b-instruct-v0.3-q8_0",
			Prompt: "Extract named entities from text.", Max: 1024},
	}

	mw := map[string]interface{}{
		"kafka": map[string]interface{}{"topics": []string{"ollama.requests", "ollama.responses"}},
		"dapr": map[string]interface{}{"stateStore": "ollama-state"},
		"fluvio": map[string]interface{}{"topics": []string{"ollama-stream"}},
		"temporal": map[string]interface{}{"workflows": []string{"ollama-batch-inference"}},
		"postgres": map[string]interface{}{"tables": []string{"ollama_requests", "ollama_responses"}},
		"keycloak": map[string]interface{}{"roles": []string{"ollama-admin", "ollama-user"}},
		"permify": map[string]interface{}{"relations": []string{"ollama:can_infer"}},
		"redis": map[string]interface{}{"keys": []string{"ollama:cache"}},
		"mojaloop": map[string]interface{}{"oracle": "ollama-oracle"},
		"opensearch": map[string]interface{}{"indices": []string{"ollama-logs"}},
		"openappsec": map[string]interface{}{"policy": "ollama-protection"},
		"apisix": map[string]interface{}{"route": "/api/ollama/*"},
		"tigerbeetle": map[string]interface{}{"accounts": []string{}},
		"lakehouse": map[string]interface{}{"tables": []string{"ollama_analytics"}},
	}

	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "healthy", "service": "ollama-inference-go", "port": port})
	})
	http.HandleFunc("/api/ollama/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"models": models, "endpoints": endpoints, "gpu": "CUDA 12.1 A100"})
	})
	http.HandleFunc("/api/ollama/middleware", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mw)
	})
	fmt.Printf("Ollama LLM Inference on :%s\n", port)
	http.ListenAndServe(":"+port, nil)
}
