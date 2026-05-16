package workflow

import (
	"time"

	"go.temporal.io/sdk/workflow"
	"payment_service/domain"
)

// PremiumPaymentWorkflowInput defines the input for the workflow.
type PremiumPaymentWorkflowInput struct {
	PaymentID      string
	PolicyID       string
	AmountFiat     float64
	CurrencyFiat   string
	CurrencyCrypto string // e.g., "USDC"
	TargetAddress  string // Address of the policy premium wallet
}

// PremiumPaymentWorkflow is the main workflow that orchestrates the payment process.
func PremiumPaymentWorkflow(ctx workflow.Context, input PremiumPaymentWorkflowInput) (*domain.Payment, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("PremiumPaymentWorkflow started", "PaymentID", input.PaymentID)

	// 1. Setup Activity Options
	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: time.Minute * 5,
		RetryOptions: workflow.RetryOptions{
			InitialInterval: time.Second * 10,
			MaximumAttempts: 5,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	// 2. Initiate Fiat Payment
	var initiateResult struct {
		Reference  string
		PaymentURL string
	}
	err := workflow.ExecuteActivity(ctx, InitiateFiatPaymentActivity, input.PaymentID, input.AmountFiat, input.CurrencyFiat).Get(ctx, &initiateResult)
	if err != nil {
		logger.Error("InitiateFiatPaymentActivity failed", "error", err)
		return nil, err
	}

	// 3. Wait for Fiat Payment Confirmation (External Signal)
	// The webhook handler will send a signal to this workflow instance upon successful payment.
	fiatConfirmationSignal := workflow.Get
	Channel(ctx, "fiat_payment_confirmed")
	var fiatConfirmation struct {
		Status string
		Reference string
	}
	selector := workflow.NewSelector(ctx)
	selector.AddReceive(fiatConfirmationSignal, func(c workflow.ReceiveChannel, more bool) {
		c.Receive(ctx, &fiatConfirmation)
	})

	// Add a timeout for the fiat payment confirmation
	timeoutTimer := workflow.NewTimer(ctx, time.Hour * 24) // 24 hours to complete fiat payment
	selector.AddFuture(timeoutTimer, func(f workflow.Future) {
		logger.Warn("Fiat payment confirmation timed out")
		fiatConfirmation.Status = "TIMEOUT"
	})

	logger.Info("Waiting for fiat payment confirmation signal...")
	selector.Select(ctx)

	if fiatConfirmation.Status != "SUCCESS" {
		logger.Error("Fiat payment failed or timed out", "status", fiatConfirmation.Status)
		return nil, errors.New("fiat payment failed or timed out")
	}

	// 4. Purchase Crypto (Fiat-to-Crypto Conversion)
	var cryptoPurchaseResult struct {
		CryptoAmount float64
		ExchangeTxID string
	}
	err = workflow.ExecuteActivity(ctx, PurchaseCryptoActivity, input.PaymentID, input.AmountFiat, input.CurrencyFiat, input.CurrencyCrypto).Get(ctx, &cryptoPurchaseResult)
	if err != nil {
		logger.Error("PurchaseCryptoActivity failed", "error", err)
		return nil, err
	}

	// 5. Transfer Crypto to Policy Premium Wallet
	var transferResult struct {
		TxHash string
	}
	// Use the service wallet ID from workflow context (set from config at workflow registration)
	serviceWalletID := workflow.GetInfo(ctx).Memo.Fields["service_wallet_id"]
	if serviceWalletID == nil || string(serviceWalletID.Data) == "" {
		serviceWalletID = &commonpb.Payload{Data: []byte(os.Getenv("SERVICE_WALLET_ID"))}
	}
	err = workflow.ExecuteActivity(ctx, TransferCryptoActivity, input.PaymentID, string(serviceWalletID.Data), input.TargetAddress, cryptoPurchaseResult.CryptoAmount, input.CurrencyCrypto).Get(ctx, &transferResult)
	if err != nil {
		logger.Error("TransferCryptoActivity failed", "error", err)
		return nil, err
	}

	// 6. Notify Policy Service
	err = workflow.ExecuteActivity(ctx, NotifyPolicyServiceActivity, input.PolicyID, cryptoPurchaseResult.CryptoAmount, input.CurrencyCrypto).Get(ctx, nil)
	if err != nil {
		logger.Error("NotifyPolicyServiceActivity failed", "error", err)
		// This is a critical step, but we might still consider the payment successful from our service's perspective
		// if the transfer succeeded. For robustness, we should implement a compensation/retry mechanism.
		// For now, we log and continue.
	}

	// 7. Finalize Payment Record
	var finalPayment *domain.Payment
	err = workflow.ExecuteActivity(ctx, FinalizePaymentActivity, input.PaymentID, domain.PaymentStatusPremiumPaid, cryptoPurchaseResult.CryptoAmount).Get(ctx, &finalPayment)
	if err != nil {
		logger.Error("FinalizePaymentActivity failed", "error", err)
		return nil, err
	}

	logger.Info("PremiumPaymentWorkflow completed successfully", "PaymentID", input.PaymentID)
	return finalPayment, nil
}
