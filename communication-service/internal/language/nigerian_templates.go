package language

import (
	"context"

	"github.com/insurance-platform/communication-service/internal/models"
	"github.com/insurance-platform/communication-service/internal/templates"
)

// NigerianTemplates contains all message templates in Nigerian languages
var NigerianTemplates = []models.Template{
	// ============================================
	// POLICY CREATED TEMPLATES
	// ============================================
	
	// English
	{
		ID:          "policy-created-en-sms",
		Name:        "policy_created",
		Channel:     models.ChannelSMS,
		Language:    "en",
		Content:     "Dear {{customer_name}}, your {{policy_type}} policy ({{policy_number}}) has been created successfully. Premium: ₦{{premium_amount}}. Thank you for choosing us!",
		Variables:   []string{"customer_name", "policy_type", "policy_number", "premium_amount"},
		Category:    "policy",
		Description: "Policy creation notification - English",
	},
	
	// Yoruba
	{
		ID:          "policy-created-yo-sms",
		Name:        "policy_created",
		Channel:     models.ChannelSMS,
		Language:    "yo",
		Content:     "Ọwọ́n {{customer_name}}, a ti ṣẹda iwe-adehun {{policy_type}} rẹ ({{policy_number}}) ni aṣeyọri. Owo sisanwo: ₦{{premium_amount}}. A dupe fun yiyan wa!",
		Variables:   []string{"customer_name", "policy_type", "policy_number", "premium_amount"},
		Category:    "policy",
		Description: "Policy creation notification - Yoruba",
	},
	
	// Igbo
	{
		ID:          "policy-created-ig-sms",
		Name:        "policy_created",
		Channel:     models.ChannelSMS,
		Language:    "ig",
		Content:     "Ezigbo {{customer_name}}, e mepụtala akwụkwọ nkwenye {{policy_type}} gị ({{policy_number}}) nke ọma. Ego ịkwụ ụgwọ: ₦{{premium_amount}}. Daalụ maka ịhọrọ anyị!",
		Variables:   []string{"customer_name", "policy_type", "policy_number", "premium_amount"},
		Category:    "policy",
		Description: "Policy creation notification - Igbo",
	},
	
	// Hausa
	{
		ID:          "policy-created-ha-sms",
		Name:        "policy_created",
		Channel:     models.ChannelSMS,
		Language:    "ha",
		Content:     "Mai girma {{customer_name}}, an ƙirƙiri takardarka ta {{policy_type}} ({{policy_number}}) cikin nasara. Kuɗin biya: ₦{{premium_amount}}. Mun gode da zaɓar mu!",
		Variables:   []string{"customer_name", "policy_type", "policy_number", "premium_amount"},
		Category:    "policy",
		Description: "Policy creation notification - Hausa",
	},
	
	// Nigerian Pidgin
	{
		ID:          "policy-created-pcm-sms",
		Name:        "policy_created",
		Channel:     models.ChannelSMS,
		Language:    "pcm",
		Content:     "Dear {{customer_name}}, we don create your {{policy_type}} policy ({{policy_number}}) successfully. Money to pay: ₦{{premium_amount}}. Thank you for choosing us!",
		Variables:   []string{"customer_name", "policy_type", "policy_number", "premium_amount"},
		Category:    "policy",
		Description: "Policy creation notification - Nigerian Pidgin",
	},

	// ============================================
	// CLAIM APPROVED TEMPLATES
	// ============================================
	
	// English
	{
		ID:          "claim-approved-en-whatsapp",
		Name:        "claim_approved",
		Channel:     models.ChannelWhatsApp,
		Language:    "en",
		Content:     "🎉 Great news, {{customer_name}}! Your claim ({{claim_number}}) has been approved. Amount: ₦{{claim_amount}}. Payment will be processed within 3-5 business days.",
		Variables:   []string{"customer_name", "claim_number", "claim_amount"},
		Category:    "claim",
		Description: "Claim approval notification - English",
	},
	
	// Yoruba
	{
		ID:          "claim-approved-yo-whatsapp",
		Name:        "claim_approved",
		Channel:     models.ChannelWhatsApp,
		Language:    "yo",
		Content:     "🎉 Iroyin ayọ, {{customer_name}}! A ti gba ibeere rẹ ({{claim_number}}) laaye. Iye owo: ₦{{claim_amount}}. A o san owo laarin ọjọ 3-5 iṣowo.",
		Variables:   []string{"customer_name", "claim_number", "claim_amount"},
		Category:    "claim",
		Description: "Claim approval notification - Yoruba",
	},
	
	// Igbo
	{
		ID:          "claim-approved-ig-whatsapp",
		Name:        "claim_approved",
		Channel:     models.ChannelWhatsApp,
		Language:    "ig",
		Content:     "🎉 Ozi ọma, {{customer_name}}! Anabatala mkpesa gị ({{claim_number}}). Ego: ₦{{claim_amount}}. A ga-akwụ ụgwọ n'ime ụbọchị ọrụ 3-5.",
		Variables:   []string{"customer_name", "claim_number", "claim_amount"},
		Category:    "claim",
		Description: "Claim approval notification - Igbo",
	},
	
	// Hausa
	{
		ID:          "claim-approved-ha-whatsapp",
		Name:        "claim_approved",
		Channel:     models.ChannelWhatsApp,
		Language:    "ha",
		Content:     "🎉 Labari mai daɗi, {{customer_name}}! An amince da buƙatarka ({{claim_number}}). Adadin: ₦{{claim_amount}}. Za a biya kuɗi a cikin kwanaki 3-5 na kasuwanci.",
		Variables:   []string{"customer_name", "claim_number", "claim_amount"},
		Category:    "claim",
		Description: "Claim approval notification - Hausa",
	},
	
	// Nigerian Pidgin
	{
		ID:          "claim-approved-pcm-whatsapp",
		Name:        "claim_approved",
		Channel:     models.ChannelWhatsApp,
		Language:    "pcm",
		Content:     "🎉 Good news, {{customer_name}}! We don approve your claim ({{claim_number}}). Money: ₦{{claim_amount}}. We go pay you within 3-5 business days.",
		Variables:   []string{"customer_name", "claim_number", "claim_amount"},
		Category:    "claim",
		Description: "Claim approval notification - Nigerian Pidgin",
	},

	// ============================================
	// PAYMENT REMINDER TEMPLATES
	// ============================================
	
	// English
	{
		ID:          "payment-reminder-en-sms",
		Name:        "payment_reminder",
		Channel:     models.ChannelSMS,
		Language:    "en",
		Content:     "Reminder: Your premium payment of ₦{{premium_amount}} for policy {{policy_number}} is due on {{due_date}}. Please pay to avoid lapse.",
		Variables:   []string{"premium_amount", "policy_number", "due_date"},
		Category:    "payment",
		Description: "Payment reminder - English",
	},
	
	// Yoruba
	{
		ID:          "payment-reminder-yo-sms",
		Name:        "payment_reminder",
		Channel:     models.ChannelSMS,
		Language:    "yo",
		Content:     "Iranti: Sisanwo owo rẹ ti ₦{{premium_amount}} fun iwe-adehun {{policy_number}} yoo to ni {{due_date}}. Jọwọ sanwo lati yago fun idaduro.",
		Variables:   []string{"premium_amount", "policy_number", "due_date"},
		Category:    "payment",
		Description: "Payment reminder - Yoruba",
	},
	
	// Igbo
	{
		ID:          "payment-reminder-ig-sms",
		Name:        "payment_reminder",
		Channel:     models.ChannelSMS,
		Language:    "ig",
		Content:     "Ncheta: Ịkwụ ụgwọ gị nke ₦{{premium_amount}} maka akwụkwọ nkwenye {{policy_number}} ga-erube na {{due_date}}. Biko kwụọ ụgwọ iji zere nkwụsị.",
		Variables:   []string{"premium_amount", "policy_number", "due_date"},
		Category:    "payment",
		Description: "Payment reminder - Igbo",
	},
	
	// Hausa
	{
		ID:          "payment-reminder-ha-sms",
		Name:        "payment_reminder",
		Channel:     models.ChannelSMS,
		Language:    "ha",
		Content:     "Tunatarwa: Biyan kuɗin ku na ₦{{premium_amount}} don takarda {{policy_number}} zai zo a {{due_date}}. Don Allah ku biya don guje wa dakatar da.",
		Variables:   []string{"premium_amount", "policy_number", "due_date"},
		Category:    "payment",
		Description: "Payment reminder - Hausa",
	},
	
	// Nigerian Pidgin
	{
		ID:          "payment-reminder-pcm-sms",
		Name:        "payment_reminder",
		Channel:     models.ChannelSMS,
		Language:    "pcm",
		Content:     "Reminder: Your payment of ₦{{premium_amount}} for policy {{policy_number}} go reach on {{due_date}}. Abeg pay make e no expire.",
		Variables:   []string{"premium_amount", "policy_number", "due_date"},
		Category:    "payment",
		Description: "Payment reminder - Nigerian Pidgin",
	},

	// ============================================
	// CLAIM REJECTED TEMPLATES
	// ============================================
	
	// English
	{
		ID:          "claim-rejected-en-whatsapp",
		Name:        "claim_rejected",
		Channel:     models.ChannelWhatsApp,
		Language:    "en",
		Content:     "Dear {{customer_name}}, we regret to inform you that your claim ({{claim_number}}) has been rejected. Reason: {{rejection_reason}}. For more information, please contact us.",
		Variables:   []string{"customer_name", "claim_number", "rejection_reason"},
		Category:    "claim",
		Description: "Claim rejection notification - English",
	},
	
	// Yoruba
	{
		ID:          "claim-rejected-yo-whatsapp",
		Name:        "claim_rejected",
		Channel:     models.ChannelWhatsApp,
		Language:    "yo",
		Content:     "Ọwọ́n {{customer_name}}, a banuje lati sọ fun ọ pe a ti kọ ibeere rẹ ({{claim_number}}). Idi: {{rejection_reason}}. Fun alaye diẹ sii, jọwọ kan si wa.",
		Variables:   []string{"customer_name", "claim_number", "rejection_reason"},
		Category:    "claim",
		Description: "Claim rejection notification - Yoruba",
	},
	
	// Igbo
	{
		ID:          "claim-rejected-ig-whatsapp",
		Name:        "claim_rejected",
		Channel:     models.ChannelWhatsApp,
		Language:    "ig",
		Content:     "Ezigbo {{customer_name}}, ọ dị anyị nwute ịgwa gị na ajụla mkpesa gị ({{claim_number}}). Ihe kpatara ya: {{rejection_reason}}. Maka ozi ndị ọzọ, biko kpọtụrụ anyị.",
		Variables:   []string{"customer_name", "claim_number", "rejection_reason"},
		Category:    "claim",
		Description: "Claim rejection notification - Igbo",
	},
	
	// Hausa
	{
		ID:          "claim-rejected-ha-whatsapp",
		Name:        "claim_rejected",
		Channel:     models.ChannelWhatsApp,
		Language:    "ha",
		Content:     "Mai girma {{customer_name}}, muna nadama sanar da ku cewa an ƙi buƙatarku ({{claim_number}}). Dalili: {{rejection_reason}}. Don ƙarin bayani, don Allah tuntuɓe mu.",
		Variables:   []string{"customer_name", "claim_number", "rejection_reason"},
		Category:    "claim",
		Description: "Claim rejection notification - Hausa",
	},
	
	// Nigerian Pidgin
	{
		ID:          "claim-rejected-pcm-whatsapp",
		Name:        "claim_rejected",
		Channel:     models.ChannelWhatsApp,
		Language:    "pcm",
		Content:     "Dear {{customer_name}}, we sorry to tell you say we don reject your claim ({{claim_number}}). Reason: {{rejection_reason}}. If you want know more, abeg contact us.",
		Variables:   []string{"customer_name", "claim_number", "rejection_reason"},
		Category:    "claim",
		Description: "Claim rejection notification - Nigerian Pidgin",
	},

	// ============================================
	// POLICY RENEWAL TEMPLATES
	// ============================================
	
	// English
	{
		ID:          "policy-renewal-en-whatsapp",
		Name:        "policy_renewal",
		Channel:     models.ChannelWhatsApp,
		Language:    "en",
		Content:     "Hello {{customer_name}}! Your policy {{policy_number}} expires on {{expiry_date}}. Renew now to continue your coverage. Premium: ₦{{renewal_amount}}.",
		Variables:   []string{"customer_name", "policy_number", "expiry_date", "renewal_amount"},
		Category:    "policy",
		Description: "Policy renewal reminder - English",
	},
	
	// Yoruba
	{
		ID:          "policy-renewal-yo-whatsapp",
		Name:        "policy_renewal",
		Channel:     models.ChannelWhatsApp,
		Language:    "yo",
		Content:     "Bawo {{customer_name}}! Iwe-adehun rẹ {{policy_number}} yoo pari ni {{expiry_date}}. Tun bẹrẹ bayi lati tẹsiwaju aabo rẹ. Owo sisanwo: ₦{{renewal_amount}}.",
		Variables:   []string{"customer_name", "policy_number", "expiry_date", "renewal_amount"},
		Category:    "policy",
		Description: "Policy renewal reminder - Yoruba",
	},
	
	// Igbo
	{
		ID:          "policy-renewal-ig-whatsapp",
		Name:        "policy_renewal",
		Channel:     models.ChannelWhatsApp,
		Language:    "ig",
		Content:     "Ndewo {{customer_name}}! Akwụkwọ nkwenye gị {{policy_number}} ga-agwụ na {{expiry_date}}. Mee ka ọ dị ọhụrụ ugbu a iji gaa n'ihu na nchekwa gị. Ego: ₦{{renewal_amount}}.",
		Variables:   []string{"customer_name", "policy_number", "expiry_date", "renewal_amount"},
		Category:    "policy",
		Description: "Policy renewal reminder - Igbo",
	},
	
	// Hausa
	{
		ID:          "policy-renewal-ha-whatsapp",
		Name:        "policy_renewal",
		Channel:     models.ChannelWhatsApp,
		Language:    "ha",
		Content:     "Sannu {{customer_name}}! Takardarka {{policy_number}} za ta ƙare a {{expiry_date}}. Sabunta yanzu don ci gaba da kariyarku. Kuɗin biya: ₦{{renewal_amount}}.",
		Variables:   []string{"customer_name", "policy_number", "expiry_date", "renewal_amount"},
		Category:    "policy",
		Description: "Policy renewal reminder - Hausa",
	},
	
	// Nigerian Pidgin
	{
		ID:          "policy-renewal-pcm-whatsapp",
		Name:        "policy_renewal",
		Channel:     models.ChannelWhatsApp,
		Language:    "pcm",
		Content:     "Hello {{customer_name}}! Your policy {{policy_number}} go expire on {{expiry_date}}. Renew am now make you continue get coverage. Money: ₦{{renewal_amount}}.",
		Variables:   []string{"customer_name", "policy_number", "expiry_date", "renewal_amount"},
		Category:    "policy",
		Description: "Policy renewal reminder - Nigerian Pidgin",
	},
}

// InitializeNigerianLanguageTemplates creates all Nigerian language templates
func InitializeNigerianLanguageTemplates(ctx context.Context, templateManager *templates.Manager) error {
	for _, template := range NigerianTemplates {
		// Check if template already exists
		existing, _ := templateManager.GetTemplate(ctx, template.ID)
		if existing != nil {
			continue
		}

		if err := templateManager.CreateTemplate(ctx, &template); err != nil {
			return err
		}
	}

	return nil
}
