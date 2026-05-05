package gamification

import (
	"context"
	"fmt"
	"log"
	"sort"
	"sync"
	"time"
)

// Level represents an agent's gamification tier
type Level string

const (
	LevelBronze   Level = "Bronze"
	LevelSilver   Level = "Silver"
	LevelGold     Level = "Gold"
	LevelPlatinum Level = "Platinum"
	LevelDiamond  Level = "Diamond"
)

// LevelThreshold maps levels to minimum point requirements
var LevelThreshold = map[Level]int{
	LevelDiamond:  10000,
	LevelPlatinum: 8000,
	LevelGold:     6000,
	LevelSilver:   3000,
	LevelBronze:   0,
}

// AgentProfile represents an agent's gamification profile
type AgentProfile struct {
	AgentID     string    `json:"agent_id"`
	Name        string    `json:"name"`
	Region      string    `json:"region"`
	Points      int       `json:"points"`
	Level       Level     `json:"level"`
	Streak      int       `json:"streak_days"`
	Signups     int       `json:"signups"`
	Conversions int       `json:"conversions"`
	Revenue     float64   `json:"revenue"`
	Badges      []string  `json:"badges"`
	Rank        int       `json:"rank"`
	RankChange  int       `json:"rank_change"`
	LastActive  time.Time `json:"last_active"`
}

// Achievement represents an earnable badge/achievement
type Achievement struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Points      int    `json:"points"`
	Earned      int    `json:"earned"`
	Total       int    `json:"total"`
}

// Incentive represents an active incentive program
type Incentive struct {
	Name      string `json:"name"`
	Threshold string `json:"threshold"`
	Reward    string `json:"reward"`
	Claimants int    `json:"claimants"`
	Status    string `json:"status"`
}

// PointEvent records a point-earning action
type PointEvent struct {
	AgentID   string    `json:"agent_id"`
	Action    string    `json:"action"`
	Points    int       `json:"points"`
	Timestamp time.Time `json:"timestamp"`
}

// GamificationEngine manages agent performance tracking and rewards
type GamificationEngine struct {
	mu           sync.RWMutex
	agents       map[string]*AgentProfile
	achievements []Achievement
	incentives   []Incentive
	events       []PointEvent
}

// NewGamificationEngine creates a new engine instance
func NewGamificationEngine() *GamificationEngine {
	return &GamificationEngine{
		agents:       make(map[string]*AgentProfile),
		achievements: defaultAchievements(),
		incentives:   defaultIncentives(),
		events:       make([]PointEvent, 0),
	}
}

func defaultAchievements() []Achievement {
	return []Achievement{
		{"ach-001", "First Sign-Up", "Register your first customer", 50, 1538, 1538},
		{"ach-002", "100 Conversions", "Convert 100 campaign leads", 500, 89, 1538},
		{"ach-003", "30-Day Streak", "Active every day for 30 days", 1000, 42, 1538},
		{"ach-004", "Revenue Champion", "Generate ₦5M+ in campaign revenue", 2000, 28, 1538},
		{"ach-005", "Regional Champion", "Top performer in your region for a month", 1500, 6, 1538},
		{"ach-006", "Campaign Star", "Achieve 50%+ conversion rate on a campaign", 750, 67, 1538},
		{"ach-007", "Speed Star", "Complete 10 sign-ups in a single day", 300, 124, 1538},
		{"ach-008", "Quality Champion", "Maintain 95%+ data quality score", 800, 156, 1538},
	}
}

func defaultIncentives() []Incentive {
	return []Incentive{
		{"Monthly Performance Bonus", "10,000+ points", "₦50,000 bonus", 3, "active"},
		{"Quarterly Top 5", "Top 5 agents", "New smartphone", 5, "active"},
		{"Consistency Award", "30-day streak", "₦20,000 + badge", 42, "active"},
		{"Revenue Milestone", "₦10M generated", "₦100,000 + trophy", 8, "active"},
		{"Referral Bonus", "5 agent referrals", "₦15,000 per referral", 23, "active"},
	}
}

// RegisterAgent registers a new agent in the gamification system
func (e *GamificationEngine) RegisterAgent(ctx context.Context, profile *AgentProfile) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if profile.AgentID == "" {
		profile.AgentID = fmt.Sprintf("AGT-%d", time.Now().UnixNano())
	}
	profile.Level = calculateLevel(profile.Points)
	profile.LastActive = time.Now()

	e.agents[profile.AgentID] = profile
	log.Printf("[Gamification] Registered agent %s: %s", profile.AgentID, profile.Name)
	return nil
}

// AwardPoints awards points to an agent for a specific action
func (e *GamificationEngine) AwardPoints(ctx context.Context, agentID, action string, points int) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	agent, exists := e.agents[agentID]
	if !exists {
		return fmt.Errorf("agent %s not found", agentID)
	}

	agent.Points += points
	agent.Level = calculateLevel(agent.Points)
	agent.LastActive = time.Now()

	event := PointEvent{
		AgentID:   agentID,
		Action:    action,
		Points:    points,
		Timestamp: time.Now(),
	}
	e.events = append(e.events, event)

	log.Printf("[Gamification] Awarded %d points to %s for %s (total: %d)", points, agent.Name, action, agent.Points)
	return nil
}

// RecordSignup records a campaign signup by an agent
func (e *GamificationEngine) RecordSignup(ctx context.Context, agentID string) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	agent, exists := e.agents[agentID]
	if !exists {
		return fmt.Errorf("agent %s not found", agentID)
	}

	agent.Signups++
	agent.Points += 10
	agent.Level = calculateLevel(agent.Points)
	agent.LastActive = time.Now()

	return nil
}

// RecordConversion records a campaign conversion
func (e *GamificationEngine) RecordConversion(ctx context.Context, agentID string, revenue float64) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	agent, exists := e.agents[agentID]
	if !exists {
		return fmt.Errorf("agent %s not found", agentID)
	}

	agent.Conversions++
	agent.Revenue += revenue
	agent.Points += 50
	agent.Level = calculateLevel(agent.Points)
	agent.LastActive = time.Now()

	return nil
}

// GetLeaderboard returns agents sorted by points
func (e *GamificationEngine) GetLeaderboard(ctx context.Context, limit int) []*AgentProfile {
	e.mu.RLock()
	defer e.mu.RUnlock()

	profiles := make([]*AgentProfile, 0, len(e.agents))
	for _, a := range e.agents {
		profiles = append(profiles, a)
	}

	sort.Slice(profiles, func(i, j int) bool {
		return profiles[i].Points > profiles[j].Points
	})

	for i := range profiles {
		profiles[i].Rank = i + 1
	}

	if limit > 0 && limit < len(profiles) {
		profiles = profiles[:limit]
	}

	return profiles
}

// GetAchievements returns all available achievements
func (e *GamificationEngine) GetAchievements() []Achievement {
	return e.achievements
}

// GetIncentives returns all active incentive programs
func (e *GamificationEngine) GetIncentives() []Incentive {
	return e.incentives
}

// GetAgentProfile returns a specific agent's profile
func (e *GamificationEngine) GetAgentProfile(ctx context.Context, agentID string) (*AgentProfile, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	agent, exists := e.agents[agentID]
	if !exists {
		return nil, fmt.Errorf("agent %s not found", agentID)
	}
	return agent, nil
}

func calculateLevel(points int) Level {
	switch {
	case points >= LevelThreshold[LevelDiamond]:
		return LevelDiamond
	case points >= LevelThreshold[LevelPlatinum]:
		return LevelPlatinum
	case points >= LevelThreshold[LevelGold]:
		return LevelGold
	case points >= LevelThreshold[LevelSilver]:
		return LevelSilver
	default:
		return LevelBronze
	}
}
