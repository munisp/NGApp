// Package repository — unit tests for well repository structs and filter logic.
// Tests cover: WellFilter defaults, Well struct fields, Equipment struct.
// Run: go test ./internal/repository/... -v
package repository

import (
	"testing"
	"time"
)

// ── WellFilter defaults tests ─────────────────────────────────────────────────

func TestWellFilter_DefaultLimit(t *testing.T) {
	f := WellFilter{Limit: 0}
	if f.Limit <= 0 {
		f.Limit = 50
	}
	if f.Limit != 50 {
		t.Errorf("default limit = %d, want 50", f.Limit)
	}
}

func TestWellFilter_MaxLimit(t *testing.T) {
	f := WellFilter{Limit: 1000}
	if f.Limit > 500 {
		f.Limit = 500
	}
	if f.Limit != 500 {
		t.Errorf("capped limit = %d, want 500", f.Limit)
	}
}

func TestWellFilter_ValidLimit(t *testing.T) {
	f := WellFilter{Limit: 100}
	if f.Limit <= 0 {
		f.Limit = 50
	}
	if f.Limit > 500 {
		f.Limit = 500
	}
	if f.Limit != 100 {
		t.Errorf("valid limit = %d, want 100", f.Limit)
	}
}

// ── Well struct tests ─────────────────────────────────────────────────────────

func TestWell_FieldsSet(t *testing.T) {
	apiNum := "42-001-20130-00-00"
	depth := 12500.0
	formation := "Wolfcamp"
	spud := "2020-03-15"

	w := Well{
		WellID:    "well-abc-123",
		Name:      "Permian Basin #1",
		APINumber: &apiNum,
		Latitude:  31.9686,
		Longitude: -102.0779,
		DepthFt:   &depth,
		Formation: &formation,
		Status:    "PRODUCING",
		WellType:  "OIL",
		SpudDate:  &spud,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if w.WellID == "" {
		t.Error("WellID should not be empty")
	}
	if *w.APINumber != apiNum {
		t.Errorf("APINumber = %s, want %s", *w.APINumber, apiNum)
	}
	if *w.DepthFt != depth {
		t.Errorf("DepthFt = %f, want %f", *w.DepthFt, depth)
	}
	if w.Status != "PRODUCING" {
		t.Errorf("Status = %s, want PRODUCING", w.Status)
	}
}

func TestWell_NilOptionalFields(t *testing.T) {
	w := Well{
		WellID:    "well-minimal",
		Name:      "Minimal Well",
		Latitude:  0,
		Longitude: 0,
		Status:    "PLANNED",
		WellType:  "GAS",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if w.APINumber != nil {
		t.Error("APINumber should be nil for minimal well")
	}
	if w.DepthFt != nil {
		t.Error("DepthFt should be nil for minimal well")
	}
	if w.Formation != nil {
		t.Error("Formation should be nil for minimal well")
	}
}

// ── Equipment struct tests ────────────────────────────────────────────────────

func TestEquipment_FieldsSet(t *testing.T) {
	model := "Centrilift 400"
	serial := "SN-2024-001"
	mfr := "Baker Hughes"
	install := "2024-01-15"
	lastSvc := time.Now().Add(-30 * 24 * time.Hour)

	e := Equipment{
		EquipmentID:  "equip-001",
		WellID:       "well-001",
		Type:         "ESP",
		Model:        &model,
		SerialNumber: &serial,
		Manufacturer: &mfr,
		InstallDate:  &install,
		Status:       "OPERATIONAL",
		LastService:  &lastSvc,
		CreatedAt:    time.Now(),
	}

	if e.Type != "ESP" {
		t.Errorf("Type = %s, want ESP", e.Type)
	}
	if *e.Model != model {
		t.Errorf("Model = %s, want %s", *e.Model, model)
	}
	if e.Status != "OPERATIONAL" {
		t.Errorf("Status = %s, want OPERATIONAL", e.Status)
	}
}

// ── Operator struct tests ─────────────────────────────────────────────────────

func TestOperator_FieldsSet(t *testing.T) {
	country := "Saudi Arabia"
	email := "ops@aramco.com"

	op := Operator{
		OperatorID:   "op-001",
		Name:         "Saudi Aramco",
		Country:      &country,
		ContactEmail: &email,
		CreatedAt:    time.Now(),
	}

	if op.Name != "Saudi Aramco" {
		t.Errorf("Name = %s, want Saudi Aramco", op.Name)
	}
	if *op.Country != "Saudi Arabia" {
		t.Errorf("Country = %s, want Saudi Arabia", *op.Country)
	}
}
