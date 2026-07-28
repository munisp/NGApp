package service
import ("context"; "fmt"; "strings"; "whatsapp-service/internal/models"; "whatsapp-service/internal/whatsapp"; "gorm.io/gorm"; "github.com/dapr/go-sdk/client")
type Service struct {
db *gorm.DB
wa *whatsapp.Client
dapr client.Client
}
func New(db *gorm.DB, wa *whatsapp.Client) *Service {
daprClient, _ := client.NewClient()
return &Service{db: db, wa: wa, dapr: daprClient}
}
func (s *Service) HandleIncoming(ctx context.Context, from, body, mediaSID string) error {
msg := &models.Message{From: from, To: "service", Body: body, MessageSID: mediaSID, Direction: "inbound", Status: "received"}
if err := s.db.Create(msg).Error; err != nil { return err }
var session models.Session
if err := s.db.Where("phone_number = ?", from).First(&session).Error; err != nil {
session = models.Session{PhoneNumber: from, State: "idle", Context: make(map[string]interface{})}
s.db.Create(&session)
}
response := s.processMessage(body, &session)
s.db.Save(&session)
return s.wa.SendMessage(ctx, from, response)
}
func (s *Service) processMessage(body string, session *models.Session) string {
body = strings.ToLower(strings.TrimSpace(body))
switch session.State {
case "idle":
if strings.Contains(body, "policy") { session.State = "policy_menu"; return "Policy Menu:\n1. View policies\n2. Make payment\n3. File claim" }
if strings.Contains(body, "claim") { session.State = "claim_menu"; return "Claim Menu:\n1. New claim\n2. Check status" }
return "Welcome! Reply:\n- POLICY for policy services\n- CLAIM for claims\n- HELP for assistance"
case "policy_menu":
if body == "1" { s.dapr.InvokeMethod(context.Background(), "policy-service", "policies", "get"); return "Your policies:\n1. Health Insurance\n2. Auto Insurance" }
if body == "2" { session.State = "payment"; return "Enter amount to pay:" }
session.State = "idle"; return "Invalid option. Reply POLICY to try again."
case "claim_menu":
if body == "1" { session.State = "new_claim"; return "Describe your claim:" }
if body == "2" { return "Your claim status: Under Review" }
session.State = "idle"; return "Invalid option."
case "new_claim":
s.dapr.PublishEvent(context.Background(), "pubsub", "claim.created", map[string]string{"description": body, "channel": "whatsapp"})
session.State = "idle"; return "Claim submitted! Reference: CLM-" + fmt.Sprintf("%d", 12345)
default:
session.State = "idle"; return "Session expired. Reply HELP to start."
}
}
func (s *Service) SendNotification(ctx context.Context, to, message string) error {
return s.wa.SendMessage(ctx, to, message)
}
