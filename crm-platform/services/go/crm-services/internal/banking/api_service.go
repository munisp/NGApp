//go:build ignore

package banking

import (
	"context"
	"fmt"
	"time"

	pb "github.com/banking-crm-integration/banking-api/proto"
	"github.com/banking-crm-integration/banking-api/go/server/config"
	"github.com/banking-crm-integration/banking-api/go/server/datasources"
	"github.com/banking-crm-integration/banking-api/go/server/models"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

var tracer = otel.Tracer("banking-api-service")

// Dependencies holds all the dependencies for the BankingAPIService
type Dependencies struct {
	Config                *config.Config
	Logger                config.Logger
	CustomerDataSource    datasources.CustomerDataSource
	AccountDataSource     datasources.AccountDataSource
	TransactionDataSource datasources.TransactionDataSource
	ProductDataSource     datasources.ProductDataSource
	AgentDataSource       datasources.AgentDataSource
	NeoBankDataSource     datasources.NeoBankDataSource
	CoreBankingDataSource datasources.CoreBankingDataSource
	PaymentDataSource     datasources.PaymentDataSource
	EventPublisher        datasources.EventPublisher
}

// NewDependencies creates a new Dependencies instance
func NewDependencies(cfg *config.Config, logger config.Logger) *Dependencies {
	return &Dependencies{
		Config:                cfg,
		Logger:                logger,
		CustomerDataSource:    datasources.NewCustomerDataSource(cfg),
		AccountDataSource:     datasources.NewAccountDataSource(cfg),
		TransactionDataSource: datasources.NewTransactionDataSource(cfg),
		ProductDataSource:     datasources.NewProductDataSource(cfg),
		AgentDataSource:       datasources.NewAgentDataSource(cfg),
		NeoBankDataSource:     datasources.NewNeoBankDataSource(cfg),
		CoreBankingDataSource: datasources.NewCoreBankingDataSource(cfg),
		PaymentDataSource:     datasources.NewPaymentDataSource(cfg),
		EventPublisher:        datasources.NewEventPublisher(cfg),
	}
}

// BankingAPIService implements the BankingAPI gRPC service
type BankingAPIService struct {
	pb.UnimplementedBankingAPIServer
	deps *Dependencies
}

// NewBankingAPIService creates a new BankingAPIService
func NewBankingAPIService(deps *Dependencies) *BankingAPIService {
	return &BankingAPIService{
		deps: deps,
	}
}

// GetCustomerProfile retrieves a customer profile by ID
func (s *BankingAPIService) GetCustomerProfile(ctx context.Context, req *pb.GetCustomerProfileRequest) (*pb.CustomerProfile, error) {
	ctx, span := tracer.Start(ctx, "GetCustomerProfile", trace.WithAttributes(
		attribute.String("customer_id", req.CustomerId),
		attribute.Bool("include_crm_data", req.IncludeCrmData),
	))
	defer span.End()

	s.deps.Logger.Info("GetCustomerProfile request received", "customer_id", req.CustomerId)

	// Validate request
	if req.CustomerId == "" {
		return nil, status.Error(codes.InvalidArgument, "customer_id is required")
	}

	// Get customer from data source
	customer, err := s.deps.CustomerDataSource.GetCustomerByID(ctx, req.CustomerId)
	if err != nil {
		s.deps.Logger.Error("Failed to get customer", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get customer: %v", err)
	}

	if customer == nil {
		return nil, status.Errorf(codes.NotFound, "customer not found: %s", req.CustomerId)
	}

	// Convert to protobuf message
	customerProfile := convertToCustomerProfile(customer)

	// Include CRM data if requested
	if req.IncludeCrmData {
		crmData, err := s.deps.CustomerDataSource.GetCustomerCRMData(ctx, req.CustomerId)
		if err != nil {
			s.deps.Logger.Error("Failed to get CRM data", "error", err)
			// Continue without CRM data
		} else if crmData != nil {
			customerProfile.CrmData = convertToCRMData(crmData)
		}
	}

	s.deps.Logger.Info("GetCustomerProfile request completed", "customer_id", req.CustomerId)
	return customerProfile, nil
}

// ListCustomers lists customers based on filter criteria
func (s *BankingAPIService) ListCustomers(ctx context.Context, req *pb.ListCustomersRequest) (*pb.ListCustomersResponse, error) {
	ctx, span := tracer.Start(ctx, "ListCustomers", trace.WithAttributes(
		attribute.Int("page_size", int(req.PageSize)),
		attribute.String("filter", req.Filter),
	))
	defer span.End()

	s.deps.Logger.Info("ListCustomers request received", "page_size", req.PageSize, "filter", req.Filter)

	// Set default page size if not specified
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	// Get customers from data source
	customers, nextPageToken, totalSize, err := s.deps.CustomerDataSource.ListCustomers(ctx, int(pageSize), req.PageToken, req.Filter, req.SortBy)
	if err != nil {
		s.deps.Logger.Error("Failed to list customers", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to list customers: %v", err)
	}

	// Convert to protobuf messages
	customerProfiles := make([]*pb.CustomerProfile, 0, len(customers))
	for _, customer := range customers {
		customerProfiles = append(customerProfiles, convertToCustomerProfile(customer))
	}

	s.deps.Logger.Info("ListCustomers request completed", "count", len(customerProfiles))
	return &pb.ListCustomersResponse{
		Customers:     customerProfiles,
		NextPageToken: nextPageToken,
		TotalSize:     int32(totalSize),
	}, nil
}

// UpdateCustomerCRMData updates CRM data for a customer
func (s *BankingAPIService) UpdateCustomerCRMData(ctx context.Context, req *pb.UpdateCustomerCRMDataRequest) (*pb.CustomerProfile, error) {
	ctx, span := tracer.Start(ctx, "UpdateCustomerCRMData", trace.WithAttributes(
		attribute.String("customer_id", req.CustomerId),
	))
	defer span.End()

	s.deps.Logger.Info("UpdateCustomerCRMData request received", "customer_id", req.CustomerId)

	// Validate request
	if req.CustomerId == "" {
		return nil, status.Error(codes.InvalidArgument, "customer_id is required")
	}
	if req.CrmData == nil {
		return nil, status.Error(codes.InvalidArgument, "crm_data is required")
	}

	// Check if customer exists
	customer, err := s.deps.CustomerDataSource.GetCustomerByID(ctx, req.CustomerId)
	if err != nil {
		s.deps.Logger.Error("Failed to get customer", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get customer: %v", err)
	}
	if customer == nil {
		return nil, status.Errorf(codes.NotFound, "customer not found: %s", req.CustomerId)
	}

	// Convert from protobuf message
	crmData := convertFromCRMData(req.CrmData)
	crmData.CustomerID = req.CustomerId

	// Update CRM data
	err = s.deps.CustomerDataSource.UpdateCustomerCRMData(ctx, req.CustomerId, crmData)
	if err != nil {
		s.deps.Logger.Error("Failed to update CRM data", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to update CRM data: %v", err)
	}

	// Get updated customer profile
	updatedCustomer, err := s.deps.CustomerDataSource.GetCustomerByID(ctx, req.CustomerId)
	if err != nil {
		s.deps.Logger.Error("Failed to get updated customer", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get updated customer: %v", err)
	}

	// Convert to protobuf message
	customerProfile := convertToCustomerProfile(updatedCustomer)
	
	// Include updated CRM data
	updatedCRMData, err := s.deps.CustomerDataSource.GetCustomerCRMData(ctx, req.CustomerId)
	if err != nil {
		s.deps.Logger.Error("Failed to get updated CRM data", "error", err)
		// Continue without CRM data
	} else if updatedCRMData != nil {
		customerProfile.CrmData = convertToCRMData(updatedCRMData)
	}

	// Publish customer updated event
	event := &models.CustomerEvent{
		EventID:    fmt.Sprintf("evt-%s", generateUUID()),
		CustomerID: req.CustomerId,
		EventType:  "CRMDataUpdated",
		EventTime:  time.Now(),
		Metadata: map[string]string{
			"source": "crm-system",
		},
	}
	
	err = s.deps.EventPublisher.PublishCustomerEvent(ctx, event)
	if err != nil {
		s.deps.Logger.Error("Failed to publish customer event", "error", err)
		// Continue without publishing event
	}

	s.deps.Logger.Info("UpdateCustomerCRMData request completed", "customer_id", req.CustomerId)
	return customerProfile, nil
}

// SyncCustomerData synchronizes customer data between banking and CRM systems
func (s *BankingAPIService) SyncCustomerData(ctx context.Context, req *pb.SyncCustomerDataRequest) (*pb.SyncCustomerDataResponse, error) {
	ctx, span := tracer.Start(ctx, "SyncCustomerData", trace.WithAttributes(
		attribute.Int("customer_count", len(req.CustomerIds)),
		attribute.Bool("full_sync", req.FullSync),
	))
	defer span.End()

	s.deps.Logger.Info("SyncCustomerData request received", 
		"customer_count", len(req.CustomerIds),
		"full_sync", req.FullSync,
		"since", req.Since.AsTime())

	// Validate request
	if len(req.CustomerIds) == 0 && !req.FullSync {
		return nil, status.Error(codes.InvalidArgument, "customer_ids or full_sync is required")
	}

	var since time.Time
	if req.Since != nil {
		since = req.Since.AsTime()
	}

	// Sync customer data
	var customers []*models.Customer
	var err error
	
	if req.FullSync {
		customers, err = s.deps.CustomerDataSource.SyncAllCustomers(ctx, since)
	} else {
		customers, err = s.deps.CustomerDataSource.SyncCustomersByIDs(ctx, req.CustomerIds, since)
	}
	
	if err != nil {
		s.deps.Logger.Error("Failed to sync customer data", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to sync customer data: %v", err)
	}

	// Convert to protobuf messages
	customerProfiles := make([]*pb.CustomerProfile, 0, len(customers))
	for _, customer := range customers {
		customerProfiles = append(customerProfiles, convertToCustomerProfile(customer))
	}

	s.deps.Logger.Info("SyncCustomerData request completed", "synced_count", len(customerProfiles))
	return &pb.SyncCustomerDataResponse{
		Customers: customerProfiles,
		SyncCount: int32(len(customerProfiles)),
		SyncTime:  timestamppb.Now(),
	}, nil
}

// GetCustomerAccounts retrieves accounts for a customer
func (s *BankingAPIService) GetCustomerAccounts(ctx context.Context, req *pb.GetCustomerAccountsRequest) (*pb.CustomerAccountsResponse, error) {
	ctx, span := tracer.Start(ctx, "GetCustomerAccounts", trace.WithAttributes(
		attribute.String("customer_id", req.CustomerId),
		attribute.String("account_type", req.AccountType),
		attribute.String("status", req.Status),
	))
	defer span.End()

	s.deps.Logger.Info("GetCustomerAccounts request received", 
		"customer_id", req.CustomerId,
		"account_type", req.AccountType,
		"status", req.Status)

	// Validate request
	if req.CustomerId == "" {
		return nil, status.Error(codes.InvalidArgument, "customer_id is required")
	}

	// Check if customer exists
	customer, err := s.deps.CustomerDataSource.GetCustomerByID(ctx, req.CustomerId)
	if err != nil {
		s.deps.Logger.Error("Failed to get customer", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get customer: %v", err)
	}
	if customer == nil {
		return nil, status.Errorf(codes.NotFound, "customer not found: %s", req.CustomerId)
	}

	// Get accounts from data source
	accounts, err := s.deps.AccountDataSource.GetAccountsByCustomerID(ctx, req.CustomerId, req.AccountType, req.Status)
	if err != nil {
		s.deps.Logger.Error("Failed to get accounts", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get accounts: %v", err)
	}

	// Convert to protobuf messages
	accountDetails := make([]*pb.AccountDetails, 0, len(accounts))
	for _, account := range accounts {
		accountDetails = append(accountDetails, convertToAccountDetails(account))
	}

	s.deps.Logger.Info("GetCustomerAccounts request completed", "customer_id", req.CustomerId, "account_count", len(accountDetails))
	return &pb.CustomerAccountsResponse{
		Accounts:      accountDetails,
		TotalAccounts: int32(len(accountDetails)),
	}, nil
}

// GetAccountDetails retrieves details for an account
func (s *BankingAPIService) GetAccountDetails(ctx context.Context, req *pb.GetAccountDetailsRequest) (*pb.AccountDetails, error) {
	ctx, span := tracer.Start(ctx, "GetAccountDetails", trace.WithAttributes(
		attribute.String("account_id", req.AccountId),
	))
	defer span.End()

	s.deps.Logger.Info("GetAccountDetails request received", "account_id", req.AccountId)

	// Validate request
	if req.AccountId == "" {
		return nil, status.Error(codes.InvalidArgument, "account_id is required")
	}

	// Get account from data source
	account, err := s.deps.AccountDataSource.GetAccountByID(ctx, req.AccountId)
	if err != nil {
		s.deps.Logger.Error("Failed to get account", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get account: %v", err)
	}

	if account == nil {
		return nil, status.Errorf(codes.NotFound, "account not found: %s", req.AccountId)
	}

	// Convert to protobuf message
	accountDetails := convertToAccountDetails(account)

	s.deps.Logger.Info("GetAccountDetails request completed", "account_id", req.AccountId)
	return accountDetails, nil
}

// GetAccountTransactions retrieves transactions for an account
func (s *BankingAPIService) GetAccountTransactions(ctx context.Context, req *pb.GetAccountTransactionsRequest) (*pb.AccountTransactionsResponse, error) {
	ctx, span := tracer.Start(ctx, "GetAccountTransactions", trace.WithAttributes(
		attribute.String("account_id", req.AccountId),
		attribute.String("transaction_type", req.TransactionType),
	))
	defer span.End()

	s.deps.Logger.Info("GetAccountTransactions request received", 
		"account_id", req.AccountId,
		"transaction_type", req.TransactionType)

	// Validate request
	if req.AccountId == "" {
		return nil, status.Error(codes.InvalidArgument, "account_id is required")
	}

	// Set default page size if not specified
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	// Set default date range if not specified
	var startDate, endDate time.Time
	if req.StartDate != nil {
		startDate = req.StartDate.AsTime()
	} else {
		startDate = time.Now().AddDate(0, -1, 0) // Default to 1 month ago
	}
	if req.EndDate != nil {
		endDate = req.EndDate.AsTime()
	} else {
		endDate = time.Now() // Default to now
	}

	// Get transactions from data source
	transactions, nextPageToken, totalSize, err := s.deps.TransactionDataSource.GetTransactionsByAccountID(
		ctx, 
		req.AccountId, 
		startDate, 
		endDate, 
		req.TransactionType, 
		int(pageSize), 
		req.PageToken,
	)
	if err != nil {
		s.deps.Logger.Error("Failed to get transactions", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get transactions: %v", err)
	}

	// Convert to protobuf messages
	transactionDetails := make([]*pb.TransactionDetails, 0, len(transactions))
	for _, transaction := range transactions {
		transactionDetails = append(transactionDetails, convertToTransactionDetails(transaction))
	}

	s.deps.Logger.Info("GetAccountTransactions request completed", 
		"account_id", req.AccountId, 
		"transaction_count", len(transactionDetails))
	
	return &pb.AccountTransactionsResponse{
		AccountId:     req.AccountId,
		Transactions:  transactionDetails,
		NextPageToken: nextPageToken,
		TotalSize:     int32(totalSize),
	}, nil
}

// GetTransactionDetails retrieves details for a transaction
func (s *BankingAPIService) GetTransactionDetails(ctx context.Context, req *pb.GetTransactionDetailsRequest) (*pb.TransactionDetails, error) {
	ctx, span := tracer.Start(ctx, "GetTransactionDetails", trace.WithAttributes(
		attribute.String("transaction_id", req.TransactionId),
	))
	defer span.End()

	s.deps.Logger.Info("GetTransactionDetails request received", "transaction_id", req.TransactionId)

	// Validate request
	if req.TransactionId == "" {
		return nil, status.Error(codes.InvalidArgument, "transaction_id is required")
	}

	// Get transaction from data source
	transaction, err := s.deps.TransactionDataSource.GetTransactionByID(ctx, req.TransactionId)
	if err != nil {
		s.deps.Logger.Error("Failed to get transaction", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get transaction: %v", err)
	}

	if transaction == nil {
		return nil, status.Errorf(codes.NotFound, "transaction not found: %s", req.TransactionId)
	}

	// Convert to protobuf message
	transactionDetails := convertToTransactionDetails(transaction)

	s.deps.Logger.Info("GetTransactionDetails request completed", "transaction_id", req.TransactionId)
	return transactionDetails, nil
}

// ListTransactions lists transactions based on filter criteria
func (s *BankingAPIService) ListTransactions(ctx context.Context, req *pb.ListTransactionsRequest) (*pb.ListTransactionsResponse, error) {
	ctx, span := tracer.Start(ctx, "ListTransactions", trace.WithAttributes(
		attribute.String("customer_id", req.CustomerId),
		attribute.String("transaction_type", req.TransactionType),
		attribute.String("status", req.Status),
	))
	defer span.End()

	s.deps.Logger.Info("ListTransactions request received", 
		"customer_id", req.CustomerId,
		"transaction_type", req.TransactionType,
		"status", req.Status)

	// Set default page size if not specified
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	// Set default date range if not specified
	var startDate, endDate time.Time
	if req.StartDate != nil {
		startDate = req.StartDate.AsTime()
	} else {
		startDate = time.Now().AddDate(0, -1, 0) // Default to 1 month ago
	}
	if req.EndDate != nil {
		endDate = req.EndDate.AsTime()
	} else {
		endDate = time.Now() // Default to now
	}

	// Get transactions from data source
	transactions, nextPageToken, totalSize, err := s.deps.TransactionDataSource.ListTransactions(
		ctx, 
		req.CustomerId, 
		startDate, 
		endDate, 
		req.TransactionType, 
		req.Status, 
		req.MinAmount, 
		req.MaxAmount, 
		int(pageSize), 
		req.PageToken,
	)
	if err != nil {
		s.deps.Logger.Error("Failed to list transactions", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to list transactions: %v", err)
	}

	// Convert to protobuf messages
	transactionDetails := make([]*pb.TransactionDetails, 0, len(transactions))
	for _, transaction := range transactions {
		transactionDetails = append(transactionDetails, convertToTransactionDetails(transaction))
	}

	s.deps.Logger.Info("ListTransactions request completed", "transaction_count", len(transactionDetails))
	return &pb.ListTransactionsResponse{
		Transactions:  transactionDetails,
		NextPageToken: nextPageToken,
		TotalSize:     int32(totalSize),
	}, nil
}

// FlagTransactionForReview flags a transaction for review
func (s *BankingAPIService) FlagTransactionForReview(ctx context.Context, req *pb.FlagTransactionForReviewRequest) (*pb.FlagTransactionForReviewResponse, error) {
	ctx, span := tracer.Start(ctx, "FlagTransactionForReview", trace.WithAttributes(
		attribute.String("transaction_id", req.TransactionId),
		attribute.String("reason", req.Reason),
		attribute.String("severity", req.Severity),
	))
	defer span.End()

	s.deps.Logger.Info("FlagTransactionForReview request received", 
		"transaction_id", req.TransactionId,
		"reason", req.Reason,
		"severity", req.Severity)

	// Validate request
	if req.TransactionId == "" {
		return nil, status.Error(codes.InvalidArgument, "transaction_id is required")
	}
	if req.Reason == "" {
		return nil, status.Error(codes.InvalidArgument, "reason is required")
	}

	// Check if transaction exists
	transaction, err := s.deps.TransactionDataSource.GetTransactionByID(ctx, req.TransactionId)
	if err != nil {
		s.deps.Logger.Error("Failed to get transaction", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get transaction: %v", err)
	}
	if transaction == nil {
		return nil, status.Errorf(codes.NotFound, "transaction not found: %s", req.TransactionId)
	}

	// Flag transaction for review
	reviewID, err := s.deps.TransactionDataSource.FlagTransactionForReview(
		ctx, 
		req.TransactionId, 
		req.Reason, 
		req.FlaggedBy, 
		req.Severity, 
		req.Notes,
	)
	if err != nil {
		s.deps.Logger.Error("Failed to flag transaction for review", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to flag transaction for review: %v", err)
	}

	// Publish transaction flagged event
	event := &models.TransactionEvent{
		EventID:       fmt.Sprintf("evt-%s", generateUUID()),
		TransactionID: req.TransactionId,
		CustomerID:    transaction.CustomerID,
		AccountID:     transaction.AccountID,
		EventType:     "TransactionFlagged",
		EventTime:     time.Now(),
		Metadata: map[string]string{
			"reason":      req.Reason,
			"severity":    req.Severity,
			"flagged_by":  req.FlaggedBy,
			"review_id":   reviewID,
		},
	}
	
	err = s.deps.EventPublisher.PublishTransactionEvent(ctx, event)
	if err != nil {
		s.deps.Logger.Error("Failed to publish transaction event", "error", err)
		// Continue without publishing event
	}

	s.deps.Logger.Info("FlagTransactionForReview request completed", 
		"transaction_id", req.TransactionId,
		"review_id", reviewID)
	
	return &pb.FlagTransactionForReviewResponse{
		TransactionId: req.TransactionId,
		ReviewId:      reviewID,
		Status:        "pending_review",
		FlaggedTime:   timestamppb.Now(),
	}, nil
}

// ListBankingProducts lists banking products based on filter criteria
func (s *BankingAPIService) ListBankingProducts(ctx context.Context, req *pb.ListBankingProductsRequest) (*pb.ListBankingProductsResponse, error) {
	ctx, span := tracer.Start(ctx, "ListBankingProducts", trace.WithAttributes(
		attribute.String("product_type", req.ProductType),
		attribute.String("product_category", req.ProductCategory),
		attribute.Bool("active_only", req.ActiveOnly),
	))
	defer span.End()

	s.deps.Logger.Info("ListBankingProducts request received", 
		"product_type", req.ProductType,
		"product_category", req.ProductCategory,
		"active_only", req.ActiveOnly)

	// Set default page size if not specified
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	// Get products from data source
	products, nextPageToken, totalSize, err := s.deps.ProductDataSource.ListProducts(
		ctx, 
		req.ProductType, 
		req.ProductCategory, 
		req.ActiveOnly, 
		int(pageSize), 
		req.PageToken,
	)
	if err != nil {
		s.deps.Logger.Error("Failed to list products", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to list products: %v", err)
	}

	// Convert to protobuf messages
	productDetails := make([]*pb.ProductDetails, 0, len(products))
	for _, product := range products {
		productDetails = append(productDetails, convertToProductDetails(product))
	}

	s.deps.Logger.Info("ListBankingProducts request completed", "product_count", len(productDetails))
	return &pb.ListBankingProductsResponse{
		Products:      productDetails,
		NextPageToken: nextPageToken,
		TotalSize:     int32(totalSize),
	}, nil
}

// GetProductDetails retrieves details for a product
func (s *BankingAPIService) GetProductDetails(ctx context.Context, req *pb.GetProductDetailsRequest) (*pb.ProductDetails, error) {
	ctx, span := tracer.Start(ctx, "GetProductDetails", trace.WithAttributes(
		attribute.String("product_id", req.ProductId),
	))
	defer span.End()

	s.deps.Logger.Info("GetProductDetails request received", "product_id", req.ProductId)

	// Validate request
	if req.ProductId == "" {
		return nil, status.Error(codes.InvalidArgument, "product_id is required")
	}

	// Get product from data source
	product, err := s.deps.ProductDataSource.GetProductByID(ctx, req.ProductId)
	if err != nil {
		s.deps.Logger.Error("Failed to get product", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get product: %v", err)
	}

	if product == nil {
		return nil, status.Errorf(codes.NotFound, "product not found: %s", req.ProductId)
	}

	// Convert to protobuf message
	productDetails := convertToProductDetails(product)

	s.deps.Logger.Info("GetProductDetails request completed", "product_id", req.ProductId)
	return productDetails, nil
}

// CheckProductEligibility checks if a customer is eligible for a product
func (s *BankingAPIService) CheckProductEligibility(ctx context.Context, req *pb.CheckProductEligibilityRequest) (*pb.ProductEligibilityResponse, error) {
	ctx, span := tracer.Start(ctx, "CheckProductEligibility", trace.WithAttributes(
		attribute.String("customer_id", req.CustomerId),
		attribute.String("product_id", req.ProductId),
	))
	defer span.End()

	s.deps.Logger.Info("CheckProductEligibility request received", 
		"customer_id", req.CustomerId,
		"product_id", req.ProductId)

	// Validate request
	if req.CustomerId == "" {
		return nil, status.Error(codes.InvalidArgument, "customer_id is required")
	}
	if req.ProductId == "" {
		return nil, status.Error(codes.InvalidArgument, "product_id is required")
	}

	// Check if customer exists
	customer, err := s.deps.CustomerDataSource.GetCustomerByID(ctx, req.CustomerId)
	if err != nil {
		s.deps.Logger.Error("Failed to get customer", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get customer: %v", err)
	}
	if customer == nil {
		return nil, status.Errorf(codes.NotFound, "customer not found: %s", req.CustomerId)
	}

	// Check if product exists
	product, err := s.deps.ProductDataSource.GetProductByID(ctx, req.ProductId)
	if err != nil {
		s.deps.Logger.Error("Failed to get product", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get product: %v", err)
	}
	if product == nil {
		return nil, status.Errorf(codes.NotFound, "product not found: %s", req.ProductId)
	}

	// Check eligibility
	eligibility, err := s.deps.ProductDataSource.CheckProductEligibility(ctx, req.CustomerId, req.ProductId)
	if err != nil {
		s.deps.Logger.Error("Failed to check product eligibility", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to check product eligibility: %v", err)
	}

	s.deps.Logger.Info("CheckProductEligibility request completed", 
		"customer_id", req.CustomerId,
		"product_id", req.ProductId,
		"is_eligible", eligibility.IsEligible)
	
	return &pb.ProductEligibilityResponse{
		CustomerId:           req.CustomerId,
		ProductId:            req.ProductId,
		IsEligible:           eligibility.IsEligible,
		EligibilityFactors:   eligibility.EligibilityFactors,
		MissingRequirements:  eligibility.MissingRequirements,
		RecommendedLimit:     eligibility.RecommendedLimit,
		RecommendedRate:      eligibility.RecommendedRate,
		RecommendationReason: eligibility.RecommendationReason,
	}, nil
}

// ListAgents lists agents based on filter criteria
func (s *BankingAPIService) ListAgents(ctx context.Context, req *pb.ListAgentsRequest) (*pb.ListAgentsResponse, error) {
	ctx, span := tracer.Start(ctx, "ListAgents", trace.WithAttributes(
		attribute.String("territory", req.Territory),
		attribute.String("status", req.Status),
		attribute.String("agent_type", req.AgentType),
	))
	defer span.End()

	s.deps.Logger.Info("ListAgents request received", 
		"territory", req.Territory,
		"status", req.Status,
		"agent_type", req.AgentType)

	// Set default page size if not specified
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	// Get agents from data source
	agents, nextPageToken, totalSize, err := s.deps.AgentDataSource.ListAgents(
		ctx, 
		req.Territory, 
		req.Status, 
		req.AgentType, 
		int(pageSize), 
		req.PageToken,
	)
	if err != nil {
		s.deps.Logger.Error("Failed to list agents", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to list agents: %v", err)
	}

	// Convert to protobuf messages
	agentDetails := make([]*pb.AgentDetails, 0, len(agents))
	for _, agent := range agents {
		agentDetails = append(agentDetails, convertToAgentDetails(agent))
	}

	s.deps.Logger.Info("ListAgents request completed", "agent_count", len(agentDetails))
	return &pb.ListAgentsResponse{
		Agents:        agentDetails,
		NextPageToken: nextPageToken,
		TotalSize:     int32(totalSize),
	}, nil
}

// GetAgentDetails retrieves details for an agent
func (s *BankingAPIService) GetAgentDetails(ctx context.Context, req *pb.GetAgentDetailsRequest) (*pb.AgentDetails, error) {
	ctx, span := tracer.Start(ctx, "GetAgentDetails", trace.WithAttributes(
		attribute.String("agent_id", req.AgentId),
	))
	defer span.End()

	s.deps.Logger.Info("GetAgentDetails request received", "agent_id", req.AgentId)

	// Validate request
	if req.AgentId == "" {
		return nil, status.Error(codes.InvalidArgument, "agent_id is required")
	}

	// Get agent from data source
	agent, err := s.deps.AgentDataSource.GetAgentByID(ctx, req.AgentId)
	if err != nil {
		s.deps.Logger.Error("Failed to get agent", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get agent: %v", err)
	}

	if agent == nil {
		return nil, status.Errorf(codes.NotFound, "agent not found: %s", req.AgentId)
	}

	// Convert to protobuf message
	agentDetails := convertToAgentDetails(agent)

	s.deps.Logger.Info("GetAgentDetails request completed", "agent_id", req.AgentId)
	return agentDetails, nil
}

// GetAgentTransactions retrieves transactions for an agent
func (s *BankingAPIService) GetAgentTransactions(ctx context.Context, req *pb.GetAgentTransactionsRequest) (*pb.AgentTransactionsResponse, error) {
	ctx, span := tracer.Start(ctx, "GetAgentTransactions", trace.WithAttributes(
		attribute.String("agent_id", req.AgentId),
		attribute.String("transaction_type", req.TransactionType),
	))
	defer span.End()

	s.deps.Logger.Info("GetAgentTransactions request received", 
		"agent_id", req.AgentId,
		"transaction_type", req.TransactionType)

	// Validate request
	if req.AgentId == "" {
		return nil, status.Error(codes.InvalidArgument, "agent_id is required")
	}

	// Check if agent exists
	agent, err := s.deps.AgentDataSource.GetAgentByID(ctx, req.AgentId)
	if err != nil {
		s.deps.Logger.Error("Failed to get agent", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get agent: %v", err)
	}
	if agent == nil {
		return nil, status.Errorf(codes.NotFound, "agent not found: %s", req.AgentId)
	}

	// Set default page size if not specified
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	// Set default date range if not specified
	var startDate, endDate time.Time
	if req.StartDate != nil {
		startDate = req.StartDate.AsTime()
	} else {
		startDate = time.Now().AddDate(0, -1, 0) // Default to 1 month ago
	}
	if req.EndDate != nil {
		endDate = req.EndDate.AsTime()
	} else {
		endDate = time.Now() // Default to now
	}

	// Get transactions from data source
	transactions, nextPageToken, totalSize, err := s.deps.AgentDataSource.GetAgentTransactions(
		ctx, 
		req.AgentId, 
		startDate, 
		endDate, 
		req.TransactionType, 
		int(pageSize), 
		req.PageToken,
	)
	if err != nil {
		s.deps.Logger.Error("Failed to get agent transactions", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get agent transactions: %v", err)
	}

	// Convert to protobuf messages
	transactionDetails := make([]*pb.TransactionDetails, 0, len(transactions))
	for _, transaction := range transactions {
		transactionDetails = append(transactionDetails, convertToTransactionDetails(transaction))
	}

	s.deps.Logger.Info("GetAgentTransactions request completed", 
		"agent_id", req.AgentId, 
		"transaction_count", len(transactionDetails))
	
	return &pb.AgentTransactionsResponse{
		AgentId:       req.AgentId,
		Transactions:  transactionDetails,
		NextPageToken: nextPageToken,
		TotalSize:     int32(totalSize),
	}, nil
}

// GetDigitalOnboardingStatus retrieves digital onboarding status for a customer
func (s *BankingAPIService) GetDigitalOnboardingStatus(ctx context.Context, req *pb.GetDigitalOnboardingStatusRequest) (*pb.DigitalOnboardingStatus, error) {
	ctx, span := tracer.Start(ctx, "GetDigitalOnboardingStatus", trace.WithAttributes(
		attribute.String("customer_id", req.CustomerId),
	))
	defer span.End()

	s.deps.Logger.Info("GetDigitalOnboardingStatus request received", "customer_id", req.CustomerId)

	// Validate request
	if req.CustomerId == "" {
		return nil, status.Error(codes.InvalidArgument, "customer_id is required")
	}

	// Check if customer exists
	customer, err := s.deps.CustomerDataSource.GetCustomerByID(ctx, req.CustomerId)
	if err != nil {
		s.deps.Logger.Error("Failed to get customer", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get customer: %v", err)
	}
	if customer == nil {
		return nil, status.Errorf(codes.NotFound, "customer not found: %s", req.CustomerId)
	}

	// Get onboarding status from data source
	onboardingStatus, err := s.deps.NeoBankDataSource.GetDigitalOnboardingStatus(ctx, req.CustomerId)
	if err != nil {
		s.deps.Logger.Error("Failed to get digital onboarding status", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get digital onboarding status: %v", err)
	}

	if onboardingStatus == nil {
		return nil, status.Errorf(codes.NotFound, "digital onboarding status not found for customer: %s", req.CustomerId)
	}

	// Convert to protobuf message
	digitalOnboardingStatus := convertToDigitalOnboardingStatus(onboardingStatus)

	s.deps.Logger.Info("GetDigitalOnboardingStatus request completed", "customer_id", req.CustomerId)
	return digitalOnboardingStatus, nil
}

// GetAppUsageMetrics retrieves app usage metrics for a customer
func (s *BankingAPIService) GetAppUsageMetrics(ctx context.Context, req *pb.GetAppUsageMetricsRequest) (*pb.AppUsageMetrics, error) {
	ctx, span := tracer.Start(ctx, "GetAppUsageMetrics", trace.WithAttributes(
		attribute.String("customer_id", req.CustomerId),
	))
	defer span.End()

	s.deps.Logger.Info("GetAppUsageMetrics request received", "customer_id", req.CustomerId)

	// Validate request
	if req.CustomerId == "" {
		return nil, status.Error(codes.InvalidArgument, "customer_id is required")
	}

	// Check if customer exists
	customer, err := s.deps.CustomerDataSource.GetCustomerByID(ctx, req.CustomerId)
	if err != nil {
		s.deps.Logger.Error("Failed to get customer", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get customer: %v", err)
	}
	if customer == nil {
		return nil, status.Errorf(codes.NotFound, "customer not found: %s", req.CustomerId)
	}

	// Set default date range if not specified
	var startDate, endDate time.Time
	if req.StartDate != nil {
		startDate = req.StartDate.AsTime()
	} else {
		startDate = time.Now().AddDate(0, -1, 0) // Default to 1 month ago
	}
	if req.EndDate != nil {
		endDate = req.EndDate.AsTime()
	} else {
		endDate = time.Now() // Default to now
	}

	// Get app usage metrics from data source
	appUsageMetrics, err := s.deps.NeoBankDataSource.GetAppUsageMetrics(ctx, req.CustomerId, startDate, endDate)
	if err != nil {
		s.deps.Logger.Error("Failed to get app usage metrics", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get app usage metrics: %v", err)
	}

	if appUsageMetrics == nil {
		return nil, status.Errorf(codes.NotFound, "app usage metrics not found for customer: %s", req.CustomerId)
	}

	// Convert to protobuf message
	appUsageMetricsProto := convertToAppUsageMetrics(appUsageMetrics)

	s.deps.Logger.Info("GetAppUsageMetrics request completed", "customer_id", req.CustomerId)
	return appUsageMetricsProto, nil
}

// GetDigitalEngagementScore retrieves digital engagement score for a customer
func (s *BankingAPIService) GetDigitalEngagementScore(ctx context.Context, req *pb.GetDigitalEngagementScoreRequest) (*pb.DigitalEngagementScore, error) {
	ctx, span := tracer.Start(ctx, "GetDigitalEngagementScore", trace.WithAttributes(
		attribute.String("customer_id", req.CustomerId),
	))
	defer span.End()

	s.deps.Logger.Info("GetDigitalEngagementScore request received", "customer_id", req.CustomerId)

	// Validate request
	if req.CustomerId == "" {
		return nil, status.Error(codes.InvalidArgument, "customer_id is required")
	}

	// Check if customer exists
	customer, err := s.deps.CustomerDataSource.GetCustomerByID(ctx, req.CustomerId)
	if err != nil {
		s.deps.Logger.Error("Failed to get customer", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get customer: %v", err)
	}
	if customer == nil {
		return nil, status.Errorf(codes.NotFound, "customer not found: %s", req.CustomerId)
	}

	// Get digital engagement score from data source
	digitalEngagementScore, err := s.deps.NeoBankDataSource.GetDigitalEngagementScore(ctx, req.CustomerId)
	if err != nil {
		s.deps.Logger.Error("Failed to get digital engagement score", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get digital engagement score: %v", err)
	}

	if digitalEngagementScore == nil {
		return nil, status.Errorf(codes.NotFound, "digital engagement score not found for customer: %s", req.CustomerId)
	}

	// Convert to protobuf message
	digitalEngagementScoreProto := convertToDigitalEngagementScore(digitalEngagementScore)

	s.deps.Logger.Info("GetDigitalEngagementScore request completed", "customer_id", req.CustomerId)
	return digitalEngagementScoreProto, nil
}

// GetCustomerSegment retrieves customer segment for a customer
func (s *BankingAPIService) GetCustomerSegment(ctx context.Context, req *pb.GetCustomerSegmentRequest) (*pb.CustomerSegment, error) {
	ctx, span := tracer.Start(ctx, "GetCustomerSegment", trace.WithAttributes(
		attribute.String("customer_id", req.CustomerId),
	))
	defer span.End()

	s.deps.Logger.Info("GetCustomerSegment request received", "customer_id", req.CustomerId)

	// Validate request
	if req.CustomerId == "" {
		return nil, status.Error(codes.InvalidArgument, "customer_id is required")
	}

	// Check if customer exists
	customer, err := s.deps.CustomerDataSource.GetCustomerByID(ctx, req.CustomerId)
	if err != nil {
		s.deps.Logger.Error("Failed to get customer", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get customer: %v", err)
	}
	if customer == nil {
		return nil, status.Errorf(codes.NotFound, "customer not found: %s", req.CustomerId)
	}

	// Get customer segment from data source
	customerSegment, err := s.deps.CoreBankingDataSource.GetCustomerSegment(ctx, req.CustomerId)
	if err != nil {
		s.deps.Logger.Error("Failed to get customer segment", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get customer segment: %v", err)
	}

	if customerSegment == nil {
		return nil, status.Errorf(codes.NotFound, "customer segment not found for customer: %s", req.CustomerId)
	}

	// Convert to protobuf message
	customerSegmentProto := convertToCustomerSegment(customerSegment)

	s.deps.Logger.Info("GetCustomerSegment request completed", "customer_id", req.CustomerId)
	return customerSegmentProto, nil
}

// GetRiskProfile retrieves risk profile for a customer
func (s *BankingAPIService) GetRiskProfile(ctx context.Context, req *pb.GetRiskProfileRequest) (*pb.RiskProfile, error) {
	ctx, span := tracer.Start(ctx, "GetRiskProfile", trace.WithAttributes(
		attribute.String("customer_id", req.CustomerId),
	))
	defer span.End()

	s.deps.Logger.Info("GetRiskProfile request received", "customer_id", req.CustomerId)

	// Validate request
	if req.CustomerId == "" {
		return nil, status.Error(codes.InvalidArgument, "customer_id is required")
	}

	// Check if customer exists
	customer, err := s.deps.CustomerDataSource.GetCustomerByID(ctx, req.CustomerId)
	if err != nil {
		s.deps.Logger.Error("Failed to get customer", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get customer: %v", err)
	}
	if customer == nil {
		return nil, status.Errorf(codes.NotFound, "customer not found: %s", req.CustomerId)
	}

	// Get risk profile from data source
	riskProfile, err := s.deps.CoreBankingDataSource.GetRiskProfile(ctx, req.CustomerId)
	if err != nil {
		s.deps.Logger.Error("Failed to get risk profile", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get risk profile: %v", err)
	}

	if riskProfile == nil {
		return nil, status.Errorf(codes.NotFound, "risk profile not found for customer: %s", req.CustomerId)
	}

	// Convert to protobuf message
	riskProfileProto := convertToRiskProfile(riskProfile)

	s.deps.Logger.Info("GetRiskProfile request completed", "customer_id", req.CustomerId)
	return riskProfileProto, nil
}

// GetCreditScore retrieves credit score for a customer
func (s *BankingAPIService) GetCreditScore(ctx context.Context, req *pb.GetCreditScoreRequest) (*pb.CreditScore, error) {
	ctx, span := tracer.Start(ctx, "GetCreditScore", trace.WithAttributes(
		attribute.String("customer_id", req.CustomerId),
	))
	defer span.End()

	s.deps.Logger.Info("GetCreditScore request received", "customer_id", req.CustomerId)

	// Validate request
	if req.CustomerId == "" {
		return nil, status.Error(codes.InvalidArgument, "customer_id is required")
	}

	// Check if customer exists
	customer, err := s.deps.CustomerDataSource.GetCustomerByID(ctx, req.CustomerId)
	if err != nil {
		s.deps.Logger.Error("Failed to get customer", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get customer: %v", err)
	}
	if customer == nil {
		return nil, status.Errorf(codes.NotFound, "customer not found: %s", req.CustomerId)
	}

	// Get credit score from data source
	creditScore, err := s.deps.CoreBankingDataSource.GetCreditScore(ctx, req.CustomerId)
	if err != nil {
		s.deps.Logger.Error("Failed to get credit score", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get credit score: %v", err)
	}

	if creditScore == nil {
		return nil, status.Errorf(codes.NotFound, "credit score not found for customer: %s", req.CustomerId)
	}

	// Convert to protobuf message
	creditScoreProto := convertToCreditScore(creditScore)

	s.deps.Logger.Info("GetCreditScore request completed", "customer_id", req.CustomerId)
	return creditScoreProto, nil
}

// GetPaymentMethods retrieves payment methods for a customer
func (s *BankingAPIService) GetPaymentMethods(ctx context.Context, req *pb.GetPaymentMethodsRequest) (*pb.PaymentMethodsResponse, error) {
	ctx, span := tracer.Start(ctx, "GetPaymentMethods", trace.WithAttributes(
		attribute.String("customer_id", req.CustomerId),
		attribute.String("type", req.Type),
		attribute.String("status", req.Status),
	))
	defer span.End()

	s.deps.Logger.Info("GetPaymentMethods request received", 
		"customer_id", req.CustomerId,
		"type", req.Type,
		"status", req.Status)

	// Validate request
	if req.CustomerId == "" {
		return nil, status.Error(codes.InvalidArgument, "customer_id is required")
	}

	// Check if customer exists
	customer, err := s.deps.CustomerDataSource.GetCustomerByID(ctx, req.CustomerId)
	if err != nil {
		s.deps.Logger.Error("Failed to get customer", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get customer: %v", err)
	}
	if customer == nil {
		return nil, status.Errorf(codes.NotFound, "customer not found: %s", req.CustomerId)
	}

	// Get payment methods from data source
	paymentMethods, err := s.deps.PaymentDataSource.GetPaymentMethods(ctx, req.CustomerId, req.Type, req.Status)
	if err != nil {
		s.deps.Logger.Error("Failed to get payment methods", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get payment methods: %v", err)
	}

	// Convert to protobuf messages
	paymentMethodsProto := make([]*pb.PaymentMethod, 0, len(paymentMethods))
	for _, paymentMethod := range paymentMethods {
		paymentMethodsProto = append(paymentMethodsProto, convertToPaymentMethod(paymentMethod))
	}

	s.deps.Logger.Info("GetPaymentMethods request completed", 
		"customer_id", req.CustomerId, 
		"payment_method_count", len(paymentMethodsProto))
	
	return &pb.PaymentMethodsResponse{
		PaymentMethods: paymentMethodsProto,
		TotalMethods:   int32(len(paymentMethodsProto)),
	}, nil
}

// GetPaymentHistory retrieves payment history for a customer
func (s *BankingAPIService) GetPaymentHistory(ctx context.Context, req *pb.GetPaymentHistoryRequest) (*pb.PaymentHistoryResponse, error) {
	ctx, span := tracer.Start(ctx, "GetPaymentHistory", trace.WithAttributes(
		attribute.String("customer_id", req.CustomerId),
		attribute.String("payment_type", req.PaymentType),
		attribute.String("status", req.Status),
	))
	defer span.End()

	s.deps.Logger.Info("GetPaymentHistory request received", 
		"customer_id", req.CustomerId,
		"payment_type", req.PaymentType,
		"status", req.Status)

	// Validate request
	if req.CustomerId == "" {
		return nil, status.Error(codes.InvalidArgument, "customer_id is required")
	}

	// Check if customer exists
	customer, err := s.deps.CustomerDataSource.GetCustomerByID(ctx, req.CustomerId)
	if err != nil {
		s.deps.Logger.Error("Failed to get customer", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get customer: %v", err)
	}
	if customer == nil {
		return nil, status.Errorf(codes.NotFound, "customer not found: %s", req.CustomerId)
	}

	// Set default page size if not specified
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	// Set default date range if not specified
	var startDate, endDate time.Time
	if req.StartDate != nil {
		startDate = req.StartDate.AsTime()
	} else {
		startDate = time.Now().AddDate(0, -1, 0) // Default to 1 month ago
	}
	if req.EndDate != nil {
		endDate = req.EndDate.AsTime()
	} else {
		endDate = time.Now() // Default to now
	}

	// Get payment history from data source
	payments, nextPageToken, totalSize, err := s.deps.PaymentDataSource.GetPaymentHistory(
		ctx, 
		req.CustomerId, 
		startDate, 
		endDate, 
		req.PaymentType, 
		req.Status, 
		int(pageSize), 
		req.PageToken,
	)
	if err != nil {
		s.deps.Logger.Error("Failed to get payment history", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get payment history: %v", err)
	}

	// Convert to protobuf messages
	paymentTransactions := make([]*pb.PaymentTransaction, 0, len(payments))
	for _, payment := range payments {
		paymentTransactions = append(paymentTransactions, convertToPaymentTransaction(payment))
	}

	s.deps.Logger.Info("GetPaymentHistory request completed", 
		"customer_id", req.CustomerId, 
		"payment_count", len(paymentTransactions))
	
	return &pb.PaymentHistoryResponse{
		Payments:      paymentTransactions,
		NextPageToken: nextPageToken,
		TotalSize:     int32(totalSize),
	}, nil
}

// GetRecurringPayments retrieves recurring payments for a customer
func (s *BankingAPIService) GetRecurringPayments(ctx context.Context, req *pb.GetRecurringPaymentsRequest) (*pb.RecurringPaymentsResponse, error) {
	ctx, span := tracer.Start(ctx, "GetRecurringPayments", trace.WithAttributes(
		attribute.String("customer_id", req.CustomerId),
		attribute.String("status", req.Status),
		attribute.String("category", req.Category),
	))
	defer span.End()

	s.deps.Logger.Info("GetRecurringPayments request received", 
		"customer_id", req.CustomerId,
		"status", req.Status,
		"category", req.Category)

	// Validate request
	if req.CustomerId == "" {
		return nil, status.Error(codes.InvalidArgument, "customer_id is required")
	}

	// Check if customer exists
	customer, err := s.deps.CustomerDataSource.GetCustomerByID(ctx, req.CustomerId)
	if err != nil {
		s.deps.Logger.Error("Failed to get customer", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get customer: %v", err)
	}
	if customer == nil {
		return nil, status.Errorf(codes.NotFound, "customer not found: %s", req.CustomerId)
	}

	// Get recurring payments from data source
	recurringPayments, err := s.deps.PaymentDataSource.GetRecurringPayments(ctx, req.CustomerId, req.Status, req.Category)
	if err != nil {
		s.deps.Logger.Error("Failed to get recurring payments", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get recurring payments: %v", err)
	}

	// Convert to protobuf messages
	recurringPaymentsProto := make([]*pb.RecurringPayment, 0, len(recurringPayments))
	for _, recurringPayment := range recurringPayments {
		recurringPaymentsProto = append(recurringPaymentsProto, convertToRecurringPayment(recurringPayment))
	}

	s.deps.Logger.Info("GetRecurringPayments request completed", 
		"customer_id", req.CustomerId, 
		"recurring_payment_count", len(recurringPaymentsProto))
	
	return &pb.RecurringPaymentsResponse{
		RecurringPayments: recurringPaymentsProto,
		TotalPayments:     int32(len(recurringPaymentsProto)),
	}, nil
}

// SubscribeToCustomerEvents subscribes to customer events
func (s *BankingAPIService) SubscribeToCustomerEvents(req *pb.SubscribeToCustomerEventsRequest, stream pb.BankingAPI_SubscribeToCustomerEventsServer) error {
	ctx := stream.Context()
	ctx, span := tracer.Start(ctx, "SubscribeToCustomerEvents", trace.WithAttributes(
		attribute.Int("customer_count", len(req.CustomerIds)),
		attribute.Int("event_type_count", len(req.EventTypes)),
	))
	defer span.End()

	s.deps.Logger.Info("SubscribeToCustomerEvents request received", 
		"customer_count", len(req.CustomerIds),
		"event_type_count", len(req.EventTypes))

	// Validate request
	if len(req.CustomerIds) == 0 {
		return status.Error(codes.InvalidArgument, "at least one customer_id is required")
	}

	// Set default since time if not specified
	var since time.Time
	if req.Since != nil {
		since = req.Since.AsTime()
	} else {
		since = time.Now() // Default to now
	}

	// Subscribe to customer events
	eventCh, errCh, err := s.deps.EventPublisher.SubscribeToCustomerEvents(ctx, req.CustomerIds, req.EventTypes, since)
	if err != nil {
		s.deps.Logger.Error("Failed to subscribe to customer events", "error", err)
		return status.Errorf(codes.Internal, "failed to subscribe to customer events: %v", err)
	}

	// Stream events to client
	for {
		select {
		case event, ok := <-eventCh:
			if !ok {
				s.deps.Logger.Info("Customer event channel closed")
				return nil
			}

			// Convert to protobuf message
			customerEvent := convertToCustomerEvent(event)

			// Send event to client
			if err := stream.Send(customerEvent); err != nil {
				s.deps.Logger.Error("Failed to send customer event", "error", err)
				return status.Errorf(codes.Internal, "failed to send customer event: %v", err)
			}

		case err, ok := <-errCh:
			if !ok {
				s.deps.Logger.Info("Customer event error channel closed")
				return nil
			}

			s.deps.Logger.Error("Error from customer event subscription", "error", err)
			return status.Errorf(codes.Internal, "error from customer event subscription: %v", err)

		case <-ctx.Done():
			s.deps.Logger.Info("Client disconnected from customer event subscription")
			return ctx.Err()
		}
	}
}

// SubscribeToTransactionEvents subscribes to transaction events
func (s *BankingAPIService) SubscribeToTransactionEvents(req *pb.SubscribeToTransactionEventsRequest, stream pb.BankingAPI_SubscribeToTransactionEventsServer) error {
	ctx := stream.Context()
	ctx, span := tracer.Start(ctx, "SubscribeToTransactionEvents", trace.WithAttributes(
		attribute.Int("customer_count", len(req.CustomerIds)),
		attribute.Int("account_count", len(req.AccountIds)),
		attribute.Int("event_type_count", len(req.EventTypes)),
	))
	defer span.End()

	s.deps.Logger.Info("SubscribeToTransactionEvents request received", 
		"customer_count", len(req.CustomerIds),
		"account_count", len(req.AccountIds),
		"event_type_count", len(req.EventTypes))

	// Validate request
	if len(req.CustomerIds) == 0 && len(req.AccountIds) == 0 {
		return status.Error(codes.InvalidArgument, "at least one customer_id or account_id is required")
	}

	// Set default since time if not specified
	var since time.Time
	if req.Since != nil {
		since = req.Since.AsTime()
	} else {
		since = time.Now() // Default to now
	}

	// Subscribe to transaction events
	eventCh, errCh, err := s.deps.EventPublisher.SubscribeToTransactionEvents(ctx, req.CustomerIds, req.AccountIds, req.EventTypes, since)
	if err != nil {
		s.deps.Logger.Error("Failed to subscribe to transaction events", "error", err)
		return status.Errorf(codes.Internal, "failed to subscribe to transaction events: %v", err)
	}

	// Stream events to client
	for {
		select {
		case event, ok := <-eventCh:
			if !ok {
				s.deps.Logger.Info("Transaction event channel closed")
				return nil
			}

			// Convert to protobuf message
			transactionEvent := convertToTransactionEvent(event)

			// Send event to client
			if err := stream.Send(transactionEvent); err != nil {
				s.deps.Logger.Error("Failed to send transaction event", "error", err)
				return status.Errorf(codes.Internal, "failed to send transaction event: %v", err)
			}

		case err, ok := <-errCh:
			if !ok {
				s.deps.Logger.Info("Transaction event error channel closed")
				return nil
			}

			s.deps.Logger.Error("Error from transaction event subscription", "error", err)
			return status.Errorf(codes.Internal, "error from transaction event subscription: %v", err)

		case <-ctx.Done():
			s.deps.Logger.Info("Client disconnected from transaction event subscription")
			return ctx.Err()
		}
	}
}

// SubscribeToAccountEvents subscribes to account events
func (s *BankingAPIService) SubscribeToAccountEvents(req *pb.SubscribeToAccountEventsRequest, stream pb.BankingAPI_SubscribeToAccountEventsServer) error {
	ctx := stream.Context()
	ctx, span := tracer.Start(ctx, "SubscribeToAccountEvents", trace.WithAttributes(
		attribute.Int("customer_count", len(req.CustomerIds)),
		attribute.Int("account_count", len(req.AccountIds)),
		attribute.Int("event_type_count", len(req.EventTypes)),
	))
	defer span.End()

	s.deps.Logger.Info("SubscribeToAccountEvents request received", 
		"customer_count", len(req.CustomerIds),
		"account_count", len(req.AccountIds),
		"event_type_count", len(req.EventTypes))

	// Validate request
	if len(req.CustomerIds) == 0 && len(req.AccountIds) == 0 {
		return status.Error(codes.InvalidArgument, "at least one customer_id or account_id is required")
	}

	// Set default since time if not specified
	var since time.Time
	if req.Since != nil {
		since = req.Since.AsTime()
	} else {
		since = time.Now() // Default to now
	}

	// Subscribe to account events
	eventCh, errCh, err := s.deps.EventPublisher.SubscribeToAccountEvents(ctx, req.CustomerIds, req.AccountIds, req.EventTypes, since)
	if err != nil {
		s.deps.Logger.Error("Failed to subscribe to account events", "error", err)
		return status.Errorf(codes.Internal, "failed to subscribe to account events: %v", err)
	}

	// Stream events to client
	for {
		select {
		case event, ok := <-eventCh:
			if !ok {
				s.deps.Logger.Info("Account event channel closed")
				return nil
			}

			// Convert to protobuf message
			accountEvent := convertToAccountEvent(event)

			// Send event to client
			if err := stream.Send(accountEvent); err != nil {
				s.deps.Logger.Error("Failed to send account event", "error", err)
				return status.Errorf(codes.Internal, "failed to send account event: %v", err)
			}

		case err, ok := <-errCh:
			if !ok {
				s.deps.Logger.Info("Account event error channel closed")
				return nil
			}

			s.deps.Logger.Error("Error from account event subscription", "error", err)
			return status.Errorf(codes.Internal, "error from account event subscription: %v", err)

		case <-ctx.Done():
			s.deps.Logger.Info("Client disconnected from account event subscription")
			return ctx.Err()
		}
	}
}

// Helper functions for converting between domain models and protobuf messages
// These would be implemented based on the actual domain models

func convertToCustomerProfile(customer *models.Customer) *pb.CustomerProfile {
	if customer == nil {
		return nil
	}

	// Implementation would convert from domain model to protobuf message
	// This is a simplified example
	return &pb.CustomerProfile{
		CustomerId:        customer.ID,
		FirstName:         customer.FirstName,
		LastName:          customer.LastName,
		MiddleName:        customer.MiddleName,
		Email:             customer.Email,
		PhoneNumber:       customer.PhoneNumber,
		Bvn:               customer.BVN,
		Nin:               customer.NIN,
		DateOfBirth:       timestamppb.New(customer.DateOfBirth),
		Gender:            customer.Gender,
		Address:           convertToAddress(customer.Address),
		Nationality:       customer.Nationality,
		Occupation:        customer.Occupation,
		Employer:          customer.Employer,
		MaritalStatus:     customer.MaritalStatus,
		EducationLevel:    customer.EducationLevel,
		IncomeBracket:     customer.IncomeBracket,
		CustomerSince:     timestamppb.New(customer.CustomerSince),
		KycLevel:          customer.KYCLevel,
		KycStatus:         customer.KYCStatus,
		CustomerType:      customer.CustomerType,
		CustomerStatus:    customer.CustomerStatus,
		PreferredLanguage: customer.PreferredLanguage,
		PreferredChannels: customer.PreferredChannels,
		CustomAttributes:  customer.CustomAttributes,
		// CrmData is set separately
	}
}

func convertToAddress(address *models.Address) *pb.Address {
	if address == nil {
		return nil
	}

	return &pb.Address{
		Street:          address.Street,
		City:            address.City,
		State:           address.State,
		PostalCode:      address.PostalCode,
		Country:         address.Country,
		AddressType:     address.AddressType,
		IsVerified:      address.IsVerified,
		VerificationDate: timestamppb.New(address.VerificationDate),
		Latitude:        address.Latitude,
		Longitude:       address.Longitude,
	}
}

func convertToCRMData(crmData *models.CRMData) *pb.CRMData {
	if crmData == nil {
		return nil
	}

	return &pb.CRMData{
		CrmCustomerId:      crmData.CRMCustomerID,
		Segment:            crmData.Segment,
		LifetimeValue:      crmData.LifetimeValue,
		ChurnRiskScore:     crmData.ChurnRiskScore,
		NextBestOffer:      crmData.NextBestOffer,
		Tags:               crmData.Tags,
		LastInteraction:    timestamppb.New(crmData.LastInteraction),
		LeadSource:         crmData.LeadSource,
		AcquisitionChannel: crmData.AcquisitionChannel,
		CustomAttributes:   crmData.CustomAttributes,
	}
}

func convertFromCRMData(crmData *pb.CRMData) *models.CRMData {
	if crmData == nil {
		return nil
	}

	result := &models.CRMData{
		CRMCustomerID:      crmData.CrmCustomerId,
		Segment:            crmData.Segment,
		LifetimeValue:      crmData.LifetimeValue,
		ChurnRiskScore:     crmData.ChurnRiskScore,
		NextBestOffer:      crmData.NextBestOffer,
		Tags:               crmData.Tags,
		LeadSource:         crmData.LeadSource,
		AcquisitionChannel: crmData.AcquisitionChannel,
		CustomAttributes:   crmData.CustomAttributes,
	}

	if crmData.LastInteraction != nil {
		result.LastInteraction = crmData.LastInteraction.AsTime()
	}

	return result
}

func convertToAccountDetails(account *models.Account) *pb.AccountDetails {
	if account == nil {
		return nil
	}

	return &pb.AccountDetails{
		AccountId:          account.ID,
		AccountNumber:      account.AccountNumber,
		CustomerId:         account.CustomerID,
		AccountName:        account.AccountName,
		AccountType:        account.AccountType,
		Currency:           account.Currency,
		CurrentBalance:     account.CurrentBalance,
		AvailableBalance:   account.AvailableBalance,
		Status:             account.Status,
		OpenedDate:         timestamppb.New(account.OpenedDate),
		LastTransactionDate: timestamppb.New(account.LastTransactionDate),
		BranchCode:         account.BranchCode,
		OverdraftEnabled:   account.OverdraftEnabled,
		OverdraftLimit:     account.OverdraftLimit,
		InterestRate:       account.InterestRate,
		Tier:               account.Tier,
		LinkedCards:        account.LinkedCards,
		CustomAttributes:   account.CustomAttributes,
	}
}

func convertToTransactionDetails(transaction *models.Transaction) *pb.TransactionDetails {
	if transaction == nil {
		return nil
	}

	return &pb.TransactionDetails{
		TransactionId:    transaction.ID,
		ReferenceNumber:  transaction.ReferenceNumber,
		CustomerId:       transaction.CustomerID,
		AccountId:        transaction.AccountID,
		TransactionType:  transaction.TransactionType,
		Channel:          transaction.Channel,
		Amount:           transaction.Amount,
		Currency:         transaction.Currency,
		Fee:              transaction.Fee,
		Status:           transaction.Status,
		Description:      transaction.Description,
		TransactionDate:  timestamppb.New(transaction.TransactionDate),
		Category:         transaction.Category,
		MerchantName:     transaction.MerchantName,
		MerchantCategory: transaction.MerchantCategory,
		Location:         transaction.Location,
		IsInternational:  transaction.IsInternational,
		DeviceId:         transaction.DeviceID,
		IpAddress:        transaction.IPAddress,
		IsSuspicious:     transaction.IsSuspicious,
		FraudScore:       transaction.FraudScore,
		CustomAttributes: transaction.CustomAttributes,
	}
}

func convertToProductDetails(product *models.Product) *pb.ProductDetails {
	if product == nil {
		return nil
	}

	return &pb.ProductDetails{
		ProductId:        product.ID,
		ProductName:      product.ProductName,
		ProductType:      product.ProductType,
		ProductCategory:  product.ProductCategory,
		Description:      product.Description,
		InterestRate:     product.InterestRate,
		MinimumBalance:   product.MinimumBalance,
		MaximumBalance:   product.MaximumBalance,
		MaintenanceFee:   product.MaintenanceFee,
		FeeFrequency:     product.FeeFrequency,
		Features:         product.Features,
		Benefits:         product.Benefits,
		Requirements:     product.Requirements,
		TargetSegments:   product.TargetSegments,
		IsActive:         product.IsActive,
		LaunchDate:       timestamppb.New(product.LaunchDate),
		ExpiryDate:       timestamppb.New(product.ExpiryDate),
		CustomAttributes: product.CustomAttributes,
	}
}

func convertToAgentDetails(agent *models.Agent) *pb.AgentDetails {
	if agent == nil {
		return nil
	}

	return &pb.AgentDetails{
		AgentId:           agent.ID,
		AgentName:         agent.AgentName,
		BusinessName:      agent.BusinessName,
		AgentType:         agent.AgentType,
		Status:            agent.Status,
		Location:          convertToAddress(agent.Location),
		PhoneNumber:       agent.PhoneNumber,
		Email:             agent.Email,
		OnboardingDate:    timestamppb.New(agent.OnboardingDate),
		ServicesOffered:   agent.ServicesOffered,
		Territory:         agent.Territory,
		SupervisorId:      agent.SupervisorID,
		FloatBalance:      agent.FloatBalance,
		CommissionRate:    agent.CommissionRate,
		TransactionCount:  int32(agent.TransactionCount),
		TransactionVolume: agent.TransactionVolume,
		CustomerCount:     int32(agent.CustomerCount),
		PerformanceScore:  agent.PerformanceScore,
		CustomAttributes:  agent.CustomAttributes,
	}
}

func convertToDigitalOnboardingStatus(status *models.DigitalOnboardingStatus) *pb.DigitalOnboardingStatus {
	if status == nil {
		return nil
	}

	steps := make([]*pb.OnboardingStep, 0, len(status.Steps))
	for _, step := range status.Steps {
		steps = append(steps, &pb.OnboardingStep{
			StepName:        step.StepName,
			Status:          step.Status,
			StartTime:       timestamppb.New(step.StartTime),
			CompletionTime:  timestamppb.New(step.CompletionTime),
			Attempts:        int32(step.Attempts),
			FailureReason:   step.FailureReason,
		})
	}

	return &pb.DigitalOnboardingStatus{
		CustomerId:      status.CustomerID,
		Status:          status.Status,
		StartDate:       timestamppb.New(status.StartDate),
		CompletionDate:  timestamppb.New(status.CompletionDate),
		Steps:           steps,
		DeviceType:      status.DeviceType,
		DeviceId:        status.DeviceID,
		IpAddress:       status.IPAddress,
		ReferralCode:    status.ReferralCode,
		UtmSource:       status.UTMSource,
		UtmMedium:       status.UTMMedium,
		UtmCampaign:     status.UTMCampaign,
		TimeTakenSeconds: int32(status.TimeTakenSeconds),
		CustomAttributes: status.CustomAttributes,
	}
}

func convertToAppUsageMetrics(metrics *models.AppUsageMetrics) *pb.AppUsageMetrics {
	if metrics == nil {
		return nil
	}

	featureUsage := make([]*pb.FeatureUsage, 0, len(metrics.FeatureUsage))
	for _, usage := range metrics.FeatureUsage {
		featureUsage = append(featureUsage, &pb.FeatureUsage{
			FeatureName:      usage.FeatureName,
			UsageCount:       int32(usage.UsageCount),
			LastUsed:         timestamppb.New(usage.LastUsed),
			AverageTimeSpent: usage.AverageTimeSpent,
		})
	}

	return &pb.AppUsageMetrics{
		CustomerId:            metrics.CustomerID,
		LoginCount:            int32(metrics.LoginCount),
		LastLogin:             timestamppb.New(metrics.LastLogin),
		SessionCount:          int32(metrics.SessionCount),
		AverageSessionDuration: metrics.AverageSessionDuration,
		FeatureUsage:          featureUsage,
		TransactionCount:      int32(metrics.TransactionCount),
		TransactionVolume:     metrics.TransactionVolume,
		MostUsedFeature:       metrics.MostUsedFeature,
		LeastUsedFeature:      metrics.LeastUsedFeature,
		DeviceType:            metrics.DeviceType,
		AppVersion:            metrics.AppVersion,
		OsVersion:             metrics.OSVersion,
		CustomAttributes:      metrics.CustomAttributes,
	}
}

func convertToDigitalEngagementScore(score *models.DigitalEngagementScore) *pb.DigitalEngagementScore {
	if score == nil {
		return nil
	}

	insights := make([]*pb.EngagementInsight, 0, len(score.Insights))
	for _, insight := range score.Insights {
		insights = append(insights, &pb.EngagementInsight{
			InsightType:   insight.InsightType,
			Description:   insight.Description,
			ImpactScore:   insight.ImpactScore,
			Recommendation: insight.Recommendation,
		})
	}

	return &pb.DigitalEngagementScore{
		CustomerId:             score.CustomerID,
		OverallScore:           score.OverallScore,
		LoginFrequencyScore:    score.LoginFrequencyScore,
		FeatureUsageScore:      score.FeatureUsageScore,
		TransactionActivityScore: score.TransactionActivityScore,
		ProductAdoptionScore:   score.ProductAdoptionScore,
		EngagementLevel:        score.EngagementLevel,
		Insights:               insights,
		CustomAttributes:       score.CustomAttributes,
	}
}

func convertToCustomerSegment(segment *models.CustomerSegment) *pb.CustomerSegment {
	if segment == nil {
		return nil
	}

	return &pb.CustomerSegment{
		CustomerId:          segment.CustomerID,
		SegmentName:         segment.SegmentName,
		SegmentDescription:  segment.SegmentDescription,
		AssignmentDate:      timestamppb.New(segment.AssignmentDate),
		SegmentCriteria:     segment.SegmentCriteria,
		SegmentScore:        segment.SegmentScore,
		PreviousSegment:     segment.PreviousSegment,
		NextReviewDate:      timestamppb.New(segment.NextReviewDate),
		RecommendedProducts: segment.RecommendedProducts,
		SpecialOffers:       segment.SpecialOffers,
		CustomAttributes:    segment.CustomAttributes,
	}
}

func convertToRiskProfile(profile *models.RiskProfile) *pb.RiskProfile {
	if profile == nil {
		return nil
	}

	riskFactors := make([]*pb.RiskFactor, 0, len(profile.RiskFactors))
	for _, factor := range profile.RiskFactors {
		riskFactors = append(riskFactors, &pb.RiskFactor{
			FactorName:  factor.FactorName,
			Category:    factor.Category,
			Score:       factor.Score,
			Description: factor.Description,
			Mitigation:  factor.Mitigation,
		})
	}

	return &pb.RiskProfile{
		CustomerId:          profile.CustomerID,
		RiskLevel:           profile.RiskLevel,
		RiskScore:           profile.RiskScore,
		AssessmentDate:      timestamppb.New(profile.AssessmentDate),
		RiskFactors:         riskFactors,
		AmlStatus:           profile.AMLStatus,
		PepStatus:           profile.PEPStatus,
		SanctionListStatus:  profile.SanctionListStatus,
		KycVerificationLevel: profile.KYCVerificationLevel,
		NextReviewDate:      timestamppb.New(profile.NextReviewDate),
		CustomAttributes:    profile.CustomAttributes,
	}
}

func convertToCreditScore(score *models.CreditScore) *pb.CreditScore {
	if score == nil {
		return nil
	}

	factors := make([]*pb.CreditFactor, 0, len(score.Factors))
	for _, factor := range score.Factors {
		factors = append(factors, &pb.CreditFactor{
			FactorName:    factor.FactorName,
			Impact:        factor.Impact,
			ScoreImpact:   int32(factor.ScoreImpact),
			Description:   factor.Description,
			Recommendation: factor.Recommendation,
		})
	}

	return &pb.CreditScore{
		CustomerId:             score.CustomerID,
		Score:                  int32(score.Score),
		Rating:                 score.Rating,
		AssessmentDate:         timestamppb.New(score.AssessmentDate),
		Factors:                factors,
		DebtToIncomeRatio:      score.DebtToIncomeRatio,
		PaymentHistoryScore:    int32(score.PaymentHistoryScore),
		CreditUtilizationScore: int32(score.CreditUtilizationScore),
		CreditHistoryLengthScore: int32(score.CreditHistoryLengthScore),
		RecentInquiriesScore:   int32(score.RecentInquiriesScore),
		NextUpdateDate:         timestamppb.New(score.NextUpdateDate),
		CustomAttributes:       score.CustomAttributes,
	}
}

func convertToPaymentMethod(method *models.PaymentMethod) *pb.PaymentMethod {
	if method == nil {
		return nil
	}

	return &pb.PaymentMethod{
		PaymentMethodId: method.ID,
		CustomerId:      method.CustomerID,
		Type:            method.Type,
		Status:          method.Status,
		Name:            method.Name,
		MaskedNumber:    method.MaskedNumber,
		ExpiryDate:      timestamppb.New(method.ExpiryDate),
		IsDefault:       method.IsDefault,
		AddedDate:       timestamppb.New(method.AddedDate),
		Provider:        method.Provider,
		CardType:        method.CardType,
		CustomAttributes: method.CustomAttributes,
	}
}

func convertToPaymentTransaction(payment *models.PaymentTransaction) *pb.PaymentTransaction {
	if payment == nil {
		return nil
	}

	return &pb.PaymentTransaction{
		PaymentId:        payment.ID,
		CustomerId:       payment.CustomerID,
		PaymentMethodId:  payment.PaymentMethodID,
		TransactionId:    payment.TransactionID,
		Amount:           payment.Amount,
		Currency:         payment.Currency,
		Status:           payment.Status,
		PaymentType:      payment.PaymentType,
		MerchantName:     payment.MerchantName,
		MerchantCategory: payment.MerchantCategory,
		TransactionDate:  timestamppb.New(payment.TransactionDate),
		ReferenceNumber:  payment.ReferenceNumber,
		Description:      payment.Description,
		Fee:              payment.Fee,
		Channel:          payment.Channel,
		Location:         payment.Location,
		IsInternational:  payment.IsInternational,
		DeviceId:         payment.DeviceID,
		IpAddress:        payment.IPAddress,
		CustomAttributes: payment.CustomAttributes,
	}
}

func convertToRecurringPayment(payment *models.RecurringPayment) *pb.RecurringPayment {
	if payment == nil {
		return nil
	}

	return &pb.RecurringPayment{
		RecurringPaymentId: payment.ID,
		CustomerId:         payment.CustomerID,
		PaymentMethodId:    payment.PaymentMethodID,
		Name:               payment.Name,
		Amount:             payment.Amount,
		Currency:           payment.Currency,
		Frequency:          payment.Frequency,
		NextPaymentDate:    timestamppb.New(payment.NextPaymentDate),
		StartDate:          timestamppb.New(payment.StartDate),
		EndDate:            timestamppb.New(payment.EndDate),
		Status:             payment.Status,
		Category:           payment.Category,
		BeneficiaryName:    payment.BeneficiaryName,
		BeneficiaryAccount: payment.BeneficiaryAccount,
		PaymentsCompleted:  int32(payment.PaymentsCompleted),
		PaymentsFailed:     int32(payment.PaymentsFailed),
		CustomAttributes:   payment.CustomAttributes,
	}
}

func convertToCustomerEvent(event *models.CustomerEvent) *pb.CustomerEvent {
	if event == nil {
		return nil
	}

	return &pb.CustomerEvent{
		EventId:      event.EventID,
		CustomerId:   event.CustomerID,
		EventType:    event.EventType,
		EventTime:    timestamppb.New(event.EventTime),
		CustomerData: convertToCustomerProfile(event.CustomerData),
		Metadata:     event.Metadata,
	}
}

func convertToTransactionEvent(event *models.TransactionEvent) *pb.TransactionEvent {
	if event == nil {
		return nil
	}

	return &pb.TransactionEvent{
		EventId:         event.EventID,
		TransactionId:   event.TransactionID,
		CustomerId:      event.CustomerID,
		AccountId:       event.AccountID,
		EventType:       event.EventType,
		EventTime:       timestamppb.New(event.EventTime),
		TransactionData: convertToTransactionDetails(event.TransactionData),
		Metadata:        event.Metadata,
	}
}

func convertToAccountEvent(event *models.AccountEvent) *pb.AccountEvent {
	if event == nil {
		return nil
	}

	return &pb.AccountEvent{
		EventId:     event.EventID,
		AccountId:   event.AccountID,
		CustomerId:  event.CustomerID,
		EventType:   event.EventType,
		EventTime:   timestamppb.New(event.EventTime),
		AccountData: convertToAccountDetails(event.AccountData),
		Metadata:    event.Metadata,
	}
}

// Helper function to generate UUID
func generateUUID() string {
	// In a real implementation, this would use a proper UUID library
	return fmt.Sprintf("%d", time.Now().UnixNano())

