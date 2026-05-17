package models

import "time"

type ContributionType string

const (
	Tabarru    ContributionType = "tabarru"
	Investment ContributionType = "investment"
	Wakala     ContributionType = "wakala_fee"
)

type TakafulFund struct {
	ID                string    `json:"id"`
	Name              string    `json:"name"`
	FundType          string    `json:"fund_type"`
	TotalContributions float64  `json:"total_contributions"`
	TabarruPool       float64   `json:"tabarru_pool"`
	InvestmentPool    float64   `json:"investment_pool"`
	ClaimsPaid        float64   `json:"claims_paid"`
	SurplusAmount     float64   `json:"surplus_amount"`
	WakalaFeeRate     float64   `json:"wakala_fee_rate"`
	MudharabaShare    float64   `json:"mudharaba_share"`
	ParticipantCount  int       `json:"participant_count"`
	IsActive          bool      `json:"is_active"`
	CreatedAt         time.Time `json:"created_at"`
}

type TakafulParticipant struct {
	ID              string    `json:"id"`
	FundID          string    `json:"fund_id"`
	CustomerID      string    `json:"customer_id"`
	Name            string    `json:"name"`
	ContributionAmt float64   `json:"contribution_amount"`
	TabarruPortion  float64   `json:"tabarru_portion"`
	InvestPortion   float64   `json:"investment_portion"`
	WakalaFee       float64   `json:"wakala_fee"`
	SurplusShare    float64   `json:"surplus_share"`
	CoverageAmount  float64   `json:"coverage_amount"`
	Status          string    `json:"status"`
	JoinedAt        time.Time `json:"joined_at"`
}

type TakafulContribution struct {
	ID              string           `json:"id"`
	ParticipantID   string           `json:"participant_id"`
	FundID          string           `json:"fund_id"`
	Amount          float64          `json:"amount"`
	Type            ContributionType `json:"type"`
	TabarruAmount   float64          `json:"tabarru_amount"`
	InvestAmount    float64          `json:"invest_amount"`
	WakalaAmount    float64          `json:"wakala_amount"`
	Period          string           `json:"period"`
	CreatedAt       time.Time        `json:"created_at"`
}

type SurplusDistribution struct {
	ID             string    `json:"id"`
	FundID         string    `json:"fund_id"`
	Period         string    `json:"period"`
	TotalSurplus   float64   `json:"total_surplus"`
	DistributedAmt float64   `json:"distributed_amount"`
	RetainedAmt    float64   `json:"retained_amount"`
	ParticipantCnt int       `json:"participant_count"`
	PerCapitaShare float64   `json:"per_capita_share"`
	DistributedAt  time.Time `json:"distributed_at"`
}

type ShariaCompliance struct {
	ID           string    `json:"id"`
	FundID       string    `json:"fund_id"`
	CheckType    string    `json:"check_type"`
	Status       string    `json:"status"`
	Details      string    `json:"details"`
	Auditor      string    `json:"auditor"`
	CheckedAt    time.Time `json:"checked_at"`
}
