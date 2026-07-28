package flightaware

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client represents a FlightAware API client
type Client struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

// FlightStatus represents flight status information
type FlightStatus struct {
	FlightNumber         string    `json:"flight_number"`
	ScheduledDepartureTime time.Time `json:"scheduled_departure_time"`
	ActualDepartureTime    time.Time `json:"actual_departure_time"`
	DepartureAirport     string    `json:"departure_airport"`
	ArrivalAirport       string    `json:"arrival_airport"`
	Status               string    `json:"status"` // "scheduled", "active", "landed", "cancelled", "diverted"
	DelayMinutes         int       `json:"delay_minutes"`
}

// FlightAwareResponse represents the API response
type FlightAwareResponse struct {
	Flights []struct {
		Ident                string `json:"ident"`
		ScheduledDeparture   int64  `json:"scheduled_departure"`
		ActualDeparture      int64  `json:"actual_departure"`
		Origin               string `json:"origin"`
		Destination          string `json:"destination"`
		Status               string `json:"status"`
	} `json:"flights"`
}

// NewClient creates a new FlightAware client
func NewClient(apiKey string) *Client {
	return &Client{
		apiKey:  apiKey,
		baseURL: "https://aeroapi.flightaware.com/aeroapi",
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// GetFlightStatus retrieves flight status information
func (c *Client) GetFlightStatus(flightNumber string, departureDate time.Time) (*FlightStatus, error) {
	// Format date as YYYY-MM-DD
	dateStr := departureDate.Format("2006-01-02")

	// Build API URL
	url := fmt.Sprintf("%s/flights/%s?start=%s&end=%s", c.baseURL, flightNumber, dateStr, dateStr)

	// Create request
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("x-apikey", c.apiKey)
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
	var apiResp FlightAwareResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Check if flight found
	if len(apiResp.Flights) == 0 {
		return nil, fmt.Errorf("flight not found: %s", flightNumber)
	}

	// Get first flight (most recent)
	flight := apiResp.Flights[0]

	// Convert timestamps
	scheduledDeparture := time.Unix(flight.ScheduledDeparture, 0)
	actualDeparture := time.Unix(flight.ActualDeparture, 0)

	// Calculate delay
	delayMinutes := 0
	if !actualDeparture.IsZero() && actualDeparture.After(scheduledDeparture) {
		delayMinutes = int(actualDeparture.Sub(scheduledDeparture).Minutes())
	}

	// Create flight status
	status := &FlightStatus{
		FlightNumber:           flight.Ident,
		ScheduledDepartureTime: scheduledDeparture,
		ActualDepartureTime:    actualDeparture,
		DepartureAirport:       flight.Origin,
		ArrivalAirport:         flight.Destination,
		Status:                 flight.Status,
		DelayMinutes:           delayMinutes,
	}

	return status, nil
}

// MockClient for testing (uses mock data)
