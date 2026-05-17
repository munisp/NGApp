package services

import (
	"context"
	"strings"
	"time"

	"aml-screening-service/internal/models"

	"github.com/google/uuid"
)

type PEPChecker struct {
	pepDatabase map[string][]PEPEntry
}

type PEPEntry struct {
	Name        string
	DateOfBirth *time.Time
	Nationality string
	Position    string
	Category    string
	Description string
	Source      string
	DateAdded   time.Time
	RiskLevel   models.RiskLevel
}

func NewPEPChecker() *PEPChecker {
	checker := &PEPChecker{
		pepDatabase: make(map[string][]PEPEntry),
	}
	checker.loadPEPDatabase()
	return checker
}

func (pc *PEPChecker) loadPEPDatabase() {
	pc.pepDatabase["Government Officials"] = []PEPEntry{
		{
			Name:        "Muhammadu Buhari",
			Nationality: "Nigerian",
			Position:    "Former President",
			Category:    "Head of State",
			Description: "Former President of Nigeria",
			Source:      "Public Records",
			DateAdded:   time.Now().AddDate(-5, 0, 0),
			RiskLevel:   models.RiskLevelHigh,
		},
		{
			Name:        "Yemi Osinbajo",
			Nationality: "Nigerian",
			Position:    "Former Vice President",
			Category:    "Senior Government Official",
			Description: "Former Vice President of Nigeria",
			Source:      "Public Records",
			DateAdded:   time.Now().AddDate(-5, 0, 0),
			RiskLevel:   models.RiskLevelHigh,
		},
	}

	pc.pepDatabase["Ministers"] = []PEPEntry{
		{
			Name:        "Godwin Emefiele",
			Nationality: "Nigerian",
			Position:    "Former CBN Governor",
			Category:    "Central Bank Official",
			Description: "Former Governor of Central Bank of Nigeria",
			Source:      "Public Records",
			DateAdded:   time.Now().AddDate(-8, 0, 0),
			RiskLevel:   models.RiskLevelHigh,
		},
	}

	pc.pepDatabase["Legislators"] = []PEPEntry{
		{
			Name:        "Ahmad Lawan",
			Nationality: "Nigerian",
			Position:    "Senate President",
			Category:    "Legislative Leader",
			Description: "President of the Nigerian Senate",
			Source:      "Public Records",
			DateAdded:   time.Now().AddDate(-4, 0, 0),
			RiskLevel:   models.RiskLevelMedium,
		},
	}

	pc.pepDatabase["Judiciary"] = []PEPEntry{
		{
			Name:        "Olukayode Ariwoola",
			Nationality: "Nigerian",
			Position:    "Chief Justice",
			Category:    "Judicial Official",
			Description: "Chief Justice of Nigeria",
			Source:      "Public Records",
			DateAdded:   time.Now().AddDate(-2, 0, 0),
			RiskLevel:   models.RiskLevelMedium,
		},
	}

	pc.pepDatabase["International Organizations"] = []PEPEntry{
		{
			Name:        "Ngozi Okonjo-Iweala",
			Nationality: "Nigerian",
			Position:    "WTO Director-General",
			Category:    "International Organization Leader",
			Description: "Director-General of World Trade Organization",
			Source:      "Public Records",
			DateAdded:   time.Now().AddDate(-3, 0, 0),
			RiskLevel:   models.RiskLevelMedium,
		},
	}

	pc.pepDatabase["Family Members"] = []PEPEntry{}
}

func (pc *PEPChecker) CheckPEP(ctx context.Context, fullName string, dob *time.Time, nationality string) ([]models.Hit, error) {
	var hits []models.Hit

	for category, entries := range pc.pepDatabase {
		for _, entry := range entries {
			score := pc.calculateMatchScore(fullName, entry.Name, dob, entry.DateOfBirth, nationality, entry.Nationality)

			if score >= 0.75 {
				hit := models.Hit{
					ID:          uuid.New(),
					ListName:    "PEP Database",
					MatchedName: entry.Name,
					MatchScore:  score,
					Category:    category,
					Description: entry.Description,
					Source:      entry.Source,
					DateAdded:   &entry.DateAdded,
					RiskLevel:   entry.RiskLevel,
					Details: map[string]interface{}{
						"position":    entry.Position,
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

func (pc *PEPChecker) calculateMatchScore(name1, name2 string, dob1, dob2 *time.Time, nat1, nat2 string) float64 {
	nameScore := pc.fuzzyMatchNames(name1, name2)

	if nameScore < 0.75 {
		return 0.0
	}

	dobScore := 1.0
	if dob1 != nil && dob2 != nil {
		if dob1.Equal(*dob2) {
			dobScore = 1.0
		} else {
			dobScore = 0.6
		}
	} else {
		dobScore = 0.85
	}

	natScore := 1.0
	if nat1 != "" && nat2 != "" {
		if strings.EqualFold(nat1, nat2) {
			natScore = 1.0
		} else {
			natScore = 0.6
		}
	} else {
		natScore = 0.85
	}

	finalScore := (nameScore * 0.6) + (dobScore * 0.2) + (natScore * 0.2)

	return finalScore
}

func (pc *PEPChecker) fuzzyMatchNames(name1, name2 string) float64 {
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

func (pc *PEPChecker) IsPEP(fullName string) bool {
	for _, entries := range pc.pepDatabase {
		for _, entry := range entries {
			if pc.fuzzyMatchNames(fullName, entry.Name) >= 0.9 {
				return true
			}
		}
	}
	return false
}

func (pc *PEPChecker) GetPEPCategory(fullName string) string {
	for category, entries := range pc.pepDatabase {
		for _, entry := range entries {
			if pc.fuzzyMatchNames(fullName, entry.Name) >= 0.9 {
				return category
			}
		}
	}
	return ""
}
