package handlers

import (
	"encoding/json"
	"net/http"

	"multi-language-service/internal/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {}

func (h *Handler) Translate(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")
	lang := r.URL.Query().Get("lang")
	if key == "" { key = "welcome" }
	if lang == "" { lang = "en" }
	translations := map[string]map[string]string{
		"welcome": {"en": "Welcome", "ha": "Barka da zuwa", "yo": "Ẹ ku abọ", "ig": "Nnọọ", "pcm": "You don come"},
		"policy": {"en": "Policy", "ha": "Siyasa", "yo": "Ìlànà", "ig": "Iwu", "pcm": "Policy"},
	}
	text := key
	if t, ok := translations[key]; ok {
		if v, ok := t[lang]; ok { text = v }
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"key": key, "language": lang, "text": text})
}

func (h *Handler) ListLanguages(w http.ResponseWriter, r *http.Request) {
	languages := []map[string]interface{}{
		{"code": "en", "name": "English", "native": "English", "coverage": 1.0},
		{"code": "ha", "name": "Hausa", "native": "هَرْشَن هَوْسَ", "coverage": 0.85},
		{"code": "yo", "name": "Yoruba", "native": "Èdè Yorùbá", "coverage": 0.82},
		{"code": "ig", "name": "Igbo", "native": "Asụsụ Igbo", "coverage": 0.78},
		{"code": "pcm", "name": "Nigerian Pidgin", "native": "Naija", "coverage": 0.70},
		{"code": "sw", "name": "Swahili", "native": "Kiswahili", "coverage": 0.65},
		{"code": "fr", "name": "French", "native": "Français", "coverage": 0.90},
		{"code": "ar", "name": "Arabic", "native": "العربية", "coverage": 0.60},
		{"code": "pt", "name": "Portuguese", "native": "Português", "coverage": 0.55},
		{"code": "am", "name": "Amharic", "native": "አማርኛ", "coverage": 0.40},
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"languages": languages})
}

func (h *Handler) GetTranslations(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"translations": map[string]interface{}{}, "language": "en"})
}

func (h *Handler) BulkTranslate(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"translated": 0, "language": "en"})
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error": map[string]string{"code": code, "message": message},
	})
}
