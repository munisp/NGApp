package enhancements

import (
	"math"
	"sort"
	"sync"
	"time"
)

// VolumePattern represents a known seasonal pattern
type VolumePattern string

const (
	PatternSalaryDay     VolumePattern = "salary_day"
	PatternMonthEnd      VolumePattern = "month_end"
	PatternHoliday       VolumePattern = "holiday"
	PatternRamadan       VolumePattern = "ramadan"
	PatternChristmas     VolumePattern = "christmas"
	PatternSchoolFees    VolumePattern = "school_fees"
	PatternWeekend       VolumePattern = "weekend"
	PatternPublicHoliday VolumePattern = "public_holiday"
)

// CapacityForecast represents a volume/liquidity prediction
type CapacityForecast struct {
	Date              time.Time         `json:"date"`
	Corridor          string            `json:"corridor"`
	PredictedVolume   float64           `json:"predictedVolumeNgn"`
	PredictedTxnCount int               `json:"predictedTxnCount"`
	ConfidenceLow     float64           `json:"confidenceLow"`
	ConfidenceHigh    float64           `json:"confidenceHigh"`
	Patterns          []VolumePattern   `json:"patterns"`
	LiquidityNeeded   float64           `json:"liquidityNeededNgn"`
	CurrentLiquidity  float64           `json:"currentLiquidityNgn"`
	LiquidityGap      float64           `json:"liquidityGapNgn"`
	RiskLevel         string            `json:"riskLevel"` // low, medium, high, critical
}

// HistoricalDataPoint stores daily volume for trend analysis
type HistoricalDataPoint struct {
	Date     time.Time
	Corridor string
	Volume   float64
	TxnCount int
}

// SeasonalCalendar defines known seasonal events in Nigeria
type SeasonalCalendar struct {
	SalaryDays   []int  // Day-of-month when salary payments peak (25-28)
	SchoolTerms  []time.Month
	Holidays     []Holiday
}

// Holiday represents a known holiday affecting volume
type Holiday struct {
	Name      string
	Month     time.Month
	Day       int
	Duration  int // days
	Impact    float64 // multiplier: 1.5 = 50% increase, 0.5 = 50% decrease
	Corridors []string // affected corridors (empty = all)
}

// CapacityPlanningService provides volume forecasting and liquidity planning
type CapacityPlanningService struct {
	mu         sync.RWMutex
	historical []HistoricalDataPoint
	calendar   SeasonalCalendar
	forecasts  []CapacityForecast
}

// NewCapacityPlanningService creates a capacity planner with Nigerian calendar
func NewCapacityPlanningService() *CapacityPlanningService {
	return &CapacityPlanningService{
		historical: make([]HistoricalDataPoint, 0),
		calendar: SeasonalCalendar{
			SalaryDays: []int{25, 26, 27, 28},
			SchoolTerms: []time.Month{
				time.January, time.May, time.September,
			},
			Holidays: []Holiday{
				{Name: "New Year", Month: time.January, Day: 1, Duration: 2, Impact: 0.3, Corridors: nil},
				{Name: "Easter", Month: time.April, Day: 18, Duration: 4, Impact: 1.4, Corridors: []string{"NG-GB", "NG-US"}},
				{Name: "Eid al-Fitr", Month: time.April, Day: 10, Duration: 3, Impact: 1.8, Corridors: []string{"NG-SN", "NG-AE", "NG-TR"}},
				{Name: "Workers Day", Month: time.May, Day: 1, Duration: 1, Impact: 0.5, Corridors: nil},
				{Name: "Democracy Day", Month: time.June, Day: 12, Duration: 1, Impact: 0.6, Corridors: nil},
				{Name: "Eid al-Adha", Month: time.June, Day: 17, Duration: 3, Impact: 1.6, Corridors: []string{"NG-SN", "NG-AE", "NG-TR"}},
				{Name: "Independence Day", Month: time.October, Day: 1, Duration: 2, Impact: 0.4, Corridors: nil},
				{Name: "Christmas", Month: time.December, Day: 25, Duration: 5, Impact: 2.0, Corridors: nil},
				{Name: "School Fees", Month: time.January, Day: 5, Duration: 10, Impact: 1.5, Corridors: []string{"NG-GB", "NG-US", "NG-CA"}},
				{Name: "School Fees", Month: time.September, Day: 1, Duration: 10, Impact: 1.5, Corridors: []string{"NG-GB", "NG-US", "NG-CA"}},
			},
		},
		forecasts: make([]CapacityForecast, 0),
	}
}

// IngestHistorical adds historical volume data for trend calculation
func (cp *CapacityPlanningService) IngestHistorical(data []HistoricalDataPoint) {
	cp.mu.Lock()
	defer cp.mu.Unlock()
	cp.historical = append(cp.historical, data...)
}

// GenerateForecast produces a 30-day volume forecast per corridor
func (cp *CapacityPlanningService) GenerateForecast(corridors []string, currentLiquidity map[string]float64) []CapacityForecast {
	cp.mu.Lock()
	defer cp.mu.Unlock()

	var forecasts []CapacityForecast
	now := time.Now()

	for _, corridor := range corridors {
		// Get baseline from historical average
		baseline := cp.getBaselineVolume(corridor)

		for day := 0; day < 30; day++ {
			forecastDate := now.AddDate(0, 0, day)

			// Apply seasonal multipliers
			multiplier := cp.getSeasonalMultiplier(forecastDate, corridor)

			// Apply day-of-week pattern
			dowMultiplier := cp.getDayOfWeekMultiplier(forecastDate.Weekday())

			predicted := baseline * multiplier * dowMultiplier
			predictedTxns := int(predicted / 5_000_000) // avg ₦5M per txn

			// Confidence interval (±20% for near-term, wider for further out)
			confidenceWidth := 0.20 + float64(day)*0.01
			low := predicted * (1 - confidenceWidth)
			high := predicted * (1 + confidenceWidth)

			// Liquidity analysis
			current := currentLiquidity[corridor]
			needed := predicted * 1.2 // 20% buffer
			gap := math.Max(0, needed-current)

			risk := "low"
			if gap > needed*0.5 {
				risk = "critical"
			} else if gap > needed*0.3 {
				risk = "high"
			} else if gap > 0 {
				risk = "medium"
			}

			patterns := cp.identifyPatterns(forecastDate, corridor)

			forecast := CapacityForecast{
				Date:              forecastDate,
				Corridor:          corridor,
				PredictedVolume:   predicted,
				PredictedTxnCount: predictedTxns,
				ConfidenceLow:     low,
				ConfidenceHigh:    high,
				Patterns:          patterns,
				LiquidityNeeded:   needed,
				CurrentLiquidity:  current,
				LiquidityGap:      gap,
				RiskLevel:         risk,
			}
			forecasts = append(forecasts, forecast)
		}
	}

	cp.forecasts = forecasts
	return forecasts
}

// GetLiquidityAlerts returns corridors where liquidity is projected insufficient
func (cp *CapacityPlanningService) GetLiquidityAlerts(daysAhead int) []CapacityForecast {
	cp.mu.RLock()
	defer cp.mu.RUnlock()

	cutoff := time.Now().AddDate(0, 0, daysAhead)
	var alerts []CapacityForecast

	for _, f := range cp.forecasts {
		if f.Date.Before(cutoff) && f.LiquidityGap > 0 {
			alerts = append(alerts, f)
		}
	}

	sort.Slice(alerts, func(i, j int) bool {
		return alerts[i].LiquidityGap > alerts[j].LiquidityGap
	})

	return alerts
}

func (cp *CapacityPlanningService) getBaselineVolume(corridor string) float64 {
	// Calculate from historical data using 30-day moving average
	now := time.Now()
	thirtyDaysAgo := now.AddDate(0, 0, -30)

	var total float64
	var count int
	for _, dp := range cp.historical {
		if dp.Corridor == corridor && dp.Date.After(thirtyDaysAgo) {
			total += dp.Volume
			count++
		}
	}

	if count == 0 {
		// Default baselines per corridor category
		defaults := map[string]float64{
			"NG-GH": 500_000_000,
			"NG-GB": 800_000_000,
			"NG-US": 1_000_000_000,
			"NG-IN": 400_000_000,
			"NG-CN": 300_000_000,
			"NG-SN": 200_000_000,
			"NG-AE": 350_000_000,
			"NG-KE": 250_000_000,
			"NG-ZA": 200_000_000,
			"NG-CA": 600_000_000,
		}
		if v, ok := defaults[corridor]; ok {
			return v
		}
		return 100_000_000
	}

	return total / float64(count)
}

func (cp *CapacityPlanningService) getSeasonalMultiplier(date time.Time, corridor string) float64 {
	multiplier := 1.0

	// Salary day effect
	for _, salDay := range cp.calendar.SalaryDays {
		if date.Day() == salDay {
			multiplier *= 1.4
			break
		}
	}

	// Holiday effects
	for _, holiday := range cp.calendar.Holidays {
		if date.Month() == holiday.Month {
			dayDiff := date.Day() - holiday.Day
			if dayDiff >= 0 && dayDiff < holiday.Duration {
				if len(holiday.Corridors) == 0 {
					multiplier *= holiday.Impact
				} else {
					for _, c := range holiday.Corridors {
						if c == corridor {
							multiplier *= holiday.Impact
							break
						}
					}
				}
			}
		}
	}

	return multiplier
}

func (cp *CapacityPlanningService) getDayOfWeekMultiplier(dow time.Weekday) float64 {
	switch dow {
	case time.Saturday:
		return 0.4
	case time.Sunday:
		return 0.3
	case time.Monday:
		return 1.2
	case time.Friday:
		return 1.1
	default:
		return 1.0
	}
}

func (cp *CapacityPlanningService) identifyPatterns(date time.Time, corridor string) []VolumePattern {
	var patterns []VolumePattern

	for _, salDay := range cp.calendar.SalaryDays {
		if date.Day() == salDay {
			patterns = append(patterns, PatternSalaryDay)
			break
		}
	}

	if date.Day() >= 28 || date.Day() <= 2 {
		patterns = append(patterns, PatternMonthEnd)
	}

	if date.Weekday() == time.Saturday || date.Weekday() == time.Sunday {
		patterns = append(patterns, PatternWeekend)
	}

	for _, h := range cp.calendar.Holidays {
		if date.Month() == h.Month && date.Day() >= h.Day && date.Day() < h.Day+h.Duration {
			patterns = append(patterns, PatternHoliday)
			break
		}
	}

	return patterns
}
