package models
import ("time"; "github.com/google/uuid"; "gorm.io/gorm")
type Message struct {
ID uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
From string `gorm:"not null;index" json:"from"`
To string `gorm:"not null" json:"to"`
Body string `gorm:"type:text" json:"body"`
MessageSID string `gorm:"uniqueIndex" json:"message_sid"`
Status string `gorm:"default:'sent'" json:"status"`
Direction string `json:"direction"`
MediaURL string `json:"media_url,omitempty"`
CreatedAt time.Time `gorm:"default:now()" json:"created_at"`
UpdatedAt time.Time `json:"updated_at"`
DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
type Session struct {
ID uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
PhoneNumber string `gorm:"uniqueIndex;not null"`
State string `gorm:"default:'idle'"`
Context map[string]interface{} `gorm:"type:jsonb"`
LastActivity time.Time `gorm:"default:now()"`
CreatedAt time.Time `gorm:"default:now()"`
UpdatedAt time.Time
}
