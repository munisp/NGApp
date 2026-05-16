package wazuh

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	baseURL  string
	token    string
	http     *http.Client
	username string
	password string
}

func New(baseURL, user, pass string) *Client {
	return &Client{
		baseURL:  baseURL,
		username: user,
		password: pass,
		http: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *Client) authenticate(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/security/user/authenticate", nil)
	if err != nil {
		return err
	}
	
	auth := base64.StdEncoding.EncodeToString([]byte(c.username + ":" + c.password))
	req.Header.Set("Authorization", "Basic "+auth)
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("authentication failed: %s", string(body))
	}
	
	var result struct {
		Data struct {
			Token string `json:"token"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return err
	}
	
	c.token = result.Data.Token
	return nil
}

func (c *Client) GetAlerts(ctx context.Context) ([]map[string]interface{}, error) {
	if c.token == "" {
		if err := c.authenticate(ctx); err != nil {
			return nil, fmt.Errorf("failed to authenticate: %w", err)
		}
	}
	
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/security_events", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode == http.StatusUnauthorized {
		if err := c.authenticate(ctx); err != nil {
			return nil, fmt.Errorf("re-authentication failed: %w", err)
		}
		return c.GetAlerts(ctx)
	}
	
	var result struct {
		Data struct {
			AffectedItems []map[string]interface{} `json:"affected_items"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result.Data.AffectedItems, nil
}

func (c *Client) CreateRule(ctx context.Context, ruleID int, description string) error {
	if c.token == "" {
		if err := c.authenticate(ctx); err != nil {
			return fmt.Errorf("failed to authenticate: %w", err)
		}
	}
	
	rule := map[string]interface{}{
		"rule_id":     ruleID,
		"description": description,
		"level":       5,
		"status":      "enabled",
		"groups":      []string{"custom_rules"},
	}
	
	body, err := json.Marshal(rule)
	if err != nil {
		return fmt.Errorf("failed to marshal rule: %w", err)
	}
	
	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/rules", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("failed to create rule: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode == http.StatusUnauthorized {
		if err := c.authenticate(ctx); err != nil {
			return fmt.Errorf("re-authentication failed: %w", err)
		}
		return c.CreateRule(ctx, ruleID, description)
	}
	
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to create rule, status %d: %s", resp.StatusCode, string(respBody))
	}
	
	return nil
}

func (c *Client) DeleteRule(ctx context.Context, ruleID int) error {
	if c.token == "" {
		if err := c.authenticate(ctx); err != nil {
			return fmt.Errorf("failed to authenticate: %w", err)
		}
	}
	
	req, err := http.NewRequestWithContext(ctx, "DELETE", fmt.Sprintf("%s/rules/%d", c.baseURL, ruleID), nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete rule: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to delete rule, status %d: %s", resp.StatusCode, string(respBody))
	}
	
	return nil
}

func (c *Client) GetAgents(ctx context.Context) ([]map[string]interface{}, error) {
	if c.token == "" {
		if err := c.authenticate(ctx); err != nil {
			return nil, fmt.Errorf("failed to authenticate: %w", err)
		}
	}
	
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/agents", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	var result struct {
		Data struct {
			AffectedItems []map[string]interface{} `json:"affected_items"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result.Data.AffectedItems, nil
}
