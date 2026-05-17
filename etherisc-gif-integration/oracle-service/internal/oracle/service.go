package oracle

import (
	"context"
	"fmt"
	"time"

	"github.com/insurance-platform/etherisc-oracle-service/internal/blockchain"
	"github.com/insurance-platform/etherisc-oracle-service/pkg/flightaware"
	"github.com/insurance-platform/etherisc-oracle-service/pkg/nimet"
	"github.com/robfig/cron/v3"
	log "github.com/sirupsen/logrus"
)

// Service represents the oracle service
type Service struct {
	flightClient     FlightClient
	weatherClient    WeatherClient
	blockchainClient *blockchain.Client
	cron             *cron.Cron
	config           *Config
}

// Config represents oracle service configuration
type Config struct {
	FlightCheckInterval  time.Duration
	WeatherCheckInterval time.Duration
	UseMockClients       bool
}

// FlightClient interface for flight data providers
type FlightClient interface {
	GetFlightStatus(flightNumber string, departureDate time.Time) (*flightaware.FlightStatus, error)
}

// WeatherClient interface for weather data providers
type WeatherClient interface {
	GetWeatherData(location string) (*nimet.WeatherData, error)
	GetHistoricalWeatherData(location string, startDate, endDate time.Time) ([]*nimet.WeatherData, error)
}

// NewService creates a new oracle service
func NewService(
	flightClient FlightClient,
	weatherClient WeatherClient,
	blockchainClient *blockchain.Client,
	config *Config,
) *Service {
	return &Service{
		flightClient:     flightClient,
		weatherClient:    weatherClient,
		blockchainClient: blockchainClient,
		cron:             cron.New(),
		config:           config,
	}
}

// Start starts the oracle service
func (s *Service) Start(ctx context.Context) error {
	log.Info("Starting oracle service...")

	// Schedule flight data checks
	flightCronSpec := fmt.Sprintf("@every %s", s.config.FlightCheckInterval)
	_, err := s.cron.AddFunc(flightCronSpec, func() {
		if err := s.checkFlights(ctx); err != nil {
			log.Errorf("Failed to check flights: %v", err)
		}
	})
	if err != nil {
		return fmt.Errorf("failed to schedule flight checks: %w", err)
	}

	// Schedule weather data checks
	weatherCronSpec := fmt.Sprintf("@every %s", s.config.WeatherCheckInterval)
	_, err = s.cron.AddFunc(weatherCronSpec, func() {
		if err := s.checkWeather(ctx); err != nil {
			log.Errorf("Failed to check weather: %v", err)
		}
	})
	if err != nil {
		return fmt.Errorf("failed to schedule weather checks: %w", err)
	}

	// Start cron scheduler
	s.cron.Start()

	log.Info("Oracle service started successfully")

	// Wait for context cancellation
	<-ctx.Done()

	// Stop cron scheduler
	s.cron.Stop()

	log.Info("Oracle service stopped")

	return nil
}

// checkFlights checks flight statuses and submits data to blockchain
func (s *Service) checkFlights(ctx context.Context) error {
	log.Info("Checking flight statuses...")

	// In production, this would fetch active policies from database
	// For now, we'll use mock data
	flights := []struct {
		FlightNumber  string
		DepartureDate time.Time
		PolicyID      [32]byte
	}{
		{
			FlightNumber:  "AA123",
			DepartureDate: time.Now(),
			PolicyID:      [32]byte{1, 2, 3},
		},
	}

	for _, flight := range flights {
		// Get flight status
		status, err := s.flightClient.GetFlightStatus(flight.FlightNumber, flight.DepartureDate)
		if err != nil {
			log.Errorf("Failed to get flight status for %s: %v", flight.FlightNumber, err)
			continue
		}

		log.Infof("Flight %s: Status=%s, Delay=%d minutes",
			flight.FlightNumber, status.Status, status.DelayMinutes)

		// Submit data to blockchain oracle
		txHash, err := s.blockchainClient.SubmitFlightData(
			ctx,
			status.FlightNumber,
			uint64(status.ScheduledDepartureTime.Unix()),
			uint64(status.ActualDepartureTime.Unix()),
			status.DepartureAirport,
			status.ArrivalAirport,
			status.Status,
		)
		if err != nil {
			log.Errorf("Failed to submit flight data to blockchain: %v", err)
			continue
		}

		log.Infof("Submitted flight data to blockchain: tx=%s", txHash)

		// Check if delay threshold met and trigger claim
		if status.DelayMinutes >= 120 { // 2 hours
			claimTxHash, err := s.blockchainClient.TriggerClaim(
				ctx,
				flight.PolicyID,
				uint64(status.ActualDepartureTime.Unix()),
				uint64(status.DelayMinutes),
			)
			if err != nil {
				log.Errorf("Failed to trigger claim: %v", err)
				continue
			}

			log.Infof("Triggered claim for policy %x: tx=%s", flight.PolicyID, claimTxHash)
		}
	}

	return nil
}

// checkWeather checks weather data and submits to blockchain
func (s *Service) checkWeather(ctx context.Context) error {
	log.Info("Checking weather data...")

	// In production, this would fetch active weather policies from database
	// For now, we'll use mock data
	locations := []string{"Lagos", "Abuja", "Kano"}

	for _, location := range locations {
		// Get weather data
		weather, err := s.weatherClient.GetWeatherData(location)
		if err != nil {
			log.Errorf("Failed to get weather data for %s: %v", location, err)
			continue
		}

		log.Infof("Weather in %s: Temp=%.1f°C, Rainfall=%.1fmm, Humidity=%.1f%%",
			location, weather.Temperature, weather.Rainfall, weather.Humidity)

		// In production, submit weather data to blockchain oracle
		// For now, we'll just log it
		log.Infof("Weather data for %s ready for blockchain submission", location)
	}

	return nil
}

// CheckFlightStatus checks a specific flight status (on-demand)
func (s *Service) CheckFlightStatus(ctx context.Context, flightNumber string, departureDate time.Time) (*flightaware.FlightStatus, error) {
	log.Infof("Checking flight status for %s on %s", flightNumber, departureDate.Format("2006-01-02"))

	status, err := s.flightClient.GetFlightStatus(flightNumber, departureDate)
	if err != nil {
		return nil, fmt.Errorf("failed to get flight status: %w", err)
	}

	return status, nil
}

// CheckWeatherData checks weather data for a location (on-demand)
func (s *Service) CheckWeatherData(ctx context.Context, location string) (*nimet.WeatherData, error) {
	log.Infof("Checking weather data for %s", location)

	weather, err := s.weatherClient.GetWeatherData(location)
	if err != nil {
		return nil, fmt.Errorf("failed to get weather data: %w", err)
	}

	return weather, nil
}

// SubmitFlightDataToBlockchain submits flight data to blockchain oracle
func (s *Service) SubmitFlightDataToBlockchain(ctx context.Context, status *flightaware.FlightStatus) (string, error) {
	log.Infof("Submitting flight data to blockchain: %s", status.FlightNumber)

	txHash, err := s.blockchainClient.SubmitFlightData(
		ctx,
		status.FlightNumber,
		uint64(status.ScheduledDepartureTime.Unix()),
		uint64(status.ActualDepartureTime.Unix()),
		status.DepartureAirport,
		status.ArrivalAirport,
		status.Status,
	)
	if err != nil {
		return "", fmt.Errorf("failed to submit flight data: %w", err)
	}

	return txHash, nil
}

// TriggerClaimForPolicy triggers a claim for a policy
func (s *Service) TriggerClaimForPolicy(
	ctx context.Context,
	policyID [32]byte,
	actualDepartureTime time.Time,
	delayMinutes int,
) (string, error) {
	log.Infof("Triggering claim for policy %x", policyID)

	txHash, err := s.blockchainClient.TriggerClaim(
		ctx,
		policyID,
		uint64(actualDepartureTime.Unix()),
		uint64(delayMinutes),
	)
	if err != nil {
		return "", fmt.Errorf("failed to trigger claim: %w", err)
	}

	return txHash, nil
}

// Stop stops the oracle service
func (s *Service) Stop() {
	log.Info("Stopping oracle service...")
	s.cron.Stop()
	s.blockchainClient.Close()
}
