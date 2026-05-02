package geo

import (
	"context"
	"log"
	"time"

	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("geo-service")
}

func EmitLocationVerified(ctx context.Context, userID string, latitude, longitude float64, country, city string) error {
	return events.GetEmitter().Emit(ctx, "geo.location.verified", "user", userID, map[string]interface{}{
		"latitude":    latitude,
		"longitude":   longitude,
		"country":     country,
		"city":        city,
		"verified_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitGeoAnomalyDetected(ctx context.Context, userID string, previousCountry, currentCountry string, distanceKm float64) error {
	return events.GetEmitter().Emit(ctx, "geo.anomaly.detected", "user", userID, map[string]interface{}{
		"previous_country": previousCountry,
		"current_country":  currentCountry,
		"distance_km":      distanceKm,
		"detected_at":      time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitGeoRestrictionTriggered(ctx context.Context, userID, country, restriction string) error {
	return events.GetEmitter().Emit(ctx, "geo.restriction.triggered", "user", userID, map[string]interface{}{
		"country":      country,
		"restriction":  restriction,
		"triggered_at": time.Now().UTC().Format(time.RFC3339),
	})
}

type GeoServiceWithEvents struct {
	service interface{}
}

func NewGeoServiceWithEvents(service interface{}) *GeoServiceWithEvents {
	return &GeoServiceWithEvents{service: service}
}

func (s *GeoServiceWithEvents) VerifyLocation(ctx context.Context, userID string, latitude, longitude float64) (string, string, error) {
	country := "NG"
	city := "Lagos"

	if err := EmitLocationVerified(ctx, userID, latitude, longitude, country, city); err != nil {
		log.Printf("Failed to emit location verified event: %v", err)
	}

	return country, city, nil
}

func (s *GeoServiceWithEvents) CheckAnomaly(ctx context.Context, userID, previousCountry, currentCountry string, distanceKm float64) (bool, error) {
	isAnomaly := distanceKm > 5000

	if isAnomaly {
		if err := EmitGeoAnomalyDetected(ctx, userID, previousCountry, currentCountry, distanceKm); err != nil {
			log.Printf("Failed to emit geo anomaly event: %v", err)
		}
	}

	return isAnomaly, nil
}
