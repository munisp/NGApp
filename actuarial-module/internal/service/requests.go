package service

import "time"

type LifePremiumRequest struct {
	QuoteID         string  `json:"quote_id"`
	ProductCode     string  `json:"product_code"`
	ProductType     string  `json:"product_type"` // term_life, whole_life, endowment
	SumAssured      float64 `json:"sum_assured"`
	TermYears       int     `json:"term_years"`
	Age             int     `json:"age"`
	Gender          string  `json:"gender"`
	IsSmoker        bool    `json:"is_smoker"`
	OccupationClass string  `json:"occupation_class"` // 1, 2, 3, 4
	DiscountRate    float64 `json:"discount_rate"`
}

type MotorPremiumRequest struct {
	QuoteID      string  `json:"quote_id"`
	VehicleValue float64 `json:"vehicle_value"`
	VehicleType  string  `json:"vehicle_type"`
	VehicleAge   int     `json:"vehicle_age"`
	Region       string  `json:"region"`
	DriverAge    int     `json:"driver_age"`
	NCDYears     int     `json:"ncd_years"` // no claims discount years
	CoverType    string  `json:"cover_type"` // comprehensive, third_party_fire_theft, third_party_only
}

type ReserveRequest struct {
	PolicyID           string    `json:"policy_id"`
	ProductType        string    `json:"product_type"`
	AnnualPremium      float64   `json:"annual_premium"`
	PolicyStartDate    time.Time `json:"policy_start_date"`
	PolicyEndDate      time.Time `json:"policy_end_date"`
	OutstandingClaims  float64   `json:"outstanding_claims"`
	ReinsuranceCession float64   `json:"reinsurance_cession"`
}

type IBNRRequest struct {
	Method         string      `json:"method"` // chain_ladder, bornhuetter_ferguson
	LineOfBusiness string      `json:"line_of_business"`
	StartYear      int         `json:"start_year"`
	ClaimsTriangle [][]float64 `json:"claims_triangle"`
}

type RBCRequest struct {
	TotalInvestments       float64 `json:"total_investments"`
	FixedIncomeAssets      float64 `json:"fixed_income_assets"`
	EquityAssets           float64 `json:"equity_assets"`
	RealEstateAssets       float64 `json:"real_estate_assets"`
	OtherAssets            float64 `json:"other_assets"`
	NetPremiumWritten      float64 `json:"net_premium_written"`
	NetClaimsReserves      float64 `json:"net_claims_reserves"`
	ReinsuranceReceivables float64 `json:"reinsurance_receivables"`
	PremiumReceivables     float64 `json:"premium_receivables"`
	AvailableCapital       float64 `json:"available_capital"`
	IsLifeInsurer          bool    `json:"is_life_insurer"`
}

type SolvencyRequest struct {
	TotalAssets        float64 `json:"total_assets"`
	TotalLiabilities   float64 `json:"total_liabilities"`
	NetPremiumWritten  float64 `json:"net_premium_written"`
	NetIncurredClaims  float64 `json:"net_incurred_claims"`
	IsLifeInsurer      bool    `json:"is_life_insurer"`
}

type LossRatioRequest struct {
	Period         string  `json:"period"`
	ProductLine    string  `json:"product_line"`
	EarnedPremium  float64 `json:"earned_premium"`
	IncurredClaims float64 `json:"incurred_claims"`
	Expenses       float64 `json:"expenses"`
}

type ExperienceStudyRequest struct {
	StudyName     string    `json:"study_name"`
	StudyType     string    `json:"study_type"` // mortality, morbidity, lapse, expense
	StartDate     time.Time `json:"start_date"`
	EndDate       time.Time `json:"end_date"`
	ProductLines  []string  `json:"product_lines"`
	ExposureCount int64     `json:"exposure_count"`
	ClaimCount    int64     `json:"claim_count"`
	ExpectedRate  float64   `json:"expected_rate"`
}

type NAICOMReportRequest struct {
	ReportType         string  `json:"report_type"` // quarterly_returns, annual_accounts, solvency_margin
	Period             string  `json:"period"`
	CompanyName        string  `json:"company_name"`
	RegistrationNumber string  `json:"registration_number"`
	GrossPremiumWritten float64 `json:"gross_premium_written"`
	NetPremiumWritten  float64 `json:"net_premium_written"`
	ClaimsPaid         float64 `json:"claims_paid"`
	OutstandingClaims  float64 `json:"outstanding_claims"`
	ManagementExpenses float64 `json:"management_expenses"`
	TotalAssets        float64 `json:"total_assets"`
	TotalLiabilities   float64 `json:"total_liabilities"`
	InvestmentIncome   float64 `json:"investment_income"`
}
