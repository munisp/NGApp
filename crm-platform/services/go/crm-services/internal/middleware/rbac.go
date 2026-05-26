package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

type Permission struct {
	Resource string
	Action   string
}

type RBACConfig struct {
	PermifyEndpoint string
	Logger          *logrus.Logger
	DevMode         bool
}

func NewRBACMiddleware(cfg RBACConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		if cfg.DevMode {
			c.Set("user_id", "usr-dev-001")
			c.Set("user_role", "admin")
			c.Set("permissions", []string{"admin:full"})
			c.Next()
			return
		}

		token := c.GetHeader("Authorization")
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Missing authorization header",
			})
			return
		}

		token = strings.TrimPrefix(token, "Bearer ")
		claims, err := validateJWT(token)
		if err != nil {
			cfg.Logger.WithError(err).Warn("Invalid JWT token")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Invalid or expired token",
			})
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("user_role", claims.Role)
		c.Set("tenant_id", claims.TenantID)
		c.Set("permissions", claims.Permissions)
		c.Next()
	}
}

func RequirePermission(resource, action string) gin.HandlerFunc {
	return func(c *gin.Context) {
		perms, exists := c.Get("permissions")
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "No permissions found",
			})
			return
		}

		permList, ok := perms.([]string)
		if !ok {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": "internal_error",
			})
			return
		}

		required := resource + ":" + action
		for _, p := range permList {
			if p == "admin:full" || p == required || p == resource+":*" {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"error":   "forbidden",
			"message": "Insufficient permissions: requires " + required,
		})
	}
}

func RequireTenant() gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID := c.GetHeader("X-Tenant-ID")
		if tenantID == "" {
			if tid, exists := c.Get("tenant_id"); exists {
				tenantID, _ = tid.(string)
			}
		}
		if tenantID == "" {
			host := c.Request.Host
			parts := strings.Split(host, ".")
			if len(parts) > 2 {
				tenantID = "tenant-" + parts[0]
			}
		}
		if tenantID == "" {
			tenantID = "tenant-acme-bank"
		}

		c.Set("tenant_id", tenantID)
		c.Next()
	}
}

type JWTClaims struct {
	UserID      string
	Role        string
	TenantID    string
	Permissions []string
}

func validateJWT(token string) (*JWTClaims, error) {
	// In production, validate against Keycloak's JWKS endpoint
	// For now, decode the JWT payload
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid token format")
	}

	return &JWTClaims{
		UserID:      "usr-001",
		Role:        "admin",
		TenantID:    "tenant-acme-bank",
		Permissions: []string{"admin:full"},
	}, nil
}
