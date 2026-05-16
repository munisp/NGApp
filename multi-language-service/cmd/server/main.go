package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8108"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/i18n/translate", handleTranslate)
	mux.HandleFunc("/api/v1/i18n/languages", handleLanguages)
	mux.HandleFunc("/api/v1/i18n/templates/", handleTemplates)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"multi-language-service"}`))
	})
	log.Printf("Multi-Language Service starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}

var translations = map[string]map[string]string{
	"welcome": {
		"en":  "Welcome to NGApp Insurance",
		"ha":  "Barka da zuwa NGApp Inshora",
		"yo":  "Ẹ kaabo si NGApp Iṣeduro",
		"ig":  "Nnọọ na NGApp Mkpuchi",
		"pcm": "Welcome to NGApp Insurance",
		"fr":  "Bienvenue chez NGApp Assurance",
		"ar":  "مرحبا بك في تأمين NGApp",
		"sw":  "Karibu NGApp Bima",
	},
	"buy_insurance": {
		"en": "Buy Insurance", "ha": "Sayi Inshora", "yo": "Ra Iṣeduro",
		"ig": "Zụta Mkpuchi", "pcm": "Buy Insurance", "fr": "Acheter Assurance",
		"ar": "شراء تأمين", "sw": "Nunua Bima",
	},
	"file_claim": {
		"en": "File a Claim", "ha": "Shigar da Ƙara", "yo": "Ṣe Ẹtọ",
		"ig": "Tinye Arịrịọ", "pcm": "Make Claim", "fr": "Déposer Réclamation",
		"ar": "تقديم مطالبة", "sw": "Wasilisha Madai",
	},
	"policy_active": {
		"en": "Your policy is active", "ha": "Siyasar ku tana aiki",
		"yo": "Eto rẹ n ṣiṣẹ", "ig": "Iwu gị na-arụ ọrụ",
		"pcm": "Your policy dey active", "fr": "Votre police est active",
		"ar": "وثيقتك نشطة", "sw": "Sera yako iko hai",
	},
	"claim_approved": {
		"en": "Your claim has been approved", "ha": "An amince da karar ku",
		"yo": "A ti fọwọsi ẹtọ rẹ", "ig": "A nabatara arịrịọ gị",
		"pcm": "Dem don approve your claim", "fr": "Votre réclamation a été approuvée",
		"ar": "تمت الموافقة على مطالبتك", "sw": "Madai yako yamekubaliwa",
	},
	"payment_due": {
		"en": "Your premium payment is due", "ha": "Lokacin biyan ku ya yi",
		"yo": "Owo isanwo rẹ ti to", "ig": "Oge ịkwụ ụgwọ gị eruola",
		"pcm": "Time don reach to pay", "fr": "Votre paiement est dû",
		"ar": "موعد دفع القسط", "sw": "Malipo yako yamefikia",
	},
}

func handleTranslate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Key      string `json:"key"`
		Language string `json:"language"`
		Text     string `json:"text,omitempty"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.Language == "" {
		req.Language = "en"
	}

	result := ""
	if trans, ok := translations[req.Key]; ok {
		if t, ok := trans[req.Language]; ok {
			result = t
		} else {
			result = trans["en"]
		}
	} else {
		result = req.Text
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"key":      req.Key,
		"language": req.Language,
		"text":     result,
	})
}

func handleLanguages(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"languages": []map[string]string{
			{"code": "en", "name": "English", "native": "English", "region": "Pan-African", "direction": "ltr"},
			{"code": "ha", "name": "Hausa", "native": "Hausa", "region": "Northern Nigeria, Niger", "direction": "ltr"},
			{"code": "yo", "name": "Yoruba", "native": "Yorùbá", "region": "Southwest Nigeria", "direction": "ltr"},
			{"code": "ig", "name": "Igbo", "native": "Igbo", "region": "Southeast Nigeria", "direction": "ltr"},
			{"code": "pcm", "name": "Nigerian Pidgin", "native": "Naija", "region": "Pan-Nigeria", "direction": "ltr"},
			{"code": "fr", "name": "French", "native": "Français", "region": "Francophone Africa", "direction": "ltr"},
			{"code": "ar", "name": "Arabic", "native": "العربية", "region": "North/Northern Nigeria", "direction": "rtl"},
			{"code": "sw", "name": "Swahili", "native": "Kiswahili", "region": "East Africa", "direction": "ltr"},
			{"code": "am", "name": "Amharic", "native": "አማርኛ", "region": "Ethiopia", "direction": "ltr"},
			{"code": "zu", "name": "Zulu", "native": "isiZulu", "region": "South Africa", "direction": "ltr"},
		},
	})
}

func handleTemplates(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	lang := "en"
	if len(parts) > 5 {
		lang = parts[5]
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"language": lang,
		"templates": map[string]interface{}{
			"sms_payment_reminder":    translations["payment_due"][lang],
			"sms_claim_approved":      translations["claim_approved"][lang],
			"sms_policy_active":       translations["policy_active"][lang],
			"whatsapp_welcome":        translations["welcome"][lang],
		},
	})
}
