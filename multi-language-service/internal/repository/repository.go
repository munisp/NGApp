package repository

import (
	"fmt"
	"multi-language-service/internal/models"
	"sync"
	"time"
)

type I18nRepository struct {
	mu           sync.RWMutex
	languages    map[string]models.Language
	translations map[string]map[string]models.Translation
}

func NewI18nRepository() *I18nRepository {
	repo := &I18nRepository{
		languages:    make(map[string]models.Language),
		translations: make(map[string]map[string]models.Translation),
	}
	repo.seedLanguages()
	repo.seedTranslations()
	return repo
}

func (r *I18nRepository) seedLanguages() {
	langs := []models.Language{
		{Code: "en", Name: "English", NativeName: "English", Direction: "ltr", IsActive: true, Coverage: 100},
		{Code: "yo", Name: "Yoruba", NativeName: "Èdè Yorùbá", Direction: "ltr", IsActive: true, Coverage: 85},
		{Code: "ha", Name: "Hausa", NativeName: "Harshen Hausa", Direction: "ltr", IsActive: true, Coverage: 85},
		{Code: "ig", Name: "Igbo", NativeName: "Asụsụ Igbo", Direction: "ltr", IsActive: true, Coverage: 80},
		{Code: "pcm", Name: "Nigerian Pidgin", NativeName: "Naija", Direction: "ltr", IsActive: true, Coverage: 90},
		{Code: "fr", Name: "French", NativeName: "Français", Direction: "ltr", IsActive: true, Coverage: 70},
		{Code: "ar", Name: "Arabic", NativeName: "العربية", Direction: "rtl", IsActive: true, Coverage: 40},
		{Code: "sw", Name: "Swahili", NativeName: "Kiswahili", Direction: "ltr", IsActive: true, Coverage: 55},
		{Code: "am", Name: "Amharic", NativeName: "አማርኛ", Direction: "ltr", IsActive: true, Coverage: 30},
		{Code: "zu", Name: "Zulu", NativeName: "isiZulu", Direction: "ltr", IsActive: true, Coverage: 25},
	}
	for _, l := range langs {
		r.languages[l.Code] = l
	}
}

func (r *I18nRepository) seedTranslations() {
	keys := map[string]map[string]string{
		"app.title":          {"en": "NGInsure - Insurance for Everyone", "yo": "NGInsure - Iṣeduro fun Gbogbo Eniyan", "ha": "NGInsure - Inshora don Kowa", "ig": "NGInsure - Inshọransị maka Onye Ọ Bụla", "pcm": "NGInsure - Insurance for Everybody"},
		"nav.dashboard":      {"en": "Dashboard", "yo": "Dasibọọdu", "ha": "Dashboard", "ig": "Dashboard", "pcm": "Dashboard"},
		"nav.policies":       {"en": "My Policies", "yo": "Àwọn Ìṣedúró Mi", "ha": "Inshorar Ni", "ig": "Ọrụ Inshọransị M", "pcm": "My Policies"},
		"nav.claims":         {"en": "Claims", "yo": "Ẹ̀tọ́", "ha": "Da'awar", "ig": "Arịrịọ", "pcm": "Claims"},
		"nav.payments":       {"en": "Payments", "yo": "Àwọn Ìsanwó", "ha": "Biyan Kuɗi", "ig": "Ịkwụ Ụgwọ", "pcm": "Payments"},
		"action.pay_now":     {"en": "Pay Now", "yo": "San Báyìí", "ha": "Biya Yanzu", "ig": "Kwụọ Ụgwọ Ugbu a", "pcm": "Pay Now"},
		"action.file_claim":  {"en": "File a Claim", "yo": "Fi Ẹ̀tọ́ Sílẹ̀", "ha": "Gabatar Da Da'awa", "ig": "Tinye Arịrịọ", "pcm": "File Claim"},
		"action.renew":       {"en": "Renew Policy", "yo": "Ṣe Àtúnṣe Ìṣedúró", "ha": "Sabunta Inshora", "ig": "Megharịa Ọrụ", "pcm": "Renew Policy"},
		"status.active":      {"en": "Active", "yo": "Ṣiṣẹ́", "ha": "Mai Aiki", "ig": "Na-arụ Ọrụ", "pcm": "Active"},
		"status.expired":     {"en": "Expired", "yo": "Ti Parẹ́", "ha": "Ya Ƙare", "ig": "Agwụla", "pcm": "Don Expire"},
		"msg.welcome":        {"en": "Welcome back, {{name}}!", "yo": "Ẹ kú àbọ̀, {{name}}!", "ha": "Barka da dawowa, {{name}}!", "ig": "Nnọọ, {{name}}!", "pcm": "Welcome back, {{name}}!"},
		"msg.premium_due":    {"en": "Your premium of {{amount}} is due on {{date}}", "yo": "Owó ìṣedúró rẹ ti {{amount}} gbọdọ̀ san ní {{date}}", "ha": "Kudin inshorar ka na {{amount}} ya kamata a biya a {{date}}", "ig": "Ụgwọ premium gị nke {{amount}} kwesịrị ịkwụ na {{date}}", "pcm": "Your premium of {{amount}} suppose pay on {{date}}"},
	}
	for key, translations := range keys {
		for lang, value := range translations {
			if r.translations[lang] == nil {
				r.translations[lang] = make(map[string]models.Translation)
			}
			r.translations[lang][key] = models.Translation{
				ID: fmt.Sprintf("T-%s-%s", lang, key), Key: key, Language: lang, Value: value, Verified: true,
			}
		}
	}
}

func (r *I18nRepository) GetLanguages() []models.Language {
	var result []models.Language
	for _, l := range r.languages {
		if l.IsActive { result = append(result, l) }
	}
	return result
}

func (r *I18nRepository) GetBundle(lang string) *models.TranslationBundle {
	r.mu.RLock()
	defer r.mu.RUnlock()
	translations, ok := r.translations[lang]
	if !ok { return nil }
	bundle := &models.TranslationBundle{
		Language: lang, Translations: make(map[string]string), UpdatedAt: time.Now(),
	}
	for k, v := range translations {
		bundle.Translations[k] = v.Value
	}
	return bundle
}

func (r *I18nRepository) Translate(key, lang string) string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if translations, ok := r.translations[lang]; ok {
		if t, ok := translations[key]; ok { return t.Value }
	}
	if translations, ok := r.translations["en"]; ok {
		if t, ok := translations[key]; ok { return t.Value }
	}
	return key
}

func (r *I18nRepository) SetTranslation(t models.Translation) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.translations[t.Language] == nil {
		r.translations[t.Language] = make(map[string]models.Translation)
	}
	r.translations[t.Language][t.Key] = t
}

func (r *I18nRepository) GetStats() map[string]interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()
	byLang := map[string]int{}
	total := 0
	for lang, translations := range r.translations {
		byLang[lang] = len(translations)
		total += len(translations)
	}
	return map[string]interface{}{
		"languages": len(r.languages), "total_translations": total, "by_language": byLang,
	}
}
