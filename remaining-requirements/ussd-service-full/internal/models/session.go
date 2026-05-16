package models
import ("time"; "github.com/google/uuid")
type USSDSession struct {
ID uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
SessionID string `gorm:"uniqueIndex;not null"`
PhoneNumber string `gorm:"not null;index"`
State string `gorm:"default:'menu'"`
Context map[string]interface{} `gorm:"type:jsonb"`
LastActivity time.Time `gorm:"default:now()"`
CreatedAt time.Time `gorm:"default:now()"`
UpdatedAt time.Time
}
type USSDTransaction struct {
ID uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
SessionID string `gorm:"not null;index"`
Request string `gorm:"type:text"`
Response string `gorm:"type:text"`
CreatedAt time.Time `gorm:"default:now()"`
}
