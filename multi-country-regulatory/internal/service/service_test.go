package service

import (
	"testing"
)

func TestNewService(t *testing.T) {
	svc := NewService(nil, nil)
	if svc == nil {
		t.Fatal("expected non-nil service")
	}
	if svc.Repo() != nil {
		t.Error("expected nil repo when created with nil")
	}
}
