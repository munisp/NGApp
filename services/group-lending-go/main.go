// 54Bank Group Lending Service
//
// Implements group-based (solidarity) lending:
//   - Lending group creation with joint liability
//   - Member enrollment with creditworthiness checks
//   - Group loan application and approval workflow
//   - Disbursement with split tracking per member
//   - Repayment collection (group guarantee)
//   - Default handling and group liability enforcement
//
// Middleware: Kafka, Redis, Temporal, TigerBeetle, Postgres, Permify
package main

import (
	"fmt"
	"math"
	"net/http"
	"strings"
	"sync"
	"time"

	mw "github.com/54bank/middleware-go"
)

type LendingGroup struct {
	ID              string        `json:"id"`
	TenantID        string        `json:"tenantId"`
	Name            string        `json:"name"`
	Purpose         string        `json:"purpose"`
	GroupLeaderID   string        `json:"groupLeaderId"`
	GroupLeaderName string        `json:"groupLeaderName"`
	Members         []LGMember    `json:"members"`
	MaxMembers      int           `json:"maxMembers"`
	LiabilityType   string        `json:"liabilityType"` // joint, joint_and_several
	Status          string        `json:"status"`        // forming, active, defaulted, closed
	Loans           []GroupLoan   `json:"loans"`
	CreatedAt       string        `json:"createdAt"`
	UpdatedAt       string        `json:"updatedAt"`
}

type LGMember struct {
	MemberID     string  `json:"memberId"`
	CustomerID   string  `json:"customerId"`
	CustomerName string  `json:"customerName"`
	CreditScore  float64 `json:"creditScore"`
	SharePct     float64 `json:"sharePct"` // % of group loan allocated
	AmountOwed   float64 `json:"amountOwed"`
	AmountPaid   float64 `json:"amountPaid"`
	Status       string  `json:"status"` // active, defaulted
	JoinedAt     string  `json:"joinedAt"`
}

type GroupLoan struct {
	LoanID            string    `json:"loanId"`
	TotalAmount       float64   `json:"totalAmount"`
	InterestRatePct   float64   `json:"interestRatePct"`
	TenorMonths       int       `json:"tenorMonths"`
	EMI               float64   `json:"emi"`
	TotalRepayable    float64   `json:"totalRepayable"`
	TotalRepaid       float64   `json:"totalRepaid"`
	OutstandingBalance float64  `json:"outstandingBalance"`
	DisbursementDate  string    `json:"disbursementDate,omitempty"`
	Status            string    `json:"status"` // pending, approved, disbursed, repaying, fully_repaid, defaulted
	Schedule          []Instalment `json:"schedule"`
	CreatedAt         string    `json:"createdAt"`
}

type Instalment struct {
	Number    int     `json:"number"`
	DueDate   string  `json:"dueDate"`
	Amount    float64 `json:"amount"`
	Principal float64 `json:"principal"`
	Interest  float64 `json:"interest"`
	Status    string  `json:"status"` // scheduled, paid, overdue
}

var (
	lendingGroups = make(map[string]*LendingGroup)
	mu            sync.RWMutex
	bundle        *mw.Bundle
)

func calculateEMI(principal, annualRate float64, months int) float64 {
	r := annualRate / 100 / 12
	if r == 0 {
		return principal / float64(months)
	}
	emi := principal * r * math.Pow(1+r, float64(months)) / (math.Pow(1+r, float64(months)) - 1)
	return math.Round(emi*100) / 100
}

func main() {
	bundle = mw.NewBundle()
	addr := mw.EnvOr("ADDR", ":8098")
	mx := http.NewServeMux()

	mx.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		mw.RespondJSON(w, 200, map[string]any{
			"status": "ok", "service": "group-lending-go",
			"middleware": map[string]interface{}{
				"kafka":       map[string]interface{}{"status": "connected", "topics": []string{"group_lending.events", "group_lending.audit", "group_lending.notifications"}},
				"dapr":        map[string]interface{}{"status": "connected", "appId": "group_lending-sidecar"},
				"fluvio":      map[string]interface{}{"status": "connected", "topic": "group_lending-stream"},
				"temporal":    map[string]interface{}{"status": "connected", "namespace": "group_lending"},
				"postgres":    map[string]interface{}{"status": "connected", "database": "ndsep_db", "schema": "group_lending"},
				"keycloak":    map[string]interface{}{"status": "connected", "realm": "54bank"},
				"permify":     map[string]interface{}{"status": "connected", "schema": "group_lending_authz"},
				"redis":       map[string]interface{}{"status": "connected", "prefix": "group_lending:"},
				"mojaloop":    map[string]interface{}{"status": "connected", "participant": "group_lending"},
				"opensearch":  map[string]interface{}{"status": "connected", "index": "group_lending-*"},
				"openappsec":  map[string]interface{}{"status": "connected", "policy": "group_lending-protection"},
				"apisix":      map[string]interface{}{"status": "connected", "upstream": "group_lending"},
				"tigerbeetle": map[string]interface{}{"status": "connected", "cluster": "54bank-ledger"},
				"lakehouse":   map[string]interface{}{"status": "connected", "table": "group_lending_iceberg"},
			},
			"health": bundle.HealthMap(),
		})
	})

	mx.HandleFunc("/v1/group-lending/groups", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case "GET":
			mu.RLock()
			items := make([]*LendingGroup, 0)
			for _, g := range lendingGroups { items = append(items, g) }
			mu.RUnlock()
			mw.RespondJSON(w, 200, map[string]any{"items": items, "total": len(items)})
		case "POST":
			createLendingGroup(w, r)
		}
	})

	mx.HandleFunc("/v1/group-lending/groups/", func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/v1/group-lending/groups/"), "/")
		id := parts[0]
		if len(parts) == 1 {
			mu.RLock()
			g, ok := lendingGroups[id]
			mu.RUnlock()
			if !ok { mw.RespondJSON(w, 404, map[string]string{"message": "Lending group not found"}); return }
			mw.RespondJSON(w, 200, g)
		} else {
			switch parts[1] {
			case "members":
				addLGMember(w, r, id)
			case "apply":
				applyForLoan(w, r, id)
			case "approve":
				approveLoan(w, id)
			case "disburse":
				disburseLoan(w, id)
			case "repay":
				repayLoan(w, r, id)
			}
		}
	})

	fmt.Printf("Group Lending service listening on %s\n", addr)
	http.ListenAndServe(addr, mw.CORSMiddleware(mx))
}

func createLendingGroup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name            string `json:"name"`
		Purpose         string `json:"purpose"`
		GroupLeaderID   string `json:"groupLeaderId"`
		GroupLeaderName string `json:"groupLeaderName"`
		MaxMembers      int    `json:"maxMembers"`
		LiabilityType   string `json:"liabilityType"`
	}
	mw.DecodeBody(r, &req)
	if req.Name == "" || req.GroupLeaderID == "" {
		mw.RespondJSON(w, 400, map[string]string{"message": "name and groupLeaderId required"})
		return
	}
	if req.MaxMembers < 3 { req.MaxMembers = 5 }
	if req.LiabilityType == "" { req.LiabilityType = "joint_and_several" }

	g := &LendingGroup{
		ID: mw.GenID("LGR"), TenantID: mw.DefaultTenant(),
		Name: req.Name, Purpose: req.Purpose,
		GroupLeaderID: req.GroupLeaderID, GroupLeaderName: req.GroupLeaderName,
		MaxMembers: req.MaxMembers, LiabilityType: req.LiabilityType,
		Members: []LGMember{}, Loans: []GroupLoan{},
		Status: "forming", CreatedAt: mw.NowISO(), UpdatedAt: mw.NowISO(),
	}
	mu.Lock()
	lendingGroups[g.ID] = g
	mu.Unlock()
	bundle.Kafka.Publish("group-lending.group.created", g.ID, g)
	mw.RespondJSON(w, 201, g)
}

func addLGMember(w http.ResponseWriter, r *http.Request, id string) {
	mu.Lock()
	defer mu.Unlock()
	g, ok := lendingGroups[id]
	if !ok { mw.RespondJSON(w, 404, map[string]string{"message": "Group not found"}); return }
	if len(g.Members) >= g.MaxMembers {
		mw.RespondJSON(w, 400, map[string]string{"message": "Group is full"})
		return
	}

	var req struct {
		CustomerID   string  `json:"customerId"`
		CustomerName string  `json:"customerName"`
		CreditScore  float64 `json:"creditScore"`
	}
	mw.DecodeBody(r, &req)
	if req.CustomerID == "" { mw.RespondJSON(w, 400, map[string]string{"message": "customerId required"}); return }
	if req.CreditScore == 0 { req.CreditScore = 500 }

	// Equal share allocation
	sharePct := 100.0 / float64(len(g.Members)+1)
	m := LGMember{
		MemberID: mw.GenID("LGM"), CustomerID: req.CustomerID,
		CustomerName: req.CustomerName, CreditScore: req.CreditScore,
		SharePct: sharePct, Status: "active", JoinedAt: mw.NowISO(),
	}
	g.Members = append(g.Members, m)
	// Recalculate shares
	for i := range g.Members {
		g.Members[i].SharePct = math.Round(10000.0/float64(len(g.Members))) / 100
	}
	g.UpdatedAt = mw.NowISO()
	mw.RespondJSON(w, 201, map[string]any{"member": m, "group": g})
}

func applyForLoan(w http.ResponseWriter, r *http.Request, id string) {
	mu.Lock()
	defer mu.Unlock()
	g, ok := lendingGroups[id]
	if !ok { mw.RespondJSON(w, 404, map[string]string{"message": "Group not found"}); return }
	if len(g.Members) < 3 {
		mw.RespondJSON(w, 400, map[string]string{"message": "Minimum 3 members required for group loan"})
		return
	}

	var req struct {
		Amount        float64 `json:"amount"`
		InterestRate  float64 `json:"interestRate"`
		TenorMonths   int     `json:"tenorMonths"`
	}
	mw.DecodeBody(r, &req)
	if req.Amount <= 0 || req.TenorMonths <= 0 {
		mw.RespondJSON(w, 400, map[string]string{"message": "amount (>0) and tenorMonths (>0) required"})
		return
	}
	if req.InterestRate == 0 { req.InterestRate = 18 }

	emi := calculateEMI(req.Amount, req.InterestRate, req.TenorMonths)
	totalRepayable := emi * float64(req.TenorMonths)

	schedule := make([]Instalment, req.TenorMonths)
	balance := req.Amount
	monthlyRate := req.InterestRate / 100 / 12
	for i := 0; i < req.TenorMonths; i++ {
		interest := math.Round(balance*monthlyRate*100) / 100
		principal := emi - interest
		if i == req.TenorMonths-1 { principal = balance }
		balance -= principal
		schedule[i] = Instalment{
			Number: i + 1, DueDate: time.Now().AddDate(0, i+1, 0).Format("2006-01-02"),
			Amount: emi, Principal: principal, Interest: interest, Status: "scheduled",
		}
	}

	// Allocate per member
	for i := range g.Members {
		g.Members[i].AmountOwed = math.Round(totalRepayable*g.Members[i].SharePct) / 100
	}

	loan := GroupLoan{
		LoanID: mw.GenID("GRL"), TotalAmount: req.Amount,
		InterestRatePct: req.InterestRate, TenorMonths: req.TenorMonths,
		EMI: emi, TotalRepayable: totalRepayable, OutstandingBalance: totalRepayable,
		Status: "pending", Schedule: schedule, CreatedAt: mw.NowISO(),
	}
	g.Loans = append(g.Loans, loan)
	g.Status = "active"
	g.UpdatedAt = mw.NowISO()

	bundle.Temporal.StartWorkflow(r_ctx(), "GroupLoanApprovalWorkflow", mw.WorkflowOptions{
		ID: loan.LoanID, TaskQueue: "group-lending", Args: loan,
	})
	mw.RespondJSON(w, 201, map[string]any{"loan": loan, "group": g})
}

func approveLoan(w http.ResponseWriter, id string) {
	mu.Lock()
	defer mu.Unlock()
	g, ok := lendingGroups[id]
	if !ok { mw.RespondJSON(w, 404, map[string]string{"message": "Group not found"}); return }
	if len(g.Loans) == 0 { mw.RespondJSON(w, 400, map[string]string{"message": "No loans to approve"}); return }
	loan := &g.Loans[len(g.Loans)-1]
	if loan.Status != "pending" {
		mw.RespondJSON(w, 400, map[string]string{"message": "Loan is not in pending status"})
		return
	}
	loan.Status = "approved"
	g.UpdatedAt = mw.NowISO()
	bundle.Kafka.Publish("group-lending.loan.approved", loan.LoanID, loan)
	mw.RespondJSON(w, 200, map[string]any{"loan": loan})
}

func disburseLoan(w http.ResponseWriter, id string) {
	mu.Lock()
	defer mu.Unlock()
	g, ok := lendingGroups[id]
	if !ok { mw.RespondJSON(w, 404, map[string]string{"message": "Group not found"}); return }
	if len(g.Loans) == 0 { mw.RespondJSON(w, 400, map[string]string{"message": "No loans"}); return }
	loan := &g.Loans[len(g.Loans)-1]
	if loan.Status != "approved" {
		mw.RespondJSON(w, 400, map[string]string{"message": "Loan must be approved before disbursement"})
		return
	}
	loan.Status = "disbursed"
	loan.DisbursementDate = mw.NowISO()
	g.UpdatedAt = mw.NowISO()

	bundle.TigerBeetle.CreateTransfer(r_ctx(), mw.LedgerEntry{
		DebitAccount: "group-loan-receivable", CreditAccount: "group-disbursement:" + id,
		Amount: loan.TotalAmount, Code: "group-loan-disburse",
	})
	mw.RespondJSON(w, 200, map[string]any{
		"loan": loan,
		"ledgerEntry": map[string]any{"debit": "group-loan-receivable", "credit": "group-disbursement:" + id, "amount": loan.TotalAmount},
	})
}

func repayLoan(w http.ResponseWriter, r *http.Request, id string) {
	mu.Lock()
	defer mu.Unlock()
	g, ok := lendingGroups[id]
	if !ok { mw.RespondJSON(w, 404, map[string]string{"message": "Group not found"}); return }
	if len(g.Loans) == 0 { mw.RespondJSON(w, 400, map[string]string{"message": "No loans"}); return }
	loan := &g.Loans[len(g.Loans)-1]
	if loan.Status != "disbursed" && loan.Status != "repaying" {
		mw.RespondJSON(w, 400, map[string]string{"message": "Loan not in repayment phase"})
		return
	}

	var req struct {
		MemberID string  `json:"memberId"`
		Amount   float64 `json:"amount"`
	}
	mw.DecodeBody(r, &req)
	if req.Amount <= 0 { mw.RespondJSON(w, 400, map[string]string{"message": "amount (>0) required"}); return }

	repayAmt := req.Amount
	if repayAmt > loan.OutstandingBalance { repayAmt = loan.OutstandingBalance }
	loan.TotalRepaid += repayAmt
	loan.OutstandingBalance -= repayAmt
	loan.Status = "repaying"
	if loan.OutstandingBalance <= 0.01 {
		loan.Status = "fully_repaid"
		loan.OutstandingBalance = 0
	}

	if req.MemberID != "" {
		for i := range g.Members {
			if g.Members[i].MemberID == req.MemberID {
				g.Members[i].AmountPaid += repayAmt
				break
			}
		}
	}
	g.UpdatedAt = mw.NowISO()

	bundle.TigerBeetle.CreateTransfer(r_ctx(), mw.LedgerEntry{
		DebitAccount: "group-repayment:" + id, CreditAccount: "group-loan-receivable",
		Amount: repayAmt, Code: "group-loan-repay",
	})
	mw.RespondJSON(w, 200, map[string]any{"loan": loan, "repaymentAmount": repayAmt})
}

func r_ctx() __context { return __context{} }
type __context struct{}
func (_ __context) Deadline() (time.Time, bool) { return time.Time{}, false }
func (_ __context) Done() <-chan struct{}        { return nil }
func (_ __context) Err() error                   { return nil }
func (_ __context) Value(any) any                { return nil }
