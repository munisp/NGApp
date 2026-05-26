package enhancements

import (
	"fmt"
	"net"
	"sync"
	"time"
)

// IPAllowlistEntry represents a whitelisted IP/CIDR for a participant
type IPAllowlistEntry struct {
	ID            string    `json:"id"`
	ParticipantID string    `json:"participantId"`
	CIDR          string    `json:"cidr"`
	Label         string    `json:"label"`
	AddedBy       string    `json:"addedBy"`
	AddedAt       time.Time `json:"addedAt"`
	LastUsed      time.Time `json:"lastUsed,omitempty"`
	HitCount      int64     `json:"hitCount"`
}

// IPAllowlistService manages per-participant IP restrictions
type IPAllowlistService struct {
	mu      sync.RWMutex
	entries map[string][]IPAllowlistEntry // participantID -> entries
	enabled map[string]bool              // participantID -> enforcement on/off
}

// NewIPAllowlistService creates a new IP allowlist manager
func NewIPAllowlistService() *IPAllowlistService {
	return &IPAllowlistService{
		entries: make(map[string][]IPAllowlistEntry),
		enabled: make(map[string]bool),
	}
}

// AddEntry adds an IP/CIDR to a participant's allowlist
func (s *IPAllowlistService) AddEntry(participantID, cidr, label, addedBy string) (*IPAllowlistEntry, error) {
	_, _, err := net.ParseCIDR(cidr)
	if err != nil {
		// Try as single IP
		ip := net.ParseIP(cidr)
		if ip == nil {
			return nil, fmt.Errorf("invalid IP or CIDR: %s", cidr)
		}
		if ip.To4() != nil {
			cidr = cidr + "/32"
		} else {
			cidr = cidr + "/128"
		}
	}

	entry := IPAllowlistEntry{
		ID:            fmt.Sprintf("IP-%s-%d", participantID, time.Now().UnixMilli()),
		ParticipantID: participantID,
		CIDR:          cidr,
		Label:         label,
		AddedBy:       addedBy,
		AddedAt:       time.Now(),
	}

	s.mu.Lock()
	s.entries[participantID] = append(s.entries[participantID], entry)
	s.mu.Unlock()

	return &entry, nil
}

// RemoveEntry removes an IP entry by ID
func (s *IPAllowlistService) RemoveEntry(participantID, entryID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	entries := s.entries[participantID]
	for i, e := range entries {
		if e.ID == entryID {
			s.entries[participantID] = append(entries[:i], entries[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("entry %s not found for participant %s", entryID, participantID)
}

// CheckIP verifies if an IP is allowed for a participant
func (s *IPAllowlistService) CheckIP(participantID, ipStr string) (bool, string) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// If enforcement not enabled, allow all
	if !s.enabled[participantID] {
		return true, "enforcement_disabled"
	}

	entries := s.entries[participantID]
	if len(entries) == 0 {
		return true, "no_rules" // no rules means allow all
	}

	ip := net.ParseIP(ipStr)
	if ip == nil {
		return false, "invalid_ip"
	}

	for i := range entries {
		_, cidrNet, err := net.ParseCIDR(entries[i].CIDR)
		if err != nil {
			continue
		}
		if cidrNet.Contains(ip) {
			entries[i].HitCount++
			entries[i].LastUsed = time.Now()
			return true, entries[i].Label
		}
	}

	return false, "not_in_allowlist"
}

// SetEnforcement enables/disables IP allowlist enforcement for a participant
func (s *IPAllowlistService) SetEnforcement(participantID string, enabled bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.enabled[participantID] = enabled
}

// GetEntries returns all allowlist entries for a participant
func (s *IPAllowlistService) GetEntries(participantID string) []IPAllowlistEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.entries[participantID]
}

// IsEnforced returns whether enforcement is on for a participant
func (s *IPAllowlistService) IsEnforced(participantID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.enabled[participantID]
}
