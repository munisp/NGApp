// Package permify provides fine-grained authorization via Permify.
package permify

import (
"context"
"encoding/json"
"fmt"
"io"
"log"
"net/http"
"os"
"strings"
"time"
)

// Role constants
const (
RoleAdmin            = "admin"
RoleGovernmentStaff  = "government_staff"
RoleAuditor          = "auditor"
RoleOrgAdmin         = "org_admin"
RoleOrgUser          = "org_user"
RoleRegulator        = "regulator"
RoleLegalOfficer     = "legal_officer"
RoleFinanceOfficer   = "finance_officer"
RoleTechOfficer      = "tech_officer"
RoleDataProtection   = "data_protection_officer"
)

// Permission constants
const (
PermViewDashboard      = "dashboard:view"
PermManageOrgs         = "orgs:manage"
PermIssueViolations    = "violations:issue"
PermIssuePenalties     = "penalties:issue"
PermApprovePenalties   = "penalties:approve"
PermApproveTransfers   = "transfers:approve"
PermViewAuditLogs      = "audit:view"
PermManageRoles        = "roles:manage"
PermViewFinancials     = "financials:view"
PermManageFinancials   = "financials:manage"
PermViewNetworkData    = "network:view"
PermManageNetworkRules = "network:manage"
PermViewMLModels       = "ml:view"
PermManageMLModels     = "ml:manage"
PermViewCertificates   = "certificates:view"
PermIssueCertificates  = "certificates:issue"
PermSubmitPortal       = "portal:submit"
PermReviewPortal       = "portal:review"
PermViewReports        = "reports:view"
PermGenerateReports    = "reports:generate"
)

// RolePermissions maps roles to their allowed permissions
var RolePermissions = map[string][]string{
RoleAdmin:           {PermViewDashboard, PermManageOrgs, PermIssueViolations, PermIssuePenalties, PermApprovePenalties, PermApproveTransfers, PermViewAuditLogs, PermManageRoles, PermViewFinancials, PermManageFinancials, PermViewNetworkData, PermManageNetworkRules, PermViewMLModels, PermManageMLModels, PermViewCertificates, PermIssueCertificates, PermReviewPortal, PermViewReports, PermGenerateReports},
RoleGovernmentStaff: {PermViewDashboard, PermManageOrgs, PermIssueViolations, PermIssuePenalties, PermApproveTransfers, PermViewAuditLogs, PermViewFinancials, PermViewNetworkData, PermViewCertificates, PermIssueCertificates, PermReviewPortal, PermViewReports, PermGenerateReports},
RoleAuditor:         {PermViewDashboard, PermViewAuditLogs, PermViewFinancials, PermViewNetworkData, PermViewCertificates, PermViewReports, PermReviewPortal},
RoleOrgAdmin:        {PermViewDashboard, PermSubmitPortal, PermViewCertificates, PermViewReports},
RoleOrgUser:         {PermViewDashboard, PermSubmitPortal},
RoleRegulator:       {PermViewDashboard, PermViewAuditLogs, PermViewFinancials, PermViewReports, PermGenerateReports, PermApproveTransfers},
RoleLegalOfficer:    {PermViewDashboard, PermViewAuditLogs, PermViewFinancials, PermApprovePenalties, PermViewReports},
RoleFinanceOfficer:  {PermViewDashboard, PermViewFinancials, PermManageFinancials, PermViewReports},
RoleTechOfficer:     {PermViewDashboard, PermViewNetworkData, PermManageNetworkRules, PermViewMLModels, PermViewReports},
RoleDataProtection:  {PermViewDashboard, PermViewAuditLogs, PermApproveTransfers, PermViewCertificates, PermViewReports},
}

type CheckRequest struct {
SubjectType string `json:"subject_type"`
SubjectID   string `json:"subject_id"`
Permission  string `json:"permission"`
ResourceType string `json:"resource_type"`
ResourceID  string `json:"resource_id"`
}

type CheckResponse struct {
Allowed bool   `json:"allowed"`
Reason  string `json:"reason,omitempty"`
}

type Client struct {
baseURL    string
httpClient *http.Client
logger     *log.Logger
}

func New() *Client {
url := os.Getenv("PERMIFY_URL")
if url == "" {
url = "http://localhost:3476"
}
return &Client{
baseURL:    url,
httpClient: &http.Client{Timeout: 3 * time.Second},
logger:     log.New(os.Stdout, "[permify] ", log.LstdFlags),
}
}

func (c *Client) Check(ctx context.Context, req CheckRequest) (bool, error) {
body, _ := json.Marshal(req)
httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost,
fmt.Sprintf("%s/v1/permissions/check", c.baseURL),
strings.NewReader(string(body)))
if err != nil {
return c.localCheck(req), nil
}
httpReq.Header.Set("Content-Type", "application/json")
resp, err := c.httpClient.Do(httpReq)
if err != nil {
c.logger.Printf("Permify unavailable, using local RBAC: %v", err)
return c.localCheck(req), nil
}
defer resp.Body.Close()
respBody, _ := io.ReadAll(resp.Body)
var checkResp CheckResponse
if err := json.Unmarshal(respBody, &checkResp); err != nil {
return c.localCheck(req), nil
}
return checkResp.Allowed, nil
}

// localCheck falls back to the in-process RBAC table when Permify is offline
func (c *Client) localCheck(req CheckRequest) bool {
perms, ok := RolePermissions[req.SubjectType]
if !ok {
return false
}
for _, p := range perms {
if p == req.Permission {
return true
}
}
return false
}

func (c *Client) HasPermission(ctx context.Context, role, permission string) (bool, error) {
return c.Check(ctx, CheckRequest{
SubjectType:  role,
SubjectID:    "*",
Permission:   permission,
ResourceType: "platform",
ResourceID:   "ndsep",
})
}
