package middleware

import (
	"context"
	"crypto/rsa"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

var (
	keycloakURL   = getEnv("KEYCLOAK_URL", "http://localhost:8080")
	keycloakRealm = getEnv("KEYCLOAK_REALM", "kyc-kyb-system")
	permifyURL    = getEnv("PERMIFY_URL", "http://localhost:3476")
	publicKey     *rsa.PublicKey
	publicKeyOnce sync.Once
)

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// UserInfo contains authenticated user information
type UserInfo struct {
	UserID         string   `json:"user_id"`
	Username       string   `json:"username"`
	Email          string   `json:"email"`
	Roles          []string `json:"roles"`
	OrganizationID string   `json:"organization_id"`
	Name           string   `json:"name"`
}

// Claims represents JWT claims
type Claims struct {
	Sub               string   `json:"sub"`
	PreferredUsername string   `json:"preferred_username"`
	Email             string   `json:"email"`
	Name              string   `json:"name"`
	OrganizationID    string   `json:"organization_id"`
	RealmAccess       struct {
		Roles []string `json:"roles"`
	} `json:"realm_access"`
	jwt.RegisteredClaims
}

// getPublicKey retrieves Keycloak public key
func getPublicKey() (*rsa.PublicKey, error) {
	var err error
	publicKeyOnce.Do(func() {
		url := fmt.Sprintf("%s/realms/%s", keycloakURL, keycloakRealm)
		
		resp, httpErr := http.Get(url)
		if httpErr != nil {
			err = fmt.Errorf("failed to get realm info: %w", httpErr)
			return
		}
		defer resp.Body.Close()

		body, httpErr := io.ReadAll(resp.Body)
		if httpErr != nil {
			err = fmt.Errorf("failed to read response: %w", httpErr)
			return
		}

		var realmInfo map[string]interface{}
		if httpErr := json.Unmarshal(body, &realmInfo); httpErr != nil {
			err = fmt.Errorf("failed to parse realm info: %w", httpErr)
			return
		}

		publicKeyStr, ok := realmInfo["public_key"].(string)
		if !ok {
			err = fmt.Errorf("public key not found in realm info")
			return
		}

		pemKey := fmt.Sprintf("-----BEGIN PUBLIC KEY-----\n%s\n-----END PUBLIC KEY-----", publicKeyStr)
		publicKey, err = jwt.ParseRSAPublicKeyFromPEM([]byte(pemKey))
	})

	return publicKey, err
}

// verifyToken verifies JWT token
func verifyToken(tokenString string) (*Claims, error) {
	pubKey, err := getPublicKey()
	if err != nil {
		return nil, err
	}

	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return pubKey, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}

// extractUserInfo extracts user information from claims
func extractUserInfo(claims *Claims) *UserInfo {
	return &UserInfo{
		UserID:         claims.Sub,
		Username:       claims.PreferredUsername,
		Email:          claims.Email,
		Roles:          claims.RealmAccess.Roles,
		OrganizationID: claims.OrganizationID,
		Name:           claims.Name,
	}
}

// checkPermission checks permission using Permify
func checkPermission(userID, permission, resourceID string) bool {
	if resourceID == "" {
		resourceID = "default"
	}

	entityType := "risk_score"
	if strings.HasPrefix(permission, "risk") {
		entityType = "risk_score"
	}

	payload := map[string]interface{}{
		"entity": map[string]string{
			"type": entityType,
			"id":   resourceID,
		},
		"permission": permission,
		"subject": map[string]string{
			"type": "user",
			"id":   userID,
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Failed to marshal permission check payload: %v", err)
		return false
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "POST", permifyURL+"/v1/permissions/check", strings.NewReader(string(jsonData)))
	if err != nil {
		log.Printf("Failed to create permission check request: %v", err)
		return false
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Permission check request failed: %v", err)
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("Permission check failed with status: %d", resp.StatusCode)
		return false
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("Failed to decode permission check response: %v", err)
		return false
	}

	can, ok := result["can"].(bool)
	return ok && can
}

// hasRole checks if user has any of the required roles
func hasRole(userRoles []string, requiredRoles []string) bool {
	for _, required := range requiredRoles {
		for _, userRole := range userRoles {
			if userRole == required {
				return true
			}
		}
	}
	return false
}

// AuthMiddleware authenticates requests
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing or invalid authorization header"})
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		claims, err := verifyToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authentication token"})
			c.Abort()
			return
		}

		userInfo := extractUserInfo(claims)
		c.Set("user", userInfo)
		c.Next()
	}
}

// RequireRoles middleware requires specific roles
func RequireRoles(requiredRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userInfoInterface, exists := c.Get("user")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			c.Abort()
			return
		}

		userInfo, ok := userInfoInterface.(*UserInfo)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user info"})
			c.Abort()
			return
		}

		// System administrator has access to everything
		if hasRole(userInfo.Roles, []string{"system_administrator"}) {
			c.Next()
			return
		}

		// Check required roles
		if !hasRole(userInfo.Roles, requiredRoles) {
			c.JSON(http.StatusForbidden, gin.H{
				"error": fmt.Sprintf("Insufficient permissions. Required roles: %v", requiredRoles),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequirePermission middleware requires specific permission via Permify
func RequirePermission(permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userInfoInterface, exists := c.Get("user")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			c.Abort()
			return
		}

		userInfo, ok := userInfoInterface.(*UserInfo)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user info"})
			c.Abort()
			return
		}

		// System administrator has access to everything
		if hasRole(userInfo.Roles, []string{"system_administrator"}) {
			c.Next()
			return
		}

		// Get resource ID from URL params
		resourceID := c.Param("id")
		if resourceID == "" {
			resourceID = c.Param("customer_id")
		}

		// Check permission via Permify
		if !checkPermission(userInfo.UserID, permission, resourceID) {
			c.JSON(http.StatusForbidden, gin.H{
				"error": fmt.Sprintf("Insufficient permissions. Required: %s", permission),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// GetUserInfo retrieves user info from context
func GetUserInfo(c *gin.Context) (*UserInfo, error) {
	userInfoInterface, exists := c.Get("user")
	if !exists {
		return nil, fmt.Errorf("user not authenticated")
	}

	userInfo, ok := userInfoInterface.(*UserInfo)
	if !ok {
		return nil, fmt.Errorf("invalid user info")
	}

	return userInfo, nil
}

// Permission constants for Risk Service
const (
	PermissionRiskScoreCreate   = "risk.score.create"
	PermissionRiskScoreRead     = "risk.score.read"
	PermissionRiskScoreOverride = "risk.score.override"
)

// Role constants
const (
	RoleSystemAdmin       = "system_administrator"
	RoleComplianceOfficer = "compliance_officer"
	RoleKYCAnalyst        = "kyc_analyst"
	RoleRiskManager       = "risk_manager"
	RoleKYCOperator       = "kyc_operator"
)
