package repository

import (
	"sync"
	"takaful-products-suite/internal/models"
)

type Repository struct {
	mu          sync.RWMutex
	products    map[string]*models.TakafulProduct
	memberships map[string]*models.TakafulMembership
	pools       map[string]*models.TakafulPool
}

func NewRepository() *Repository {
	r := &Repository{
		products:    make(map[string]*models.TakafulProduct),
		memberships: make(map[string]*models.TakafulMembership),
		pools:       make(map[string]*models.TakafulPool),
	}
	r.seed()
	return r
}

func (r *Repository) seed() {
	products := []models.TakafulProduct{
		{ID: "TKF-001", Name: "Takaful Crop Insurance", Type: models.TakafulCropInsurance, Description: "Sharia-compliant mutual weather-index crop insurance — takaful structure for Muslim farming communities", ContributionNGN: 3500, CoverageNGN: 150000, SurplusSharingPct: 70, WakalaFeePct: 25, PoolID: "POOL-CROP", ShariaApproved: true, IsActive: true},
		{ID: "TKF-002", Name: "Takaful IBLT Livestock", Type: models.TakafulLivestockIBLT, Description: "NDVI-based livestock protection in Takaful wrapper — for Northern Nigeria pastoralists", ContributionNGN: 5000, CoverageNGN: 300000, SurplusSharingPct: 70, WakalaFeePct: 22, PoolID: "POOL-LIVESTOCK", ShariaApproved: true, IsActive: true},
		{ID: "TKF-003", Name: "Takaful Motor Third Party", Type: models.TakafulMotorTP, Description: "Compulsory third-party motor in Takaful structure — for Northern Nigeria market", ContributionNGN: 8000, CoverageNGN: 5000000, SurplusSharingPct: 60, WakalaFeePct: 30, PoolID: "POOL-MOTOR", ShariaApproved: true, IsActive: true},
		{ID: "TKF-004", Name: "Takaful Hospi-Cash", Type: models.TakafulHospiCash, Description: "Fixed daily benefit during hospitalisation from participants risk pool — surplus shared", ContributionNGN: 1500, CoverageNGN: 500000, SurplusSharingPct: 75, WakalaFeePct: 20, PoolID: "POOL-HEALTH", ShariaApproved: true, IsActive: true},
		{ID: "TKF-005", Name: "Takaful Education Savings", Type: models.TakafulEducation, Description: "Mudharabah-based investment + group Takaful coverage for children education", ContributionNGN: 5000, CoverageNGN: 2000000, SurplusSharingPct: 65, WakalaFeePct: 25, PoolID: "POOL-EDUCATION", ShariaApproved: true, IsActive: true},
		{ID: "TKF-006", Name: "Takaful Hajj & Umrah Travel", Type: models.TakafulHajjUmrah, Description: "Covers medical, trip cancellation, lost luggage for pilgrimage — Nigeria-to-Saudi corridor", ContributionNGN: 15000, CoverageNGN: 5000000, SurplusSharingPct: 60, WakalaFeePct: 28, PoolID: "POOL-HAJJ", ShariaApproved: true, IsActive: true},
	}
	for i := range products {
		r.products[products[i].ID] = &products[i]
	}
	pools := []models.TakafulPool{
		{ID: "POOL-CROP", Name: "Crop Takaful Pool", ProductType: "takaful_crop", TotalContributions: 45000000, TotalClaims: 12000000, Surplus: 33000000, MemberCount: 12857, WakalaFeeCollected: 11250000},
		{ID: "POOL-LIVESTOCK", Name: "Livestock Takaful Pool", ProductType: "takaful_livestock_iblt", TotalContributions: 28000000, TotalClaims: 8500000, Surplus: 19500000, MemberCount: 5600, WakalaFeeCollected: 6160000},
		{ID: "POOL-MOTOR", Name: "Motor Takaful Pool", ProductType: "takaful_motor_tp", TotalContributions: 65000000, TotalClaims: 35000000, Surplus: 30000000, MemberCount: 8125, WakalaFeeCollected: 19500000},
		{ID: "POOL-HEALTH", Name: "Health Takaful Pool", ProductType: "takaful_hospi_cash", TotalContributions: 18000000, TotalClaims: 5200000, Surplus: 12800000, MemberCount: 12000, WakalaFeeCollected: 3600000},
		{ID: "POOL-EDUCATION", Name: "Education Takaful Pool", ProductType: "takaful_education", TotalContributions: 35000000, TotalClaims: 2000000, Surplus: 33000000, MemberCount: 7000, WakalaFeeCollected: 8750000},
		{ID: "POOL-HAJJ", Name: "Hajj Takaful Pool", ProductType: "takaful_hajj_umrah", TotalContributions: 22000000, TotalClaims: 6800000, Surplus: 15200000, MemberCount: 1467, WakalaFeeCollected: 6160000},
	}
	for i := range pools {
		r.pools[pools[i].ID] = &pools[i]
	}
}

func (r *Repository) GetProducts() []models.TakafulProduct {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]models.TakafulProduct, 0, len(r.products))
	for _, p := range r.products {
		result = append(result, *p)
	}
	return result
}

func (r *Repository) GetProduct(id string) *models.TakafulProduct {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if p, ok := r.products[id]; ok {
		c := *p
		return &c
	}
	return nil
}

func (r *Repository) GetPools() []models.TakafulPool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]models.TakafulPool, 0, len(r.pools))
	for _, p := range r.pools {
		result = append(result, *p)
	}
	return result
}

func (r *Repository) GetPool(id string) *models.TakafulPool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if p, ok := r.pools[id]; ok {
		c := *p
		return &c
	}
	return nil
}

func (r *Repository) CreateMembership(m *models.TakafulMembership) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.memberships[m.ID] = m
	if pool, ok := r.pools[m.PoolID]; ok {
		pool.TotalContributions += m.ContributionPaid
		pool.MemberCount++
		pool.Surplus += m.ContributionPaid * 0.75
	}
}

func (r *Repository) GetMemberships() []models.TakafulMembership {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]models.TakafulMembership, 0, len(r.memberships))
	for _, m := range r.memberships {
		result = append(result, *m)
	}
	return result
}
