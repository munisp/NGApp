package service

import "fmt"

type MessageTemplate struct {
	Name    string
	Body    string
	Params  []string
}

var Templates = map[string]*MessageTemplate{
	"welcome": {Name: "welcome", Body: "Welcome to NGInsure, %s! Your account has been set up. Reply MENU anytime to see options."},
	"quote_ready": {Name: "quote_ready", Body: "Your %s insurance quote is ready!\n\nCoverage: NGN %s\nMonthly Premium: NGN %s\nAnnual Premium: NGN %s\n\nReply YES to proceed or NO to cancel."},
	"claim_filed": {Name: "claim_filed", Body: "Your claim has been filed successfully!\n\nReference: %s\nPolicy: %s\nAmount: NGN %s\n\nYou will receive updates on this number."},
	"claim_status": {Name: "claim_status", Body: "Claim %s Status: %s\n\nLast Updated: %s\nExpected Resolution: %s"},
	"payment_reminder": {Name: "payment_reminder", Body: "Hi %s, your premium payment of NGN %s for policy %s is due on %s. Reply PAY to make payment now."},
	"payment_confirmed": {Name: "payment_confirmed", Body: "Payment Confirmed!\n\nAmount: NGN %s\nPolicy: %s\nRef: %s\nDate: %s\n\nThank you!"},
	"renewal_notice": {Name: "renewal_notice", Body: "Your policy %s expires on %s.\n\nRenewal Premium: NGN %s\nReply RENEW to auto-renew or CALL to speak with an agent."},
}

func RenderTemplate(name string, params ...interface{}) string {
	tmpl, ok := Templates[name]
	if !ok { return "Message template not found." }
	return fmt.Sprintf(tmpl.Body, params...)
}
