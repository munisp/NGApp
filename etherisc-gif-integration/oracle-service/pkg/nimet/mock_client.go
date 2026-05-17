//go:build testing
// +build testing

// This file contains MockClient used exclusively in unit tests.
// It is excluded from production builds via the 'testing' build tag.
package nimet

import "time"

// MockClient provides a mock NiMet client for testing.
type MockClient struct{}

// NewMockClient creates a mock NiMet client for testing.
func NewMockClient() *MockClient {
return &MockClient{}
}

// GetWeatherData returns mock weather data.
func (m *MockClient) GetWeatherData(location string) (*WeatherData, error) {
return &WeatherData{
:    location,
  time.Now(),
28.5,
fall:    15.2,
:    75.0,
dSpeed:   12.5,
   1013.25,
dition:   "rainy",
}, nil
}

// GetHistoricalWeatherData returns mock historical weather data.
func (m *MockClient) GetHistoricalWeatherData(location string, startDate, endDate time.Time) ([]*WeatherData, error) {
weatherData := make([]*WeatherData, 0)
for d := startDate; d.Before(endDate) || d.Equal(endDate); d = d.AddDate(0, 0, 1) {
= append(weatherData, &WeatherData{
:    location,
  d,
27.0 + float64(d.Day()%5),
fall:    float64(d.Day() % 20),
:    70.0 + float64(d.Day()%10),
dSpeed:   10.0 + float64(d.Day()%5),
   1013.0,
dition:   "partly-cloudy",
 weatherData, nil
}
