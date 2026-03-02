package security

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
)

// InputValidator provides request validation and sanitization middleware.
// Protects against SQL injection, XSS, command injection, path traversal,
// and malformed input attacks.
type InputValidator struct {
	maxBodySize     int64
	maxURLLength    int
	maxHeaderSize   int
	maxQueryParams  int
	maxFieldLength  int
	blockedPatterns []*regexp.Regexp
}

// ValidationError represents a validation failure
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
	Code    string `json:"code"`
}

// NewInputValidator creates a configured input validator
func NewInputValidator() *InputValidator {
	iv := &InputValidator{
		maxBodySize:    10 * 1024 * 1024, // 10MB (for KYC docs)
		maxURLLength:   4096,
		maxHeaderSize:  8192,
		maxQueryParams: 50,
		maxFieldLength: 10000,
	}

	// Compile blocked patterns for common attack vectors
	patterns := []string{
		// SQL injection patterns
		`(?i)(\bunion\b\s+\bselect\b|\binsert\b\s+\binto\b|\bdelete\b\s+\bfrom\b|\bdrop\b\s+\btable\b|\bexec\b\s*\(|\bexecute\b\s*\()`,
		// XSS patterns
		`(?i)(<script[^>]*>|javascript:|on\w+\s*=|<iframe|<object|<embed|<applet)`,
		// Command injection
		`(?i)(;\s*(ls|cat|rm|wget|curl|bash|sh|python|perl|ruby|nc|ncat)\b|\|\s*(ls|cat|rm|wget|curl|bash|sh))`,
		// Path traversal
		`(?i)(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.\.%2f|%2e%2e%5c)`,
		// LDAP injection
		`(?i)(\*\)\(\||\)\(\&|\)\(\!)`,
		// Template injection
		`(?i)(\{\{.*\}\}|\$\{.*\}|<%.*%>)`,
		// Null byte injection
		`%00|\x00`,
	}
	for _, p := range patterns {
		iv.blockedPatterns = append(iv.blockedPatterns, regexp.MustCompile(p))
	}

	return iv
}

// Middleware returns a Gin middleware that validates all incoming requests
func (iv *InputValidator) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. Validate URL length
		if len(c.Request.URL.String()) > iv.maxURLLength {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "URL exceeds maximum length",
				"code":    "URL_TOO_LONG",
			})
			c.Abort()
			return
		}

		// 2. Validate Content-Length
		if c.Request.ContentLength > iv.maxBodySize {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{
				"success": false,
				"error":   "Request body exceeds maximum size",
				"code":    "BODY_TOO_LARGE",
			})
			c.Abort()
			return
		}

		// 3. Validate query parameters
		if len(c.Request.URL.Query()) > iv.maxQueryParams {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Too many query parameters",
				"code":    "TOO_MANY_PARAMS",
			})
			c.Abort()
			return
		}

		// 4. Check URL path for attack patterns
		if errs := iv.validateString(c.Request.URL.Path, "url_path"); len(errs) > 0 {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Potentially malicious URL pattern detected",
				"code":    "BLOCKED_PATTERN",
			})
			c.Abort()
			return
		}

		// 5. Check query parameters for attack patterns
		for key, values := range c.Request.URL.Query() {
			if errs := iv.validateString(key, "query_key"); len(errs) > 0 {
				c.JSON(http.StatusBadRequest, gin.H{
					"success": false,
					"error":   fmt.Sprintf("Potentially malicious query parameter: %s", key),
					"code":    "BLOCKED_PATTERN",
				})
				c.Abort()
				return
			}
			for _, v := range values {
				if errs := iv.validateString(v, "query_value"); len(errs) > 0 {
					c.JSON(http.StatusBadRequest, gin.H{
						"success": false,
						"error":   fmt.Sprintf("Potentially malicious query value for: %s", key),
						"code":    "BLOCKED_PATTERN",
					})
					c.Abort()
					return
				}
			}
		}

		// 6. Validate Content-Type for POST/PUT/PATCH
		if c.Request.Method == "POST" || c.Request.Method == "PUT" || c.Request.Method == "PATCH" {
			ct := c.GetHeader("Content-Type")
			if ct != "" && !isAllowedContentType(ct) {
				c.JSON(http.StatusUnsupportedMediaType, gin.H{
					"success": false,
					"error":   "Unsupported content type",
					"code":    "UNSUPPORTED_MEDIA_TYPE",
				})
				c.Abort()
				return
			}
		}

		// 7. Ensure valid UTF-8 in all string parameters
		for key, values := range c.Request.URL.Query() {
			if !utf8.ValidString(key) {
				c.JSON(http.StatusBadRequest, gin.H{
					"success": false,
					"error":   "Invalid UTF-8 encoding in query parameters",
					"code":    "INVALID_ENCODING",
				})
				c.Abort()
				return
			}
			for _, v := range values {
				if !utf8.ValidString(v) {
					c.JSON(http.StatusBadRequest, gin.H{
						"success": false,
						"error":   "Invalid UTF-8 encoding in query parameters",
						"code":    "INVALID_ENCODING",
					})
					c.Abort()
					return
				}
			}
		}

		c.Next()
	}
}

// ValidateJSON validates a JSON request body against attack patterns
func (iv *InputValidator) ValidateJSON(data []byte) []ValidationError {
	var errs []ValidationError

	// Parse JSON
	var parsed interface{}
	if err := json.Unmarshal(data, &parsed); err != nil {
		return []ValidationError{{Field: "body", Message: "Invalid JSON", Code: "INVALID_JSON"}}
	}

	// Recursively validate all string values
	iv.validateJSONValue(parsed, "body", &errs)
	return errs
}

func (iv *InputValidator) validateJSONValue(value interface{}, path string, errs *[]ValidationError) {
	switch v := value.(type) {
	case string:
		if fieldErrs := iv.validateString(v, path); len(fieldErrs) > 0 {
			*errs = append(*errs, fieldErrs...)
		}
	case map[string]interface{}:
		for key, val := range v {
			iv.validateJSONValue(val, path+"."+key, errs)
		}
	case []interface{}:
		for i, val := range v {
			iv.validateJSONValue(val, fmt.Sprintf("%s[%d]", path, i), errs)
		}
	}
}

func (iv *InputValidator) validateString(s string, field string) []ValidationError {
	var errs []ValidationError

	// Check length
	if len(s) > iv.maxFieldLength {
		errs = append(errs, ValidationError{
			Field:   field,
			Message: "Field exceeds maximum length",
			Code:    "FIELD_TOO_LONG",
		})
	}

	// Check blocked patterns
	for _, pattern := range iv.blockedPatterns {
		if pattern.MatchString(s) {
			errs = append(errs, ValidationError{
				Field:   field,
				Message: "Potentially malicious content detected",
				Code:    "BLOCKED_PATTERN",
			})
			break // One match is enough
		}
	}

	return errs
}

// SanitizeString removes potentially dangerous characters from a string
func SanitizeString(s string) string {
	// Remove null bytes
	s = strings.ReplaceAll(s, "\x00", "")
	// Trim whitespace
	s = strings.TrimSpace(s)
	return s
}

// SanitizeEmail validates and sanitizes an email address
func SanitizeEmail(email string) (string, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	if !emailRegex.MatchString(email) {
		return "", fmt.Errorf("invalid email format")
	}
	return email, nil
}

// ValidateOrderRequest validates trading order parameters
func ValidateOrderRequest(symbol, side, orderType string, quantity, price float64) []ValidationError {
	var errs []ValidationError

	// Symbol validation
	symbolRegex := regexp.MustCompile(`^[A-Z0-9_/]{1,20}$`)
	if !symbolRegex.MatchString(symbol) {
		errs = append(errs, ValidationError{Field: "symbol", Message: "Invalid symbol format", Code: "INVALID_SYMBOL"})
	}

	// Side validation
	if side != "buy" && side != "sell" {
		errs = append(errs, ValidationError{Field: "side", Message: "Side must be 'buy' or 'sell'", Code: "INVALID_SIDE"})
	}

	// Order type validation
	validTypes := map[string]bool{"market": true, "limit": true, "stop": true, "stop_limit": true, "iceberg": true, "twap": true, "vwap": true}
	if !validTypes[orderType] {
		errs = append(errs, ValidationError{Field: "type", Message: "Invalid order type", Code: "INVALID_ORDER_TYPE"})
	}

	// Quantity validation
	if quantity <= 0 || quantity > 1e9 {
		errs = append(errs, ValidationError{Field: "quantity", Message: "Quantity must be between 0 and 1 billion", Code: "INVALID_QUANTITY"})
	}

	// Price validation (0 allowed for market orders)
	if price < 0 || price > 1e12 {
		errs = append(errs, ValidationError{Field: "price", Message: "Price must be between 0 and 1 trillion", Code: "INVALID_PRICE"})
	}

	return errs
}

func isAllowedContentType(ct string) bool {
	allowed := []string{
		"application/json",
		"multipart/form-data",
		"application/x-www-form-urlencoded",
		"application/octet-stream",
	}
	ct = strings.ToLower(ct)
	for _, a := range allowed {
		if strings.Contains(ct, a) {
			return true
		}
	}
	return false
}
