package service
import ("context"; "opencti-integration/internal/models"; "opencti-integration/internal/opencti"; "opencti-integration/internal/wazuh"; "gorm.io/gorm"; "time")
type Service struct {
db *gorm.DB
opencti *opencti.Client
wazuh *wazuh.Client
}
func New(db *gorm.DB, openctiClient *opencti.Client, wazuhClient *wazuh.Client) *Service {
return &Service{db: db, opencti: openctiClient, wazuh: wazuhClient}
}
func (s *Service) SyncIndicators(ctx context.Context) error {
indicators, err := s.opencti.GetIndicators(ctx)
if err != nil { return err }
for _, ind := range indicators {
ti := &models.ThreatIndicator{
Type: ind["pattern_type"].(string),
Value: ind["pattern"].(string),
Confidence: int(ind["confidence"].(float64)),
Source: "opencti",
FirstSeen: time.Now(),
LastSeen: time.Now(),
}
s.db.Create(ti)
}
return nil
}
func (s *Service) ProcessWazuhAlerts(ctx context.Context) error {
alerts, err := s.wazuh.GetAlerts(ctx)
if err != nil { return err }
for _, alert := range alerts {
var indicator models.ThreatIndicator
if err := s.db.Where("value = ?", alert["data"]).First(&indicator).Error; err == nil {
event := &models.ThreatEvent{
IndicatorID: indicator.ID,
EventType: "detection",
SourceIP: alert["src_ip"].(string),
Description: alert["rule"].(map[string]interface{})["description"].(string),
Severity: "high",
DetectedAt: time.Now(),
}
s.db.Create(event)
}
}
return nil
}
func (s *Service) GetActiveThreats(ctx context.Context) ([]models.ThreatIndicator, error) {
var threats []models.ThreatIndicator
err := s.db.Where("is_active = ?", true).Order("last_seen DESC").Limit(100).Find(&threats).Error
return threats, err
}
