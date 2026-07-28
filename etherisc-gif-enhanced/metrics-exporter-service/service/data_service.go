package service

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/etherisc/metrics-exporter-service/config"
)

// DataService is responsible for fetching and calculating raw data from various GIF components.
// In a real-world scenario, this would involve making RPC/HTTP calls to the respective services.
type DataService struct {
	cfg *config.Config
}

// NewDataService creates a new DataService instance.
func NewDataService(cfg *config.Config) *DataService {
	return &DataService{cfg: cfg}
}

// --- Mock Data Structures ---

// BlockchainStats represents raw data from the blockchain/GIF service.
type BlockchainStats struct {
	PolicyCreations int
	ClaimTriggers   int
	OracleSubmissions int
	GasCosts map[string]float64 // Key: tx_type_currency, Value: cost
	TotalTransactions int
	SuccessfulTransactions int
}

// ReinsuranceStats represents raw data from the reinsurance/TigerBeetle service.
type ReinsuranceStats struct {
	CededPremiums float64
	TreatyCapacity float64
	TreatyUsed float64
	ReinsurerBalances map[string]float64 // Key: reinsurer_id_currency, Value: balance
	FacultativePlacements int
}

// OracleStats represents raw data from the oracle service.
type OracleStats struct {
	DataFetchLatency time.Duration
	SuccessfulSubmissions int
	TotalSubmissions int
	ExternalAPIHealth map[string]bool // Key: api_name, Value: is_healthy
}

// --- Mock Fetch Functions ---

// FetchBlockchainStats simulates fetching blockchain operations data.
func (s *DataService) FetchBlockchainStats(ctx context.Context) (*BlockchainStats, error) {
	// Simulate network latency
	time.Sleep(time.Duration(rand.Intn(100)) * time.Millisecond)

	// In a real implementation, use s.cfg.Integration.GIFServiceURL to fetch data.
	// For now, we use mock data.
	return &BlockchainStats{
		PolicyCreations:    rand.Intn(50) + 10,
		ClaimTriggers:      rand.Intn(10) + 1,
		OracleSubmissions:  rand.Intn(20) + 5,
		GasCosts: map[string]float64{
			"policy_creation_eth": float64(rand.Intn(100)) / 100.0,
			"claim_trigger_eth":   float64(rand.Intn(50)) / 100.0,
		},
		TotalTransactions:      rand.Intn(1000) + 500,
		SuccessfulTransactions: rand.Intn(990) + 500, // Ensure success rate is high
	}, nil
}

// FetchReinsuranceStats simulates fetching reinsurance data.
func (s *DataService) FetchReinsuranceStats(ctx context.Context) (*ReinsuranceStats, error) {
	// Simulate network latency
	time.Sleep(time.Duration(rand.Intn(100)) * time.Millisecond)

	// In a real implementation, use s.cfg.Integration.TigerBeetleAPIURL and LakehouseDBConnStr.
	return &ReinsuranceStats{
		CededPremiums:         float64(rand.Intn(100000)) + 50000.0,
		TreatyCapacity:        1000000.0,
		TreatyUsed:            float64(rand.Intn(500000)) + 100000.0,
		ReinsurerBalances: map[string]float64{
			"reinsurer_a_usd": float64(rand.Intn(50000)) - 10000.0, // Can be negative
			"reinsurer_b_usd": float64(rand.Intn(20000)) + 5000.0,
		},
		FacultativePlacements: rand.Intn(50) + 5,
	}, nil
}

// FetchOracleStats simulates fetching oracle data.
func (s *DataService) FetchOracleStats(ctx context.Context) (*OracleStats, error) {
	// Simulate network latency
	time.Sleep(time.Duration(rand.Intn(100)) * time.Millisecond)

	// In a real implementation, use s.cfg.Integration.ClaimsServiceURL and PolicyServiceURL.
	return &OracleStats{
		DataFetchLatency: time.Duration(rand.Intn(500)) * time.Millisecond,
		SuccessfulSubmissions: rand.Intn(100) + 900,
		TotalSubmissions:      1000,
		ExternalAPIHealth: map[string]bool{
			"weather_api": true,
			"price_feed":  rand.Intn(10) != 0, // 90% chance of being healthy
			"index_data":  true,
		},
	}, nil
}

// GetIntegrationHealth checks the health of all integrated services.
func (s *DataService) GetIntegrationHealth(ctx context.Context) map[string]bool {
	// In a real implementation, this would ping the configured URLs.
	// For now, we mock the health status.
	health := make(map[string]bool)
	health[fmt.Sprintf("GIFService (%s)", s.cfg.Integration.GIFServiceURL)] = true
	health[fmt.Sprintf("PolicyService (%s)", s.cfg.Integration.PolicyServiceURL)] = true
	health[fmt.Sprintf("ClaimsService (%s)", s.cfg.Integration.ClaimsServiceURL)] = true
	health[fmt.Sprintf("TigerBeetleAPI (%s)", s.cfg.Integration.TigerBeetleAPIURL)] = true
	health[fmt.Sprintf("LakehouseDB (%s)", s.cfg.Integration.LakehouseDBConnStr)] = true
	return health
}
