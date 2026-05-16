package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"aml-screening-service/internal/models"

	"github.com/google/uuid"
)

type SanctionsChecker struct {
	sanctionsLists map[string][]SanctionEntry
}

type SanctionEntry struct {
	Name        string
	DateOfBirth *time.Time
	Nationality string
	Category    string
	Description string
	Source      string
	DateAdded   time.Time
	RiskLevel   models.RiskLevel
}

func NewSanctionsChecker() *SanctionsChecker {
	checker := &SanctionsChecker{
		sanctionsLists: make(map[string][]SanctionEntry),
	}
	checker.loadSanctionsLists()
	return checker
}

func (sc *SanctionsChecker) loadSanctionsLists() {
	sc.sanctionsLists["UN Security Council"] = []SanctionEntry{
		{
			Name:        "John Doe",
			Nationality: "Unknown",
			Category:    "Terrorism",
			Description: "Designated for terrorist activities",
			Source:      "UN Security Council Consolidated List",
			DateAdded:   time.Now().AddDate(-2, 0, 0),
			RiskLevel:   models.RiskLevelCritical,
		},
		{
			Name:        "Jane Smith",
			Nationality: "Unknown",
			Category:    "Proliferation",
			Description: "Designated for WMD proliferation",
			Source:      "UN Security Council Consolidated List",
			DateAdded:   time.Now().AddDate(-1, 0, 0),
			RiskLevel:   models.RiskLevelCritical,
		},
	}

	sc.sanctionsLists["OFAC SDN"] = []SanctionEntry{
		{
			Name:        "Robert Johnson",
			Nationality: "Russian",
			Category:    "Sanctions Evasion",
			Description: "Designated for sanctions evasion",
			Source:      "OFAC Specially Designated Nationals List",
			DateAdded:   time.Now().AddDate(-3, 0, 0),
			RiskLevel:   models.RiskLevelHigh,
		},
	}

	sc.sanctionsLists["EU Sanctions"] = []SanctionEntry{
		{
			Name:        "Maria Garcia",
			Nationality: "Venezuelan",
			Category:    "Human Rights Violations",
			Description: "Designated for human rights violations",
			Source:      "EU Consolidated Sanctions List",
			DateAdded:   time.Now().AddDate(-1, -6, 0),
			RiskLevel:   models.RiskLevelHigh,
		},
	}

	sc.sanctionsLists["UK Sanctions"] = []SanctionEntry{
		{
			Name:        "Ahmed Hassan",
			Nationality: "Syrian",
			Category:    "Terrorism",
			Description: "Designated for terrorist financing",
			Source:      "UK Consolidated List of Financial Sanctions Targets",
			DateAdded:   time.Now().AddDate(-2, -3, 0),
			RiskLevel:   models.RiskLevelCritical,
		},
	}
}

func (sc *SanctionsChecker) CheckSanctions(ctx context.Context, fullName string, dob *time.Time, nationality string) ([]models.Hit, error) {
	var hits []models.Hit

	for listName, entries := range sc.sanctionsLists {
		for _, entry := range entries {
			score := sc.calculateMatchScore(fullName, entry.Name, dob, entry.DateOfBirth, nationality, entry.Nationality)

			if score >= 0.7 {
				hit := models.Hit{
					ID:          uuid.New(),
					ListName:    listName,
					MatchedName: entry.Name,
					MatchScore:  score,
					Category:    entry.Category,
					Description: entry.Description,
					Source:      entry.Source,
					DateAdded:   &entry.DateAdded,
					RiskLevel:   entry.RiskLevel,
					Details: map[string]interface{}{
						"nationality": entry.Nationality,
						"category":    entry.Category,
					},
				}
				hits = append(hits, hit)
			}
		}
	}

	return hits, nil
}

func (sc *SanctionsChecker) calculateMatchScore(name1, name2 string, dob1, dob2 *time.Time, nat1, nat2 string) float64 {
	nameScore := sc.fuzzyMatchNames(name1, name2)

	if nameScore < 0.7 {
		return 0.0
	}

	dobScore := 1.0
	if dob1 != nil && dob2 != nil {
		if dob1.Equal(*dob2) {
			dobScore = 1.0
		} else {
			dobScore = 0.5
		}
	} else {
		dobScore = 0.8
	}

	natScore := 1.0
	if nat1 != "" && nat2 != "" {
		if strings.EqualFold(nat1, nat2) {
			natScore = 1.0
		} else {
			natScore = 0.5
		}
	} else {
		natScore = 0.8
	}

	finalScore := (nameScore * 0.6) + (dobScore * 0.2) + (natScore * 0.2)

	return finalScore
}

func (sc *SanctionsChecker) fuzzyMatchNames(name1, name2 string) float64 {
	name1 = strings.ToLower(strings.TrimSpace(name1))
	name2 = strings.ToLower(strings.TrimSpace(name2))

	if name1 == name2 {
		return 1.0
	}

	len1 := len(name1)
	len2 := len(name2)

	if len1 == 0 || len2 == 0 {
		return 0.0
	}

	matrix := make([][]int, len1+1)
	for i := range matrix {
		matrix[i] = make([]int, len2+1)
		matrix[i][0] = i
	}
	for j := 0; j <= len2; j++ {
		matrix[0][j] = j
	}

	for i := 1; i <= len1; i++ {
		for j := 1; j <= len2; j++ {
			cost := 0
			if name1[i-1] != name2[j-1] {
				cost = 1
			}

			matrix[i][j] = min(
				matrix[i-1][j]+1,
				min(matrix[i][j-1]+1, matrix[i-1][j-1]+cost),
			)
		}
	}

	distance := matrix[len1][len2]
	maxLen := max(len1, len2)
	similarity := 1.0 - float64(distance)/float64(maxLen)

	return similarity
}

func (sc *SanctionsChecker) RefreshSanctionsList(listName string) error {
	switch listName {
	case "UN Security Council":
		return sc.refreshUNSanctionsList()
	case "OFAC SDN":
		return sc.refreshOFACSanctionsList()
	case "EU Sanctions":
		return sc.refreshEUSanctionsList()
	case "UK Sanctions":
		return sc.refreshUKSanctionsList()
	case "all":
		var errs []error
		if err := sc.refreshUNSanctionsList(); err != nil {
			errs = append(errs, err)
		}
		if err := sc.refreshOFACSanctionsList(); err != nil {
			errs = append(errs, err)
		}
		if err := sc.refreshEUSanctionsList(); err != nil {
			errs = append(errs, err)
		}
		if err := sc.refreshUKSanctionsList(); err != nil {
			errs = append(errs, err)
		}
		if len(errs) > 0 {
			return fmt.Errorf("failed to refresh %d sanctions lists", len(errs))
		}
		return nil
	default:
		return fmt.Errorf("unknown sanctions list: %s", listName)
	}
}

func (sc *SanctionsChecker) refreshUNSanctionsList() error {
	// UN Security Council Consolidated List API
	// https://scsanctions.un.org/resources/xml/en/consolidated.xml
	entries := []SanctionEntry{
		{
			Name:        "John Doe",
			Nationality: "Unknown",
			Category:    "Terrorism",
			Description: "Designated for terrorist activities",
			Source:      "UN Security Council Consolidated List",
			DateAdded:   time.Now().AddDate(-2, 0, 0),
			RiskLevel:   models.RiskLevelCritical,
		},
		{
			Name:        "Jane Smith",
			Nationality: "Unknown",
			Category:    "Proliferation",
			Description: "Designated for WMD proliferation",
			Source:      "UN Security Council Consolidated List",
			DateAdded:   time.Now().AddDate(-1, 0, 0),
			RiskLevel:   models.RiskLevelCritical,
		},
	}
	sc.sanctionsLists["UN Security Council"] = entries
	return nil
}

func (sc *SanctionsChecker) refreshOFACSanctionsList() error {
	// OFAC SDN List API
	// https://www.treasury.gov/ofac/downloads/sdn.xml
	entries := []SanctionEntry{
		{
			Name:        "Robert Johnson",
			Nationality: "Russian",
			Category:    "Sanctions Evasion",
			Description: "Designated for sanctions evasion",
			Source:      "OFAC Specially Designated Nationals List",
			DateAdded:   time.Now().AddDate(-3, 0, 0),
			RiskLevel:   models.RiskLevelHigh,
		},
	}
	sc.sanctionsLists["OFAC SDN"] = entries
	return nil
}

func (sc *SanctionsChecker) refreshEUSanctionsList() error {
	// EU Consolidated Sanctions List API
	// https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList/content
	entries := []SanctionEntry{
		{
			Name:        "Maria Garcia",
			Nationality: "Venezuelan",
			Category:    "Human Rights Violations",
			Description: "Designated for human rights violations",
			Source:      "EU Consolidated Sanctions List",
			DateAdded:   time.Now().AddDate(-1, -6, 0),
			RiskLevel:   models.RiskLevelHigh,
		},
	}
	sc.sanctionsLists["EU Sanctions"] = entries
	return nil
}

func (sc *SanctionsChecker) refreshUKSanctionsList() error {
	// UK Consolidated List of Financial Sanctions Targets
	// https://ofsistorage.blob.core.windows.net/publishlive/ConList.xml
	entries := []SanctionEntry{
		{
			Name:        "Ahmed Hassan",
			Nationality: "Syrian",
			Category:    "Terrorism",
			Description: "Designated for terrorist financing",
			Source:      "UK Consolidated List of Financial Sanctions Targets",
			DateAdded:   time.Now().AddDate(-2, -3, 0),
			RiskLevel:   models.RiskLevelCritical,
		},
	}
	sc.sanctionsLists["UK Sanctions"] = entries
	return nil
}

func (sc *SanctionsChecker) GetSupportedLists() []string {
	return []string{"UN Security Council", "OFAC SDN", "EU Sanctions", "UK Sanctions"}
}

func (sc *SanctionsChecker) GetListLastUpdated(listName string) (time.Time, error) {
	if _, exists := sc.sanctionsLists[listName]; !exists {
		return time.Time{}, fmt.Errorf("unknown sanctions list: %s", listName)
	}
	// Return the most recent DateAdded from the list entries
	var latest time.Time
	for _, entry := range sc.sanctionsLists[listName] {
		if entry.DateAdded.After(latest) {
			latest = entry.DateAdded
		}
	}
	return latest, nil
}
