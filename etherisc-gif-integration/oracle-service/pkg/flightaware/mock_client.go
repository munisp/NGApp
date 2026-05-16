//go:build testing
// +build testing

// This file contains MockClient used exclusively in unit tests.
// It is excluded from production builds via the 'testing' build tag.
package flightaware

import "time"

// MockClient provides a mock FlightAware client for testing.
type MockClient struct{}

// NewMockClient creates a mock FlightAware client for testing.
func NewMockClient() *MockClient {
	return &MockClient{}
}

// GetFlightStatus returns mock flight status data.
func (m *MockClient) GetFlightStatus(flightNumber string, departureDate time.Time) (*FlightStatus, error) {
	scheduledDeparture := departureDate
	actualDeparture := departureDate.Add(2*time.Hour + 30*time.Minute) // 2.5 hour delay
	return &FlightStatus{
		FlightNumber:           flightNumber,
		ScheduledDepartureTime: scheduledDeparture,
		ActualDepartureTime:    actualDeparture,
		DepartureAirport:       "LOS",
		ArrivalAirport:         "ABV",
		Status:                 "delayed",
		DelayMinutes:           150,
	}, nil
}
