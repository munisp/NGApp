// Package middleware provides HTTP middleware for the payment switch platform
// Recommendation #7: RBAC Enforcement at API Layer
package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Role represents a user role in the system
type Role string

const (
	RoleAdmin       Role = "admin"
	RoleOperator    Role = "operator"
	RoleCompliance  Role = "compliance"
	RoleSupport     Role = "support"
	RoleParticipant Role = "participant"
	RoleMerchant    Role = "merchant"
	RoleViewer      Role = "viewer"
	RoleSystem      Role = "system"
)

// Permission represents a specific permission
type Permission string

const (
	// User management
	PermissionUserCreate Permission = "user:create"
	PermissionUserRead   Permission = "user:read"
	PermissionUserUpdate Permission = "user:update"
	PermissionUserDelete Permission = "user:delete"

	// Participant management
	PermissionParticipantCreate    Permission = "participant:create"
	PermissionParticipantRead      Permission = "participant:read"
	PermissionParticipantUpdate    Permission = "participant:update"
	PermissionParticipantDelete    Permission = "participant:delete"
	PermissionParticipantProvision Permission = "participant:provision"

	// KYC/KYB management
	PermissionKYCRead    Permission = "kyc:read"
	PermissionKYCApprove Permission = "kyc:approve"
	PermissionKYCReject  Permission = "kyc:reject"
	PermissionKYBRead    Permission = "kyb:read"
	PermissionKYBApprove Permission = "kyb:approve"
	PermissionKYBReject  Permission = "kyb:reject"

	// Transaction management
	PermissionTransactionRead    Permission = "transaction:read"
	PermissionTransactionCreate  Permission = "transaction:create"
	PermissionTransactionReverse Permission = "transaction:reverse"
	PermissionTransactionExport  Permission = "transaction:export"

	// Compliance
	PermissionComplianceRead   Permission = "compliance:read"
	PermissionComplianceReport Permission = "compliance:report"
	PermissionSARFile          Permission = "sar:file"
	PermissionCTRFile          Permission = "ctr:file"

	// Disputes & Refunds
	PermissionDisputeRead    Permission = "dispute:read"
	PermissionDisputeCreate  Permission = "dispute:create"
	PermissionDisputeResolve Permission = "dispute:resolve"
	PermissionRefundCreate   Permission = "refund:create"
	PermissionRefundApprove  Permission = "refund:approve"

	// Settings & Configuration
	PermissionSettingsRead   Permission = "settings:read"
	PermissionSettingsUpdate Permission = "settings:update"

	// Audit logs
	PermissionAuditRead Permission = "audit:read"

	// System administration
	PermissionSystemAdmin Permission = "system:admin"
)

// RolePermissions defines the permissions for each role
var RolePermissions = map[Role][]Permission{
	RoleAdmin: {
		PermissionUserCreate, PermissionUserRead, PermissionUserUpdate, PermissionUserDelete,
		PermissionParticipantCreate, PermissionParticipantRead, PermissionParticipantUpdate, PermissionParticipantDelete, PermissionParticipantProvision,
		PermissionKYCRead, PermissionKYCApprove, PermissionKYCReject,
		PermissionKYBRead, PermissionKYBApprove, PermissionKYBReject,
		PermissionTransactionRead, PermissionTransactionCreate, PermissionTransactionReverse, PermissionTransactionExport,
		PermissionComplianceRead, PermissionComplianceReport, PermissionSARFile, PermissionCTRFile,
		PermissionDisputeRead, PermissionDisputeCreate, PermissionDisputeResolve,
		PermissionRefundCreate, PermissionRefundApprove,
		PermissionSettingsRead, PermissionSettingsUpdate,
		PermissionAuditRead,
		PermissionSystemAdmin,
	},
	RoleOperator: {
		PermissionUserRead,
		PermissionParticipantRead, PermissionParticipantUpdate, PermissionParticipantProvision,
		PermissionKYCRead, PermissionKYCApprove, PermissionKYCReject,
		PermissionKYBRead, PermissionKYBApprove, PermissionKYBReject,
		PermissionTransactionRead, PermissionTransactionCreate, PermissionTransactionExport,
		PermissionDisputeRead, PermissionDisputeCreate, PermissionDisputeResolve,
		PermissionRefundCreate, PermissionRefundApprove,
		PermissionSettingsRead,
	},
	RoleCompliance: {
		PermissionUserRead,
		PermissionParticipantRead,
		PermissionKYCRead, PermissionKYCApprove, PermissionKYCReject,
		PermissionKYBRead, PermissionKYBApprove, PermissionKYBReject,
		PermissionTransactionRead, PermissionTransactionExport,
		PermissionComplianceRead, PermissionComplianceReport, PermissionSARFile, PermissionCTRFile,
		PermissionDisputeRead,
		PermissionAuditRead,
	},
	RoleSupport: {
		PermissionUserRead,
		PermissionParticipantRead,
		PermissionKYCRead,
		PermissionKYBRead,
		PermissionTransactionRead,
		PermissionDisputeRead, PermissionDisputeCreate,
		PermissionRefundCreate,
	},
	RoleParticipant: {
		PermissionTransactionRead, PermissionTransactionCreate,
		PermissionDisputeRead, PermissionDisputeCreate,
	},
	RoleMerchant: {
		PermissionTransactionRead, PermissionTransactionCreate,
		PermissionDisputeRead,
		PermissionRefundCreate,
	},
	RoleViewer: {
		PermissionUserRead,
		PermissionParticipantRead,
		PermissionKYCRead,
		PermissionKYBRead,
		PermissionTransactionRead,
		PermissionComplianceRead,
		PermissionDisputeRead,
		PermissionAuditRead,
	},
	RoleSystem: {
		// System role has all permissions
		PermissionSystemAdmin,
	},
}

// UserClaims represents the JWT claims for a user
type UserClaims struct {
	jwt.RegisteredClaims
	UserID      string   `json:"user_id"`
	Email       string   `json:"email"`
	Role        Role     `json:"role"`
	Permissions []string `json:"permissions,omitempty"`
}

// contextKey is used for storing values in context
type contextKey string

const (
	userClaimsKey contextKey = "user_claims"
)

// RBACConfig holds configuration for the RBAC middleware
type RBACConfig struct {
	JWTSecret          string
	JWTIssuer          string
	SkipPaths          []string
	EnableAuditLogging bool
}

// RBACMiddleware creates a new RBAC middleware
type RBACMiddleware struct {
	config *RBACConfig
}

// NewRBACMiddleware creates a new RBAC middleware instance
func NewRBACMiddleware(config *RBACConfig) *RBACMiddleware {
	return &RBACMiddleware{config: config}
}

// Authenticate validates the JWT token and extracts user claims
func (m *RBACMiddleware) Authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip authentication for certain paths
		for _, path := range m.config.SkipPaths {
			if strings.HasPrefix(r.URL.Path, path) {
				next.ServeHTTP(w, r)
				return
			}
		}

		// Extract token from Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			writeError(w, http.StatusUnauthorized, "missing authorization header")
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			writeError(w, http.StatusUnauthorized, "invalid authorization header format")
			return
		}

		tokenString := parts[1]

		// Parse and validate token
		claims := &UserClaims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(m.config.JWTSecret), nil
		})

		if err != nil || !token.Valid {
			writeError(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}

		// Validate issuer if configured
		if m.config.JWTIssuer != "" && claims.Issuer != m.config.JWTIssuer {
			writeError(w, http.StatusUnauthorized, "invalid token issuer")
			return
		}

		// Add claims to context
		ctx := context.WithValue(r.Context(), userClaimsKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequirePermission creates middleware that checks for a specific permission
func (m *RBACMiddleware) RequirePermission(permission Permission) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := GetUserClaims(r.Context())
			if claims == nil {
				writeError(w, http.StatusUnauthorized, "authentication required")
				return
			}

			if !HasPermission(claims, permission) {
				writeError(w, http.StatusForbidden, fmt.Sprintf("permission denied: %s required", permission))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireRole creates middleware that checks for a specific role
func (m *RBACMiddleware) RequireRole(roles ...Role) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := GetUserClaims(r.Context())
			if claims == nil {
				writeError(w, http.StatusUnauthorized, "authentication required")
				return
			}

			hasRole := false
			for _, role := range roles {
				if claims.Role == role {
					hasRole = true
					break
				}
			}

			if !hasRole {
				writeError(w, http.StatusForbidden, "insufficient role privileges")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireAnyPermission creates middleware that checks for any of the specified permissions
func (m *RBACMiddleware) RequireAnyPermission(permissions ...Permission) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := GetUserClaims(r.Context())
			if claims == nil {
				writeError(w, http.StatusUnauthorized, "authentication required")
				return
			}

			for _, permission := range permissions {
				if HasPermission(claims, permission) {
					next.ServeHTTP(w, r)
					return
				}
			}

			writeError(w, http.StatusForbidden, "permission denied")
		})
	}
}

// GetUserClaims retrieves user claims from context
func GetUserClaims(ctx context.Context) *UserClaims {
	if claims, ok := ctx.Value(userClaimsKey).(*UserClaims); ok {
		return claims
	}
	return nil
}

// HasPermission checks if the user has a specific permission
func HasPermission(claims *UserClaims, permission Permission) bool {
	if claims == nil {
		return false
	}

	// System role has all permissions
	if claims.Role == RoleSystem {
		return true
	}

	// Check role-based permissions
	rolePerms, ok := RolePermissions[claims.Role]
	if ok {
		for _, p := range rolePerms {
			if p == permission || p == PermissionSystemAdmin {
				return true
			}
		}
	}

	// Check explicit permissions in claims
	for _, p := range claims.Permissions {
		if Permission(p) == permission {
			return true
		}
	}

	return false
}

// HasRole checks if the user has a specific role
func HasRole(claims *UserClaims, role Role) bool {
	if claims == nil {
		return false
	}
	return claims.Role == role
}

// GenerateToken generates a JWT token for a user
func GenerateToken(secret string, issuer string, userID string, email string, role Role, expiry time.Duration) (string, error) {
	claims := &UserClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuer,
			Subject:   userID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
		UserID: userID,
		Email:  email,
		Role:   role,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func writeError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(ErrorResponse{
		Error:   http.StatusText(code),
		Code:    code,
		Message: message,
	})
}
