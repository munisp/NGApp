package whitelabel

import (
	"fmt"
	"sync"
	"time"
)

type TenantTier string

const (
	TierEnterprise TenantTier = "ENTERPRISE"
	TierStandard   TenantTier = "STANDARD"
	TierStartup    TenantTier = "STARTUP"
)

type Tenant struct {
	ID              string
	Name            string
	Domain          string
	Tier            TenantTier
	BrandConfig     BrandConfig
	FeeSchedule     FeeSchedule
	DataIsolation   DataIsolation
	ModulesEnabled  []string
	CreatedAt       time.Time
	Active          bool
}

type BrandConfig struct {
	PrimaryColor   string
	SecondaryColor string
	LogoURL        string
	FaviconURL     string
	AppName        string
	SupportEmail   string
	SupportPhone   string
	TermsURL       string
	PrivacyURL     string
}

type FeeSchedule struct {
	NIPFlat          float64 // per transaction
	NIPPercentage    float64 // of amount
	NIPCap           float64 // max fee
	NEFTFlat         float64
	RemittanceFlat   float64
	RemittancePct    float64
	RemittanceCap    float64
	MonthlyPlatform  float64
	SettlementFee    float64
}

type DataIsolation struct {
	Strategy       string // "schema", "database", "row_level"
	SchemaPrefix   string
	DatabaseName   string
	EncryptionKey  string
}

type WhiteLabelManager struct {
	mu      sync.RWMutex
	tenants map[string]*Tenant
}

func NewWhiteLabelManager() *WhiteLabelManager {
	m := &WhiteLabelManager{tenants: make(map[string]*Tenant)}
	m.initTenants()
	return m
}

func (m *WhiteLabelManager) initTenants() {
	m.tenants["platform-owner"] = &Tenant{
		ID: "platform-owner", Name: "NGPaySwitch (Platform)", Domain: "payswitch.ng",
		Tier: TierEnterprise, Active: true, CreatedAt: time.Now(),
		BrandConfig: BrandConfig{
			PrimaryColor: "#2563eb", SecondaryColor: "#1e40af",
			AppName: "NGPaySwitch", SupportEmail: "support@payswitch.ng",
		},
		FeeSchedule: FeeSchedule{NIPFlat: 10, NEFTFlat: 5, RemittancePct: 0.5, RemittanceCap: 5000},
		DataIsolation: DataIsolation{Strategy: "schema", SchemaPrefix: "platform"},
		ModulesEnabled: []string{"outbound", "inbound", "domestic", "trade", "card", "government", "openbanking"},
	}

	m.tenants["gtbank-whitelabel"] = &Tenant{
		ID: "gtbank-whitelabel", Name: "GTBank Pay", Domain: "pay.gtbank.com",
		Tier: TierEnterprise, Active: true, CreatedAt: time.Now(),
		BrandConfig: BrandConfig{
			PrimaryColor: "#FF6600", SecondaryColor: "#CC5200",
			AppName: "GTBank Pay", SupportEmail: "support@gtbank.com",
		},
		FeeSchedule: FeeSchedule{NIPFlat: 10, NEFTFlat: 7.5, RemittancePct: 0.35, RemittanceCap: 3500},
		DataIsolation: DataIsolation{Strategy: "schema", SchemaPrefix: "gtbank"},
		ModulesEnabled: []string{"domestic", "outbound", "inbound", "card"},
	}

	m.tenants["fintech-startup"] = &Tenant{
		ID: "fintech-startup", Name: "PayQuick", Domain: "app.payquick.ng",
		Tier: TierStartup, Active: true, CreatedAt: time.Now(),
		BrandConfig: BrandConfig{
			PrimaryColor: "#10B981", SecondaryColor: "#059669",
			AppName: "PayQuick", SupportEmail: "hello@payquick.ng",
		},
		FeeSchedule: FeeSchedule{NIPFlat: 15, NEFTFlat: 10, RemittancePct: 0.75, RemittanceCap: 7500, MonthlyPlatform: 500000},
		DataIsolation: DataIsolation{Strategy: "row_level", SchemaPrefix: "payquick"},
		ModulesEnabled: []string{"domestic", "outbound"},
	}
}

func (m *WhiteLabelManager) GetTenant(id string) (*Tenant, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	t, ok := m.tenants[id]
	if !ok {
		return nil, fmt.Errorf("tenant %s not found", id)
	}
	return t, nil
}

func (m *WhiteLabelManager) GetAllTenants() []*Tenant {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make([]*Tenant, 0, len(m.tenants))
	for _, t := range m.tenants {
		result = append(result, t)
	}
	return result
}

func (m *WhiteLabelManager) ResolveTenantByDomain(domain string) (*Tenant, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, t := range m.tenants {
		if t.Domain == domain {
			return t, nil
		}
	}
	return nil, fmt.Errorf("no tenant found for domain %s", domain)
}
