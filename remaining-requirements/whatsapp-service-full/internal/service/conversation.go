package service

import "time"

type ConversationState struct {
	Phone       string
	CurrentFlow string
	Step        int
	Data        map[string]string
	LastMessage time.Time
}

type Flow struct {
	Name  string
	Steps []FlowStep
}

type FlowStep struct {
	Prompt     string
	DataKey    string
	Validation func(string) bool
}

var InsuranceFlows = map[string]*Flow{
	"get_quote": {Name: "Get Quote", Steps: []FlowStep{
		{Prompt: "What type of insurance? (health/auto/property/life)", DataKey: "type", Validation: func(s string) bool { return s == "health" || s == "auto" || s == "property" || s == "life" }},
		{Prompt: "What is your age?", DataKey: "age"},
		{Prompt: "What coverage amount do you need? (in Naira)", DataKey: "amount"},
	}},
	"file_claim": {Name: "File Claim", Steps: []FlowStep{
		{Prompt: "What is your policy number?", DataKey: "policy_number"},
		{Prompt: "Describe the incident briefly:", DataKey: "description"},
		{Prompt: "What is the estimated claim amount? (in Naira)", DataKey: "amount"},
	}},
	"check_status": {Name: "Check Status", Steps: []FlowStep{
		{Prompt: "Enter your claim reference number:", DataKey: "claim_ref"},
	}},
	"pay_premium": {Name: "Pay Premium", Steps: []FlowStep{
		{Prompt: "Enter your policy number:", DataKey: "policy_number"},
		{Prompt: "Select payment method:\n1. Mobile Money\n2. Bank Transfer\n3. Card", DataKey: "method"},
	}},
}

func GetMainMenu() string {
	return "Welcome to NGInsure WhatsApp! \xF0\x9F\x8F\xA5\n\nHow can I help you today?\n\n1\xEF\xB8\x8F\xE2\x83\xA3 Get Insurance Quote\n2\xEF\xB8\x8F\xE2\x83\xA3 File a Claim\n3\xEF\xB8\x8F\xE2\x83\xA3 Check Claim Status\n4\xEF\xB8\x8F\xE2\x83\xA3 Pay Premium\n5\xEF\xB8\x8F\xE2\x83\xA3 Talk to Agent\n\nReply with a number to get started."
}

func RouteInput(input string) (string, bool) {
	switch input {
	case "1": return "get_quote", true
	case "2": return "file_claim", true
	case "3": return "check_status", true
	case "4": return "pay_premium", true
	case "5": return "", false
	default: return "", false
	}
}
