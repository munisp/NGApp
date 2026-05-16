package handlers

import (
	"encoding/json"
	"multi-language-service/internal/models"
	"multi-language-service/internal/service"
	"net/http"
	"strings"
)

type Handler struct { svc *service.I18nService }
func NewHandler(svc *service.I18nService) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/i18n/languages", h.GetLanguages)
	mux.HandleFunc("/api/v1/i18n/bundle/", h.GetBundle)
	mux.HandleFunc("/api/v1/i18n/translate", h.Translate)
	mux.HandleFunc("/api/v1/i18n/translation", h.SetTranslation)
	mux.HandleFunc("/api/v1/i18n/stats", h.GetStats)
}

func rj(w http.ResponseWriter, s int, d interface{}) { w.Header().Set("Content-Type","application/json"); w.WriteHeader(s); json.NewEncoder(w).Encode(d) }
func re(w http.ResponseWriter, s int, m string) { rj(w, s, map[string]string{"error": m}) }

func (h *Handler) GetLanguages(w http.ResponseWriter, r *http.Request) {
	rj(w, 200, map[string]interface{}{"languages": h.svc.GetLanguages()})
}

func (h *Handler) GetBundle(w http.ResponseWriter, r *http.Request) {
	lang := strings.TrimPrefix(r.URL.Path, "/api/v1/i18n/bundle/")
	bundle := h.svc.GetBundle(lang)
	if bundle == nil { re(w, 404, "language not found"); return }
	rj(w, 200, bundle)
}

func (h *Handler) Translate(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key"); lang := r.URL.Query().Get("lang")
	if key == "" || lang == "" { re(w, 400, "key and lang required"); return }
	text := h.svc.Translate(key, lang, nil)
	rj(w, 200, map[string]string{"key": key, "language": lang, "text": text})
}

func (h *Handler) SetTranslation(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { re(w, 405, "Method not allowed"); return }
	var t models.Translation
	json.NewDecoder(r.Body).Decode(&t)
	h.svc.SetTranslation(t)
	rj(w, 200, map[string]string{"status": "saved"})
}

func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) { rj(w, 200, h.svc.GetStats()) }
