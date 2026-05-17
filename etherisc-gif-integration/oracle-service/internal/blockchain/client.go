package blockchain

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// Client represents a blockchain client for oracle interactions
type Client struct {
	ethClient      *ethclient.Client
	privateKey     *ecdsa.PrivateKey
	publicKey      *ecdsa.PublicKey
	address        common.Address
	chainID        *big.Int
	oracleAddress  common.Address
	productAddress common.Address
}

// Config represents blockchain client configuration
type Config struct {
	RPCURL         string
	PrivateKey     string
	OracleAddress  string
	ProductAddress string
}

// NewClient creates a new blockchain client
func NewClient(cfg *Config) (*Client, error) {
	// Connect to Ethereum node
	ethClient, err := ethclient.Dial(cfg.RPCURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Ethereum node: %w", err)
	}

	// Get chain ID
	chainID, err := ethClient.ChainID(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to get chain ID: %w", err)
	}

	// Parse private key
	privateKey, err := crypto.HexToECDSA(cfg.PrivateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to parse private key: %w", err)
	}

	// Get public key and address
	publicKey := privateKey.Public()
	publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("failed to cast public key to ECDSA")
	}

	address := crypto.PubkeyToAddress(*publicKeyECDSA)

	// Parse oracle address
	oracleAddress := common.HexToAddress(cfg.OracleAddress)

	// Parse product address
	productAddress := common.HexToAddress(cfg.ProductAddress)

	return &Client{
		ethClient:      ethClient,
		privateKey:     privateKey,
		publicKey:      publicKeyECDSA,
		address:        address,
		chainID:        chainID,
		oracleAddress:  oracleAddress,
		productAddress: productAddress,
	}, nil
}

// GetTransactor creates a transactor for signing transactions
func (c *Client) GetTransactor(ctx context.Context) (*bind.TransactOpts, error) {
	nonce, err := c.ethClient.PendingNonceAt(ctx, c.address)
	if err != nil {
		return nil, fmt.Errorf("failed to get nonce: %w", err)
	}

	gasPrice, err := c.ethClient.SuggestGasPrice(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get gas price: %w", err)
	}

	auth, err := bind.NewKeyedTransactorWithChainID(c.privateKey, c.chainID)
	if err != nil {
		return nil, fmt.Errorf("failed to create transactor: %w", err)
	}

	auth.Nonce = big.NewInt(int64(nonce))
	auth.Value = big.NewInt(0)
	auth.GasLimit = uint64(300000)
	auth.GasPrice = gasPrice

	return auth, nil
}

// SubmitFlightData submits flight data to the oracle contract
func (c *Client) SubmitFlightData(
	ctx context.Context,
	flightNumber string,
	scheduledDepartureTime uint64,
	actualDepartureTime uint64,
	departureAirport string,
	arrivalAirport string,
	status string,
) (string, error) {
	// Get transactor
	auth, err := c.GetTransactor(ctx)
	if err != nil {
		return "", err
	}

	// Encode flight data
	data := encodeFlightData(
		flightNumber,
		scheduledDepartureTime,
		actualDepartureTime,
		departureAirport,
		arrivalAirport,
		status,
	)

	// Submit data to oracle contract
	// Note: This would use the actual contract binding
	// For now, we'll simulate the transaction
	tx := fmt.Sprintf("0x%x", crypto.Keccak256([]byte(fmt.Sprintf(
		"%s-%d-%d-%s-%s-%s",
		flightNumber,
		scheduledDepartureTime,
		actualDepartureTime,
		departureAirport,
		arrivalAirport,
		status,
	))))

	// In production, this would be:
	// oracle, err := NewFlightOracle(c.oracleAddress, c.ethClient)
	// tx, err := oracle.SubmitData(auth, data)
	// return tx.Hash().Hex(), err

	return tx, nil
}

// TriggerClaim triggers a claim on the product contract
func (c *Client) TriggerClaim(
	ctx context.Context,
	policyID [32]byte,
	actualDepartureTime uint64,
	delayMinutes uint64,
) (string, error) {
	// Get transactor
	auth, err := c.GetTransactor(ctx)
	if err != nil {
		return "", err
	}

	// Encode claim data
	claimData := encodeClaimData(actualDepartureTime, delayMinutes)

	// Trigger claim on product contract
	// Note: This would use the actual contract binding
	// For now, we'll simulate the transaction
	tx := fmt.Sprintf("0x%x", crypto.Keccak256([]byte(fmt.Sprintf(
		"%x-%d-%d",
		policyID,
		actualDepartureTime,
		delayMinutes,
	))))

	// In production, this would be:
	// product, err := NewFlightDelayProduct(c.productAddress, c.ethClient)
	// tx, err := product.TriggerClaim(auth, policyID, claimData)
	// return tx.Hash().Hex(), err

	return tx, nil
}

// GetBalance gets the account balance
func (c *Client) GetBalance(ctx context.Context) (*big.Int, error) {
	balance, err := c.ethClient.BalanceAt(ctx, c.address, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get balance: %w", err)
	}
	return balance, nil
}

// Close closes the blockchain client
func (c *Client) Close() {
	c.ethClient.Close()
}

// Helper functions

func encodeFlightData(
	flightNumber string,
	scheduledDepartureTime uint64,
	actualDepartureTime uint64,
	departureAirport string,
	arrivalAirport string,
	status string,
) []byte {
	// In production, this would use ABI encoding
	// For now, we'll use a simple concatenation
	data := fmt.Sprintf("%s|%d|%d|%s|%s|%s",
		flightNumber,
		scheduledDepartureTime,
		actualDepartureTime,
		departureAirport,
		arrivalAirport,
		status,
	)
	return []byte(data)
}

func encodeClaimData(actualDepartureTime uint64, delayMinutes uint64) []byte {
	// In production, this would use ABI encoding
	// For now, we'll use a simple concatenation
	data := fmt.Sprintf("%d|%d", actualDepartureTime, delayMinutes)
	return []byte(data)
}
