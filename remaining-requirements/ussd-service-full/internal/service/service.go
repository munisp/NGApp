package service
import ("context"; "fmt"; "strings"; "time"; "ussd-service/internal/models"; "gorm.io/gorm"; "github.com/dapr/go-sdk/client")
type Service struct {
db *gorm.DB
dapr client.Client
}
func New(db *gorm.DB) *Service {
daprClient, _ := client.NewClient()
return &Service{db: db, dapr: daprClient}
}
func (s *Service) HandleUSSD(ctx context.Context, sessionID, phoneNumber, text string) (string, bool) {
var session models.USSDSession
if err := s.db.Where("session_id = ?", sessionID).First(&session).Error; err != nil {
session = models.USSDSession{SessionID: sessionID, PhoneNumber: phoneNumber, State: "menu", Context: make(map[string]interface{})}
s.db.Create(&session)
}
s.db.Create(&models.USSDTransaction{SessionID: sessionID, Request: text})
response, cont := s.processInput(text, &session)
session.LastActivity = time.Now()
s.db.Save(&session)
s.db.Create(&models.USSDTransaction{SessionID: sessionID, Response: response})
return response, cont
}
func (s *Service) processInput(text string, session *models.USSDSession) (string, bool) {
text = strings.TrimSpace(text)
switch session.State {
case "menu":
if text == "" { return "CON Welcome to Insurance\n1. My Policies\n2. File Claim\n3. Make Payment\n4. Check Claim Status", true }
switch text {
case "1": session.State = "policies"; return "CON Your Policies:\n1. Health Insurance\n2. Auto Insurance\n0. Back", true
case "2": session.State = "new_claim"; return "CON File New Claim\nEnter policy number:", true
case "3": session.State = "payment"; return "CON Make Payment\nEnter amount (NGN):", true
case "4": session.State = "claim_status"; return "CON Enter claim number:", true
default: return "END Invalid option", false
}
case "policies":
if text == "1*1" { return "END Policy: Health Insurance\nPremium: NGN 50,000\nStatus: Active\nExpiry: 2026-12-31", false }
if text == "1*2" { return "END Policy: Auto Insurance\nPremium: NGN 75,000\nStatus: Active\nExpiry: 2026-06-30", false }
session.State = "menu"; return "END Thank you", false
case "new_claim":
parts := strings.Split(text, "*")
if len(parts) == 2 {
policyNum := parts[1]
session.Context["policy_number"] = policyNum
session.State = "claim_description"
return "CON Describe incident:", true
}
return "END Invalid input", false
case "claim_description":
parts := strings.Split(text, "*")
if len(parts) == 3 {
description := parts[2]
s.dapr.PublishEvent(context.Background(), "pubsub", "claim.created", map[string]string{
"policy_number": session.Context["policy_number"].(string),
"description": description,
"channel": "ussd",
})
session.State = "menu"
return fmt.Sprintf("END Claim submitted!\nReference: CLM-%d", 12345), false
}
return "END Invalid input", false
case "payment":
parts := strings.Split(text, "*")
if len(parts) == 2 {
amount := parts[1]
return fmt.Sprintf("END Payment of NGN %s initiated.\nYou will receive confirmation SMS.", amount), false
}
return "END Invalid amount", false
case "claim_status":
parts := strings.Split(text, "*")
if len(parts) == 2 {
return "END Claim Status: Under Review\nLast Updated: 2026-01-28", false
}
return "END Invalid claim number", false
default:
session.State = "menu"
return "END Session expired", false
}
}
