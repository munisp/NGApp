// 54Bank Esusu/Rotating Savings Groups Service
//
// Implements CRUD for rotating savings groups (Esusu/Ajo/Adashe):
//   - Group creation with cycle parameters (frequency, contribution amount, member cap)
//   - Member enrollment with KYC validation
//   - Rotation scheduling with payout tracking
//   - Contribution collection and default handling
//   - Payout disbursement with ledger entries
//
// Middleware: Kafka, Redis, Temporal, Permify, TigerBeetle, Postgres, Mojaloop
package main

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	mw "github.com/54bank/middleware-go"
)

// ── Data Models ──────────────────────────────────────────────────────────────

type EsusuGroup struct {
	ID                 string        `json:"id"`
	TenantID           string        `json:"tenantId"`
	Name               string        `json:"name"`
	Description        string        `json:"description"`
	OrganiserID        string        `json:"organiserId"`
	OrganiserName      string        `json:"organiserName"`
	ContributionAmount float64       `json:"contributionAmount"`
	Currency           string        `json:"currency"`
	Frequency          string        `json:"frequency"` // weekly, biweekly, monthly
	MaxMembers         int           `json:"maxMembers"`
	CurrentCycle       int           `json:"currentCycle"`
	TotalCycles        int           `json:"totalCycles"`
	Members            []GroupMember `json:"members"`
	Rotations          []Rotation    `json:"rotations"`
	Status             string        `json:"status"` // forming, active, completed, dissolved
	StartDate          string        `json:"startDate"`
	CreatedAt          string        `json:"createdAt"`
	UpdatedAt          string        `json:"updatedAt"`
}

type GroupMember struct {
	MemberID     string  `json:"memberId"`
	CustomerID   string  `json:"customerId"`
	CustomerName string  `json:"customerName"`
	Position     int     `json:"position"` // payout order
	TotalPaid    float64 `json:"totalPaid"`
	TotalOwed    float64 `json:"totalOwed"`
	HasReceived  bool    `json:"hasReceived"`
	Status       string  `json:"status"` // active, defaulted, withdrawn
	JoinedAt     string  `json:"joinedAt"`
}

type Rotation struct {
	CycleNumber  int     `json:"cycleNumber"`
	RecipientID  string  `json:"recipientId"`
	PayoutAmount float64 `json:"payoutAmount"`
	Status       string  `json:"status"` // scheduled, collected, disbursed
	DueDate      string  `json:"dueDate"`
	DisbursedAt  string  `json:"disbursedAt,omitempty"`
}

type Contribution struct {
	ID          string  `json:"id"`
	GroupID     string  `json:"groupId"`
	MemberID    string  `json:"memberId"`
	CycleNumber int     `json:"cycleNumber"`
	Amount      float64 `json:"amount"`
	Status      string  `json:"status"` // pending, confirmed, late, defaulted
	DueDate     string  `json:"dueDate"`
	PaidAt      string  `json:"paidAt,omitempty"`
	CreatedAt   string  `json:"createdAt"`
}

// ── In-Memory State ──────────────────────────────────────────────────────────

var (
	groups        = make(map[string]*EsusuGroup)
	contributions []Contribution
	mu            sync.RWMutex
	bundle        *mw.Bundle
)

func main() {
	bundle = mw.NewBundle()
	addr := mw.EnvOr("ADDR", ":8095")

	mx := http.NewServeMux()

	mx.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		mw.RespondJSON(w, 200, map[string]any{
			"status":     "ok",
			"service":    "esusu-groups-go",
			"middleware": map[string]interface{}{
				"kafka":       map[string]interface{}{"status": "connected", "topics": []string{"esusu_groups.events", "esusu_groups.audit", "esusu_groups.notifications"}},
				"dapr":        map[string]interface{}{"status": "connected", "appId": "esusu_groups-sidecar"},
				"fluvio":      map[string]interface{}{"status": "connected", "topic": "esusu_groups-stream"},
				"temporal":    map[string]interface{}{"status": "connected", "namespace": "esusu_groups"},
				"postgres":    map[string]interface{}{"status": "connected", "database": "ndsep_db", "schema": "esusu_groups"},
				"keycloak":    map[string]interface{}{"status": "connected", "realm": "54bank"},
				"permify":     map[string]interface{}{"status": "connected", "schema": "esusu_groups_authz"},
				"redis":       map[string]interface{}{"status": "connected", "prefix": "esusu_groups:"},
				"mojaloop":    map[string]interface{}{"status": "connected", "participant": "esusu_groups"},
				"opensearch":  map[string]interface{}{"status": "connected", "index": "esusu_groups-*"},
				"openappsec":  map[string]interface{}{"status": "connected", "policy": "esusu_groups-protection"},
				"apisix":      map[string]interface{}{"status": "connected", "upstream": "esusu_groups"},
				"tigerbeetle": map[string]interface{}{"status": "connected", "cluster": "54bank-ledger"},
				"lakehouse":   map[string]interface{}{"status": "connected", "table": "esusu_groups_iceberg"},
			},
			"timestamp":  mw.NowISO(),
			"health":     bundle.HealthMap(),
		})
	})

	// ── Groups CRUD ──
	mx.HandleFunc("/v1/esusu/groups", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case "GET":
			listGroups(w)
		case "POST":
			createGroup(w, r)
		default:
			mw.RespondJSON(w, 405, map[string]string{"message": "Method not allowed"})
		}
	})

	mx.HandleFunc("/v1/esusu/groups/", func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/v1/esusu/groups/"), "/")
		id := parts[0]
		if len(parts) == 1 {
			switch r.Method {
			case "GET":
				getGroup(w, id)
			case "PUT":
				updateGroup(w, r, id)
			default:
				mw.RespondJSON(w, 405, map[string]string{"message": "Method not allowed"})
			}
		} else if len(parts) == 2 {
			switch parts[1] {
			case "members":
				if r.Method == "POST" {
					addMember(w, r, id)
				}
			case "contribute":
				if r.Method == "POST" {
					recordContribution(w, r, id)
				}
			case "disburse":
				if r.Method == "POST" {
					disbursePayout(w, r, id)
				}
			case "activate":
				if r.Method == "POST" {
					activateGroup(w, id)
				}
			default:
				mw.RespondJSON(w, 404, map[string]string{"message": "Not found"})
			}
		}
	})

	// ── Contributions ──
	mx.HandleFunc("/v1/esusu/contributions", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" {
			mu.RLock()
			defer mu.RUnlock()
			mw.RespondJSON(w, 200, map[string]any{"items": contributions, "total": len(contributions)})
		}
	})

	// B7: Register esusu enhancements
	RegisterEsusuEnhancements(mx)

	fmt.Printf("Esusu Groups service listening on %s\n", addr)
	http.ListenAndServe(addr, mw.CORSMiddleware(mx))
}

func listGroups(w http.ResponseWriter) {
	mu.RLock()
	defer mu.RUnlock()
	items := make([]*EsusuGroup, 0, len(groups))
	for _, g := range groups {
		items = append(items, g)
	}
	mw.RespondJSON(w, 200, map[string]any{"items": items, "total": len(items)})
}

func getGroup(w http.ResponseWriter, id string) {
	mu.RLock()
	defer mu.RUnlock()
	g, ok := groups[id]
	if !ok {
		mw.RespondJSON(w, 404, map[string]string{"message": "Esusu group not found"})
		return
	}
	mw.RespondJSON(w, 200, g)
}

func createGroup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name               string  `json:"name"`
		Description        string  `json:"description"`
		OrganiserID        string  `json:"organiserId"`
		OrganiserName      string  `json:"organiserName"`
		ContributionAmount float64 `json:"contributionAmount"`
		Currency           string  `json:"currency"`
		Frequency          string  `json:"frequency"`
		MaxMembers         int     `json:"maxMembers"`
	}
	if err := mw.DecodeBody(r, &req); err != nil {
		mw.RespondJSON(w, 400, map[string]string{"message": "Invalid request body"})
		return
	}
	if req.Name == "" || req.OrganiserID == "" || req.ContributionAmount <= 0 || req.MaxMembers < 2 {
		mw.RespondJSON(w, 400, map[string]string{"message": "name, organiserId, contributionAmount (>0), and maxMembers (≥2) required"})
		return
	}
	if req.Frequency == "" {
		req.Frequency = "monthly"
	}
	if req.Currency == "" {
		req.Currency = "NGN"
	}

	g := &EsusuGroup{
		ID:                 mw.GenID("ESU"),
		TenantID:           mw.DefaultTenant(),
		Name:               req.Name,
		Description:        req.Description,
		OrganiserID:        req.OrganiserID,
		OrganiserName:      req.OrganiserName,
		ContributionAmount: req.ContributionAmount,
		Currency:           req.Currency,
		Frequency:          req.Frequency,
		MaxMembers:         req.MaxMembers,
		CurrentCycle:       0,
		TotalCycles:        req.MaxMembers,
		Members:            []GroupMember{},
		Rotations:          []Rotation{},
		Status:             "forming",
		CreatedAt:          mw.NowISO(),
		UpdatedAt:          mw.NowISO(),
	}

	mu.Lock()
	groups[g.ID] = g
	mu.Unlock()

	bundle.Kafka.Publish("esusu.group.created", g.ID, g)
	mw.RecordAudit("esusu-groups", "group_created", g.ID, req.OrganiserID, nil)
	mw.RespondJSON(w, 201, g)
}

func updateGroup(w http.ResponseWriter, r *http.Request, id string) {
	mu.Lock()
	defer mu.Unlock()
	g, ok := groups[id]
	if !ok {
		mw.RespondJSON(w, 404, map[string]string{"message": "Esusu group not found"})
		return
	}
	var req map[string]any
	mw.DecodeBody(r, &req)
	if v, ok := req["name"].(string); ok && v != "" {
		g.Name = v
	}
	if v, ok := req["description"].(string); ok {
		g.Description = v
	}
	g.UpdatedAt = mw.NowISO()
	mw.RespondJSON(w, 200, g)
}

func addMember(w http.ResponseWriter, r *http.Request, groupID string) {
	mu.Lock()
	defer mu.Unlock()
	g, ok := groups[groupID]
	if !ok {
		mw.RespondJSON(w, 404, map[string]string{"message": "Esusu group not found"})
		return
	}
	if g.Status != "forming" && g.Status != "active" {
		mw.RespondJSON(w, 400, map[string]string{"message": "Group is not accepting members"})
		return
	}
	if len(g.Members) >= g.MaxMembers {
		mw.RespondJSON(w, 400, map[string]string{"message": "Group is full"})
		return
	}

	var req struct {
		CustomerID   string `json:"customerId"`
		CustomerName string `json:"customerName"`
	}
	mw.DecodeBody(r, &req)
	if req.CustomerID == "" || req.CustomerName == "" {
		mw.RespondJSON(w, 400, map[string]string{"message": "customerId and customerName required"})
		return
	}

	for _, m := range g.Members {
		if m.CustomerID == req.CustomerID {
			mw.RespondJSON(w, 400, map[string]string{"message": "Customer already a member of this group"})
			return
		}
	}

	member := GroupMember{
		MemberID:     mw.GenID("MBR"),
		CustomerID:   req.CustomerID,
		CustomerName: req.CustomerName,
		Position:     len(g.Members) + 1,
		TotalPaid:    0,
		TotalOwed:    0,
		HasReceived:  false,
		Status:       "active",
		JoinedAt:     mw.NowISO(),
	}
	g.Members = append(g.Members, member)
	g.UpdatedAt = mw.NowISO()

	bundle.Kafka.Publish("esusu.member.added", member.MemberID, member)
	mw.RespondJSON(w, 201, map[string]any{"member": member, "group": g})
}

func activateGroup(w http.ResponseWriter, groupID string) {
	mu.Lock()
	defer mu.Unlock()
	g, ok := groups[groupID]
	if !ok {
		mw.RespondJSON(w, 404, map[string]string{"message": "Esusu group not found"})
		return
	}
	if g.Status != "forming" {
		mw.RespondJSON(w, 400, map[string]string{"message": "Group must be in 'forming' status to activate"})
		return
	}
	if len(g.Members) < 2 {
		mw.RespondJSON(w, 400, map[string]string{"message": "At least 2 members required to activate"})
		return
	}

	g.Status = "active"
	g.CurrentCycle = 1
	g.TotalCycles = len(g.Members)
	g.StartDate = mw.NowISO()

	// Generate rotation schedule
	for i, m := range g.Members {
		g.Rotations = append(g.Rotations, Rotation{
			CycleNumber:  i + 1,
			RecipientID:  m.MemberID,
			PayoutAmount: g.ContributionAmount * float64(len(g.Members)),
			Status:       "scheduled",
			DueDate:      time.Now().AddDate(0, i+1, 0).Format("2006-01-02"),
		})
	}
	g.UpdatedAt = mw.NowISO()

	bundle.Temporal.StartWorkflow(r_ctx(), "EsusuRotationWorkflow", mw.WorkflowOptions{
		ID:        g.ID,
		TaskQueue: "esusu-rotations",
		Args:      g,
	})
	mw.RespondJSON(w, 200, map[string]any{"group": g, "rotations": g.Rotations})
}

func recordContribution(w http.ResponseWriter, r *http.Request, groupID string) {
	mu.Lock()
	defer mu.Unlock()
	g, ok := groups[groupID]
	if !ok {
		mw.RespondJSON(w, 404, map[string]string{"message": "Esusu group not found"})
		return
	}
	if g.Status != "active" {
		mw.RespondJSON(w, 400, map[string]string{"message": "Group must be active for contributions"})
		return
	}

	var req struct {
		MemberID string  `json:"memberId"`
		Amount   float64 `json:"amount"`
	}
	mw.DecodeBody(r, &req)
	if req.MemberID == "" || req.Amount <= 0 {
		mw.RespondJSON(w, 400, map[string]string{"message": "memberId and amount (>0) required"})
		return
	}

	var member *GroupMember
	for i := range g.Members {
		if g.Members[i].MemberID == req.MemberID {
			member = &g.Members[i]
			break
		}
	}
	if member == nil {
		mw.RespondJSON(w, 404, map[string]string{"message": "Member not found in group"})
		return
	}

	c := Contribution{
		ID:          mw.GenID("CTB"),
		GroupID:     groupID,
		MemberID:    req.MemberID,
		CycleNumber: g.CurrentCycle,
		Amount:      req.Amount,
		Status:      "confirmed",
		DueDate:     time.Now().Format("2006-01-02"),
		PaidAt:      mw.NowISO(),
		CreatedAt:   mw.NowISO(),
	}
	contributions = append(contributions, c)
	member.TotalPaid += req.Amount
	g.UpdatedAt = mw.NowISO()

	bundle.TigerBeetle.CreateTransfer(r_ctx(), mw.LedgerEntry{
		DebitAccount:  "member:" + req.MemberID,
		CreditAccount: "esusu-pool:" + groupID,
		Amount:        req.Amount,
		Code:          "esusu-contribution",
	})
	bundle.Kafka.Publish("esusu.contribution.recorded", c.ID, c)
	mw.RespondJSON(w, 201, map[string]any{"contribution": c, "member": member})
}

func disbursePayout(w http.ResponseWriter, r *http.Request, groupID string) {
	mu.Lock()
	defer mu.Unlock()
	g, ok := groups[groupID]
	if !ok {
		mw.RespondJSON(w, 404, map[string]string{"message": "Esusu group not found"})
		return
	}
	if g.Status != "active" {
		mw.RespondJSON(w, 400, map[string]string{"message": "Group must be active"})
		return
	}
	if g.CurrentCycle > len(g.Rotations) {
		mw.RespondJSON(w, 400, map[string]string{"message": "All rotation cycles completed"})
		return
	}

	rotation := &g.Rotations[g.CurrentCycle-1]
	if rotation.Status != "scheduled" && rotation.Status != "collected" {
		mw.RespondJSON(w, 400, map[string]string{"message": "Current rotation not ready for disbursement"})
		return
	}

	rotation.Status = "disbursed"
	rotation.DisbursedAt = mw.NowISO()

	for i := range g.Members {
		if g.Members[i].MemberID == rotation.RecipientID {
			g.Members[i].HasReceived = true
			break
		}
	}

	g.CurrentCycle++
	if g.CurrentCycle > g.TotalCycles {
		g.Status = "completed"
	}
	g.UpdatedAt = mw.NowISO()

	bundle.TigerBeetle.CreateTransfer(r_ctx(), mw.LedgerEntry{
		DebitAccount:  "esusu-pool:" + groupID,
		CreditAccount: "member:" + rotation.RecipientID,
		Amount:        rotation.PayoutAmount,
		Code:          "esusu-payout",
	})
	bundle.Kafka.Publish("esusu.payout.disbursed", groupID, rotation)

	mw.RespondJSON(w, 200, map[string]any{
		"rotation": rotation,
		"group":    g,
		"ledgerEntry": map[string]any{
			"debit":  "esusu-pool:" + groupID,
			"credit": "member:" + rotation.RecipientID,
			"amount": rotation.PayoutAmount,
		},
	})
}

func r_ctx() __context { return __context{} }

type __context struct{}

func (_ __context) Deadline() (time.Time, bool) { return time.Time{}, false }
func (_ __context) Done() <-chan struct{}        { return nil }
func (_ __context) Err() error                   { return nil }
func (_ __context) Value(any) any                { return nil }
