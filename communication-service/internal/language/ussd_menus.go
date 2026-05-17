package language

import "github.com/insurance-platform/communication-service/internal/models"

// USSDMenus contains USSD menus in all Nigerian languages
var USSDMenus = map[string]map[models.Language]*models.USSDMenu{
	// ============================================
	// MAIN MENU
	// ============================================
	"main": {
		models.LanguageEnglish: {
			ID:        "main",
			Title:     "Welcome to Insurance Platform",
			InputType: models.USSDInputTypeMenu,
			Options: []models.USSDOption{
				{Key: "1", Label: "Check Balance", NextMenu: "check_balance", Action: "check_balance"},
				{Key: "2", Label: "Policy Information", NextMenu: "policy_info_input"},
				{Key: "3", Label: "Make Payment", NextMenu: "payment_input"},
				{Key: "4", Label: "File a Claim", NextMenu: "claim_input"},
				{Key: "5", Label: "Contact Support", Action: "contact_support"},
				{Key: "6", Label: "Change Language", NextMenu: "language_select"},
			},
		},
		models.LanguageYoruba: {
			ID:        "main",
			Title:     "Kaabo si Insurance Platform",
			InputType: models.USSDInputTypeMenu,
			Options: []models.USSDOption{
				{Key: "1", Label: "Ṣayẹwo Iwọntunwọnsi", NextMenu: "check_balance", Action: "check_balance"},
				{Key: "2", Label: "Alaye Iwe-adehun", NextMenu: "policy_info_input"},
				{Key: "3", Label: "Sanwo", NextMenu: "payment_input"},
				{Key: "4", Label: "Fi Ibeere Silẹ", NextMenu: "claim_input"},
				{Key: "5", Label: "Pe Atilẹyin", Action: "contact_support"},
				{Key: "6", Label: "Yi Ede Pada", NextMenu: "language_select"},
			},
		},
		models.LanguageIgbo: {
			ID:        "main",
			Title:     "Nnọọ na Insurance Platform",
			InputType: models.USSDInputTypeMenu,
			Options: []models.USSDOption{
				{Key: "1", Label: "Lelee Ego", NextMenu: "check_balance", Action: "check_balance"},
				{Key: "2", Label: "Ozi Akwụkwọ Nkwenye", NextMenu: "policy_info_input"},
				{Key: "3", Label: "Kwụọ Ụgwọ", NextMenu: "payment_input"},
				{Key: "4", Label: "Tinye Mkpesa", NextMenu: "claim_input"},
				{Key: "5", Label: "Kpọtụrụ Nkwado", Action: "contact_support"},
				{Key: "6", Label: "Gbanwee Asụsụ", NextMenu: "language_select"},
			},
		},
		models.LanguageHausa: {
			ID:        "main",
			Title:     "Barka da zuwa Insurance Platform",
			InputType: models.USSDInputTypeMenu,
			Options: []models.USSDOption{
				{Key: "1", Label: "Duba Ma'auni", NextMenu: "check_balance", Action: "check_balance"},
				{Key: "2", Label: "Bayanan Takarda", NextMenu: "policy_info_input"},
				{Key: "3", Label: "Yi Biya", NextMenu: "payment_input"},
				{Key: "4", Label: "Shigar da Buƙata", NextMenu: "claim_input"},
				{Key: "5", Label: "Tuntuɓi Tallafi", Action: "contact_support"},
				{Key: "6", Label: "Canza Harshe", NextMenu: "language_select"},
			},
		},
		models.LanguagePidgin: {
			ID:        "main",
			Title:     "Welcome to Insurance Platform",
			InputType: models.USSDInputTypeMenu,
			Options: []models.USSDOption{
				{Key: "1", Label: "Check Balance", NextMenu: "check_balance", Action: "check_balance"},
				{Key: "2", Label: "Policy Info", NextMenu: "policy_info_input"},
				{Key: "3", Label: "Pay Money", NextMenu: "payment_input"},
				{Key: "4", Label: "File Claim", NextMenu: "claim_input"},
				{Key: "5", Label: "Call Support", Action: "contact_support"},
				{Key: "6", Label: "Change Language", NextMenu: "language_select"},
			},
		},
	},

	// ============================================
	// LANGUAGE SELECTION MENU
	// ============================================
	"language_select": {
		models.LanguageEnglish: {
			ID:        "language_select",
			Title:     "Select your preferred language:",
			InputType: models.USSDInputTypeMenu,
			Options: []models.USSDOption{
				{Key: "1", Label: "English", Action: "set_language_en"},
				{Key: "2", Label: "Yoruba (Yorùbá)", Action: "set_language_yo"},
				{Key: "3", Label: "Igbo", Action: "set_language_ig"},
				{Key: "4", Label: "Hausa", Action: "set_language_ha"},
				{Key: "5", Label: "Pidgin (Naija)", Action: "set_language_pcm"},
			},
		},
		// Same for all languages as it shows all options
		models.LanguageYoruba: {
			ID:        "language_select",
			Title:     "Yan ede ti o fẹ:",
			InputType: models.USSDInputTypeMenu,
			Options: []models.USSDOption{
				{Key: "1", Label: "English", Action: "set_language_en"},
				{Key: "2", Label: "Yoruba (Yorùbá)", Action: "set_language_yo"},
				{Key: "3", Label: "Igbo", Action: "set_language_ig"},
				{Key: "4", Label: "Hausa", Action: "set_language_ha"},
				{Key: "5", Label: "Pidgin (Naija)", Action: "set_language_pcm"},
			},
		},
		models.LanguageIgbo: {
			ID:        "language_select",
			Title:     "Họrọ asụsụ ị chọrọ:",
			InputType: models.USSDInputTypeMenu,
			Options: []models.USSDOption{
				{Key: "1", Label: "English", Action: "set_language_en"},
				{Key: "2", Label: "Yoruba (Yorùbá)", Action: "set_language_yo"},
				{Key: "3", Label: "Igbo", Action: "set_language_ig"},
				{Key: "4", Label: "Hausa", Action: "set_language_ha"},
				{Key: "5", Label: "Pidgin (Naija)", Action: "set_language_pcm"},
			},
		},
		models.LanguageHausa: {
			ID:        "language_select",
			Title:     "Zaɓi harshen da kuke so:",
			InputType: models.USSDInputTypeMenu,
			Options: []models.USSDOption{
				{Key: "1", Label: "English", Action: "set_language_en"},
				{Key: "2", Label: "Yoruba (Yorùbá)", Action: "set_language_yo"},
				{Key: "3", Label: "Igbo", Action: "set_language_ig"},
				{Key: "4", Label: "Hausa", Action: "set_language_ha"},
				{Key: "5", Label: "Pidgin (Naija)", Action: "set_language_pcm"},
			},
		},
		models.LanguagePidgin: {
			ID:        "language_select",
			Title:     "Choose di language wey you want:",
			InputType: models.USSDInputTypeMenu,
			Options: []models.USSDOption{
				{Key: "1", Label: "English", Action: "set_language_en"},
				{Key: "2", Label: "Yoruba (Yorùbá)", Action: "set_language_yo"},
				{Key: "3", Label: "Igbo", Action: "set_language_ig"},
				{Key: "4", Label: "Hausa", Action: "set_language_ha"},
				{Key: "5", Label: "Pidgin (Naija)", Action: "set_language_pcm"},
			},
		},
	},

	// ============================================
	// POLICY INFO INPUT
	// ============================================
	"policy_info_input": {
		models.LanguageEnglish: {
			ID:         "policy_info_input",
			Title:      "Enter your policy number:",
			InputType:  models.USSDInputTypeText,
			NextMenu:   "get_policy_info",
			Action:     "get_policy_info",
			Validation: "required",
			ErrorMsg:   "Policy number is required",
		},
		models.LanguageYoruba: {
			ID:         "policy_info_input",
			Title:      "Tẹ nọmba iwe-adehun rẹ sii:",
			InputType:  models.USSDInputTypeText,
			NextMenu:   "get_policy_info",
			Action:     "get_policy_info",
			Validation: "required",
			ErrorMsg:   "Nọmba iwe-adehun jẹ dandan",
		},
		models.LanguageIgbo: {
			ID:         "policy_info_input",
			Title:      "Tinye nọmba akwụkwọ nkwenye gị:",
			InputType:  models.USSDInputTypeText,
			NextMenu:   "get_policy_info",
			Action:     "get_policy_info",
			Validation: "required",
			ErrorMsg:   "Nọmba akwụkwọ nkwenye dị mkpa",
		},
		models.LanguageHausa: {
			ID:         "policy_info_input",
			Title:      "Shigar da lambar takardarka:",
			InputType:  models.USSDInputTypeText,
			NextMenu:   "get_policy_info",
			Action:     "get_policy_info",
			Validation: "required",
			ErrorMsg:   "Ana buƙatar lambar takarda",
		},
		models.LanguagePidgin: {
			ID:         "policy_info_input",
			Title:      "Enter your policy number:",
			InputType:  models.USSDInputTypeText,
			NextMenu:   "get_policy_info",
			Action:     "get_policy_info",
			Validation: "required",
			ErrorMsg:   "Policy number dey important",
		},
	},

	// ============================================
	// PAYMENT INPUT
	// ============================================
	"payment_input": {
		models.LanguageEnglish: {
			ID:         "payment_input",
			Title:      "Enter policy number to pay premium:",
			InputType:  models.USSDInputTypeText,
			NextMenu:   "make_payment",
			Action:     "make_payment",
			Validation: "required",
			ErrorMsg:   "Policy number is required",
		},
		models.LanguageYoruba: {
			ID:         "payment_input",
			Title:      "Tẹ nọmba iwe-adehun lati sanwo:",
			InputType:  models.USSDInputTypeText,
			NextMenu:   "make_payment",
			Action:     "make_payment",
			Validation: "required",
			ErrorMsg:   "Nọmba iwe-adehun jẹ dandan",
		},
		models.LanguageIgbo: {
			ID:         "payment_input",
			Title:      "Tinye nọmba akwụkwọ nkwenye iji kwụọ ụgwọ:",
			InputType:  models.USSDInputTypeText,
			NextMenu:   "make_payment",
			Action:     "make_payment",
			Validation: "required",
			ErrorMsg:   "Nọmba akwụkwọ nkwenye dị mkpa",
		},
		models.LanguageHausa: {
			ID:         "payment_input",
			Title:      "Shigar da lambar takarda don biya:",
			InputType:  models.USSDInputTypeText,
			NextMenu:   "make_payment",
			Action:     "make_payment",
			Validation: "required",
			ErrorMsg:   "Ana buƙatar lambar takarda",
		},
		models.LanguagePidgin: {
			ID:         "payment_input",
			Title:      "Enter policy number to pay:",
			InputType:  models.USSDInputTypeText,
			NextMenu:   "make_payment",
			Action:     "make_payment",
			Validation: "required",
			ErrorMsg:   "Policy number dey important",
		},
	},

	// ============================================
	// CLAIM INPUT
	// ============================================
	"claim_input": {
		models.LanguageEnglish: {
			ID:        "claim_input",
			Title:     "Enter policy number for claim:",
			InputType: models.USSDInputTypeText,
			NextMenu:  "claim_type_select",
		},
		models.LanguageYoruba: {
			ID:        "claim_input",
			Title:     "Tẹ nọmba iwe-adehun fun ibeere:",
			InputType: models.USSDInputTypeText,
			NextMenu:  "claim_type_select",
		},
		models.LanguageIgbo: {
			ID:        "claim_input",
			Title:     "Tinye nọmba akwụkwọ nkwenye maka mkpesa:",
			InputType: models.USSDInputTypeText,
			NextMenu:  "claim_type_select",
		},
		models.LanguageHausa: {
			ID:        "claim_input",
			Title:     "Shigar da lambar takarda don buƙata:",
			InputType: models.USSDInputTypeText,
			NextMenu:  "claim_type_select",
		},
		models.LanguagePidgin: {
			ID:        "claim_input",
			Title:     "Enter policy number for claim:",
			InputType: models.USSDInputTypeText,
			NextMenu:  "claim_type_select",
		},
	},

	// ============================================
	// CLAIM TYPE SELECTION
	// ============================================
	"claim_type_select": {
		models.LanguageEnglish: {
			ID:        "claim_type_select",
			Title:     "Select claim type:",
			InputType: models.USSDInputTypeMenu,
			Options: []models.USSDOption{
				{Key: "1", Label: "Health", Action: "file_claim"},
				{Key: "2", Label: "Motor", Action: "file_claim"},
				{Key: "3", Label: "Life", Action: "file_claim"},
				{Key: "4", Label: "Property", Action: "file_claim"},
			},
		},
		models.LanguageYoruba: {
			ID:        "claim_type_select",
			Title:     "Yan iru ibeere:",
			InputType: models.USSDInputTypeMenu,
			Options: []models.USSDOption{
				{Key: "1", Label: "Ilera", Action: "file_claim"},
				{Key: "2", Label: "Ọkọ", Action: "file_claim"},
				{Key: "3", Label: "Aye", Action: "file_claim"},
				{Key: "4", Label: "Ohun-ini", Action: "file_claim"},
			},
		},
		models.LanguageIgbo: {
			ID:        "claim_type_select",
			Title:     "Họrọ ụdị mkpesa:",
			InputType: models.USSDInputTypeMenu,
			Options: []models.USSDOption{
				{Key: "1", Label: "Ahụ Ike", Action: "file_claim"},
				{Key: "2", Label: "Ụgbọ Ala", Action: "file_claim"},
				{Key: "3", Label: "Ndụ", Action: "file_claim"},
				{Key: "4", Label: "Akụ", Action: "file_claim"},
			},
		},
		models.LanguageHausa: {
			ID:        "claim_type_select",
			Title:     "Zaɓi nau'in buƙata:",
			InputType: models.USSDInputTypeMenu,
			Options: []models.USSDOption{
				{Key: "1", Label: "Lafiya", Action: "file_claim"},
				{Key: "2", Label: "Mota", Action: "file_claim"},
				{Key: "3", Label: "Rayuwa", Action: "file_claim"},
				{Key: "4", Label: "Dukiya", Action: "file_claim"},
			},
		},
		models.LanguagePidgin: {
			ID:        "claim_type_select",
			Title:     "Choose claim type:",
			InputType: models.USSDInputTypeMenu,
			Options: []models.USSDOption{
				{Key: "1", Label: "Health", Action: "file_claim"},
				{Key: "2", Label: "Motor", Action: "file_claim"},
				{Key: "3", Label: "Life", Action: "file_claim"},
				{Key: "4", Label: "Property", Action: "file_claim"},
			},
		},
	},
}

// GetUSSDMenu returns the appropriate menu based on menu ID and language
func GetUSSDMenu(menuID string, language models.Language) *models.USSDMenu {
	if menus, exists := USSDMenus[menuID]; exists {
		if menu, exists := menus[language]; exists {
			return menu
		}
		// Fallback to English if language not found
		if menu, exists := menus[models.LanguageEnglish]; exists {
			return menu
		}
	}
	return nil
}

// GetUSSDResponseMessages returns localized response messages
func GetUSSDResponseMessages(language models.Language) map[string]string {
	messages := map[models.Language]map[string]string{
		models.LanguageEnglish: {
			"contact_support":      "Contact Us:\n\nPhone: 0800-INSURANCE\nEmail: support@insurance.ng\nWebsite: www.insurance.ng\n\nBusiness Hours: Mon-Fri 8AM-5PM",
			"language_changed":     "Language changed successfully!",
			"invalid_input":        "Invalid input. Please try again.",
			"service_unavailable":  "Service temporarily unavailable. Please try again later.",
			"claim_filed_success":  "Claim filed successfully!\n\nClaim ID: %s\nPolicy: %s\nType: %s\n\nOur team will contact you within 24 hours.",
			"payment_instructions": "To pay premium for policy %s:\n\n1. Dial *123*456*%s#\n2. Or visit our website\n3. Or visit any of our branches\n\nThank you!",
		},
		models.LanguageYoruba: {
			"contact_support":      "Pe Wa:\n\nFoonu: 0800-INSURANCE\nImeeli: support@insurance.ng\nWebsaiti: www.insurance.ng\n\nAkoko Iṣowo: Ọjọ Aje-Ọjọ Jimọ 8AM-5PM",
			"language_changed":     "A ti yi ede pada ni aṣeyọri!",
			"invalid_input":        "Titẹ sii ti ko tọ. Jọwọ gbiyanju lẹẹkansi.",
			"service_unavailable":  "Iṣẹ ko wa fun igba diẹ. Jọwọ gbiyanju lẹẹkansi.",
			"claim_filed_success":  "A ti fi ibeere silẹ ni aṣeyọri!\n\nID Ibeere: %s\nIwe-adehun: %s\nIru: %s\n\nEgbẹ wa yoo pe ọ laarin wakati 24.",
			"payment_instructions": "Lati sanwo fun iwe-adehun %s:\n\n1. Pe *123*456*%s#\n2. Tabi ṣabẹwo si websaiti wa\n3. Tabi ṣabẹwo si ọkan ninu awọn ẹka wa\n\nO ṣeun!",
		},
		models.LanguageIgbo: {
			"contact_support":      "Kpọtụrụ Anyị:\n\nEkwentị: 0800-INSURANCE\nEmail: support@insurance.ng\nWebsaiti: www.insurance.ng\n\nOge Ọrụ: Mọnde-Fraịde 8AM-5PM",
			"language_changed":     "Agbanwela asụsụ nke ọma!",
			"invalid_input":        "Ntinye adịghị mma. Biko nwalee ọzọ.",
			"service_unavailable":  "Ọrụ adịghị ugbu a. Biko nwalee ọzọ.",
			"claim_filed_success":  "E tinyela mkpesa nke ọma!\n\nID Mkpesa: %s\nAkwụkwọ Nkwenye: %s\nỤdị: %s\n\nNdị otu anyị ga-akpọtụrụ gị n'ime awa 24.",
			"payment_instructions": "Iji kwụọ ụgwọ maka akwụkwọ nkwenye %s:\n\n1. Kpọọ *123*456*%s#\n2. Ma ọ bụ gaa na websaiti anyị\n3. Ma ọ bụ gaa n'alaka anyị ọ bụla\n\nDaalụ!",
		},
		models.LanguageHausa: {
			"contact_support":      "Tuntuɓe Mu:\n\nWaya: 0800-INSURANCE\nImel: support@insurance.ng\nGidan yanar gizo: www.insurance.ng\n\nLokacin Kasuwanci: Litinin-Juma'a 8AM-5PM",
			"language_changed":     "An canza harshe cikin nasara!",
			"invalid_input":        "Shigarwar ba daidai ba. Don Allah sake gwadawa.",
			"service_unavailable":  "Sabis ba ya samuwa a yanzu. Don Allah sake gwadawa.",
			"claim_filed_success":  "An shigar da buƙata cikin nasara!\n\nID Buƙata: %s\nTakarda: %s\nNau'i: %s\n\nƘungiyarmu za ta tuntuɓe ku cikin sa'o'i 24.",
			"payment_instructions": "Don biyan kuɗi don takarda %s:\n\n1. Kira *123*456*%s#\n2. Ko ziyarci gidan yanar gizon mu\n3. Ko ziyarci kowane reshe namu\n\nMun gode!",
		},
		models.LanguagePidgin: {
			"contact_support":      "Contact Us:\n\nPhone: 0800-INSURANCE\nEmail: support@insurance.ng\nWebsite: www.insurance.ng\n\nBusiness Hours: Monday-Friday 8AM-5PM",
			"language_changed":     "Language don change successfully!",
			"invalid_input":        "Wetin you enter no correct. Abeg try again.",
			"service_unavailable":  "Service no dey available now. Abeg try again later.",
			"claim_filed_success":  "We don file your claim successfully!\n\nClaim ID: %s\nPolicy: %s\nType: %s\n\nOur team go contact you within 24 hours.",
			"payment_instructions": "To pay for policy %s:\n\n1. Dial *123*456*%s#\n2. Or go our website\n3. Or go any of our branches\n\nThank you!",
		},
	}

	if msgs, exists := messages[language]; exists {
		return msgs
	}
	return messages[models.LanguageEnglish]
}
