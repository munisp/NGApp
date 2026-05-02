package kyc

import (
	"context"
	"log"

	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("kyc-service")
}

func (s *OCRService) ExtractDocumentWithEvents(ctx context.Context, imageData []byte, documentType DocumentType, filename string, customerID string) (*DocumentOCRResult, error) {
	result, err := s.ExtractDocument(imageData, documentType, filename)
	if err != nil {
		emitErr := events.GetEmitter().Emit(ctx, events.EventKYCVerificationFailed, "customer", customerID, map[string]interface{}{
			"document_type": string(documentType),
			"error":         err.Error(),
		})
		if emitErr != nil {
			log.Printf("Failed to emit OCR failure event: %v", emitErr)
		}
		return nil, err
	}

	emitErr := events.GetEmitter().Emit(ctx, events.EventOCRProcessed, "document", result.DocumentID, map[string]interface{}{
		"customer_id":     customerID,
		"document_type":   string(documentType),
		"confidence":      result.Confidence,
		"processing_time": result.ProcessingTime,
		"provider":        string(result.Provider),
		"warnings_count":  len(result.Warnings),
		"fields_extracted": len(result.ExtractedFields),
	})
	if emitErr != nil {
		log.Printf("Failed to emit OCR processed event: %v", emitErr)
	}

	return result, nil
}

func (s *AMLScreeningService) ScreenIndividualWithEvents(ctx context.Context, req *ScreeningRequest) (*ScreeningResult, error) {
	emitErr := events.GetEmitter().Emit(ctx, events.EventAMLScreeningInitiated, "customer", req.ReferenceID, map[string]interface{}{
		"full_name":      req.FullName,
		"screening_type": string(req.ScreeningType),
		"watchlists":     req.Watchlists,
	})
	if emitErr != nil {
		log.Printf("Failed to emit AML screening initiated event: %v", emitErr)
	}

	result, err := s.ScreenIndividual(req)
	if err != nil {
		emitErr := events.GetEmitter().Emit(ctx, events.EventAMLAlertRaised, "customer", req.ReferenceID, map[string]interface{}{
			"error":          err.Error(),
			"screening_type": string(req.ScreeningType),
		})
		if emitErr != nil {
			log.Printf("Failed to emit AML screening failure event: %v", emitErr)
		}
		return nil, err
	}

	emitErr = events.GetEmitter().Emit(ctx, events.EventAMLScreeningCompleted, "customer", req.ReferenceID, map[string]interface{}{
		"screening_id":      result.ScreeningID,
		"risk_score":        result.RiskScore,
		"risk_level":        string(result.RiskLevel),
		"total_matches":     result.TotalMatches,
		"potential_matches": result.PotentialMatches,
		"confirmed_matches": result.ConfirmedMatches,
		"watchlists_checked": result.WatchlistsChecked,
		"processing_time":   result.ProcessingTime,
	})
	if emitErr != nil {
		log.Printf("Failed to emit AML screening completed event: %v", emitErr)
	}

	if result.ConfirmedMatches > 0 || result.PotentialMatches > 0 {
		emitErr = events.GetEmitter().Emit(ctx, events.EventSanctionsMatchFound, "customer", req.ReferenceID, map[string]interface{}{
			"screening_id":      result.ScreeningID,
			"confirmed_matches": result.ConfirmedMatches,
			"potential_matches": result.PotentialMatches,
			"risk_level":        string(result.RiskLevel),
		})
		if emitErr != nil {
			log.Printf("Failed to emit sanctions match event: %v", emitErr)
		}
	}

	return result, nil
}

func EmitKYCVerificationCompleted(ctx context.Context, customerID string, status string, confidenceScore float64, verifiedFields []string) error {
	return events.EmitKYCVerificationCompleted(ctx, customerID, status, confidenceScore, verifiedFields)
}

func EmitAMLScreeningCompleted(ctx context.Context, customerID string, riskScore float64, watchlistsChecked []string, matchesFound int) error {
	return events.EmitAMLScreeningCompleted(ctx, customerID, riskScore, watchlistsChecked, matchesFound)
}
