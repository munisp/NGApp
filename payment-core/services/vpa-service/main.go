package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"os"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	_ "github.com/lib/pq"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// VPAService implements the VPA gRPC service
type VPAService struct {
	db    *sql.DB
	redis *redis.Client
}

// VPA represents a Virtual Payment Address
type VPA struct {
	VPAID         string            `json:"vpa_id"`
	AccountID     string            `json:"account_id"`
	VPAHandle     string            `json:"vpa_handle"`
	BankCode      string            `json:"bank_code"`
	FullVPA       string            `json:"full_vpa"`
	DisplayName   string            `json:"display_name"`
	VPAType       string            `json:"vpa_type"`
	Status        string            `json:"status"`
	CreatedAt     time.Time         `json:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at"`
	LastUsedAt    *time.Time        `json:"last_used_at,omitempty"`
	Metadata      map[string]string `json:"metadata"`
}

// NewVPAService creates a new VPA service
func NewVPAService(db *sql.DB, redis *redis.Client) *VPAService {
	return &VPAService{
		db:    db,
		redis: redis,
	}
}

// CreateVPA creates a new Virtual Payment Address
func (s *VPAService) CreateVPA(ctx context.Context, req *CreateVPARequest) (*CreateVPAResponse, error) {
	// Validate request
	if req.AccountId == "" || req.VpaHandle == "" || req.BankCode == "" {
		return nil, status.Error(codes.InvalidArgument, "missing required fields")
	}

	// Normalize VPA handle
	vpaHandle := strings.ToLower(strings.TrimSpace(req.VpaHandle))
	bankCode := strings.ToLower(strings.TrimSpace(req.BankCode))
	fullVPA := fmt.Sprintf("%s@%s", vpaHandle, bankCode)

	// Check if VPA already exists
	exists, err := s.checkVPAExists(ctx, fullVPA)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to check VPA availability")
	}
	if exists {
		return nil, status.Error(codes.AlreadyExists, "VPA already exists")
	}

	// Generate VPA ID
	vpaID := generateID()

	// Insert into database
	query := `
		INSERT INTO vpas (vpa_id, account_id, vpa_handle, bank_code, full_vpa, display_name, vpa_type, status, metadata, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	metadataJSON, _ := json.Marshal(req.Metadata)
	now := time.Now()

	_, err = s.db.ExecContext(ctx, query,
		vpaID,
		req.AccountId,
		vpaHandle,
		bankCode,
		fullVPA,
		req.DisplayName,
		req.VpaType.String(),
		"ACTIVE",
		metadataJSON,
		now,
		now,
	)

	if err != nil {
		log.Printf("Failed to create VPA: %v", err)
		return nil, status.Error(codes.Internal, "failed to create VPA")
	}

	// Cache VPA in Redis for fast resolution
	vpa := VPA{
		VPAID:       vpaID,
		AccountID:   req.AccountId,
		VPAHandle:   vpaHandle,
		BankCode:    bankCode,
		FullVPA:     fullVPA,
		DisplayName: req.DisplayName,
		VPAType:     req.VpaType.String(),
		Status:      "ACTIVE",
		CreatedAt:   now,
		UpdatedAt:   now,
		Metadata:    req.Metadata,
	}

	if err := s.cacheVPA(ctx, vpa); err != nil {
		log.Printf("Failed to cache VPA: %v", err)
	}

	return &CreateVPAResponse{
		VpaId:     vpaID,
		FullVpa:   fullVPA,
		CreatedAt: now.Unix(),
		Status:    VPAStatus_ACTIVE,
	}, nil
}

// ResolveVPA resolves a VPA to account details
func (s *VPAService) ResolveVPA(ctx context.Context, req *ResolveVPARequest) (*ResolveVPAResponse, error) {
	if req.Vpa == "" {
		return nil, status.Error(codes.InvalidArgument, "VPA is required")
	}

	// Normalize VPA
	vpa := strings.ToLower(strings.TrimSpace(req.Vpa))

	// Try to get from cache first
	cachedVPA, err := s.getVPAFromCache(ctx, vpa)
	if err == nil && cachedVPA != nil {
		// Update last used time asynchronously
		go s.updateLastUsed(context.Background(), cachedVPA.VPAID)

		return &ResolveVPAResponse{
			VpaId:             cachedVPA.VPAID,
			AccountId:         cachedVPA.AccountID,
			BankId:            cachedVPA.BankCode,
			AccountHolderName: cachedVPA.DisplayName,
			VpaType:           parseVPAType(cachedVPA.VPAType),
			Status:            parseVPAStatus(cachedVPA.Status),
			Metadata:          cachedVPA.Metadata,
		}, nil
	}

	// Cache miss, query database
	query := `
		SELECT vpa_id, account_id, bank_code, display_name, vpa_type, status, metadata
		FROM vpas
		WHERE full_vpa = $1 AND status = 'ACTIVE'
	`

	var vpaData VPA
	var metadataJSON []byte

	err = s.db.QueryRowContext(ctx, query, vpa).Scan(
		&vpaData.VPAID,
		&vpaData.AccountID,
		&vpaData.BankCode,
		&vpaData.DisplayName,
		&vpaData.VPAType,
		&vpaData.Status,
		&metadataJSON,
	)

	if err == sql.ErrNoRows {
		return nil, status.Error(codes.NotFound, "VPA not found")
	}
	if err != nil {
		log.Printf("Failed to resolve VPA: %v", err)
		return nil, status.Error(codes.Internal, "failed to resolve VPA")
	}

	// Parse metadata
	if len(metadataJSON) > 0 {
		json.Unmarshal(metadataJSON, &vpaData.Metadata)
	}

	// Cache for future lookups
	vpaData.FullVPA = vpa
	if err := s.cacheVPA(ctx, vpaData); err != nil {
		log.Printf("Failed to cache VPA: %v", err)
	}

	// Update last used time
	go s.updateLastUsed(context.Background(), vpaData.VPAID)

	return &ResolveVPAResponse{
		VpaId:             vpaData.VPAID,
		AccountId:         vpaData.AccountID,
		BankId:            vpaData.BankCode,
		AccountHolderName: vpaData.DisplayName,
		VpaType:           parseVPAType(vpaData.VPAType),
		Status:            parseVPAStatus(vpaData.Status),
		Metadata:          vpaData.Metadata,
	}, nil
}

// ListVPAs lists all VPAs for an account
func (s *VPAService) ListVPAs(ctx context.Context, req *ListVPAsRequest) (*ListVPAsResponse, error) {
	if req.AccountId == "" {
		return nil, status.Error(codes.InvalidArgument, "account_id is required")
	}

	pageSize := req.PageSize
	if pageSize == 0 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}

	query := `
		SELECT vpa_id, full_vpa, display_name, vpa_type, status, created_at, last_used_at
		FROM vpas
		WHERE account_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`

	rows, err := s.db.QueryContext(ctx, query, req.AccountId, pageSize)
	if err != nil {
		log.Printf("Failed to list VPAs: %v", err)
		return nil, status.Error(codes.Internal, "failed to list VPAs")
	}
	defer rows.Close()

	var vpas []*VPAInfo
	for rows.Next() {
		var vpaInfo VPAInfo
		var lastUsedAt sql.NullTime

		err := rows.Scan(
			&vpaInfo.VpaId,
			&vpaInfo.FullVpa,
			&vpaInfo.DisplayName,
			&vpaInfo.VpaType,
			&vpaInfo.Status,
			&vpaInfo.CreatedAt,
			&lastUsedAt,
		)

		if err != nil {
			log.Printf("Failed to scan VPA: %v", err)
			continue
		}

		if lastUsedAt.Valid {
			vpaInfo.LastUsedAt = lastUsedAt.Time.Unix()
		}

		vpas = append(vpas, &vpaInfo)
	}

	return &ListVPAsResponse{
		Vpas:       vpas,
		TotalCount: int32(len(vpas)),
	}, nil
}

// CheckAvailability checks if a VPA is available
func (s *VPAService) CheckAvailability(ctx context.Context, req *CheckAvailabilityRequest) (*CheckAvailabilityResponse, error) {
	if req.VpaHandle == "" || req.BankCode == "" {
		return nil, status.Error(codes.InvalidArgument, "vpa_handle and bank_code are required")
	}

	vpaHandle := strings.ToLower(strings.TrimSpace(req.VpaHandle))
	bankCode := strings.ToLower(strings.TrimSpace(req.BankCode))
	fullVPA := fmt.Sprintf("%s@%s", vpaHandle, bankCode)

	exists, err := s.checkVPAExists(ctx, fullVPA)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to check availability")
	}

	response := &CheckAvailabilityResponse{
		Available: !exists,
	}

	// If not available, provide suggestions
	if exists {
		suggestions := []string{
			fmt.Sprintf("%s1@%s", vpaHandle, bankCode),
			fmt.Sprintf("%s2@%s", vpaHandle, bankCode),
			fmt.Sprintf("%s_pay@%s", vpaHandle, bankCode),
		}
		response.Suggestions = suggestions
	}

	return response, nil
}

// Helper methods

func (s *VPAService) checkVPAExists(ctx context.Context, fullVPA string) (bool, error) {
	// Check cache first
	exists, err := s.redis.Exists(ctx, fmt.Sprintf("vpa:%s", fullVPA)).Result()
	if err == nil && exists > 0 {
		return true, nil
	}

	// Check database
	var count int
	query := "SELECT COUNT(*) FROM vpas WHERE full_vpa = $1"
	err = s.db.QueryRowContext(ctx, query, fullVPA).Scan(&count)
	if err != nil {
		return false, err
	}

	return count > 0, nil
}

func (s *VPAService) cacheVPA(ctx context.Context, vpa VPA) error {
	key := fmt.Sprintf("vpa:%s", vpa.FullVPA)
	data, err := json.Marshal(vpa)
	if err != nil {
		return err
	}

	return s.redis.Set(ctx, key, data, 24*time.Hour).Err()
}

func (s *VPAService) getVPAFromCache(ctx context.Context, fullVPA string) (*VPA, error) {
	key := fmt.Sprintf("vpa:%s", fullVPA)
	data, err := s.redis.Get(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var vpa VPA
	if err := json.Unmarshal([]byte(data), &vpa); err != nil {
		return nil, err
	}

	return &vpa, nil
}

func (s *VPAService) updateLastUsed(ctx context.Context, vpaID string) {
	query := "UPDATE vpas SET last_used_at = $1 WHERE vpa_id = $2"
	_, err := s.db.ExecContext(ctx, query, time.Now(), vpaID)
	if err != nil {
		log.Printf("Failed to update last_used_at: %v", err)
	}
}

func generateID() string {
	return fmt.Sprintf("vpa_%d", time.Now().UnixNano())
}

func parseVPAType(t string) VPAType {
	switch strings.ToUpper(t) {
	case "PERSONAL":
		return VPAType_PERSONAL
	case "BUSINESS":
		return VPAType_BUSINESS
	case "MERCHANT":
		return VPAType_MERCHANT
	case "TEMPORARY":
		return VPAType_TEMPORARY
	default:
		return VPAType_PERSONAL
	}
}

func parseVPAStatus(s string) VPAStatus {
	switch strings.ToUpper(s) {
	case "ACTIVE":
		return VPAStatus_ACTIVE
	case "INACTIVE":
		return VPAStatus_INACTIVE
	case "SUSPENDED":
		return VPAStatus_SUSPENDED
	case "PENDING_VERIFICATION":
		return VPAStatus_PENDING_VERIFICATION
	default:
		return VPAStatus_ACTIVE
	}
}

func main() {
	// Initialize PostgreSQL connection
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/payment_switch?sslmode=disable"
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize Redis connection
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}

	redisClient := redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})

	// Create VPA service
	vpaService := NewVPAService(db, redisClient)

	// Start gRPC server
	port := os.Getenv("PORT")
	if port == "" {
		port = "50051"
	}

	lis, err := net.Listen("tcp", fmt.Sprintf(":%s", port))
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	grpcServer := grpc.NewServer()
	// RegisterVPAServiceServer(grpcServer, vpaService)

	log.Printf("VPA Service starting on port %s", port)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("Failed to serve: %v", err)
	}
}
