package errors

import (
	"encoding/json"
	"fmt"
	"net/http"
	"runtime"
	"strings"
)

// ErrorCode represents a standardized error code
type ErrorCode string

const (
	// Client errors (4xx)
	ErrCodeBadRequest          ErrorCode = "BAD_REQUEST"
	ErrCodeUnauthorized        ErrorCode = "UNAUTHORIZED"
	ErrCodeForbidden           ErrorCode = "FORBIDDEN"
	ErrCodeNotFound            ErrorCode = "NOT_FOUND"
	ErrCodeConflict            ErrorCode = "CONFLICT"
	ErrCodeValidation          ErrorCode = "VALIDATION_ERROR"
	ErrCodeRateLimited         ErrorCode = "RATE_LIMITED"
	ErrCodePayloadTooLarge     ErrorCode = "PAYLOAD_TOO_LARGE"

	// Server errors (5xx)
	ErrCodeInternal            ErrorCode = "INTERNAL_ERROR"
	ErrCodeServiceUnavailable  ErrorCode = "SERVICE_UNAVAILABLE"
	ErrCodeTimeout             ErrorCode = "TIMEOUT"
	ErrCodeDatabaseError       ErrorCode = "DATABASE_ERROR"
	ErrCodeExternalService     ErrorCode = "EXTERNAL_SERVICE_ERROR"
	ErrCodeCircuitBreakerOpen  ErrorCode = "CIRCUIT_BREAKER_OPEN"

	// Business errors
	ErrCodePolicyNotFound      ErrorCode = "POLICY_NOT_FOUND"
	ErrCodeClaimNotFound       ErrorCode = "CLAIM_NOT_FOUND"
	ErrCodeInsufficientFunds   ErrorCode = "INSUFFICIENT_FUNDS"
	ErrCodePolicyExpired       ErrorCode = "POLICY_EXPIRED"
	ErrCodeDuplicateEntry      ErrorCode = "DUPLICATE_ENTRY"
	ErrCodeInvalidState        ErrorCode = "INVALID_STATE"
	ErrCodeKYCRequired         ErrorCode = "KYC_REQUIRED"
	ErrCodeFraudDetected       ErrorCode = "FRAUD_DETECTED"
)

// AppError represents a structured application error
type AppError struct {
	Code       ErrorCode              `json:"code"`
	Message    string                 `json:"message"`
	Details    map[string]interface{} `json:"details,omitempty"`
	HTTPStatus int                    `json:"-"`
	Cause      error                  `json:"-"`
	Stack      string                 `json:"-"`
}

// Error implements the error interface
func (e *AppError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %s (caused by: %v)", e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// Unwrap returns the underlying error
func (e *AppError) Unwrap() error {
	return e.Cause
}

// WithDetails adds details to the error
func (e *AppError) WithDetails(details map[string]interface{}) *AppError {
	e.Details = details
	return e
}

// WithCause adds a cause to the error
func (e *AppError) WithCause(cause error) *AppError {
	e.Cause = cause
	return e
}

// ToJSON converts the error to JSON
func (e *AppError) ToJSON() []byte {
	data, _ := json.Marshal(e)
	return data
}

// NewError creates a new AppError
func NewError(code ErrorCode, message string) *AppError {
	return &AppError{
		Code:       code,
		Message:    message,
		HTTPStatus: codeToHTTPStatus(code),
		Stack:      captureStack(),
	}
}

// Error constructors for common cases
func BadRequest(message string) *AppError {
	return NewError(ErrCodeBadRequest, message)
}

func Unauthorized(message string) *AppError {
	return NewError(ErrCodeUnauthorized, message)
}

func Forbidden(message string) *AppError {
	return NewError(ErrCodeForbidden, message)
}

func NotFound(message string) *AppError {
	return NewError(ErrCodeNotFound, message)
}

func Conflict(message string) *AppError {
	return NewError(ErrCodeConflict, message)
}

func ValidationError(message string, details map[string]interface{}) *AppError {
	return NewError(ErrCodeValidation, message).WithDetails(details)
}

func InternalError(message string) *AppError {
	return NewError(ErrCodeInternal, message)
}

func ServiceUnavailable(message string) *AppError {
	return NewError(ErrCodeServiceUnavailable, message)
}

func Timeout(message string) *AppError {
	return NewError(ErrCodeTimeout, message)
}

func DatabaseError(message string, cause error) *AppError {
	return NewError(ErrCodeDatabaseError, message).WithCause(cause)
}

func ExternalServiceError(service, message string, cause error) *AppError {
	return NewError(ErrCodeExternalService, message).
		WithDetails(map[string]interface{}{"service": service}).
		WithCause(cause)
}

// Business error constructors
func PolicyNotFound(policyID string) *AppError {
	return NewError(ErrCodePolicyNotFound, "Policy not found").
		WithDetails(map[string]interface{}{"policy_id": policyID})
}

func ClaimNotFound(claimID string) *AppError {
	return NewError(ErrCodeClaimNotFound, "Claim not found").
		WithDetails(map[string]interface{}{"claim_id": claimID})
}

func InsufficientFunds(required, available float64) *AppError {
	return NewError(ErrCodeInsufficientFunds, "Insufficient funds").
		WithDetails(map[string]interface{}{
			"required":  required,
			"available": available,
		})
}

func PolicyExpired(policyID string) *AppError {
	return NewError(ErrCodePolicyExpired, "Policy has expired").
		WithDetails(map[string]interface{}{"policy_id": policyID})
}

func KYCRequired(customerID string) *AppError {
	return NewError(ErrCodeKYCRequired, "KYC verification required").
		WithDetails(map[string]interface{}{"customer_id": customerID})
}

func FraudDetected(reason string, score float64) *AppError {
	return NewError(ErrCodeFraudDetected, "Potential fraud detected").
		WithDetails(map[string]interface{}{
			"reason": reason,
			"score":  score,
		})
}

// Helper functions
func codeToHTTPStatus(code ErrorCode) int {
	switch code {
	case ErrCodeBadRequest, ErrCodeValidation:
		return http.StatusBadRequest
	case ErrCodeUnauthorized:
		return http.StatusUnauthorized
	case ErrCodeForbidden:
		return http.StatusForbidden
	case ErrCodeNotFound, ErrCodePolicyNotFound, ErrCodeClaimNotFound:
		return http.StatusNotFound
	case ErrCodeConflict, ErrCodeDuplicateEntry:
		return http.StatusConflict
	case ErrCodeRateLimited:
		return http.StatusTooManyRequests
	case ErrCodePayloadTooLarge:
		return http.StatusRequestEntityTooLarge
	case ErrCodeServiceUnavailable, ErrCodeCircuitBreakerOpen:
		return http.StatusServiceUnavailable
	case ErrCodeTimeout:
		return http.StatusGatewayTimeout
	default:
		return http.StatusInternalServerError
	}
}

func captureStack() string {
	const depth = 32
	var pcs [depth]uintptr
	n := runtime.Callers(3, pcs[:])
	frames := runtime.CallersFrames(pcs[:n])

	var builder strings.Builder
	for {
		frame, more := frames.Next()
		if !strings.Contains(frame.File, "runtime/") {
			fmt.Fprintf(&builder, "%s:%d %s\n", frame.File, frame.Line, frame.Function)
		}
		if !more {
			break
		}
	}
	return builder.String()
}

// IsAppError checks if an error is an AppError
func IsAppError(err error) bool {
	_, ok := err.(*AppError)
	return ok
}

// AsAppError converts an error to AppError
func AsAppError(err error) *AppError {
	if appErr, ok := err.(*AppError); ok {
		return appErr
	}
	return InternalError(err.Error()).WithCause(err)
}

// HTTPErrorHandler is a middleware for handling errors in HTTP handlers
func HTTPErrorHandler(w http.ResponseWriter, err error) {
	appErr := AsAppError(err)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(appErr.HTTPStatus)
	w.Write(appErr.ToJSON())
}

// RecoverMiddleware recovers from panics and converts them to errors
func RecoverMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				err := InternalError(fmt.Sprintf("panic recovered: %v", rec))
				HTTPErrorHandler(w, err)
			}
		}()
		next.ServeHTTP(w, r)
	})
}
