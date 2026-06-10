// Package ledger provides gRPC service definitions for the ledger service
package ledger

import (
	"context"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// UnimplementedLedgerServiceServer must be embedded to have forward compatible implementations
type UnimplementedLedgerServiceServer struct{}

// LedgerServiceServer is the server API for LedgerService
type LedgerServiceServer interface {
	CreateAccount(context.Context, *CreateAccountRequest) (*CreateAccountResponse, error)
	CreateAccounts(context.Context, *CreateAccountsRequest) (*CreateAccountsResponse, error)
	CreateTransfer(context.Context, *CreateTransferRequest) (*CreateTransferResponse, error)
	CreateTransfers(context.Context, *CreateTransfersRequest) (*CreateTransfersResponse, error)
	GetAccountBalance(context.Context, *GetAccountBalanceRequest) (*GetAccountBalanceResponse, error)
	GetAccountBalances(context.Context, *GetAccountBalancesRequest) (*GetAccountBalancesResponse, error)
	SyncBalanceToPostgres(context.Context, *SyncBalanceRequest) (*SyncBalanceResponse, error)
	mustEmbedUnimplementedLedgerServiceServer()
}

func (UnimplementedLedgerServiceServer) CreateAccount(context.Context, *CreateAccountRequest) (*CreateAccountResponse, error) {
	return nil, nil
}
func (UnimplementedLedgerServiceServer) CreateAccounts(context.Context, *CreateAccountsRequest) (*CreateAccountsResponse, error) {
	return nil, nil
}
func (UnimplementedLedgerServiceServer) CreateTransfer(context.Context, *CreateTransferRequest) (*CreateTransferResponse, error) {
	return nil, nil
}
func (UnimplementedLedgerServiceServer) CreateTransfers(context.Context, *CreateTransfersRequest) (*CreateTransfersResponse, error) {
	return nil, nil
}
func (UnimplementedLedgerServiceServer) GetAccountBalance(context.Context, *GetAccountBalanceRequest) (*GetAccountBalanceResponse, error) {
	return nil, nil
}
func (UnimplementedLedgerServiceServer) GetAccountBalances(context.Context, *GetAccountBalancesRequest) (*GetAccountBalancesResponse, error) {
	return nil, nil
}
func (UnimplementedLedgerServiceServer) SyncBalanceToPostgres(context.Context, *SyncBalanceRequest) (*SyncBalanceResponse, error) {
	return nil, nil
}
func (UnimplementedLedgerServiceServer) mustEmbedUnimplementedLedgerServiceServer() {}

// Account represents a ledger account
type Account struct {
	AccountId     string
	ParticipantId string
	Ledger        uint32
	Code          uint32
	Flags         uint32
}

// Transfer represents a ledger transfer
type Transfer struct {
	TransferId      string
	TransactionId   string
	DebitAccountId  string
	CreditAccountId string
	Amount          string
	Ledger          uint32
	Code            uint32
	Flags           uint32
}

// Balance represents an account balance
type Balance struct {
	AccountId        string
	AvailableBalance string
	PendingBalance   string
	TotalBalance     string
	LastUpdated      *timestamppb.Timestamp
}

// CreateAccountRequest is the request for CreateAccount
type CreateAccountRequest struct {
	Account *Account
}

// CreateAccountResponse is the response for CreateAccount
type CreateAccountResponse struct {
	Success              bool
	Message              string
	TigerbeetleAccountId string
}

// CreateAccountsRequest is the request for CreateAccounts
type CreateAccountsRequest struct {
	Accounts []*Account
}

// CreateAccountsResponse is the response for CreateAccounts
type CreateAccountsResponse struct {
	Success      bool
	Message      string
	CreatedCount int32
}

// CreateTransferRequest is the request for CreateTransfer
type CreateTransferRequest struct {
	Transfer *Transfer
}

// CreateTransferResponse is the response for CreateTransfer
type CreateTransferResponse struct {
	Success               bool
	Message               string
	TigerbeetleTransferId string
	CompletedAt           *timestamppb.Timestamp
}

// CreateTransfersRequest is the request for CreateTransfers
type CreateTransfersRequest struct {
	Transfers []*Transfer
}

// CreateTransfersResponse is the response for CreateTransfers
type CreateTransfersResponse struct {
	Success      bool
	Message      string
	CreatedCount int32
}

// GetAccountBalanceRequest is the request for GetAccountBalance
type GetAccountBalanceRequest struct {
	AccountId string
}

// GetAccountBalanceResponse is the response for GetAccountBalance
type GetAccountBalanceResponse struct {
	Success bool
	Message string
	Balance *Balance
}

// GetAccountBalancesRequest is the request for GetAccountBalances
type GetAccountBalancesRequest struct {
	AccountIds []string
}

// GetAccountBalancesResponse is the response for GetAccountBalances
type GetAccountBalancesResponse struct {
	Success  bool
	Message  string
	Balances []*Balance
}

// SyncBalanceRequest is the request for SyncBalanceToPostgres
type SyncBalanceRequest struct {
	AccountId     string
	ParticipantId string
	Currency      string
}

// SyncBalanceResponse is the response for SyncBalanceToPostgres
type SyncBalanceResponse struct {
	Success bool
	Message string
}

// ServiceRegistrar abstracts gRPC server registration (matches grpc.ServiceRegistrar)
type ServiceRegistrar interface {
	RegisterService(desc *ServiceDesc, impl interface{})
}

// ServiceDesc describes a gRPC service (matches grpc.ServiceDesc)
type ServiceDesc struct {
	ServiceName string
	HandlerType interface{}
}

// LedgerServiceDesc is the gRPC service descriptor for LedgerService
var LedgerServiceDesc = ServiceDesc{
	ServiceName: "ledger.LedgerService",
	HandlerType: (*LedgerServiceServer)(nil),
}

// RegisterLedgerServiceServer registers the LedgerServiceServer with a gRPC server
func RegisterLedgerServiceServer(s interface{}, srv LedgerServiceServer) {
	if registrar, ok := s.(ServiceRegistrar); ok {
		registrar.RegisterService(&LedgerServiceDesc, srv)
	}
}
