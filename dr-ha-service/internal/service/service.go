package service

import (
	"crypto/sha256"
	"dr-ha-service/internal/models"
	"dr-ha-service/internal/repository"
	"fmt"
	"math/rand"
	"time"
)

type DRService struct { repo *repository.DRRepository }
func NewDRService(repo *repository.DRRepository) *DRService { return &DRService{repo: repo} }

func (s *DRService) TriggerFailover(sourceID, targetID, reason string) (*models.FailoverEvent, error) {
	src, err := s.repo.GetNode(sourceID)
	if err != nil { return nil, fmt.Errorf("source node: %w", err) }
	tgt, err := s.repo.GetNode(targetID)
	if err != nil { return nil, fmt.Errorf("target node: %w", err) }
	if tgt.Status != "standby" && tgt.Status != "active" {
		return nil, fmt.Errorf("target node %s is not ready (status: %s)", targetID, tgt.Status)
	}

	now := time.Now()
	completed := now.Add(time.Duration(30+rand.Intn(120)) * time.Second)

	event := models.FailoverEvent{
		ID: fmt.Sprintf("FO-%d", time.Now().UnixNano()%10000000),
		SourceNode: src.Name, TargetNode: tgt.Name, Reason: reason,
		Status: "completed", Duration: completed.Sub(now).String(),
		DataLoss: false, RPOAchieved: "3 minutes", RTOAchieved: "12 minutes",
		InitiatedAt: now, CompletedAt: &completed,
	}
	s.repo.AddFailover(event)
	return &event, nil
}

func (s *DRService) CreateBackup(nodeID, backupType string) (*models.BackupRecord, error) {
	_, err := s.repo.GetNode(nodeID)
	if err != nil { return nil, err }

	hash := sha256.Sum256([]byte(fmt.Sprintf("%s-%s-%d", nodeID, backupType, time.Now().UnixNano())))

	backup := models.BackupRecord{
		ID: fmt.Sprintf("BKP-%d", time.Now().UnixNano()%10000000),
		NodeID: nodeID, Type: backupType,
		SizeMB: 500 + rand.Intn(5000), Status: "completed", Encrypted: true,
		Checksum: fmt.Sprintf("%x", hash[:16]),
		Location: fmt.Sprintf("s3://nginsure-backups/%s/%s", nodeID, time.Now().Format("2006/01/02")),
		RetainUntil: time.Now().AddDate(0, 3, 0), CreatedAt: time.Now(),
	}
	s.repo.AddBackup(backup)
	return &backup, nil
}

func (s *DRService) GetNodes() []models.ServiceNode { return s.repo.GetNodes() }
func (s *DRService) GetNode(id string) (*models.ServiceNode, error) { return s.repo.GetNode(id) }
func (s *DRService) GetFailovers() []models.FailoverEvent { return s.repo.GetFailovers() }
func (s *DRService) GetBackups(nodeID string) []models.BackupRecord { return s.repo.GetBackups(nodeID) }
func (s *DRService) GetPlans() []models.DRPlan { return s.repo.GetPlans() }
func (s *DRService) GetStats() map[string]interface{} { return s.repo.GetStats() }
