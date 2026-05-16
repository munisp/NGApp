package nimet

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client represents a NiMet (Nigerian Meteorological Agency) API client
type Client struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

// WeatherData represents weather information
type WeatherData struct {
	Location    string    `json:"location"`
	Timestamp   time.Time `json:"timestamp"`
	Temperature float64   `json:"temperature"` // Celsius
	Rainfall    float64   `json:"rainfall"`    // mm
	Humidity    float64   `json:"humidity"`    // percentage
	WindSpeed   float64   `json:"wind_speed"`  // km/h
	Pressure    float64   `json:"pressure"`    // hPa
	Condition   string    `json:"condition"`   // "clear", "cloudy", "rainy", "stormy"
}

// NiMetResponse represents the API response
type NiMetResponse struct {
	Data struct {
		Location    string  `json:"location"`
		Timestamp   string  `json:"timestamp"`
		Temperature float64 `json:"temperature"`
		Rainfall    float64 `json:"rainfall"`
		Humidity    float64 `json:"humidity"`
		WindSpeed   float64 `json:"wind_speed"`
		Pressure    float64 `json:"pressure"`
		Condition   string  `json:"condition"`
	} `json:"data"`
}

// NewClient creates a new NiMet client
func NewClient(apiKey string) *Client {
	return &Client{
		apiKey:  apiKey,
		baseURL: "https://api.nimet.gov.ng/v1", // Hypothetical API endpoint
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// GetWeatherData retrieves weather data for a location
func (c *Client) GetWeatherData(location string) (*WeatherData, error) {
	// Build API URL
	url := fmt.Sprintf("%s/weather?location=%s", c.baseURL, location)

	// Create request
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiKey))
	req.Header.Set("Accept", "application/json")

	// Execute request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	// Check status code
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var apiResp NiMetResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Parse timestamp
	timestamp, err := time.Parse(time.RFC3339, apiResp.Data.Timestamp)
	if err != nil {
		timestamp = time.Now()
	}

	// Create weather data
	weather := &WeatherData{
		Location:    apiResp.Data.Location,
		Timestamp:   timestamp,
		Temperature: apiResp.Data.Temperature,
		Rainfall:    apiResp.Data.Rainfall,
		Humidity:    apiResp.Data.Humidity,
		WindSpeed:   apiResp.Data.WindSpeed,
		Pressure:    apiResp.Data.Pressure,
		Condition:   apiResp.Data.Condition,
	}

	return weather, nil
}

// GetHistoricalWeatherData retrieves historical weather data
func (c *Client) GetHistoricalWeatherData(location string, startDate, endDate time.Time) ([]*WeatherData, error) {
	// Build API URL
	url := fmt.Sprintf("%s/weather/historical?location=%s&start=%s&end=%s",
		c.baseURL,
		location,
		startDate.Format("2006-01-02"),
		endDate.Format("2006-01-02"),
	)

	// Create request
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiKey))
	req.Header.Set("Accept", "application/json")

	// Execute request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	// Check status code
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var apiResp struct {
		Data []struct {
			Location    string  `json:"location"`
			Timestamp   string  `json:"timestamp"`
			Temperature float64 `json:"temperature"`
			Rainfall    float64 `json:"rainfall"`
			Humidity    float64 `json:"humidity"`
			WindSpeed   float64 `json:"wind_speed"`
			Pressure    float64 `json:"pressure"`
			Condition   string  `json:"condition"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Convert to weather data
	weatherData := make([]*WeatherData, 0, len(apiResp.Data))
	for _, data := range apiResp.Data {
		timestamp, _ := time.Parse(time.RFC3339, data.Timestamp)
		weatherData = append(weatherData, &WeatherData{
			Location:    data.Location,
			Timestamp:   timestamp,
			Temperature: data.Temperature,
			Rainfall:    data.Rainfall,
			Humidity:    data.Humidity,
			WindSpeed:   data.WindSpeed,
			Pressure:    data.Pressure,
			Condition:   data.Condition,
		})
	}

	return weatherData, nil
}

// MockClient for testing (uses mock data)
