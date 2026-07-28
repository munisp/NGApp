package models

import "time"

type TakafulProductType string

const (
	TakafulCropInsurance  TakafulProductType = "takaful_crop"
	TakafulLivestockIBLT  TakafulProductType = "takaful_livestock_iblt"
	TakafulMotorTP        TakafulProductType = "takaful_motor_tp"
	TakafulHospiCash      TakafulProductType = "takaful_hospi_cash"
	TakafulEducation      TakafulProductType = "takaful_education"
	TakafulHajjUmrah      TakafulProductType = "takaful_hajj_umrah"
)

type TakafulProduct struct {
	ID              string             `json:"id"`
	Name            string             `json:"name"`
	Type            TakafulProductType `json:"type"`
	Description     string             `json:"description"`
	ContributionNGN float64            `json:"contribution_ngn"`
	CoverageNGN     float64            `json:"coverage_ngn"`
	SurplusSharingPct float64          `json:"surplus_sharing_pct"`
	WakalaFeePct    float64            `json:"wakala_fee_pct"`
	PoolID          string             `json:"pool_id"`
	ShariaApproved  bool               `json:"sharia_approved"`
	IsActive        bool               `json:"is_active"`
}

type TakafulMembership struct {
	ID              string    `json:"id"`
	ProductID       string    `json:"product_id"`
	MemberName      string    `json:"member_name"`
	MemberID        string    `json:"member_id"`
	ContributionPaid float64  `json:"contribution_paid_ngn"`
	PoolID          string    `json:"pool_id"`
	Status          string    `json:"status"`
	JoinedAt        time.Time `json:"joined_at"`
}

type TakafulPool struct {
	ID                string  `json:"id"`
	Name              string  `json:"name"`
	ProductType       string  `json:"product_type"`
	TotalContributions float64 `json:"total_contributions_ngn"`
	TotalClaims       float64 `json:"total_claims_ngn"`
	Surplus           float64 `json:"surplus_ngn"`
	MemberCount       int     `json:"member_count"`
	WakalaFeeCollected float64 `json:"wakala_fee_collected_ngn"`
}

type SurplusDistribution struct {
	PoolID        string    `json:"pool_id"`
	TotalSurplus  float64   `json:"total_surplus_ngn"`
	MemberCount   int       `json:"member_count"`
	PerMemberShare float64  `json:"per_member_share_ngn"`
	DistributedAt time.Time `json:"distributed_at"`
}

type ShariaCompliance struct {
	ProductID     string   `json:"product_id"`
	IsCompliant   bool     `json:"is_compliant"`
	Principles    []string `json:"principles_met"`
	BoardApproval string   `json:"board_approval_status"`
	ReviewDate    string   `json:"review_date"`
}
