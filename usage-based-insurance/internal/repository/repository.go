package repository

import (
	"fmt"
	"sync"
	"time"
	"usage-based-insurance/internal/models"
)

type UBIRepository struct {
	mu         sync.RWMutex
	policies   map[string]*models.UBIPolicy
	telemetry  map[string][]models.TelematicsData
	scores     map[string][]models.DrivingScore
	trips      map[string][]models.Trip
}

func NewUBIRepository() *UBIRepository {
	return &UBIRepository{
		policies:  make(map[string]*models.UBIPolicy),
		telemetry: make(map[string][]models.TelematicsData),
		scores:    make(map[string][]models.DrivingScore),
		trips:     make(map[string][]models.Trip),
	}
}

func (r *UBIRepository) CreatePolicy(p *models.UBIPolicy) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.policies[p.ID] = p
	return nil
}

func (r *UBIRepository) GetPolicy(id string) (*models.UBIPolicy, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.policies[id]
	if !ok {
		return nil, fmt.Errorf("policy %s not found", id)
	}
	return p, nil
}

func (r *UBIRepository) UpdatePolicy(p *models.UBIPolicy) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.policies[p.ID] = p
}

func (r *UBIRepository) ListPolicies() []models.UBIPolicy {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.UBIPolicy
	for _, p := range r.policies {
		result = append(result, *p)
	}
	return result
}

func (r *UBIRepository) AddTelemetry(policyID string, data models.TelematicsData) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.telemetry[policyID] = append(r.telemetry[policyID], data)
}

func (r *UBIRepository) GetTelemetry(policyID string, limit int) []models.TelematicsData {
	r.mu.RLock()
	defer r.mu.RUnlock()
	data := r.telemetry[policyID]
	if limit > 0 && len(data) > limit {
		return data[len(data)-limit:]
	}
	return data
}

func (r *UBIRepository) SaveScore(score models.DrivingScore) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.scores[score.PolicyID] = append(r.scores[score.PolicyID], score)
}

func (r *UBIRepository) GetScores(policyID string) []models.DrivingScore {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.scores[policyID]
}

func (r *UBIRepository) AddTrip(trip models.Trip) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.trips[trip.PolicyID] = append(r.trips[trip.PolicyID], trip)
}

func (r *UBIRepository) GetTrips(policyID string) []models.Trip {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.trips[policyID]
}

func (r *UBIRepository) GetStats() map[string]interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()
	totalTrips := 0
	totalDistance := 0.0
	for _, trips := range r.trips {
		totalTrips += len(trips)
		for _, t := range trips {
			totalDistance += t.DistanceKm
		}
	}
	return map[string]interface{}{
		"total_policies": len(r.policies),
		"total_trips":    totalTrips,
		"total_distance_km": totalDistance,
		"total_telemetry_points": func() int {
			c := 0
			for _, d := range r.telemetry {
				c += len(d)
			}
			return c
		}(),
	}
}

func init() {
	_ = time.Now
	_ = fmt.Sprintf
}
