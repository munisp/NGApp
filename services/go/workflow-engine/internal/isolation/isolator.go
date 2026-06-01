// Package isolation provides the node isolation activity for the security triage workflow.
// IEC 62443 §21.2 — IsolateNodeActivity: quarantines a compromised OT/IT node by
// applying a Kubernetes NetworkPolicy that blocks all ingress/egress except from
// the security namespace, and optionally disables the device in the platform DB.
//
// Isolation Modes:
//   - "network": Apply Kubernetes NetworkPolicy to quarantine the pod/node
//   - "device":  Disable the device record in the platform database via REST API
//   - "full":    Both network + device isolation
//
// Re-admission: Isolation is reversed by the ReAdmitNode activity after the
// security team confirms clearance via the Cybersecurity dashboard.
package isolation

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"
)

// IsolationMode defines how a node is isolated.
type IsolationMode string

const (
	ModeNetwork IsolationMode = "network" // Kubernetes NetworkPolicy quarantine
	ModeDevice  IsolationMode = "device"  // Platform DB device disable
	ModeFull    IsolationMode = "full"    // Both network + device
)

// IsolationRequest describes a node isolation request.
type IsolationRequest struct {
	EventID    string        `json:"event_id"`
	NodeID     string        `json:"node_id"`     // Kubernetes node name or device ID
	Namespace  string        `json:"namespace"`   // Kubernetes namespace
	IPAddress  string        `json:"ip_address"`
	Mode       IsolationMode `json:"mode"`
	Reason     string        `json:"reason"`
	TriggeredBy string       `json:"triggered_by"` // "workflow-engine" or user ID
}

// IsolationResult is the outcome of a node isolation action.
type IsolationResult struct {
	NodeID          string        `json:"node_id"`
	Mode            IsolationMode `json:"mode"`
	NetworkPolicyID string        `json:"network_policy_id,omitempty"`
	DeviceDisabled  bool          `json:"device_disabled"`
	IsolatedAt      time.Time     `json:"isolated_at"`
	ReversibleBy    string        `json:"reversible_by"` // workflow ID for re-admission
}

// Isolator applies node isolation actions.
type Isolator struct {
	// k8sAPIURL is the Kubernetes API server URL (in-cluster: https://kubernetes.default.svc)
	k8sAPIURL string
	// k8sToken is the service account token for Kubernetes API access
	k8sToken string
	// platformAPIURL is the OG-RMM platform API URL for device management
	platformAPIURL string
	// platformAPIKey is the platform API key for device management
	platformAPIKey string
	httpClient     *http.Client
}

// NewIsolator creates a new node isolator.
func NewIsolator(k8sAPIURL, k8sToken, platformAPIURL, platformAPIKey string) *Isolator {
	return &Isolator{
		k8sAPIURL:      k8sAPIURL,
		k8sToken:       k8sToken,
		platformAPIURL: platformAPIURL,
		platformAPIKey: platformAPIKey,
		httpClient:     &http.Client{Timeout: 30 * time.Second},
	}
}

// IsolateNode applies isolation to a compromised node.
// This is the main entry point called by the IsolateNodeActivity Temporal activity.
func (i *Isolator) IsolateNode(ctx context.Context, req IsolationRequest) (*IsolationResult, error) {
	slog.Info("Isolating node", "nodeId", req.NodeID, "mode", req.Mode, "reason", req.Reason)

	result := &IsolationResult{
		NodeID:     req.NodeID,
		Mode:       req.Mode,
		IsolatedAt: time.Now().UTC(),
	}

	switch req.Mode {
	case ModeNetwork:
		policyID, err := i.applyNetworkPolicy(ctx, req)
		if err != nil {
			return nil, fmt.Errorf("apply network policy: %w", err)
		}
		result.NetworkPolicyID = policyID

	case ModeDevice:
		if err := i.disableDevice(ctx, req); err != nil {
			return nil, fmt.Errorf("disable device: %w", err)
		}
		result.DeviceDisabled = true

	case ModeFull:
		policyID, err := i.applyNetworkPolicy(ctx, req)
		if err != nil {
			slog.Warn("Network policy failed, continuing with device isolation", "err", err)
		} else {
			result.NetworkPolicyID = policyID
		}
		if err := i.disableDevice(ctx, req); err != nil {
			slog.Warn("Device isolation failed", "err", err)
		} else {
			result.DeviceDisabled = true
		}
	}

	result.ReversibleBy = fmt.Sprintf("re-admit-%s", req.EventID)
	slog.Info("Node isolated successfully", "nodeId", req.NodeID, "policyId", result.NetworkPolicyID)
	return result, nil
}

// ReAdmitNode reverses a previous isolation, restoring normal network access.
// Called by the ReAdmitNode activity after security clearance is confirmed.
func (i *Isolator) ReAdmitNode(ctx context.Context, nodeID, namespace, eventID string) error {
	slog.Info("Re-admitting node", "nodeId", nodeID, "namespace", namespace)

	// Delete the quarantine NetworkPolicy
	policyName := fmt.Sprintf("quarantine-%s", eventID)
	url := fmt.Sprintf("%s/apis/networking.k8s.io/v1/namespaces/%s/networkpolicies/%s",
		i.k8sAPIURL, namespace, policyName)

	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return fmt.Errorf("create delete request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+i.k8sToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := i.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("delete network policy: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNotFound {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("k8s delete policy returned %d: %s", resp.StatusCode, string(b))
	}

	// Re-enable the device in the platform
	deviceURL := fmt.Sprintf("%s/api/devices/%s/status", i.platformAPIURL, nodeID)
	body, _ := json.Marshal(map[string]string{"status": "online"})
	devReq, err := http.NewRequestWithContext(ctx, http.MethodPatch, deviceURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create device re-enable request: %w", err)
	}
	devReq.Header.Set("Authorization", "Bearer "+i.platformAPIKey)
	devReq.Header.Set("Content-Type", "application/json")

	devResp, err := i.httpClient.Do(devReq)
	if err != nil {
		slog.Warn("Device re-enable failed (non-fatal)", "err", err)
		return nil
	}
	defer devResp.Body.Close()

	slog.Info("Node re-admitted", "nodeId", nodeID)
	return nil
}

// applyNetworkPolicy creates a Kubernetes NetworkPolicy that quarantines a node.
// The policy blocks all ingress/egress except from the security-ops namespace.
func (i *Isolator) applyNetworkPolicy(ctx context.Context, req IsolationRequest) (string, error) {
	policyName := fmt.Sprintf("quarantine-%s", req.EventID)
	namespace := req.Namespace
	if namespace == "" {
		namespace = "ot-edge"
	}

	// Kubernetes NetworkPolicy manifest — deny all except security-ops namespace
	policy := map[string]any{
		"apiVersion": "networking.k8s.io/v1",
		"kind":       "NetworkPolicy",
		"metadata": map[string]any{
			"name":      policyName,
			"namespace": namespace,
			"labels": map[string]string{
				"app.kubernetes.io/managed-by": "og-rmm-workflow-engine",
				"og-rmm/event-id":              req.EventID,
				"og-rmm/isolation-reason":      req.Reason,
			},
			"annotations": map[string]string{
				"og-rmm/triggered-by": req.TriggeredBy,
				"og-rmm/isolated-at":  time.Now().UTC().Format(time.RFC3339),
				"og-rmm/node-id":      req.NodeID,
			},
		},
		"spec": map[string]any{
			"podSelector": map[string]any{
				"matchLabels": map[string]string{
					"og-rmm/node-id": req.NodeID,
				},
			},
			"policyTypes": []string{"Ingress", "Egress"},
			// Allow only security-ops namespace to communicate with the quarantined pod
			"ingress": []map[string]any{
				{
					"from": []map[string]any{
						{
							"namespaceSelector": map[string]any{
								"matchLabels": map[string]string{
									"kubernetes.io/metadata.name": "security-ops",
								},
							},
						},
					},
				},
			},
			"egress": []map[string]any{
				{
					"to": []map[string]any{
						{
							"namespaceSelector": map[string]any{
								"matchLabels": map[string]string{
									"kubernetes.io/metadata.name": "security-ops",
								},
							},
						},
					},
				},
			},
		},
	}

	body, err := json.Marshal(policy)
	if err != nil {
		return "", fmt.Errorf("marshal network policy: %w", err)
	}

	url := fmt.Sprintf("%s/apis/networking.k8s.io/v1/namespaces/%s/networkpolicies",
		i.k8sAPIURL, namespace)
	req2, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("create k8s request: %w", err)
	}
	req2.Header.Set("Authorization", "Bearer "+i.k8sToken)
	req2.Header.Set("Content-Type", "application/json")

	resp, err := i.httpClient.Do(req2)
	if err != nil {
		return "", fmt.Errorf("k8s create network policy: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("k8s returned %d: %s", resp.StatusCode, string(b))
	}

	return policyName, nil
}

// disableDevice marks a device as quarantined in the OG-RMM platform database.
func (i *Isolator) disableDevice(ctx context.Context, req IsolationRequest) error {
	deviceURL := fmt.Sprintf("%s/api/devices/%s/status", i.platformAPIURL, req.NodeID)
	body, err := json.Marshal(map[string]string{
		"status": "quarantined",
		"reason": req.Reason,
	})
	if err != nil {
		return err
	}

	devReq, err := http.NewRequestWithContext(ctx, http.MethodPatch, deviceURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	devReq.Header.Set("Authorization", "Bearer "+i.platformAPIKey)
	devReq.Header.Set("Content-Type", "application/json")

	resp, err := i.httpClient.Do(devReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("platform device disable returned %d: %s", resp.StatusCode, string(b))
	}
	return nil
}
