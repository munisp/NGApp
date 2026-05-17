package service

import "time"

type CreateInitiativeRequest struct {
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Category    string     `json:"category"`
	Priority    string     `json:"priority"`
	OwnerID     string     `json:"owner_id"`
	OwnerName   string     `json:"owner_name"`
	StartDate   *time.Time `json:"start_date"`
	TargetDate  *time.Time `json:"target_date"`
	Budget      float64    `json:"budget"`
}

type AddMilestoneRequest struct {
	InitiativeRef string    `json:"initiative_ref"`
	Title         string    `json:"title"`
	Description   string    `json:"description"`
	DueDate       time.Time `json:"due_date"`
}

type CreateKPIRequest struct {
	InitiativeRef string  `json:"initiative_ref"`
	Name          string  `json:"name"`
	Description   string  `json:"description"`
	TargetValue   float64 `json:"target_value"`
	Unit          string  `json:"unit"`
	Frequency     string  `json:"frequency"`
}

type AddRiskRequest struct {
	InitiativeRef string `json:"initiative_ref"`
	Title         string `json:"title"`
	Description   string `json:"description"`
	Probability   string `json:"probability"`
	Impact        string `json:"impact"`
	Mitigation    string `json:"mitigation"`
	Owner         string `json:"owner"`
}
