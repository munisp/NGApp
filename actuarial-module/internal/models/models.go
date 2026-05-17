package models

import (
	"time"

	"github.com/google/uuid"
)

type MortalityTable struct {
	ID        uuid.UUID          `json:"id" gorm:"type:uuid;primaryKey"`
	Name      string             `json:"name" gorm:"uniqueIndex;not null"`
	Type      string             `json:"type" gorm:"not null"` // aggregate, select, ultimate
	BaseYear  int                `json:"base_year"`
	Country   string             `json:"country" gorm:"default:'NG'"`
	Gender    string             `json:"gender"` // male, female, unisex
	Rates     map[int]float64    `json:"rates" gorm:"serializer:json"`
	Source    string             `json:"source"`
	IsActive  bool               `json:"is_active" gorm:"default:true"`
	CreatedAt time.Time          `json:"created_at"`
	UpdatedAt time.Time          `json:"updated_at"`
}

type ProductPricingConfig struct {
	ID               uuid.UUID          `json:"id" gorm:"type:uuid;primaryKey"`
	ProductCode      string             `json:"product_code" gorm:"uniqueIndex;not null"`
	ProductName      string             `json:"product_name" gorm:"not null"`
	ProductType      string             `json:"product_type"` // term_life, whole_life, endowment, motor, fire, marine
	LineOfBusiness   string             `json:"line_of_business"`
	BaseRate         float64            `json:"base_rate"`
	ExpenseLoading   float64            `json:"expense_loading"`
	ProfitMargin     float64            `json:"profit_margin"`
	CommissionRate   float64            `json:"commission_rate"`
	DiscountRate     float64            `json:"discount_rate"`
	MinPremium       float64            `json:"min_premium"`
	MaxSumAssured    float64            `json:"max_sum_assured"`
	MortalityTableID *uuid.UUID         `json:"mortality_table_id" gorm:"type:uuid"`
	RatingFactors    map[string]float64 `json:"rating_factors" gorm:"serializer:json"`
	IsActive         bool               `json:"is_active" gorm:"default:true"`
	EffectiveFrom    time.Time          `json:"effective_from"`
	EffectiveTo      *time.Time         `json:"effective_to"`
	CreatedAt        time.Time          `json:"created_at"`
	UpdatedAt        time.Time          `json:"updated_at"`
}

type ReserveCalculation struct {
	ID               uuid.UUID          `json:"id" gorm:"type:uuid;primaryKey"`
	PolicyID         string             `json:"policy_id" gorm:"index;not null"`
	ProductType      string             `json:"product_type"`
	ValuationDate    time.Time          `json:"valuation_date" gorm:"index;not null"`
	GrossReserve     float64            `json:"gross_reserve"`
	NetReserve       float64            `json:"net_reserve"`
	UnearnedPremium  float64            `json:"unearned_premium"`
	IBNR             float64            `json:"ibnr"`
	ClaimsReserve    float64            `json:"claims_reserve"`
	Method           string             `json:"method"`
	Assumptions      map[string]float64 `json:"assumptions" gorm:"serializer:json"`
	Status           string             `json:"status" gorm:"default:'calculated'"`
	ApprovedBy       *uuid.UUID         `json:"approved_by" gorm:"type:uuid"`
	ApprovedAt       *time.Time         `json:"approved_at"`
	CreatedAt        time.Time          `json:"created_at"`
}

type PremiumCalculation struct {
	ID             uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	QuoteID        string    `json:"quote_id" gorm:"index"`
	ProductCode    string    `json:"product_code"`
	ProductType    string    `json:"product_type"`
	SumAssured     float64   `json:"sum_assured"`
	Term           int       `json:"term_years"`
	Age            int       `json:"age"`
	Gender         string    `json:"gender"`
	GrossPremium   float64   `json:"gross_premium"`
	NetPremium     float64   `json:"net_premium"`
	LoadingFactor  float64   `json:"loading_factor"`
	ExpenseLoading float64   `json:"expense_loading"`
	ProfitMargin   float64   `json:"profit_margin"`
	DiscountRate   float64   `json:"discount_rate"`
	MortalityTable string    `json:"mortality_table"`
	RiskClass      string    `json:"risk_class"`
	CreatedAt      time.Time `json:"created_at"`
}

type IBNRCalculation struct {
	ID                 uuid.UUID         `json:"id" gorm:"type:uuid;primaryKey"`
	ValuationDate      time.Time         `json:"valuation_date" gorm:"index;not null"`
	Method             string            `json:"method"` // chain_ladder, bornhuetter_ferguson, cape_cod
	LineOfBusiness     string            `json:"line_of_business" gorm:"index"`
	TotalIBNR          float64           `json:"total_ibnr"`
	ByAccidentYear     map[int]float64   `json:"by_accident_year" gorm:"serializer:json"`
	DevelopmentFactors []float64         `json:"development_factors" gorm:"serializer:json"`
	ConfidenceLow      float64           `json:"confidence_low"`
	ConfidenceHigh     float64           `json:"confidence_high"`
	Status             string            `json:"status" gorm:"default:'calculated'"`
	CreatedAt          time.Time         `json:"created_at"`
}

type RiskBasedCapital struct {
	ID               uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	ValuationDate    time.Time `json:"valuation_date" gorm:"index;not null"`
	InsuranceRisk    float64   `json:"insurance_risk"`
	AssetRisk        float64   `json:"asset_risk"`
	InterestRateRisk float64   `json:"interest_rate_risk"`
	OperationalRisk  float64   `json:"operational_risk"`
	CreditRisk       float64   `json:"credit_risk"`
	MarketRisk       float64   `json:"market_risk"`
	TotalRBC         float64   `json:"total_rbc"`
	AvailableCapital float64   `json:"available_capital"`
	RBCRatio         float64   `json:"rbc_ratio"`
	Status           string    `json:"status"` // adequate, company_action, regulatory_action, authorized_control
	CreatedAt        time.Time `json:"created_at"`
}

type SolvencyAnalysis struct {
	ID               uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	ValuationDate    time.Time `json:"valuation_date" gorm:"index;not null"`
	TotalAssets      float64   `json:"total_assets"`
	TotalLiabilities float64   `json:"total_liabilities"`
	NetAssets        float64   `json:"net_assets"`
	RequiredCapital  float64   `json:"required_capital"`
	SolvencyRatio    float64   `json:"solvency_ratio"`
	NAICOMMinimum    float64   `json:"naicom_minimum"`
	Compliant        bool      `json:"compliant"`
	CreatedAt        time.Time `json:"created_at"`
}

type LossRatioAnalysis struct {
	ID             uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	Period         string    `json:"period" gorm:"index"`
	ProductLine    string    `json:"product_line" gorm:"index"`
	EarnedPremium  float64   `json:"earned_premium"`
	IncurredClaims float64   `json:"incurred_claims"`
	Expenses       float64   `json:"expenses"`
	LossRatio      float64   `json:"loss_ratio"`
	ExpenseRatio   float64   `json:"expense_ratio"`
	CombinedRatio  float64   `json:"combined_ratio"`
	Trend          string    `json:"trend"`
	CreatedAt      time.Time `json:"created_at"`
}

type ExperienceStudy struct {
	ID            uuid.UUID          `json:"id" gorm:"type:uuid;primaryKey"`
	StudyName     string             `json:"study_name" gorm:"not null"`
	StudyType     string             `json:"study_type"` // mortality, morbidity, lapse, expense
	StartDate     time.Time          `json:"start_date"`
	EndDate       time.Time          `json:"end_date"`
	ProductLines  []string           `json:"product_lines" gorm:"serializer:json"`
	ExposureCount int64              `json:"exposure_count"`
	ClaimCount    int64              `json:"claim_count"`
	ActualRate    float64            `json:"actual_rate"`
	ExpectedRate  float64            `json:"expected_rate"`
	AERatio       float64            `json:"ae_ratio"` // Actual/Expected
	Results       map[string]float64 `json:"results" gorm:"serializer:json"`
	Status        string             `json:"status" gorm:"default:'draft'"`
	CreatedAt     time.Time          `json:"created_at"`
	UpdatedAt     time.Time          `json:"updated_at"`
}

type NAICOMReport struct {
	ID           uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	ReportType   string                 `json:"report_type" gorm:"not null"` // quarterly_returns, annual_accounts, solvency_margin
	Period       string                 `json:"period" gorm:"index;not null"`
	ReportData   map[string]interface{} `json:"report_data" gorm:"serializer:json"`
	Status       string                 `json:"status" gorm:"default:'draft'"` // draft, reviewed, submitted
	SubmittedAt  *time.Time             `json:"submitted_at"`
	SubmittedBy  *uuid.UUID             `json:"submitted_by" gorm:"type:uuid"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
}
