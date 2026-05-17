package models
import ("time"; "github.com/google/uuid")
type ThreatIndicator struct {
ID uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
Type string `gorm:"not null;index"`
Value string `gorm:"not null;index"`
Confidence int `gorm:"default:50"`
Severity string `gorm:"default:'medium'"`
Source string `gorm:"default:'opencti'"`
FirstSeen time.Time `gorm:"default:now()"`
LastSeen time.Time `gorm:"default:now()"`
IsActive bool `gorm:"default:true"`
Metadata map[string]interface{} `gorm:"type:jsonb"`
CreatedAt time.Time `gorm:"default:now()"`
UpdatedAt time.Time
}
type ThreatEvent struct {
ID uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
IndicatorID uuid.UUID `gorm:"type:uuid;not null;index"`
EventType string `gorm:"not null"`
SourceIP string
DestIP string
Description string `gorm:"type:text"`
Severity string
DetectedAt time.Time `gorm:"default:now()"`
WazuhAlertID string
Metadata map[string]interface{} `gorm:"type:jsonb"`
CreatedAt time.Time `gorm:"default:now()"`
}
