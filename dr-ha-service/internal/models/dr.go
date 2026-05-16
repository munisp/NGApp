package models

import "time"

type ServiceNode struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Region    string    `json:"region"`
	Type      string    `json:"type"`
	Status    string    `json:"status"`
	Health    float64   `json:"health_pct"`
	CPU       float64   `json:"cpu_pct"`
	Memory    float64   `json:"memory_pct"`
	Uptime    string    `json:"uptime"`
	LastCheck time.Time `json:"last_check"`
}

type FailoverEvent struct {
	ID           string    `json:"id"`
	SourceNode   string    `json:"source_node"`
	TargetNode   string    `json:"target_node"`
	Reason       string    `json:"reason"`
	Status       string    `json:"status"`
	Duration     string    `json:"duration"`
	DataLoss     bool      `json:"data_loss"`
	RPOAchieved  string    `json:"rpo_achieved"`
	RTOAchieved  string    `json:"rto_achieved"`
	InitiatedAt  time.Time `json:"initiated_at"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
}

type BackupRecord struct {
	ID          string    `json:"id"`
	NodeID      string    `json:"node_id"`
	Type        string    `json:"type"`
	SizeMB      int       `json:"size_mb"`
	Status      string    `json:"status"`
	Encrypted   bool      `json:"encrypted"`
	Checksum    string    `json:"checksum"`
	Location    string    `json:"location"`
	RetainUntil time.Time `json:"retain_until"`
	CreatedAt   time.Time `json:"created_at"`
}

type DRPlan struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	RPOTarget    string   `json:"rpo_target"`
	RTOTarget    string   `json:"rto_target"`
	Strategy     string   `json:"strategy"`
	Nodes        []string `json:"nodes"`
	LastTested   *time.Time `json:"last_tested,omitempty"`
	Status       string   `json:"status"`
}
