package apisix

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// Client provides a real APISIX Admin API client.
type Client struct {
	adminURL string
	apiKey   string
	http     *http.Client
}

// NewClient creates an APISIX client from environment.
func NewClient() *Client {
	return &Client{
		adminURL: envOr("APISIX_ADMIN_URL", "http://apisix:9180"),
		apiKey:   os.Getenv("APISIX_ADMIN_KEY"),
		http:     &http.Client{Timeout: 5 * time.Second},
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// HealthCheck verifies APISIX is reachable.
func (c *Client) HealthCheck(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.adminURL+"/apisix/admin/routes", nil)
	if err != nil {
		return err
	}
	c.setAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("apisix health: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("apisix unhealthy: status %d", resp.StatusCode)
	}
	return nil
}

func (c *Client) setAuth(req *http.Request) {
	if c.apiKey != "" {
		req.Header.Set("X-API-KEY", c.apiKey)
	}
}

// Route represents an APISIX route.
type Route struct {
	ID          string                 `json:"id"`
	URI         string                 `json:"uri"`
	Name        string                 `json:"name"`
	Methods     []string               `json:"methods"`
	UpstreamID  string                 `json:"upstream_id"`
	Plugins     map[string]interface{} `json:"plugins"`
	Status      int                    `json:"status"`
}

// ListRoutes returns all configured routes.
func (c *Client) ListRoutes(ctx context.Context) ([]Route, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.adminURL+"/apisix/admin/routes", nil)
	if err != nil {
		return nil, err
	}
	c.setAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result struct {
		List []struct {
			Value Route `json:"value"`
		} `json:"list"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	routes := make([]Route, len(result.List))
	for i, r := range result.List {
		routes[i] = r.Value
	}
	return routes, nil
}

// CreateRoute creates a route with rate limiting and authentication plugins.
func (c *Client) CreateRoute(ctx context.Context, route Route) error {
	body, _ := json.Marshal(route)
	url := fmt.Sprintf("%s/apisix/admin/routes/%s", c.adminURL, route.ID)
	req, err := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	c.setAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("create route: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		errBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("create route failed (%d): %s", resp.StatusCode, string(errBody))
	}
	return nil
}

// Upstream represents an APISIX upstream.
type Upstream struct {
	ID    string                 `json:"id"`
	Name  string                 `json:"name"`
	Type  string                 `json:"type"` // roundrobin, chash, ewma
	Nodes map[string]int         `json:"nodes"`
	Checks map[string]interface{} `json:"checks,omitempty"`
}

// ListUpstreams returns all configured upstreams.
func (c *Client) ListUpstreams(ctx context.Context) ([]Upstream, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.adminURL+"/apisix/admin/upstreams", nil)
	if err != nil {
		return nil, err
	}
	c.setAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result struct {
		List []struct {
			Value Upstream `json:"value"`
		} `json:"list"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	upstreams := make([]Upstream, len(result.List))
	for i, u := range result.List {
		upstreams[i] = u.Value
	}
	return upstreams, nil
}

// SSLCert represents an APISIX SSL certificate.
type SSLCert struct {
	ID     string   `json:"id"`
	SNIs   []string `json:"snis"`
	Status int      `json:"status"`
}

// ListSSLCerts returns configured SSL certificates.
func (c *Client) ListSSLCerts(ctx context.Context) ([]SSLCert, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.adminURL+"/apisix/admin/ssls", nil)
	if err != nil {
		return nil, err
	}
	c.setAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result struct {
		List []struct {
			Value SSLCert `json:"value"`
		} `json:"list"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	certs := make([]SSLCert, len(result.List))
	for i, s := range result.List {
		certs[i] = s.Value
	}
	return certs, nil
}

// PluginMetadata returns metadata for a specific plugin.
func (c *Client) PluginMetadata(ctx context.Context, pluginName string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/apisix/admin/plugin_metadata/%s", c.adminURL, pluginName)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	c.setAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}
