package service

import "time"

type CreateProfileRequest struct {
	CustomerRef  string     `json:"customer_ref"`
	FirstName    string     `json:"first_name"`
	LastName     string     `json:"last_name"`
	Email        string     `json:"email"`
	Phone        string     `json:"phone"`
	DateOfBirth  *time.Time `json:"date_of_birth"`
	Gender       string     `json:"gender"`
	Address      string     `json:"address"`
	City         string     `json:"city"`
	State        string     `json:"state"`
	LGA          string     `json:"lga"`
	BVN          string     `json:"bvn"`
	NIN          string     `json:"nin"`
	Occupation   string     `json:"occupation"`
	EmployerName string     `json:"employer_name"`
	AnnualIncome float64    `json:"annual_income"`
}

type AddPolicyRequest struct {
	CustomerRef  string    `json:"customer_ref"`
	PolicyNumber string    `json:"policy_number"`
	PolicyType   string    `json:"policy_type"`
	ProductName  string    `json:"product_name"`
	Status       string    `json:"status"`
	Premium      float64   `json:"premium"`
	SumAssured   float64   `json:"sum_assured"`
	InceptionDate time.Time `json:"inception_date"`
	ExpiryDate   time.Time `json:"expiry_date"`
	AgentCode    string    `json:"agent_code"`
}

type AddInteractionRequest struct {
	CustomerRef string                 `json:"customer_ref"`
	Channel     string                 `json:"channel"`
	Type        string                 `json:"type"`
	Subject     string                 `json:"subject"`
	Description string                 `json:"description"`
	AgentID     string                 `json:"agent_id"`
	Metadata    map[string]interface{} `json:"metadata"`
}
