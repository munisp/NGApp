package activity

import (
	"context"
	"errors"
	"time"

	"go.temporal.io/sdk/activity"
	"go.uber.org/zap"
	"payment_service/adapter"
	"payment_service/domain"
	"payment_service/service"
)

// Activities struct holds dependencies for all activities.
type Activities struct {
	Repo            *service.MockPaymentRepository // Using mock repo for simplicity
	FiatGateway     adapter.FiatGateway
	CryptoExchange  adapter.CryptoExchange
	WalletManager   adapter.WalletManager
	PolicyService   adapter.PolicyService
	Logger          *zap.Logger
}

// InitiateFiatPaymentActivity initiates the fiat payment process.
func (a *Activities) InitiateFiatPaymentActivity(ctx context.Context, paymentID string, amount float64, currency string) (map[string]string, error) {
	log := activity.GetLogger(ctx)
	log.Info("Initiating fiat payment", zap.String("payment_id", paymentID))

	// 1. Call Fiat Gateway
	reference, paymentURL, err := a.FiatGateway.InitiatePayment(ctx, amount, currency)
	if err != nil {
		log.Error("FiatGateway.InitiatePayment failed", zap.Error(err))
		return nil, err
	}

	// 2. Update Payment Status
	payment, err := a.Repo.GetPaymentByID(ctx, paymentID)
	if err != nil {
		return nil, err
	}
	payment.Status = domain.PaymentStatusPendingFiat
	payment.WorkflowRunID = activity.GetInfo(ctx).WorkflowExecution.RunID // Store run ID for signaling
	if err := a.Repo.SavePayment(ctx, payment); err != nil {
		return nil, err
	}

	return map[string]string{
		"Reference":  reference,
		"PaymentURL": paymentURL,
	}, nil
}

// PurchaseCryptoActivity handles the fiat-to-crypto conversion.
func (a *Activities) PurchaseCryptoActivity(ctx context.Context, paymentID string, fiatAmount float64, fiatCurrency string, cryptoCurrency string) (map[string]interface{}, error) {
	log := activity.GetLogger(ctx)
	log.Info("Purchasing crypto", zap.String("payment_id", paymentID))

	// 1. Call Crypto Exchange
	cryptoAmount, exchangeTxID, err := a.CryptoExchange.BuyCrypto(ctx, fiatAmount, fiatCurrency, cryptoCurrency)
	if err != nil {
		log.Error("CryptoExchange.BuyCrypto failed", zap.Error(err))
		return nil, err
	}

	// 2. Update Payment Status
	payment, err := a.Repo.GetPaymentByID(ctx, paymentID)
	if err != nil {
		return nil, err
	}
	payment.Status = domain.PaymentStatusCryptoPurchased
	payment.AmountCrypto = cryptoAmount
	if err := a.Repo.SavePayment(ctx, payment); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"CryptoAmount": cryptoAmount,
		"ExchangeTxID": exchangeTxID,
	}, nil
}

// TransferCryptoActivity transfers the purchased crypto to the target policy wallet.
func (a *Activities) TransferCryptoActivity(ctx context.Context, paymentID string, fromWalletID string, toAddress string, amount float64, currency string) (map[string]string, error) {
	log := activity.GetLogger(ctx)
	log.Info("Transferring crypto", zap.String("payment_id", paymentID))

	// 1. Call Wallet Manager
	txHash, err := a.WalletManager.Transfer(ctx, fromWalletID, toAddress, amount, currency)
	if err != nil {
		log.Error("WalletManager.Transfer failed", zap.Error(err))
		return nil, err
	}

	// 2. No explicit status update here, as the next activity will finalize.

	return map[string]string{
		"TxHash": txHash,
	}, nil
}

// NotifyPolicyServiceActivity informs the GIF Policy Service that the premium is paid.
func (a *Activities) NotifyPolicyServiceActivity(ctx context.Context, policyID string, amount float64, currency string) error {
	log := activity.GetLogger(ctx)
	log.Info("Notifying Policy Service", zap.String("policy_id", policyID))

	// 1. Call Policy Service
	if err := a.PolicyService.NotifyPremiumPaid(ctx, policyID, amount, currency); err != nil {
		log.Error("PolicyService.NotifyPremiumPaid failed", zap.Error(err))
		// Note: Depending on requirements, this might be retried or compensated.
		return err
	}

	return nil
}

// FinalizePaymentActivity updates the payment record to the final success status.
func (a *Activities) FinalizePaymentActivity(ctx context.Context, paymentID string, status domain.PaymentStatus, cryptoAmount float64) (*domain.Payment, error) {
	log := activity.GetLogger(ctx)
	log.Info("Finalizing payment", zap.String("payment_id", paymentID), zap.String("status", string(status)))

	payment, err := a.Repo.GetPaymentByID(ctx, paymentID)
	if err != nil {
		return nil, err
	}

	if status == domain.PaymentStatusPremiumPaid {
		payment.Status = domain.PaymentStatusPremiumPaid
		payment.AmountCrypto = cryptoAmount
	} else {
		payment.Status = domain.PaymentStatusFailed
	}

	if err := a.Repo.SavePayment(ctx, payment); err != nil {
		return nil, err
	}

	return payment, nil
}

// --- Temporal Worker Setup ---

// StartWorker registers the workflow and activities and starts the worker.
func StartWorker(c *service.TemporalClient, repo *service.MockPaymentRepository, fg adapter.FiatGateway, ce adapter.CryptoExchange, wm adapter.WalletManager, ps adapter.PolicyService, logger *zap.Logger) service.TemporalWorker {
	a := &Activities{
		Repo:            repo,
		FiatGateway:     fg,
		CryptoExchange:  ce,
		WalletManager:   wm,
		PolicyService:   ps,
		Logger:          logger,
	}

	w := c.NewWorker("payment-task-queue", logger)
	w.RegisterWorkflow(workflow.PremiumPaymentWorkflow)
	w.RegisterActivity(a)

	err := w.Start()
	if err != nil {
		logger.Fatal("Unable to start Temporal worker", zap.Error(err))
	}

	logger.Info("Temporal Worker started", zap.String("task_queue", "payment-task-queue"))
	return w
}
